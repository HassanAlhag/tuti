import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

// Force seed mode for all tests so no MongoDB connection is required
process.env.MONGO_URI = "";

const { createOrder, getOrder, listOrders, getSeedOrders, __resetSeedOrdersForTests, __injectSeedOrderForTests } = await import("./orders.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const initialStockSnapshot = new Map(
  seedRepository.getState().products.map((p) => [p.id, { stock: p.stock, orders: p.orders }])
);

function resetProductStock() {
  for (const p of seedRepository.getState().products) {
    const snap = initialStockSnapshot.get(p.id);
    if (snap) { p.stock = snap.stock; p.orders = snap.orders; }
  }
}

function resetAll() {
  __resetSeedOrdersForTests();
  resetProductStock();
}

beforeEach(resetAll);

function makeAuthUser(sub, role = "customer", shopId = null) {
  return { sub, role, shopId };
}

function makePayload(emailOverride = "test@example.com") {
  return {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Test Customer",
    customerEmail: emailOverride,
    phone: "+971500000001",
    items: [{ productId: "prf-001", productName: "Oud Al Layl", shopId: "shop-oud-lane", price: 350, quantity: 1, category: "perfume" }],
    deliveryAddress: "Dubai",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
  };
}

function injectAccessOrder(overrides = {}) {
  __injectSeedOrderForTests({
    orderId: "ORD-TEST-ACCESS",
    customerId: "user-cust-access",
    shopIds: ["shop-oud-lane"],
    customerName: "Test Access",
    customerEmail: "access@example.com",
    phone: "",
    items: [],
    subtotal: 100,
    platformFee: 14,
    vendorNet: 86,
    status: "Pending",
    paymentStatus: "COD pending",
    paymentMethod: "cod",
    checkoutMode: "account",
    deliveryAddress: "",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });
}

function injectAssignedAccessOrder(overrides = {}) {
  injectAccessOrder({
    orderId: "ORD-CUSTOMER-DELIVERY-SAFE",
    customerId: "user-cust-access",
    shopIds: ["shop-oud-lane"],
    status: "Shipped",
    driverAssignment: {
      id: "asg-internal-001",
      assignmentId: "assignment-internal-001",
      driverId: "drv-raw-001",
      driverName: "Internal Driver",
      driverPhone: "+971555550000",
      status: "rescheduled",
      assignedAt: "2026-06-01T09:00:00.000Z",
      pickedUpAt: "2026-06-01T09:30:00.000Z",
      deliveredAt: null,
      retryScheduledAt: "2026-06-01T13:00:00.000Z",
      lastFailureReason: "CUSTOMER_REQUESTED_RESCHEDULE",
      note: "Driver says customer asked for later.",
      evidenceMediaIds: ["media-internal-1"],
      evidence: [{ id: "evidence-internal-1" }],
      customerReached: true,
      contactAttempts: 2,
      nextAction: "RESCHEDULE",
      attemptCount: 2,
      supersededAt: null,
      supersededByAssignmentId: null,
    },
    driverAssignmentHistory: [{
      driverId: "drv-old-001",
      note: "Internal previous driver note",
      evidenceMediaIds: ["media-history-1"],
    }],
    supportCase: { status: "internal_review", notes: "Support-only note" },
    resolutionDecision: { action: "admin_review", note: "Admin-only decision" },
    ...overrides,
  });
}

function assertNoRawDeliveryFields(payload) {
  const json = JSON.stringify(payload);
  assert.equal(payload.driverAssignment, undefined, "raw driverAssignment must not be exposed");
  assert.equal(payload.driverAssignmentHistory, undefined, "driverAssignmentHistory must not be exposed");
  assert.equal(payload.supportCase, undefined, "support review info must not be exposed");
  assert.equal(payload.resolutionDecision, undefined, "admin review info must not be exposed");
  for (const raw of [
    "drv-raw-001",
    "asg-internal-001",
    "assignment-internal-001",
    "CUSTOMER_REQUESTED_RESCHEDULE",
    "Driver says customer asked for later.",
    "media-internal-1",
    "evidence-internal-1",
    "customerReached",
    "contactAttempts",
    "RETRY_SAME_DRIVER",
    "attemptCount",
    "supersededByAssignmentId",
    "Internal previous driver note",
    "Support-only note",
    "Admin-only decision",
  ]) {
    assert.equal(json.includes(raw), false, `customer payload must not contain ${raw}`);
  }
}

