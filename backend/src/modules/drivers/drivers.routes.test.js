import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "driver-route-test-secret-at-least-32-chars";

const { driversRouter } = await import("./drivers.routes.js");
const {
  __getSeedDriverForTests,
  __resetSeedDriversForTests,
  __resetDriverShopAccessForTests,
  __grantActiveAccessForTests,
  requestExistingDriverForShop,
  listDriverShopAccessForDriver,
} = await import("./drivers.service.js");
const {
  getSeedOrders,
  __injectSeedOrderForTests,
  __resetSeedOrdersForTests,
} = await import("../orders/orders.service.js");
const { __resetNotificationsForTests } = await import("../notifications/notifications.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const DRIVER_ID = "drv-002";
const OTHER_DRIVER_ID = "drv-001";
const ORDER_ID = "ORD-DRV-ROUTE-001";
const SHOP_ID = "shop-rose-vault";
const PROOF_URL = "https://cdn.tuti.test/proof/route-delivery.jpg";

const assignedCodOrder = {
  orderId: ORDER_ID,
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, productId: "prf-002", price: 310, quantity: 1 }],
  subtotal: 310,
  platformFee: 40,
  vendorNet: 270,
  paymentMethod: "cod",
  paymentStatus: "COD pending",
  status: "Shipped",
  customerName: "Driver Route Test Customer",
  customerEmail: "driver-route-test@example.com",
  phone: "+971501234567",
  deliveryAddress: "Dubai Marina",
  statusHistory: [],
  driverAssignment: {
    driverId: DRIVER_ID,
    driverName: "Khalid Bin Hamdan",
    driverPhone: "+971 50 987 6543",
    assignedAt: "2026-06-01T09:00:00.000Z",
    pickedUpAt: "2026-06-01T09:30:00.000Z",
    deliveredAt: null,
    codCollected: false,
    codAmount: 310,
    codSettledAt: null,
    codSettledBy: null,
    codSettlementRef: null,
    note: "",
    proofOfDeliveryUrl: "",
  },
};

let server;
let baseUrl;

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function authHeaders(user) {
  return {
    Authorization: `Bearer ${tokenFor(user)}`,
    "Content-Type": "application/json",
  };
}

async function patchDelivery(driverId, user, body = {}) {
  const response = await fetch(`${baseUrl}/api/drivers/${driverId}/orders/${ORDER_ID}/delivery`, {
    method: "PATCH",
    headers: authHeaders(user),
    body: JSON.stringify({
      codCollected: true,
      codAmount: 310,
      note: "Delivered through route.",
      proofOfDeliveryUrl: PROOF_URL,
      ...body,
    }),
  });
  const payload = await response.json();
  return { response, payload };
}

async function getDriverRoute(path, user) {
  const response = await fetch(`${baseUrl}/api/drivers${path}`, {
    headers: authHeaders(user),
  });
  const payload = await response.json();
  return { response, payload };
}

