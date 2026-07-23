import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";

// Route-level regression test for requireOwnedShop (backend/src/middleware/auth.js).
// Every seller product route derives `shopId` from the JWT claim
// (req.user.shopId) and, until now, only checked that claim for bare string
// equality against a product's own shopId -- never confirming that the
// authenticated user is the shop's real, database-recorded owner. This file
// spins up the real Express router (as marketplace.routes.test.js does for
// the reviews route) and issues real HTTP requests with hand-signed JWTs to
// prove the middleware actually rejects a shopId claim that doesn't resolve
// to a shop this user owns, and accepts one that does.
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "seller-shop-ownership-route-test-secret-32ch";

const { marketplaceRouter, sellerBrandRouter } = await import("./marketplace.routes.js");
const { sellerPerformanceRouter } = await import("./seller-performance.routes.js");
const { supportRouter } = await import("../support/support.routes.js");
const { notificationsRouter } = await import("../notifications/notifications.routes.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const OWNER_SUB = "user-legit-owner-001";
const ATTACKER_SUB = "user-attacker-002";

const OWNED_SHOP = {
  id: "shop-ownership-test-001",
  name: "Legit Owner Boutique",
  owner: "Legit Owner",
  ownerId: OWNER_SUB,
  city: "Dubai",
  status: "Approved",
  category: "perfume",
  categories: ["perfume"],
};
const UNOWNED_SHOP = {
  ...OWNED_SHOP,
  id: "shop-missing-owner-001",
  name: "Missing Owner Boutique",
  ownerId: null,
};
const MISMATCHED_SHOP = {
  ...OWNED_SHOP,
  id: "shop-mismatched-owner-001",
  name: "Mismatched Owner Boutique",
  ownerId: "different-owner-999",
};
const CAKE_SHOP = {
  ...OWNED_SHOP,
  id: "shop-cake-entitlement-001",
  name: "Cake Entitlement Boutique",
  ownerId: "cake-owner-001",
  category: "cake",
  categories: ["cake"],
};
const MIXED_SHOP = {
  ...OWNED_SHOP,
  id: "shop-mixed-entitlement-001",
  name: "Mixed Entitlement Boutique",
  ownerId: "mixed-owner-001",
  category: "mixed",
  categories: ["perfume", "cake", "dessert"],
};
const GIFT_BOX_SHOP = {
  ...OWNED_SHOP,
  id: "shop-gift-box-entitlement-001",
  name: "Gift Box Entitlement Boutique",
  ownerId: "gift-box-owner-001",
  category: "gift_box",
  categories: ["gift_box"],
};

let server;
let baseUrl;
let initialShops;

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function resetState() {
  const state = seedRepository.getState();
  state.shops.length = 0;
  state.shops.push(
    structuredClone(OWNED_SHOP),
    structuredClone(UNOWNED_SHOP),
    structuredClone(MISMATCHED_SHOP),
    structuredClone(CAKE_SHOP),
    structuredClone(MIXED_SHOP),
    structuredClone(GIFT_BOX_SHOP)
  );
  state.products.length = 0;
}

before(async () => {
  initialShops = seedRepository.getState().shops.map((shop) => structuredClone(shop));

  const app = express();
  app.use(express.json());
  app.use("/api/marketplace", marketplaceRouter);
  app.use("/api/seller", sellerBrandRouter);
  app.use("/api/seller", sellerPerformanceRouter);
  app.use("/api/support", supportRouter);
  app.use("/api/notifications", notificationsRouter);
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
  state.shops = initialShops;
});

beforeEach(resetState);

async function getSellerOverview(user) {
  const response = await fetch(`${baseUrl}/api/marketplace/seller`, {
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
  });
  return { response, payload: await response.json() };
}

async function postSellerProduct(user, body = {}) {
  const response = await fetch(`${baseUrl}/api/marketplace/seller/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(user)}` },
    body: JSON.stringify({ name: "Test Product", price: 100, category: "perfume", ...body }),
  });
  return { response, payload: await response.json() };
}

async function patchSellerProduct(user, productId, body = {}) {
  const response = await fetch(`${baseUrl}/api/marketplace/seller/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(user)}` },
    body: JSON.stringify({ price: 125, ...body }),
  });
  return { response, payload: await response.json() };
}

