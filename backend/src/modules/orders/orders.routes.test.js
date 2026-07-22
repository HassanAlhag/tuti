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
const { DEMO_SELLER_USER_ID } = await import("../../seed/marketplace.seed.js");

// requireOwnedShop verifies shop ownership against the database, so a
// hand-crafted seller JWT must carry a sub/shopId pair that actually
// resolves to a real seed shop's ownerId -- shop-oud-lane's is the stable
// DEMO_SELLER_USER_ID (see marketplace.seed.js / auth.service.js). A
// second, test-only shop with its own distinct ownerId is added here so
// the "wrong shop" case exercises the order-level shopIds check (a seller
// who legitimately owns *a* shop, just not this order's shop) rather than
// only ever hitting the ownership-claim gate.
const OTHER_SELLER_ID = "orders-route-other-seller-001";
const OTHER_SHOP_ID = "shop-orders-route-other-001";
const OTHER_PRODUCT_ID = "orders-route-other-product-001";

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
  const state = seedRepository.getState();
  if (!state.shops.some((shop) => shop.id === OTHER_SHOP_ID)) {
    state.shops.push({
      id: OTHER_SHOP_ID,
      name: "Orders Route Other Shop",
      owner: "Other Seller",
      ownerId: OTHER_SELLER_ID,
      city: "Dubai",
      status: "Approved",
      category: "perfume",
      categories: ["perfume"],
    });
  }
  if (!state.products.some((product) => product.id === OTHER_PRODUCT_ID)) {
    state.products.push({
      id: OTHER_PRODUCT_ID,
      name: "Other Shop Perfume",
      shopId: OTHER_SHOP_ID,
      status: "Live",
      category: "perfume",
      price: 240,
      stock: 20,
      orders: 0,
      family: "Oud",
      gender: "Unisex",
    });
  } else {
    const product = state.products.find((item) => item.id === OTHER_PRODUCT_ID);
    product.stock = 20;
    product.orders = 0;
  }
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

async function listOrdersRoute(user) {
  const response = await fetch(`${baseUrl}/api/orders`, {
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
  });
  const payload = await response.json();
  return { response, payload };
}

async function patchOrderStatusRoute(orderId, user, status) {
  const response = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(user)}` },
    body: JSON.stringify({ status }),
  });
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
  const state = seedRepository.getState();
  state.shops = state.shops.filter((shop) => shop.id !== OTHER_SHOP_ID);
  state.products = state.products.filter((product) => product.id !== OTHER_PRODUCT_ID);
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

  const seller = await getOrderRoute(order.orderId, { user: { sub: DEMO_SELLER_USER_ID, role: "seller", shopId: "shop-oud-lane" } });
  assert.equal(seller.response.status, 200);
  assert.equal(seller.payload.data.orderId, order.orderId);

  // A seller who legitimately owns a *different* shop must still be denied
  // -- this exercises the order-level shopIds check (assertOrderAccess),
  // not just requireOwnedShop's ownership-claim gate.
  const wrongSeller = await getOrderRoute(order.orderId, { user: { sub: OTHER_SELLER_ID, role: "seller", shopId: OTHER_SHOP_ID } });
  assert.equal(wrongSeller.response.status, 403);
  assert.equal(wrongSeller.payload.error, "Access denied.");

  // A seller whose shopId claim does not resolve to any real, owned shop
  // must be denied by requireOwnedShop before the order is even loaded.
  const unownedShopClaim = await getOrderRoute(order.orderId, { user: { sub: "forged-seller-001", role: "seller", shopId: "shop-oud-lane" } });
  assert.equal(unownedShopClaim.response.status, 403);
  assert.equal(unownedShopClaim.payload.error, "Shop ownership could not be verified.");

  const admin = await getOrderRoute(order.orderId, { user: { sub: "admin-001", role: "admin" } });
  assert.equal(admin.response.status, 200);
  assert.equal(admin.payload.data.orderId, order.orderId);

  const support = await getOrderRoute(order.orderId, { user: { sub: "support-001", role: "support" } });
  assert.equal(support.response.status, 200);
  assert.equal(support.payload.data.orderId, order.orderId);
});

test("seller order list uses verified owned shop only", async () => {
  const ownOrder = await createOrder(makePayload("seller-list-own@example.com"), null, null);
  await createOrder({
    ...makePayload("seller-list-other@example.com"),
    items: [{ productId: OTHER_PRODUCT_ID, productName: "Other Perfume", shopId: OTHER_SHOP_ID, price: 240, quantity: 1, category: "perfume" }],
  }, null, null);

  const seller = await listOrdersRoute({ sub: DEMO_SELLER_USER_ID, role: "seller", shopId: "shop-oud-lane" });
  assert.equal(seller.response.status, 200);
  assert.ok(seller.payload.data.orders.some((order) => order.orderId === ownOrder.orderId));
  assert.ok(seller.payload.data.orders.every((order) => order.shopIds.includes("shop-oud-lane")));

  const forged = await listOrdersRoute({ sub: "forged-seller-list", role: "seller", shopId: "shop-oud-lane" });
  assert.equal(forged.response.status, 403);
  assert.equal(forged.payload.error, "Shop ownership could not be verified.");
});

test("seller can transition own order but cannot mutate another shop's order", async () => {
  const ownOrder = await createOrder(makePayload("seller-status-own@example.com"), null, null);
  const otherOrder = await createOrder({
    ...makePayload("seller-status-other@example.com"),
    items: [{ productId: OTHER_PRODUCT_ID, productName: "Other Perfume", shopId: OTHER_SHOP_ID, price: 240, quantity: 1, category: "perfume" }],
  }, null, null);

  const ownSeller = { sub: DEMO_SELLER_USER_ID, role: "seller", shopId: "shop-oud-lane" };
  const otherSeller = { sub: OTHER_SELLER_ID, role: "seller", shopId: OTHER_SHOP_ID };

  const ownUpdate = await patchOrderStatusRoute(ownOrder.orderId, ownSeller, "Confirmed");
  assert.equal(ownUpdate.response.status, 200);
  assert.equal(ownUpdate.payload.data.status, "Confirmed");

  const blocked = await patchOrderStatusRoute(ownOrder.orderId, otherSeller, "Confirmed");
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.payload.error, "Access denied.");

  const reloaded = await getOrderRoute(ownOrder.orderId, { user: ownSeller });
  assert.equal(reloaded.response.status, 200);
  assert.equal(reloaded.payload.data.status, "Confirmed");

  const otherReloaded = await getOrderRoute(otherOrder.orderId, { user: otherSeller });
  assert.equal(otherReloaded.response.status, 200);
  assert.equal(otherReloaded.payload.data.status, "Pending");
});

test("admin and support order status scopes are unchanged", async () => {
  const adminOrder = await createOrder(makePayload("admin-status@example.com"), null, null);
  const supportOrder = await createOrder(makePayload("support-status@example.com"), null, null);

  const admin = await patchOrderStatusRoute(adminOrder.orderId, { sub: "admin-002", role: "admin" }, "Confirmed");
  assert.equal(admin.response.status, 200);
  assert.equal(admin.payload.data.status, "Confirmed");

  const support = await patchOrderStatusRoute(supportOrder.orderId, { sub: "support-002", role: "support" }, "Cancelled");
  assert.equal(support.response.status, 200);
  assert.equal(support.payload.data.status, "Cancelled");
});
