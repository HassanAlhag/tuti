import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

// Force seed mode -- same convention as drivers.service.test.js.
process.env.NODE_ENV = "production";
process.env.MONGO_URI = "";

const {
  reportDeliveryFailure,
  retryFailedDelivery,
  reassignFailedDelivery,
  returnFailedDeliveryToSeller,
  recordDriverDelivery,
  __getSeedDriverForTests,
  __resetSeedDriversForTests,
  __resetSeedDeliveryAttemptsForTests,
  __getSeedDeliveryAttemptsForTests,
  __resetDriverShopAccessForTests,
  __grantActiveAccessForTests,
} = await import("./drivers.service.js");
const {
  getSeedOrders,
  __injectSeedOrderForTests,
  __resetSeedOrdersForTests,
} = await import("../orders/orders.service.js");
const { __resetNotificationsForTests } = await import("../notifications/notifications.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");
const { MAX_DELIVERY_ATTEMPTS } = await import("../../shared/deliveryFailurePolicy.js");

const DRIVER_ID = "drv-002";
const OTHER_DRIVER_ID = "drv-001";
const ORDER_ID = "ORD-DELIVERY-FAIL-001";
const SHOP_ID = "shop-rose-vault";
const OTHER_SHOP_ID = "shop-oud-lane";

const baseOrder = {
  orderId: ORDER_ID,
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, productId: "prf-002", price: 310, quantity: 1 }],
  subtotal: 310,
  platformFee: 40,
  vendorNet: 270,
  paymentMethod: "cod",
  paymentStatus: "COD pending",
  status: "Shipped",
  customerName: "Delivery Failure Customer",
  customerEmail: "delivery-failure-test@example.com",
  phone: "+971501234567",
  deliveryAddress: "Dubai Marina",
  statusHistory: [],
  driverAssignment: {
    id: "assign-001",
    driverId: DRIVER_ID,
    driverName: "Khalid Bin Hamdan",
    driverPhone: "+971 50 987 6543",
    assignedAt: "2026-06-01T09:00:00.000Z",
    pickedUpAt: "2026-06-01T09:30:00.000Z",
    deliveredAt: null,
    codCollected: false,
    codAmount: 310,
    note: "",
    status: "picked_up",
    attemptCount: 0,
    lastFailureReason: null,
    nextAction: null,
    retryScheduledAt: null,
  },
};

function resetAll() {
  __resetSeedOrdersForTests();
  __resetSeedDriversForTests();
  __resetSeedDeliveryAttemptsForTests();
  __resetDriverShopAccessForTests();
  __resetNotificationsForTests();
  seedRepository.__resetSellerTransactionsForTests();
}

function seedOrder(overrides = {}) {
  const order = structuredClone({
    ...baseOrder,
    ...overrides,
    driverAssignment: overrides.driverAssignment === null
      ? null
      : { ...baseOrder.driverAssignment, ...(overrides.driverAssignment || {}) },
  });
  __injectSeedOrderForTests(order);
  const driver = __getSeedDriverForTests(DRIVER_ID);
  driver.status = "on_delivery";
  const assignedDriverId = order.driverAssignment?.driverId || DRIVER_ID;
  const assignedShopId = order.shopIds?.[0] || SHOP_ID;
  __grantActiveAccessForTests(assignedDriverId, assignedShopId);
  __grantActiveAccessForTests(OTHER_DRIVER_ID, assignedShopId);
  return order;
}

function getOrder(orderId = ORDER_ID) {
  const order = getSeedOrders().find((item) => item.orderId === orderId);
  assert.ok(order, `Expected seed order ${orderId}`);
  return order;
}

function driverUser() {
  return { sub: "driver-user-002", role: "driver", name: "Khalid Bin Hamdan", driverId: DRIVER_ID };
}

function sellerUser() {
  return { sub: "seller-user-rose-vault", role: "seller", name: "Rose Vault Seller" };
}

function adminUser() {
  return { sub: "admin-user-001", role: "admin", name: "Ops Admin" };
}

beforeEach(resetAll);

// ── Authorization ────────────────────────────────────────────────────────

test("authorization: driver cannot report a failure for an order not assigned to them", async () => {
  seedOrder({ driverAssignment: { driverId: OTHER_DRIVER_ID } });
  await assert.rejects(
    () => reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser()),
    (err) => { assert.equal(err.status, 404); return true; }
  );
});

test("authorization: unknown reason code is rejected with 422", async () => {
  seedOrder();
  await assert.rejects(
    () => reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "NOT_A_REAL_REASON" }, driverUser()),
    (err) => { assert.equal(err.status, 422); return true; }
  );
});

test("authorization: seller cannot act on an order belonging to a different shop", async () => {
  seedOrder({ driverAssignment: { status: "delivery_failed", lastFailureReason: "CUSTOMER_UNREACHABLE", attemptCount: 1 } });
  await assert.rejects(
    () => retryFailedDelivery(OTHER_SHOP_ID, ORDER_ID, sellerUser()),
    (err) => { assert.equal(err.status, 404); return true; }
  );
});

