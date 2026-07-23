import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

// Force seed mode -- these tests exercise the same registration logic paths
// that run against Mongo in production, but without a live database. See
// auth.service.mongo.test.js for the Mongo-mode-specific transaction test.
process.env.MONGO_URI = "";

const { login, register } = await import("./auth.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");
const { DEMO_SELLER_USER_ID } = await import("../../seed/marketplace.seed.js");
const {
  createSellerProduct,
  updateSellerProduct,
} = await import("../marketplace/marketplace.service.js");

function resetState() {
  const state = seedRepository.getState();
  // Registration in seed mode prepends onto the shared in-memory shop/product
  // lists (seedRepository.addShop/addProduct) -- clear both so each test
  // starts from a known baseline instead of accumulating across the file.
  state.shops.length = 0;
  state.products.length = 0;
}

let emailCounter = 0;
function uniqueEmail(prefix = "seller") {
  emailCounter += 1;
  return `${prefix}-${emailCounter}-${Date.now()}@example.com`;
}

function sellerPayload(overrides = {}) {
  return {
    name: "Test Seller",
    email: uniqueEmail(),
    password: "supersecret123",
    role: "seller",
    shopName: "Test Boutique",
    shopCategory: "perfume",
    ...overrides,
  };
}

beforeEach(() => {
  resetState();
});

test("registration ignores a client-supplied shopId and always generates a fresh one", async () => {
  const { user } = await register(sellerPayload({ shopId: "shop-oud-lane" }));

  assert.notEqual(user.shopId, "shop-oud-lane");
  assert.ok(user.shopId?.startsWith("shop-"), "expected a server-generated shopId");
});

test("registering against an existing shop id does not shadow or corrupt it", async () => {
  const first = await register(sellerPayload({ shopName: "Original Boutique" }));
  const originalShopId = first.user.shopId;
  const state = seedRepository.getState();
  const originalShopCountBefore = state.shops.filter((s) => s.id === originalShopId).length;
  assert.equal(originalShopCountBefore, 1);

  // Attacker tries to register a second seller "as" the first seller's shop.
  const second = await register(sellerPayload({ shopId: originalShopId, shopName: "Attacker Boutique" }));

  assert.notEqual(second.user.shopId, originalShopId, "attacker must not receive the victim's shopId");
  const originalShopCountAfter = state.shops.filter((s) => s.id === originalShopId).length;
  assert.equal(originalShopCountAfter, 1, "the original shop must not be duplicated/shadowed");
  const originalShop = state.shops.find((s) => s.id === originalShopId);
  assert.equal(originalShop.owner, "Test Seller", "the original shop's owner must be unchanged");
});

test("every seller registration gets a distinct shopId -- no shared/duplicate shop ownership", async () => {
  const results = await Promise.all(
    Array.from({ length: 5 }, () => register(sellerPayload()))
  );
  const shopIds = results.map((r) => r.user.shopId);
  assert.equal(new Set(shopIds).size, shopIds.length, "expected every registration to receive a unique shopId");
});

test("a non-seller registration never carries a shopId, even if one is supplied", async () => {
  const { user } = await register({
    name: "Test Customer",
    email: uniqueEmail("customer"),
    password: "supersecret123",
    role: "customer",
    shopId: "shop-oud-lane",
  });

  assert.equal(user.shopId, null);
});

test("seller cannot access or modify another shop's products", async () => {
  const sellerA = await register(sellerPayload({ shopName: "Shop A" }));
  const sellerB = await register(sellerPayload({ shopName: "Shop B" }));

  const product = await createSellerProduct({
    shopId: sellerA.user.shopId,
    name: "Shop A Perfume",
    price: 100,
    category: "perfume",
    status: "Draft",
  });

  await assert.rejects(
    updateSellerProduct(product.id, sellerB.user.shopId, { price: 999 }),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );
});

test("legitimate seller retains full access to their own products", async () => {
  const seller = await register(sellerPayload({ shopName: "Owner Shop" }));

  const product = await createSellerProduct({
    shopId: seller.user.shopId,
    name: "Owner Perfume",
    price: 100,
    category: "perfume",
    status: "Draft",
  });

  const updated = await updateSellerProduct(product.id, seller.user.shopId, { stock: 42 });
  assert.equal(updated.stock, 42);
});

test("seed demo seller login resolves to stable Oud Lane owner identity", async () => {
  const state = seedRepository.getState();
  state.shops.splice(0, state.shops.length, {
    id: "shop-oud-lane",
    name: "Oud Lane",
    owner: "Mariam Al Noor",
    ownerId: DEMO_SELLER_USER_ID,
    status: "Approved",
    category: "perfume",
    categories: ["perfume"],
  });

  const { user } = await login({ email: "demo-seller@example.com", password: "anything" });
  const shop = seedRepository.getShop("shop-oud-lane");

  assert.equal(user.id, DEMO_SELLER_USER_ID);
  assert.equal(user._id, DEMO_SELLER_USER_ID);
  assert.equal(user.shopId, "shop-oud-lane");
  assert.equal(shop.ownerId, DEMO_SELLER_USER_ID);
});
