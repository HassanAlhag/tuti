import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";

// Real HTTP round-trips through the actual driver + admin routers, mirroring
// the 5 manual E2E scenarios from the delivery-failed workflow spec:
//  1. unreachable -> retry -> complete
//  2. vehicle breakdown -> reassign
//  3. reschedule -> complete
//  4. damaged order blocks COD
//  5. max attempts reached
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "delivery-failure-e2e-test-secret-at-least-32-chars";

const { driverRouter, driversRouter } = await import("./drivers.routes.js");
const {
  __getSeedDriverForTests,
  __resetSeedDriversForTests,
  __resetSeedDeliveryAttemptsForTests,
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
const SHOP_ID = "shop-rose-vault";

const baseOrder = {
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, productId: "prf-002", price: 310, quantity: 1 }],
  subtotal: 310,
  platformFee: 40,
  vendorNet: 270,
  paymentMethod: "cod",
  paymentStatus: "COD pending",
  status: "Shipped",
  customerName: "E2E Customer",
  customerEmail: "e2e-delivery-failure@example.com",
  phone: "+971501234567",
  deliveryAddress: "Dubai Marina",
  statusHistory: [],
  driverAssignment: {
    id: "assign-e2e-01",
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

let server;
let baseUrl;

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function authHeaders(user) {
  return { Authorization: `Bearer ${tokenFor(user)}`, "Content-Type": "application/json" };
}

function driverUser() {
  return { sub: "driver-user-002", role: "driver", name: "Khalid Bin Hamdan", driverId: DRIVER_ID, shopId: SHOP_ID };
}

function adminUser() {
  return { sub: "admin-001", role: "admin", name: "Ops Admin" };
}

function seedOrder(orderId, overrides = {}) {
  const order = structuredClone({
    ...baseOrder,
    ...overrides,
    orderId,
    driverAssignment: { ...baseOrder.driverAssignment, ...(overrides.driverAssignment || {}) },
  });
  __injectSeedOrderForTests(order);
  const driver = __getSeedDriverForTests(DRIVER_ID);
  driver.status = "on_delivery";
  const assignedShopId = order.shopIds?.[0] || SHOP_ID;
  __grantActiveAccessForTests(DRIVER_ID, assignedShopId);
  __grantActiveAccessForTests(OTHER_DRIVER_ID, assignedShopId);
  return order;
}

function getOrder(orderId) {
  const order = getSeedOrders().find((item) => item.orderId === orderId);
  assert.ok(order, `Expected seed order ${orderId}`);
  return order;
}

async function post(path, user, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: authHeaders(user),
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

function resetAll() {
  __resetSeedOrdersForTests();
  __resetSeedDriversForTests();
  __resetSeedDeliveryAttemptsForTests();
  __resetDriverShopAccessForTests();
  __resetNotificationsForTests();
  seedRepository.__resetSellerTransactionsForTests();
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/driver", driverRouter);
  app.use("/api/drivers", driversRouter);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ error: error.message || "Unexpected server error." });
  });

  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

beforeEach(resetAll);

test("E2E 1: unreachable -> retry -> complete", async () => {
  const orderId = "ORD-E2E-UNREACHABLE";
  seedOrder(orderId);

  const failed = await post(`/api/driver/deliveries/${orderId}/fail`, driverUser(), { reason: "CUSTOMER_UNREACHABLE" });
  assert.equal(failed.response.status, 200);
  assert.equal(failed.payload.data.attempt.attemptNumber, 1);
  assert.equal(failed.payload.data.order.driverAssignment.status, "delivery_failed");

  const retried = await post(`/api/drivers/orders/${orderId}/delivery/retry`, adminUser(), {});
  assert.equal(retried.response.status, 200);
  assert.equal(retried.payload.data.driverAssignment.status, "accepted");

  const deliveredResponse = await fetch(`${baseUrl}/api/driver/deliveries/${orderId}/delivery`, {
    method: "PATCH",
    headers: authHeaders(driverUser()),
    body: JSON.stringify({ codCollected: true, codAmount: 310, note: "Delivered on retry.", proofOfDeliveryUrl: "https://cdn.tuti.test/proof/e2e-1.jpg" }),
  });
  const delivered = await deliveredResponse.json();
  assert.equal(deliveredResponse.status, 200);
  assert.equal(delivered.data.status, "Delivered");
  assert.equal(delivered.data.driverAssignment.codCollected, true);
});