// ── Reason-specific validation ───────────────────────────────────────────

test("reasons: note is required for CUSTOMER_REFUSED", async () => {
  seedOrder();
  await assert.rejects(
    () => reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_REFUSED" }, driverUser()),
    (err) => { assert.equal(err.status, 422); return true; }
  );
  const result = await reportDeliveryFailure(
    DRIVER_ID, ORDER_ID,
    { reason: "CUSTOMER_REFUSED", note: "Customer refused the package at the door." },
    driverUser()
  );
  assert.equal(result.attempt.reasonCode, "CUSTOMER_REFUSED");
  assert.equal(result.attempt.nextAction, "ADMIN_REVIEW");
});

test("reasons: evidence is required for ORDER_DAMAGED", async () => {
  seedOrder();
  await assert.rejects(
    () => reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "ORDER_DAMAGED", note: "Box was crushed." }, driverUser()),
    (err) => { assert.equal(err.status, 422); return true; }
  );
});

test("reasons: CUSTOMER_REQUESTED_RESCHEDULE requires a future requestedRetryAt", async () => {
  seedOrder();
  await assert.rejects(
    () => reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_REQUESTED_RESCHEDULE" }, driverUser()),
    (err) => { assert.equal(err.status, 422); return true; }
  );
  await assert.rejects(
    () => reportDeliveryFailure(
      DRIVER_ID, ORDER_ID,
      { reason: "CUSTOMER_REQUESTED_RESCHEDULE", requestedRetryAt: "2020-01-01T09:00:00.000Z" },
      driverUser()
    ),
    (err) => { assert.equal(err.status, 422); return true; }
  );
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const result = await reportDeliveryFailure(
    DRIVER_ID, ORDER_ID,
    { reason: "CUSTOMER_REQUESTED_RESCHEDULE", requestedRetryAt: future },
    driverUser()
  );
  assert.equal(result.order.driverAssignment.status, "rescheduled");
  assert.equal(result.attempt.nextAction, "RESCHEDULE");
});

test("reasons: attempt ceiling forces ADMIN_REVIEW/RETURN_TO_SELLER regardless of the reason's own default", async () => {
  seedOrder();
  // Drive through fail -> retry cycles up to the ceiling so attemptCount
  // and the actual DeliveryAttempt row count stay in sync, the way the
  // real fail/retry flow always keeps them.
  for (let i = 1; i < MAX_DELIVERY_ATTEMPTS; i++) {
    await reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser());
    await retryFailedDelivery(SHOP_ID, ORDER_ID, sellerUser());
  }
  const result = await reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser());
  assert.equal(result.attempt.attemptNumber, MAX_DELIVERY_ATTEMPTS);
  assert.equal(result.attempt.nextAction, "ADMIN_REVIEW");
});

// ── State machine / idempotency ──────────────────────────────────────────