async function getSellerRoute(user, path) {
  const response = await fetch(`${baseUrl}/api/marketplace${path}`, {
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { response, payload };
}

async function getBrandProfile(user) {
  const response = await fetch(`${baseUrl}/api/seller/brand-profile`, {
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
  });
  return { response, payload: await response.json() };
}

async function getPath(user, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
  });
  return { response, payload: await response.json() };
}

test("requireOwnedShop rejects a shopId claim that does not belong to the authenticated user", async () => {
  const forgedUser = { sub: ATTACKER_SUB, role: "seller", shopId: OWNED_SHOP.id, name: "Attacker" };

  const { response: overviewRes } = await getSellerOverview(forgedUser);
  assert.equal(overviewRes.status, 403);

  const { response: createRes } = await postSellerProduct(forgedUser);
  assert.equal(createRes.status, 403);

  const performance = await getPath(forgedUser, "/api/seller/performance-summary");
  assert.equal(performance.response.status, 403);

  const support = await getPath(forgedUser, "/api/support/tickets");
  assert.equal(support.response.status, 403);

  const notifications = await getPath(forgedUser, "/api/notifications");
  assert.equal(notifications.response.status, 403);
});

test("requireOwnedShop allows the legitimate owner through", async () => {
  const legitimateUser = { sub: OWNER_SUB, role: "seller", shopId: OWNED_SHOP.id, name: "Legit Owner" };

  const { response: overviewRes, payload: overviewPayload } = await getSellerOverview(legitimateUser);
  assert.equal(overviewRes.status, 200);
  assert.equal(overviewPayload.data.shop.id, OWNED_SHOP.id);

  const { response: createRes, payload: createPayload } = await postSellerProduct(legitimateUser);
  assert.equal(createRes.status, 201);
  assert.equal(createPayload.data.shopId, OWNED_SHOP.id);

  const { response: balanceRes } = await getSellerRoute(legitimateUser, "/seller/balance");
  assert.equal(balanceRes.status, 200);

  const { response: transactionsRes } = await getSellerRoute(legitimateUser, "/seller/transactions");
  assert.equal(transactionsRes.status, 200);

  const { response: payoutsRes } = await getSellerRoute(legitimateUser, "/seller/payouts");
  assert.equal(payoutsRes.status, 200);

  const { response: brandRes, payload: brandPayload } = await getBrandProfile(legitimateUser);
  assert.equal(brandRes.status, 200);
  assert.equal(brandPayload.data.shopId, OWNED_SHOP.id);

  const performance = await getPath(legitimateUser, "/api/seller/performance-summary");
  assert.equal(performance.response.status, 200);

  const support = await getPath(legitimateUser, "/api/support/tickets");
  assert.equal(support.response.status, 200);

  const notifications = await getPath(legitimateUser, "/api/notifications");
  assert.equal(notifications.response.status, 200);
});

test("requireOwnedShop rejects a seller JWT with no shop at all", async () => {
  const shopless = { sub: "user-no-shop-003", role: "seller", shopId: null, name: "Shopless Seller" };

  const { response } = await getSellerOverview(shopless);
  assert.equal(response.status, 403);
});

test("requireOwnedShop rejects a seller whose shop has no ownerId", async () => {
  const user = { sub: OWNER_SUB, role: "seller", shopId: UNOWNED_SHOP.id, name: "Missing Owner Seller" };

  const { response, payload } = await getSellerOverview(user);

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Shop ownership could not be verified.");
});

test("requireOwnedShop rejects a seller whose shop ownerId mismatches sub", async () => {
  const user = { sub: OWNER_SUB, role: "seller", shopId: MISMATCHED_SHOP.id, name: "Mismatched Seller" };

  const { response, payload } = await getSellerOverview(user);

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Shop ownership could not be verified.");
});

