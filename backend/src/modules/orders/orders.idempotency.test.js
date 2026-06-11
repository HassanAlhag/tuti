import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

// Force seed mode for all tests so no MongoDB connection is required
process.env.MONGO_URI = "";

const { createOrder, __resetSeedOrdersForTests } = await import("./orders.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

// Snapshot initial product stock so we can restore it between tests
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

// Minimal valid COD order payload using a seed product with ample stock
function makePayload(overrides = {}) {
  return {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Fatima Al Rashid",
    customerEmail: "fatima@example.com",
    phone: "+971501234567",
    items: [{ productId: "prf-001", productName: "Oud Al Layl", shopId: "shop-oud-lane", price: 350, quantity: 1, category: "perfume" }],
    deliveryAddress: "Dubai Marina, Building 3",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
    ...overrides,
  };
}

const KEY_A = "aaaaabbb-1234-5678-9012-abcdef000001";
const KEY_B = "bbbbcccc-1234-5678-9012-abcdef000002";

beforeEach(resetAll);

test("idempotency: first request creates one order", async () => {
  const order = await createOrder(makePayload(), null, KEY_A);
  assert.ok(order.orderId, "should have orderId");
  assert.equal(order.idempotencyKey, undefined, "idempotency key must not be exposed in response");
});

test("idempotency: second identical request returns the same order", async () => {
  const first = await createOrder(makePayload(), null, KEY_A);
  const second = await createOrder(makePayload(), null, KEY_A);
  assert.equal(first.orderId, second.orderId, "both requests must yield the same orderId");
});

test("idempotency: stock is deducted exactly once for duplicate key", async () => {
  const products = seedRepository.getState().products;
  const product = products.find((p) => p.id === "prf-001");
  const stockBefore = product.stock;

  await createOrder(makePayload(), null, KEY_A);
  const stockAfterFirst = product.stock;
  assert.equal(stockAfterFirst, stockBefore - 1, "stock should drop by 1 after first create");

  await createOrder(makePayload(), null, KEY_A);
  const stockAfterDuplicate = product.stock;
  assert.equal(stockAfterDuplicate, stockAfterFirst, "duplicate request must not deduct stock again");
});

test("idempotency: different keys create separate orders", async () => {
  const orderA = await createOrder(makePayload(), null, KEY_A);
  const orderB = await createOrder(makePayload(), null, KEY_B);
  assert.notEqual(orderA.orderId, orderB.orderId, "different keys must create different orders");
});

test("idempotency: request without key creates order each time", async () => {
  const first = await createOrder(makePayload(), null, null);
  const second = await createOrder(makePayload(), null, null);
  assert.notEqual(first.orderId, second.orderId, "no key → separate orders");
});

test("idempotency: changed payload with same key returns conflict", async () => {
  await createOrder(makePayload(), null, KEY_A);

  const differentPayload = makePayload({ customerEmail: "different@example.com" });
  await assert.rejects(
    () => createOrder(differentPayload, null, KEY_A),
    (err) => {
      assert.equal(err.status, 409, "should be 409 conflict");
      assert.ok(err.message.includes("changed") || err.message.includes("review"), "should mention changed order");
      return true;
    }
  );
});

test("idempotency: guest order returns guestToken in initial response", async () => {
  const order = await createOrder(makePayload(), null, KEY_A);
  assert.ok(order.guestToken, "guest order must return guestToken");
  assert.equal(typeof order.guestToken, "string");
  assert.ok(order.guestToken.length > 16, "guestToken must have reasonable length");
});

test("idempotency: authenticated order does not return guestToken", async () => {
  const userId = "user-00001";
  const order = await createOrder(makePayload({ checkoutMode: "account" }), userId, KEY_A);
  assert.equal(order.guestToken, undefined, "authenticated order must not expose guestToken");
});

test("idempotency: duplicate request for authenticated order returns same orderId", async () => {
  const userId = "user-auth-test-001";
  const first = await createOrder(makePayload({ checkoutMode: "account" }), userId, KEY_A);
  const second = await createOrder(makePayload({ checkoutMode: "account" }), userId, KEY_A);
  assert.equal(first.orderId, second.orderId, "authenticated duplicate must return same order");
});

test("idempotency: insufficient stock returns customer-safe error", async () => {
  // deplete prf-001 stock first
  const products = seedRepository.getState().products;
  const product = products.find((p) => p.id === "prf-001");
  product.stock = 0;

  await assert.rejects(
    () => createOrder(makePayload(), null, KEY_A),
    (err) => {
      assert.equal(err.status, 409);
      assert.ok(err.message.toLowerCase().includes("sold out"), `Expected 'sold out', got: ${err.message}`);
      // Must not expose internal product ID in the error message
      assert.ok(!err.message.includes("prf-001"), "must not expose internal product ID");
      return true;
    }
  );
});

test("idempotency: Build Your Box deducts perfume and treat; synthetic id not deducted", async () => {
  const products = seedRepository.getState().products;
  const perfume = products.find((p) => p.id === "prf-007");
  const treat = products.find((p) => p.id === "cke-001");
  const stockBefore = { perfume: perfume.stock, treat: treat.stock };

  const boxPayload = {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Ahmed Hassan",
    customerEmail: "ahmed@example.com",
    phone: "+971501234568",
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
        giftWrap: false,
        cardMessage: "",
      },
    }],
    deliveryAddress: "Abu Dhabi Corniche",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
  };

  await createOrder(boxPayload, null, KEY_A);

  assert.equal(perfume.stock, stockBefore.perfume - 1, "perfume stock should drop by 1");
  assert.equal(treat.stock, stockBefore.treat - 1, "treat stock should drop by 1");

  // synthetic build-box id should not be in products
  const syntheticProduct = products.find((p) => p.id === "build-box");
  assert.equal(syntheticProduct, undefined, "build-box synthetic id must not exist in products");
});

test("idempotency: Build Your Box duplicate does not re-deduct stock", async () => {
  const products = seedRepository.getState().products;
  const perfume = products.find((p) => p.id === "prf-007");
  const treat = products.find((p) => p.id === "cke-001");

  const boxPayload = {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Sara Al Mazrouei",
    customerEmail: "sara@example.com",
    phone: "+971501234569",
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
        giftWrap: false,
        cardMessage: "",
      },
    }],
    deliveryAddress: "Sharjah City Centre",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
  };

  await createOrder(boxPayload, null, KEY_A);
  const stockAfterFirst = { perfume: perfume.stock, treat: treat.stock };

  await createOrder(boxPayload, null, KEY_A);
  assert.equal(perfume.stock, stockAfterFirst.perfume, "perfume stock must not change on duplicate");
  assert.equal(treat.stock, stockAfterFirst.treat, "treat stock must not change on duplicate");
});
