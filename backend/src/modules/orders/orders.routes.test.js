import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "orders-route-test-secret-at-least-32-chars";

const { ordersRouter } = await import("./orders.routes.js");
const {
  createOrder,
  __resetSeedOrdersForTests,
} = await import("./orders.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const initialStockSnapshot = new Map(
  seedRepository.getState().products.map((product) => [product.id, { stock: product.stock, orders: product.orders }])
);

let server;
let baseUrl;

function resetProductStock() {
  for (const product of seedRepository.getState().products) {
    const snapshot = initialStockSnapshot.get(product.id);
    if (snapshot) {
      product.stock = snapshot.stock;
      product.orders = snapshot.orders;
    }
  }
}

function resetAll() {
  __resetSeedOrdersForTests();
  resetProductStock();
}

function makePayload(email = "orders-route@example.com") {
  return {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Orders Route Customer",
    customerEmail: email,
    phone: "+971500000010",
    items: [{ productId: "prf-001", productName: "Oud Al Layl", shopId: "shop-oud-lane", price: 350, quantity: 1, category: "perfume" }],
    deliveryAddress: "Dubai",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
  };
}

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

async function getOrderRoute(orderId, { token = null, user = null } = {}) {
  const headers = {};
  if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const response = await fetch(`${baseUrl}/api/orders/${orderId}${query}`, { headers });
  const payload = await response.json();
  return { response, payload };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/orders", ordersRouter);
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

test("order detail route denies guest without token", async () => {
  const order = await createOrder(makePayload("guest-without-token@example.com"), null, null);

  const { response, payload } = await getOrderRoute(order.orderId);

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Access denied.");
});

test("order detail route denies guest with wrong token", async () => {
  const order = await createOrder(makePayload("guest-wrong-token@example.com"), null, null);

  const { response, payload } = await getOrderRoute(order.orderId, { token: "wrong-token" });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Access denied.");
});

test("order detail route allows guest with valid token for matching guest order and strips internals", async () => {
  const order = await createOrder(makePayload("guest-valid-token@example.com"), null, "routekey01");

  const { response, payload } = await getOrderRoute(order.orderId, { token: order.guestToken });

  assert.equal(response.status, 200);
  assert.equal(payload.data.orderId, order.orderId);
  assert.equal(payload.data.guestConfirmationToken, undefined);
  assert.equal(payload.data.idempotencyKey, undefined);
  assert.equal(payload.data.requestFingerprint, undefined);
  assert.equal(payload.data.guestToken, undefined);
});

test("order detail route does not allow one guest token to read another guest order", async () => {
  const first = await createOrder(makePayload("guest-route-one@example.com"), null, null);
  const second = await createOrder(makePayload("guest-route-two@example.com"), null, null);

  const { response, payload } = await getOrderRoute(second.orderId, { token: first.guestToken });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Access denied.");
});

test("order detail route does not allow guest token access to account orders", async () => {
  const customerId = "orders-route-customer-001";
  const order = await createOrder(makePayload("account-route@example.com"), customerId, null);

  const { response, payload } = await getOrderRoute(order.orderId, { token: "guest-token-for-account-order" });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Access denied.");
});

test("order detail route lets authenticated customer read only their own order", async () => {
  const ownerId = "orders-route-owner-001";
  const order = await createOrder(makePayload("owner-route@example.com"), ownerId, null);

  const own = await getOrderRoute(order.orderId, { user: { sub: ownerId, role: "customer" } });
  assert.equal(own.response.status, 200);
  assert.equal(own.payload.data.orderId, order.orderId);

  const other = await getOrderRoute(order.orderId, { user: { sub: "orders-route-other-001", role: "customer" } });
  assert.equal(other.response.status, 403);
  assert.equal(other.payload.error, "Access denied.");
});

test("order detail route preserves seller, admin, and support scopes", async () => {
  const order = await createOrder(makePayload("scoped-route@example.com"), "orders-route-customer-002", null);

  const seller = await getOrderRoute(order.orderId, { user: { sub: "seller-001", role: "seller", shopId: "shop-oud-lane" } });
  assert.equal(seller.response.status, 200);
  assert.equal(seller.payload.data.orderId, order.orderId);

  const wrongSeller = await getOrderRoute(order.orderId, { user: { sub: "seller-002", role: "seller", shopId: "shop-rose-vault" } });
  assert.equal(wrongSeller.response.status, 403);
  assert.equal(wrongSeller.payload.error, "Access denied.");

  const admin = await getOrderRoute(order.orderId, { user: { sub: "admin-001", role: "admin" } });
  assert.equal(admin.response.status, 200);
  assert.equal(admin.payload.data.orderId, order.orderId);

  const support = await getOrderRoute(order.orderId, { user: { sub: "support-001", role: "support" } });
  assert.equal(support.response.status, 200);
  assert.equal(support.payload.data.orderId, order.orderId);
});