test("E2E 2: vehicle breakdown -> reassign", async () => {
  const orderId = "ORD-E2E-BREAKDOWN";
  seedOrder(orderId);

  const failed = await post(`/api/driver/deliveries/${orderId}/fail`, driverUser(), { reason: "VEHICLE_BREAKDOWN" });
  assert.equal(failed.response.status, 200);
  assert.equal(failed.payload.data.attempt.nextAction, "REASSIGN_DRIVER");

  const reassigned = await post(`/api/drivers/orders/${orderId}/delivery/reassign`, adminUser(), { driverId: OTHER_DRIVER_ID });
  assert.equal(reassigned.response.status, 200);
  assert.equal(reassigned.payload.data.driverAssignment.driverId, OTHER_DRIVER_ID);
  assert.equal(reassigned.payload.data.driverAssignment.attemptCount, 0);
  assert.equal(reassigned.payload.data.driverAssignmentHistory.length, 1);
  assert.equal(reassigned.payload.data.driverAssignmentHistory[0].driverId, DRIVER_ID);
});

test("E2E 3: reschedule -> complete", async () => {
  const orderId = "ORD-E2E-RESCHEDULE";
  seedOrder(orderId);
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const failed = await post(`/api/driver/deliveries/${orderId}/fail`, driverUser(), {
    reason: "CUSTOMER_REQUESTED_RESCHEDULE",
    requestedRetryAt: future,
  });
  assert.equal(failed.response.status, 200);
  assert.equal(failed.payload.data.order.driverAssignment.status, "rescheduled");
  assert.equal(failed.payload.data.order.driverAssignment.retryScheduledAt !== null, true);

  const retried = await post(`/api/drivers/orders/${orderId}/delivery/retry`, adminUser(), {});
  assert.equal(retried.response.status, 200);
  assert.equal(retried.payload.data.driverAssignment.status, "accepted");

  const deliveredResponse = await fetch(`${baseUrl}/api/driver/deliveries/${orderId}/delivery`, {
    method: "PATCH",
    headers: authHeaders(driverUser()),
    body: JSON.stringify({ codCollected: true, codAmount: 310, proofOfDeliveryUrl: "https://cdn.tuti.test/proof/e2e-3.jpg" }),
  });
  const delivered = await deliveredResponse.json();
  assert.equal(deliveredResponse.status, 200);
  assert.equal(delivered.data.status, "Delivered");
});

test("E2E 4: damaged order blocks COD -- requires evidence, never marks Delivered, and returns to seller", async () => {
  const orderId = "ORD-E2E-DAMAGED";
  seedOrder(orderId);

  const rejected = await post(`/api/driver/deliveries/${orderId}/fail`, driverUser(), { reason: "ORDER_DAMAGED", note: "Crushed in transit." });
  assert.equal(rejected.response.status, 422);

  const failed = await post(`/api/driver/deliveries/${orderId}/fail`, driverUser(), {
    reason: "ORDER_DAMAGED",
    note: "Crushed in transit.",
    evidenceMediaAssetIds: [],
  });
  // Evidence array is present but empty -- still fails the evidenceRequired check.
  assert.equal(failed.response.status, 422);

  const order = getOrder(orderId);
  assert.equal(order.status, "Shipped");
  assert.notEqual(order.paymentStatus, "COD collected");
  assert.equal(order.driverAssignment.codCollected, false);

  const returned = await post(`/api/drivers/orders/${orderId}/delivery/return-to-seller`, adminUser(), {});
  // No prior failed attempt was recorded (evidence never provided), but the
  // assignment is still active (picked_up) and can be returned directly by
  // an admin, e.g. after a phone call with the driver confirms the damage.
  assert.equal(returned.response.status, 200);
  assert.equal(returned.payload.data.status, "Ready for Delivery");
  assert.equal(returned.payload.data.driverAssignment, undefined);
});

test("E2E 5: max attempts reached forces admin review", async () => {
  const orderId = "ORD-E2E-MAXATTEMPTS";
  seedOrder(orderId);

  for (let i = 1; i < MAX_DELIVERY_ATTEMPTS; i++) {
    const failed = await post(`/api/driver/deliveries/${orderId}/fail`, driverUser(), { reason: "CUSTOMER_UNREACHABLE" });
    assert.equal(failed.response.status, 200);
    assert.equal(failed.payload.data.attempt.nextAction, "RETRY_SAME_DRIVER");
    const retried = await post(`/api/drivers/orders/${orderId}/delivery/retry`, adminUser(), {});
    assert.equal(retried.response.status, 200);
  }

  const final = await post(`/api/driver/deliveries/${orderId}/fail`, driverUser(), { reason: "CUSTOMER_UNREACHABLE" });
  assert.equal(final.response.status, 200);
  assert.equal(final.payload.data.attempt.attemptNumber, MAX_DELIVERY_ATTEMPTS);
  assert.equal(final.payload.data.attempt.nextAction, "ADMIN_REVIEW");

  // Ceiling reached: same-driver retry must now be refused.
  const blockedRetry = await post(`/api/drivers/orders/${orderId}/delivery/retry`, adminUser(), {});
  assert.equal(blockedRetry.response.status, 409);
});