test("seller can update own product but cannot act on another seeded shop", async () => {
  const owner = { sub: OWNER_SUB, role: "seller", shopId: OWNED_SHOP.id, name: "Legit Owner" };
  const otherOwner = { sub: "different-owner-999", role: "seller", shopId: MISMATCHED_SHOP.id, name: "Other Owner" };

  const ownCreate = await postSellerProduct(owner, { name: "Owned Perfume" });
  assert.equal(ownCreate.response.status, 201);

  const ownPatch = await patchSellerProduct(owner, ownCreate.payload.data.id, { price: 155 });
  assert.equal(ownPatch.response.status, 200);
  assert.equal(ownPatch.payload.data.price, 155);

  const otherCreate = await postSellerProduct(otherOwner, { name: "Other Shop Perfume" });
  assert.equal(otherCreate.response.status, 201);

  const crossPatch = await patchSellerProduct(owner, otherCreate.payload.data.id, { price: 500 });
  assert.equal(crossPatch.response.status, 403);
  assert.equal(crossPatch.payload.error, "You do not own this product.");
});

test("seller product creation enforces category entitlements", async () => {
  const perfumeSeller = { sub: OWNER_SUB, role: "seller", shopId: OWNED_SHOP.id, name: "Perfume Seller" };
  const cakeSeller = { sub: CAKE_SHOP.ownerId, role: "seller", shopId: CAKE_SHOP.id, name: "Cake Seller" };
  const mixedSeller = { sub: MIXED_SHOP.ownerId, role: "seller", shopId: MIXED_SHOP.id, name: "Mixed Seller" };
  const giftBoxSeller = { sub: GIFT_BOX_SHOP.ownerId, role: "seller", shopId: GIFT_BOX_SHOP.id, name: "Gift Box Seller" };

  assert.equal((await postSellerProduct(perfumeSeller, { category: "perfume" })).response.status, 201);
  assert.equal((await postSellerProduct(perfumeSeller, { category: "gift_box" })).response.status, 201);
  assert.equal((await postSellerProduct(perfumeSeller, { category: "cake" })).response.status, 403);
  assert.equal((await postSellerProduct(perfumeSeller, { category: "dessert" })).response.status, 403);

  assert.equal((await postSellerProduct(cakeSeller, { category: "cake" })).response.status, 201);
  assert.equal((await postSellerProduct(cakeSeller, { category: "dessert" })).response.status, 201);
  assert.equal((await postSellerProduct(cakeSeller, { category: "gift_box" })).response.status, 201);
  assert.equal((await postSellerProduct(cakeSeller, { category: "perfume" })).response.status, 403);

  for (const category of ["perfume", "cake", "dessert", "gift_box"]) {
    assert.equal((await postSellerProduct(mixedSeller, { category })).response.status, 201);
  }

  assert.equal((await postSellerProduct(giftBoxSeller, { category: "gift_box" })).response.status, 201);
  assert.equal((await postSellerProduct(giftBoxSeller, { category: "perfume" })).response.status, 403);
  assert.equal((await postSellerProduct(giftBoxSeller, { category: "cake" })).response.status, 403);
});

test("seller product creation rejects legacy bundle and ignores client-supplied shopId for entitlement", async () => {
  const perfumeSeller = { sub: OWNER_SUB, role: "seller", shopId: OWNED_SHOP.id, name: "Perfume Seller" };

  const bundle = await postSellerProduct(perfumeSeller, { category: "bundle" });
  assert.equal(bundle.response.status, 422);
  assert.equal(bundle.payload.error, "Legacy bundle products cannot be created by sellers. Use Gift Box instead.");

  const forgedShopId = await postSellerProduct(perfumeSeller, {
    category: "cake",
    shopId: CAKE_SHOP.id,
  });
  assert.equal(forgedShopId.response.status, 403);
});

test("seller product category update cannot move product outside entitlement", async () => {
  const perfumeSeller = { sub: OWNER_SUB, role: "seller", shopId: OWNED_SHOP.id, name: "Perfume Seller" };

  const product = await postSellerProduct(perfumeSeller, { category: "perfume", name: "Perfume to Retype" });
  assert.equal(product.response.status, 201);

  const blocked = await patchSellerProduct(perfumeSeller, product.payload.data.id, { category: "cake" });
  assert.equal(blocked.response.status, 403);

  const allowed = await patchSellerProduct(perfumeSeller, product.payload.data.id, { category: "gift_box" });
  assert.equal(allowed.response.status, 200);
  assert.equal(allowed.payload.data.category, "gift_box");
});

test("requireOwnedShop does not affect admin requests", async () => {
  const admin = { sub: "user-admin-004", role: "admin", name: "Admin" };

  const { response } = await getSellerOverview(admin);
  assert.equal(response.status, 200);
});