test("state: failure cannot be reported once the order is Delivered", async () => {
  seedOrder({ status: "Delivered" });
  await assert.rejects(
    () => reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser()),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("state: failure cannot be reported once the assignment is already completed", async () => {
  seedOrder({ driverAssignment: { status: "completed", deliveredAt: "2026-06-01T10:00:00.000Z" } });
  await assert.rejects(
    () => reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser()),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("state: duplicate failure submission is an idempotent replay, not a new attempt", async () => {
  seedOrder();
  const first = await reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser());
  assert.equal(first.idempotentReplay, false);
  assert.equal(first.attempt.attemptNumber, 1);

  const second = await reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser());
  assert.equal(second.idempotentReplay, true);
  assert.equal(second.attempt.id, first.attempt.id);
  assert.equal(second.attempt.attemptNumber, 1);

  const attempts = __getSeedDeliveryAttemptsForTests(ORDER_ID);
  assert.equal(attempts.length, 1);
});

test("state: completion is blocked while the assignment is delivery_failed (no retry yet)", async () => {
  seedOrder({ driverAssignment: { status: "delivery_failed", lastFailureReason: "CUSTOMER_UNREACHABLE", attemptCount: 1 } });
  await assert.rejects(
    () => recordDriverDelivery(DRIVER_ID, ORDER_ID, { codCollected: true, codAmount: 310 }, driverUser()),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("state: retry moves the assignment back to accepted, then completion succeeds", async () => {
  seedOrder({ driverAssignment: { status: "delivery_failed", lastFailureReason: "CUSTOMER_UNREACHABLE", attemptCount: 1 } });

  const retried = await retryFailedDelivery(SHOP_ID, ORDER_ID, sellerUser());
  assert.equal(retried.driverAssignment.status, "accepted");
  assert.equal(retried.driverAssignment.nextAction, null);

  const delivered = await recordDriverDelivery(DRIVER_ID, ORDER_ID, { codCollected: true, codAmount: 310 }, driverUser());
  assert.equal(delivered.status, "Delivered");
  assert.equal(delivered.driverAssignment.status, "completed");
});

test("retry: blocked when the reason policy requires return-to-seller instead", async () => {
  seedOrder({ driverAssignment: { status: "delivery_failed", lastFailureReason: "ORDER_DAMAGED", attemptCount: 1 } });
  await assert.rejects(
    () => retryFailedDelivery(SHOP_ID, ORDER_ID, sellerUser()),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("retry: blocked once the attempt ceiling has been reached", async () => {
  seedOrder({ driverAssignment: { status: "delivery_failed", lastFailureReason: "CUSTOMER_UNREACHABLE", attemptCount: MAX_DELIVERY_ATTEMPTS } });
  await assert.rejects(
    () => retryFailedDelivery(SHOP_ID, ORDER_ID, sellerUser()),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("reassign: supersedes the old assignment into history and starts a fresh assignment", async () => {
  seedOrder({ driverAssignment: { status: "delivery_failed", lastFailureReason: "VEHICLE_BREAKDOWN", attemptCount: 1 } });

  // Admin scope: the fixture's drivers are global (shopId: null), not
  // shop-owned, so a seller-scoped reassignment target (which must belong
  // to the seller's own shop) wouldn't resolve them -- that restriction is
  // itself correct behavior, exercised separately by the "different shop"
  // authorization test above.
  const result = await reassignFailedDelivery(null, ORDER_ID, { driverId: OTHER_DRIVER_ID }, adminUser());
  assert.equal(result.driverAssignment.driverId, OTHER_DRIVER_ID);
  assert.equal(result.driverAssignment.attemptCount, 0);
  assert.equal(result.driverAssignment.status, "picked_up"); // order was already "Shipped" -- skips redundant re-pickup
  assert.equal(result.driverAssignmentHistory.length, 1);
  assert.equal(result.driverAssignmentHistory[0].driverId, DRIVER_ID);
  assert.ok(result.driverAssignmentHistory[0].supersededByAssignmentId);

  const oldDriver = __getSeedDriverForTests(DRIVER_ID);
  const newDriver = __getSeedDriverForTests(OTHER_DRIVER_ID);
  assert.equal(oldDriver.status, "active");
  assert.equal(newDriver.status, "on_delivery");
});

test("reassign: rejects selecting the same driver already assigned", async () => {
  seedOrder({ driverAssignment: { status: "delivery_failed", lastFailureReason: "VEHICLE_BREAKDOWN", attemptCount: 1 } });
  await assert.rejects(
    () => reassignFailedDelivery(SHOP_ID, ORDER_ID, { driverId: DRIVER_ID }, sellerUser()),
    (err) => { assert.equal(err.status, 422); return true; }
  );
});

test("return-to-seller: archives the assignment, clears it, and resets order to Ready for Delivery", async () => {
  seedOrder({ driverAssignment: { status: "delivery_failed", lastFailureReason: "ORDER_DAMAGED", attemptCount: 1 } });

  const result = await returnFailedDeliveryToSeller(SHOP_ID, ORDER_ID, sellerUser());
  assert.equal(result.status, "Ready for Delivery");
  assert.equal(result.driverAssignment, undefined);
  assert.equal(result.driverAssignmentHistory.length, 1);
  assert.equal(result.driverAssignmentHistory[0].status, "returned_to_seller");

  const driver = __getSeedDriverForTests(DRIVER_ID);
  assert.equal(driver.status, "active");
});

// ── COD safety ────────────────────────────────────────────────────────────

test("COD safety: failure cannot be reported once COD was already marked collected", async () => {
  seedOrder({ driverAssignment: { codCollected: true, codAmount: 310 } });
  await assert.rejects(
    () => reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser()),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("COD safety: a failed delivery never increases driver cash balance or marks the order Delivered", async () => {
  seedOrder();
  const driverBefore = structuredClone(__getSeedDriverForTests(DRIVER_ID));

  const result = await reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "CUSTOMER_UNREACHABLE" }, driverUser());
  assert.equal(result.order.status, "Shipped");
  assert.notEqual(result.order.paymentStatus, "COD collected");

  const driverAfter = __getSeedDriverForTests(DRIVER_ID);
  assert.equal(driverAfter.codBalance, driverBefore.codBalance);
  assert.equal(driverAfter.totalCodCollected, driverBefore.totalCodCollected);
  assert.equal(driverAfter.totalDeliveries, driverBefore.totalDeliveries);

  const order = getOrder();
  assert.equal(order.status, "Shipped");
  assert.equal(order.driverAssignment.deliveredAt, null);
});

test("COD safety: driver alone cannot force a return-to-seller/reassignment decision -- only the failure report + policy nextAction", async () => {
  seedOrder();
  const result = await reportDeliveryFailure(DRIVER_ID, ORDER_ID, { reason: "ORDER_DAMAGED", note: "Bottle shattered in transit.", evidenceMediaAssetIds: [] }, driverUser())
    .catch((err) => err);
  // Evidence is required for ORDER_DAMAGED -- the driver's report alone,
  // without evidence, cannot even reach a next-action decision.
  assert.equal(result.status, 422);
});