test("access: authenticated customer can read their own order", async () => {
  const userId = "user-access-001";
  const order = await createOrder(makePayload(), userId, null);
  const fetched = await getOrder(order.orderId, makeAuthUser(userId));
  assert.equal(fetched.orderId, order.orderId);
});

test("access: authenticated customer cannot read another customer's order", async () => {
  const ownerUserId = "user-access-002";
  const otherUserId = "user-access-003";

  const order = await createOrder(makePayload(), ownerUserId, null);

  await assert.rejects(
    () => getOrder(order.orderId, makeAuthUser(otherUserId)),
    (err) => {
      assert.equal(err.status, 403, "must return 403");
      return true;
    }
  );
});

test("access: unauthenticated request without token is denied", async () => {
  const order = await createOrder(makePayload(), null, null);

  await assert.rejects(
    () => getOrder(order.orderId, null, null),
    (err) => {
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test("access: guest order is accessible with correct guestToken", async () => {
  const order = await createOrder(makePayload(), null, null);
  assert.ok(order.guestToken, "must return guestToken for guest orders");

  const fetched = await getOrder(order.orderId, null, order.guestToken);
  assert.equal(fetched.orderId, order.orderId);
});

test("access: guest order is denied with incorrect token", async () => {
  const order = await createOrder(makePayload(), null, null);

  await assert.rejects(
    () => getOrder(order.orderId, null, "wrong-token-12345"),
    (err) => {
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test("access: guest token is scoped to the matching guest order only", async () => {
  const first = await createOrder(makePayload("guest-one@example.com"), null, null);
  const second = await createOrder(makePayload("guest-two@example.com"), null, null);

  await assert.rejects(
    () => getOrder(second.orderId, null, first.guestToken),
    (err) => {
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test("access: guest token cannot open an authenticated customer order", async () => {
  const userId = "user-access-account-token-001";
  const order = await createOrder(makePayload("account-token@example.com"), userId, null);
  assert.equal(order.guestToken, undefined, "account orders must not return guestToken");

  await assert.rejects(
    () => getOrder(order.orderId, null, "guest-token-cannot-open-account-order"),
    (err) => {
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test("access: guestConfirmationToken is not exposed in order GET response", async () => {
  const order = await createOrder(makePayload(), null, null);
  const fetched = await getOrder(order.orderId, null, order.guestToken);
  assert.equal(fetched.guestConfirmationToken, undefined, "guestConfirmationToken must not be in GET response");
});

test("access: idempotencyKey is not exposed in order GET response", async () => {
  const userId = "user-access-004";
  const key = "aaaabbbb-cccc-dddd-eeee-111111111111";
  const created = await createOrder(makePayload("auth@example.com"), userId, key);
  const fetched = await getOrder(created.orderId, makeAuthUser(userId));
  assert.equal(fetched.idempotencyKey, undefined, "idempotencyKey must not be exposed");
  assert.equal(fetched.requestFingerprint, undefined, "requestFingerprint must not be exposed");
});

test("access: seller can read an order for their shop", async () => {
  __injectSeedOrderForTests({
    orderId: "ORD-TEST-SELLER01",
    customerId: "user-cust-999",
    shopIds: ["shop-oud-lane"],
    customerName: "Test",
    customerEmail: "test@example.com",
    phone: "",
    items: [],
    subtotal: 100,
    platformFee: 14,
    vendorNet: 86,
    status: "Pending",
    paymentStatus: "COD pending",
    paymentMethod: "cod",
    checkoutMode: "account",
    deliveryAddress: "",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
    shopIds: ["shop-oud-lane"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const sellerUser = makeAuthUser("seller-001", "seller", "shop-oud-lane");
  const fetched = await getOrder("ORD-TEST-SELLER01", sellerUser);
  assert.equal(fetched.orderId, "ORD-TEST-SELLER01");
});

test("access: seller cannot read an order from a different shop", async () => {
  __injectSeedOrderForTests({
    orderId: "ORD-TEST-SELLER02",
    customerId: "user-cust-998",
    shopIds: ["shop-rose-vault"],
    customerName: "Test",
    customerEmail: "test2@example.com",
    phone: "",
    items: [],
    subtotal: 200,
    platformFee: 28,
    vendorNet: 172,
    status: "Pending",
    paymentStatus: "COD pending",
    paymentMethod: "cod",
    checkoutMode: "account",
    deliveryAddress: "",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const wrongSellerUser = makeAuthUser("seller-002", "seller", "shop-oud-lane");
  await assert.rejects(
    () => getOrder("ORD-TEST-SELLER02", wrongSellerUser),
    (err) => {
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test("access: admin can read any order", async () => {
  __injectSeedOrderForTests({
    orderId: "ORD-TEST-ADMIN01",
    customerId: "user-cust-997",
    shopIds: ["shop-citrus-atelier"],
    customerName: "Test Admin Order",
    customerEmail: "admin-test@example.com",
    phone: "",
    items: [],
    subtotal: 150,
    platformFee: 21,
    vendorNet: 129,
    status: "Confirmed",
    paymentStatus: "COD pending",
    paymentMethod: "cod",
    checkoutMode: "account",
    deliveryAddress: "",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const adminUser = makeAuthUser("admin-001", "admin");
  const fetched = await getOrder("ORD-TEST-ADMIN01", adminUser);
  assert.equal(fetched.orderId, "ORD-TEST-ADMIN01");
});

test("access: support can read any order", async () => {
  injectAccessOrder({
    orderId: "ORD-TEST-SUPPORT01",
    customerId: "user-cust-support",
    shopIds: ["shop-citrus-atelier"],
    status: "Confirmed",
  });

  const supportUser = makeAuthUser("support-001", "support");
  const fetched = await getOrder("ORD-TEST-SUPPORT01", supportUser);
  assert.equal(fetched.orderId, "ORD-TEST-SUPPORT01");
});

test("access: customer order detail exposes only customer-safe delivery data", async () => {
  injectAssignedAccessOrder();

  const fetched = await getOrder("ORD-CUSTOMER-DELIVERY-SAFE", makeAuthUser("user-cust-access"));

  assertNoRawDeliveryFields(fetched);
  assert.deepEqual(fetched.delivery, {
    state: "rescheduled",
    messageCode: "DELIVERY_RESCHEDULED",
    deliveredAt: null,
    retryScheduledAt: "2026-06-01T13:00:00.000Z",
    customerActionRequired: false,
    message: "Your delivery has been rescheduled to the requested time.",
  });
});

test("access: customer order list excludes raw assignment details", async () => {
  injectAssignedAccessOrder();

  const result = await listOrders({ userId: "user-cust-access", role: "customer" });

  assert.equal(result.orders.length, 1);
  assertNoRawDeliveryFields(result.orders[0]);
  assert.equal(result.orders[0].delivery.messageCode, "DELIVERY_RESCHEDULED");
});

test("access: customer delivery issue maps unreachable failures to safe action copy", async () => {
  injectAssignedAccessOrder({
    orderId: "ORD-CUSTOMER-UNREACHABLE",
    driverAssignment: {
      id: "asg-internal-002",
      driverId: "drv-raw-001",
      status: "delivery_failed",
      lastFailureReason: "CUSTOMER_UNREACHABLE",
      retryScheduledAt: "2026-06-01T14:00:00.000Z",
      note: "Called three times.",
      evidenceMediaIds: ["media-secret"],
      nextAction: "RETRY_SAME_DRIVER",
    },
  });

  const fetched = await getOrder("ORD-CUSTOMER-UNREACHABLE", makeAuthUser("user-cust-access"));

  assertNoRawDeliveryFields(fetched);
  assert.equal(fetched.delivery.state, "delivery_issue");
  assert.equal(fetched.delivery.messageCode, "CONTACT_DETAILS_REQUIRED");
  assert.equal(fetched.delivery.customerActionRequired, true);
  assert.equal(fetched.delivery.retryScheduledAt, null);
  assert.equal(fetched.delivery.message, "We tried to reach you for your delivery but couldn't connect. We'll try again soon.");
});

test("access: guest tracking response uses the same customer-safe delivery serializer", async () => {
  const created = await createOrder(makePayload("guest-tracking@example.com"), null, null);
  injectAssignedAccessOrder({
    orderId: created.orderId,
    customerId: null,
    guestConfirmationToken: getSeedOrders().find((order) => order.orderId === created.orderId)?.guestConfirmationToken,
  });

  const fetched = await getOrder(created.orderId, null, created.guestToken);

  assertNoRawDeliveryFields(fetched);
  assert.equal(fetched.delivery.messageCode, "DELIVERY_RESCHEDULED");
});

test("access: seller and admin order payloads retain operational assignment details", async () => {
  injectAssignedAccessOrder();

  const sellerOrder = await getOrder("ORD-CUSTOMER-DELIVERY-SAFE", makeAuthUser("seller-001", "seller", "shop-oud-lane"));
  assert.equal(sellerOrder.driverAssignment.driverId, "drv-raw-001");
  assert.equal(sellerOrder.driverAssignment.note, "Driver says customer asked for later.");
  assert.equal(sellerOrder.driverAssignment.nextAction, "RESCHEDULE");
  assert.equal(sellerOrder.driverAssignmentHistory.length, 1);

  const adminOrder = await getOrder("ORD-CUSTOMER-DELIVERY-SAFE", makeAuthUser("admin-001", "admin"));
  assert.equal(adminOrder.driverAssignment.driverId, "drv-raw-001");
  assert.equal(adminOrder.driverAssignment.evidenceMediaIds[0], "media-internal-1");
  assert.equal(adminOrder.supportCase.status, "internal_review");
});

test("access: order not found returns 404", async () => {
  await assert.rejects(
    () => getOrder("ORD-NONEXISTENT-0000", makeAuthUser("user-001")),
    (err) => {
      assert.equal(err.status, 404);
      return true;
    }
  );
});

test("access: customer-safe error on missing product (404 → 422)", async () => {
  const badPayload = {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Test",
    customerEmail: "test@example.com",
    phone: "+971500000002",
    items: [{ productId: "prf-nonexistent-xyz", productName: "Ghost Perfume", shopId: "shop-oud-lane", price: 350, quantity: 1, category: "perfume" }],
    deliveryAddress: "Dubai",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
  };

  await assert.rejects(
    () => createOrder(badPayload, null, null),
    (err) => {
      assert.ok([404, 422].includes(err.status), `Expected 404 or 422, got ${err.status}`);
      assert.ok(!err.message.includes("prf-nonexistent-xyz"), "must not expose internal product ID in error");
      return true;
    }
  );
});

test("access: get-by-orderId is refresh-safe (returns same order on repeated calls)", async () => {
  const userId = "user-refresh-001";
  const created = await createOrder(makePayload("refresh@example.com"), userId, null);

  const first = await getOrder(created.orderId, makeAuthUser(userId));
  const second = await getOrder(created.orderId, makeAuthUser(userId));

  assert.equal(first.orderId, second.orderId);
  assert.equal(first.subtotal, second.subtotal);
  assert.deepEqual(first.items, second.items);
});

test("access: configured Build Your Box data survives create/get round-trip", async () => {
  const boxPayload = {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Gift Buyer",
    customerEmail: "gift@example.com",
    phone: "+971500000003",
    items: [{
      productId: "build-box",
      productName: "Build Your Box",
      shopId: "shop-sweet-studio",
      price: 484,
      quantity: 1,
      category: "bundle",
      bundledProductIds: ["prf-007", "cke-001"],
      configuration: {
        type: "build_your_box",
        version: 1,
        selectedPerfume: { productId: "prf-007", name: "Cocoa Rose Parfum", category: "perfume", shopId: "shop-sweet-studio", price: 295 },
        selectedTreat: { productId: "cke-001", name: "Chocolate Elegance", category: "cake", shopId: "shop-sweet-studio", price: 189 },
        totalPrice: 484,
        giftWrap: true,
        cardMessage: "Happy birthday!",
      },
    }],
    deliveryAddress: "Jumeirah",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "With love",
    notes: "",
  };

  const created = await createOrder(boxPayload, null, null);
  const fetched = await getOrder(created.orderId, null, created.guestToken);

  const fetchedItem = fetched.items[0];
  assert.equal(fetchedItem.configuration?.type, "build_your_box");
  assert.equal(fetchedItem.configuration?.selectedPerfume?.productId, "prf-007");
  assert.equal(fetchedItem.configuration?.selectedTreat?.productId, "cke-001");
  assert.equal(fetchedItem.configuration?.giftWrap, true);
  assert.equal(fetchedItem.configuration?.cardMessage, "Happy birthday!");
});