async function postDriverRoute(path, user, body = {}) {
  const response = await fetch(`${baseUrl}/api/drivers${path}`, {
    method: "POST",
    headers: authHeaders(user),
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

function resetAll() {
  __resetSeedOrdersForTests();
  __resetSeedDriversForTests();
  __resetDriverShopAccessForTests();
  __resetNotificationsForTests();
  seedRepository.__resetSellerTransactionsForTests();
}

function seedAssignedOrder(overrides = {}) {
  const order = structuredClone({
    ...assignedCodOrder,
    ...overrides,
    driverAssignment: {
      ...assignedCodOrder.driverAssignment,
      ...(overrides.driverAssignment || {}),
    },
  });
  __injectSeedOrderForTests(order);
  const driver = __getSeedDriverForTests(order.driverAssignment.driverId);
  driver.status = "on_delivery";
  __grantActiveAccessForTests(order.driverAssignment.driverId, order.shopIds?.[0] || SHOP_ID);
  return order;
}

function getOrder() {
  const order = getSeedOrders().find((item) => item.orderId === ORDER_ID);
  assert.ok(order, `Expected seed order ${ORDER_ID}`);
  return order;
}

function assignedDriverUser(overrides = {}) {
  return {
    sub: "driver-user-002",
    role: "driver",
    name: "Khalid Bin Hamdan",
    driverId: DRIVER_ID,
    shopId: SHOP_ID,
    ...overrides,
  };
}

function adminUser() {
  return { sub: "admin-001", role: "admin", name: "Admin User" };
}

before(async () => {
  const app = express();
  app.use(express.json());
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
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(resetAll);

test("driver delivery route: mismatched driver token is rejected before delivery mutation", async () => {
  seedAssignedOrder();
  const orderBefore = structuredClone(getOrder());
  const driverBefore = structuredClone(__getSeedDriverForTests(DRIVER_ID));

  const { response, payload } = await patchDelivery(DRIVER_ID, assignedDriverUser({ driverId: OTHER_DRIVER_ID }));

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Driver is not authorized for this delivery.");

  const orderAfter = getOrder();
  assert.equal(orderAfter.status, orderBefore.status);
  assert.equal(orderAfter.paymentStatus, orderBefore.paymentStatus);
  assert.equal(orderAfter.driverAssignment.deliveredAt, null);
  assert.equal(orderAfter.driverAssignment.proofOfDeliveryUrl, "");
  assert.equal(orderAfter.driverAssignment.codCollected, false);
  assert.equal(orderAfter.driverAssignment.codSettledAt, null);
  assert.equal(orderAfter.driverAssignment.codSettlementRef, null);
  assert.deepEqual(__getSeedDriverForTests(DRIVER_ID), driverBefore);
});

test("driver delivery route: missing driverId on driver token is rejected before delivery mutation", async () => {
  seedAssignedOrder();
  const orderBefore = structuredClone(getOrder());
  const driverBefore = structuredClone(__getSeedDriverForTests(DRIVER_ID));
  const { driverId: _driverId, ...userWithoutDriverId } = assignedDriverUser();

  const { response, payload } = await patchDelivery(DRIVER_ID, userWithoutDriverId);

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Driver is not authorized for this delivery.");
  assert.deepEqual(getOrder(), orderBefore);
  assert.deepEqual(__getSeedDriverForTests(DRIVER_ID), driverBefore);
});

test("driver delivery route: matching driver token can complete own delivery", async () => {
  seedAssignedOrder();
  const driverBefore = structuredClone(__getSeedDriverForTests(DRIVER_ID));

  const { response, payload } = await patchDelivery(DRIVER_ID, assignedDriverUser());

  assert.equal(response.status, 200);
  assert.equal(payload.data.orderId, ORDER_ID);
  assert.equal(payload.data.status, "Delivered");
  assert.equal(payload.data.paymentStatus, "COD collected");
  assert.equal(payload.data.driverAssignment.proofOfDeliveryUrl, PROOF_URL);

  const driverAfter = __getSeedDriverForTests(DRIVER_ID);
  assert.equal(driverAfter.totalDeliveries, driverBefore.totalDeliveries + 1);
  assert.equal(driverAfter.codBalance, driverBefore.codBalance + 310);
  assert.equal(driverAfter.totalCodCollected, driverBefore.totalCodCollected + 310);
});

test("driver delivery route: admin can complete delivery for any driverId", async () => {
  seedAssignedOrder();

  const { response, payload } = await patchDelivery(DRIVER_ID, adminUser());

  assert.equal(response.status, 200);
  assert.equal(payload.data.orderId, ORDER_ID);
  assert.equal(payload.data.status, "Delivered");
  assert.equal(payload.data.driverAssignment.proofOfDeliveryUrl, PROOF_URL);
});

test("driver access admin routes: admin can list pending, approve, reject, and read shop/driver links", async () => {
  const requested = await requestExistingDriverForShop(SHOP_ID, "seller-route-001", { driverId: DRIVER_ID });

  const pending = await getDriverRoute("/access/pending", adminUser());
  assert.equal(pending.response.status, 200);
  assert.ok(pending.payload.data.some((row) => row.id === requested.id));

  const approve = await postDriverRoute(`/access/${requested.id}/approve`, adminUser(), { canReceiveBroadcasts: true });
  assert.equal(approve.response.status, 200);
  assert.equal(approve.payload.data.status, "active");

  const shops = await getDriverRoute(`/${DRIVER_ID}/shops`, adminUser());
  assert.equal(shops.response.status, 200);
  assert.ok(shops.payload.data.some((row) => row.shopId === SHOP_ID && row.status === "active"));

  const shopDrivers = await getDriverRoute(`/shops/${SHOP_ID}/drivers`, adminUser());
  assert.equal(shopDrivers.response.status, 200);
  assert.ok(shopDrivers.payload.data.some((row) => row.driverId === DRIVER_ID));

  const rejectedRequest = await requestExistingDriverForShop("shop-oud-lane", "seller-route-002", { driverId: OTHER_DRIVER_ID });
  const reject = await postDriverRoute(`/access/${rejectedRequest.id}/reject`, adminUser(), { reason: "Not approved" });
  assert.equal(reject.response.status, 200);
  assert.equal(reject.payload.data.status, "rejected");
  assert.equal(reject.payload.data.rejectionReason, "Not approved");
});

test("driver access admin routes: direct assignment attaches one driver to multiple shops explicitly", async () => {
  const direct = await postDriverRoute("/access/direct", adminUser(), {
    driverId: DRIVER_ID,
    shopIds: [SHOP_ID, "shop-oud-lane"],
  });

  assert.equal(direct.response.status, 201);
  assert.equal(direct.payload.data.length, 2);
  assert.deepEqual(new Set(direct.payload.data.map((row) => row.shopId)), new Set([SHOP_ID, "shop-oud-lane"]));
  assert.ok(direct.payload.data.every((row) => row.status === "active" && row.requestedByType === "admin"));

  const rows = await listDriverShopAccessForDriver(DRIVER_ID);
  assert.equal(rows.length, 2);
});

test("driver access admin routes: non-admin and invalid ids receive controlled responses", async () => {
  const seller = { sub: "seller-route-001", role: "seller", shopId: SHOP_ID };

  const pendingAsSeller = await getDriverRoute("/access/pending", seller);
  assert.equal(pendingAsSeller.response.status, 403);

  const directAsSeller = await postDriverRoute("/access/direct", seller, { driverId: DRIVER_ID, shopIds: [SHOP_ID] });
  assert.equal(directAsSeller.response.status, 403);

  const missingAccess = await postDriverRoute("/access/dsa-missing/approve", adminUser(), {});
  assert.equal(missingAccess.response.status, 404);

  const invalidDirect = await postDriverRoute("/access/direct", adminUser(), { driverId: DRIVER_ID, shopIds: ["shop-missing"] });
  assert.equal(invalidDirect.response.status, 404);
});
