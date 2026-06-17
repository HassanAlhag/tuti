import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

// Force seed mode for checkout authority tests.
process.env.MONGO_URI = "";

const {
  createOrder,
  getSeedOrders,
  __resetSeedOrdersForTests,
} = await import("./orders.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const initialProductSnapshot = new Map(
  seedRepository.getState().products.map((product) => [product.id, structuredClone(product)])
);

function resetProducts() {
  for (const product of seedRepository.getState().products) {
    const snapshot = initialProductSnapshot.get(product.id);
    if (snapshot) {
      for (const key of Object.keys(product)) delete product[key];
      Object.assign(product, structuredClone(snapshot));
    }
  }
}

function resetAll() {
  __resetSeedOrdersForTests();
  resetProducts();
}

function getProduct(productId = "prf-001") {
  const product = seedRepository.getState().products.find((item) => item.id === productId);
  assert.ok(product, `Expected seed product ${productId}`);
  return product;
}

function makePayload(itemOverrides = {}, overrides = {}) {
  return {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Checkout Authority Buyer",
    customerEmail: "authority@example.com",
    phone: "+971501234567",
    items: [{
      productId: "prf-001",
      productName: "Client Supplied Name",
      shopId: "client-supplied-shop",
      price: 1,
      quantity: 1,
      category: "perfume",
      ...itemOverrides,
    }],
    deliveryAddress: "Dubai Marina",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
    ...overrides,
  };
}

function makeBuildYourBoxPayload(itemOverrides = {}, configurationOverrides = {}) {
  return {
    checkoutMode: "guest",
    paymentMethod: "cod",
    customerName: "Gift Buyer",
    customerEmail: "gift-authority@example.com",
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
        giftWrap: true,
        cardMessage: "Happy birthday!",
        ...configurationOverrides,
      },
      ...itemOverrides,
    }],
    deliveryAddress: "Jumeirah",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "With love",
    notes: "",
  };
}

function assertAuthoritativeStandardItem(order, product, quantity = 1) {
  const item = order.items[0];
  assert.equal(item.productId, product.id);
  assert.equal(item.productName, product.name);
  assert.equal(item.shopId, product.shopId);
  assert.equal(item.price, product.price);
  assert.equal(item.quantity, quantity);
  assert.equal(item.category, product.category || "perfume");
  assert.equal(order.subtotal, product.price * quantity);
  assert.equal(order.platformFee, Math.round(order.subtotal * 0.14));
  assert.equal(order.vendorNet, order.subtotal - order.platformFee);
  assert.deepEqual(order.shopIds, [product.shopId]);
}

const KEY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const KEY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const KEY_C = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";

beforeEach(resetAll);

test("checkout authority: lower client price is ignored in favor of product record price", async () => {
  const product = getProduct();
  const order = await createOrder(makePayload({ price: 1 }), null, KEY_A);

  assertAuthoritativeStandardItem(order, product);
});

test("checkout authority: higher client price is ignored in favor of product record price", async () => {
  const product = getProduct();
  const order = await createOrder(makePayload({ price: 99999 }), null, KEY_A);

  assertAuthoritativeStandardItem(order, product);
});

test("checkout authority: client product name and shopId are ignored in favor of product record values", async () => {
  const product = getProduct();
  const order = await createOrder(
    makePayload({
      productName: "Tampered Name",
      shopId: "shop-attacker",
      price: 2,
    }),
    null,
    KEY_A
  );

  assertAuthoritativeStandardItem(order, product);
});

test("checkout authority: quantity still comes from checkout intent while product facts come from backend", async () => {
  const product = getProduct();
  const order = await createOrder(makePayload({ quantity: 2, price: 1, shopId: "shop-attacker" }), null, KEY_A);

  assertAuthoritativeStandardItem(order, product, 2);
});

test("checkout authority: non-live product is rejected before order creation", async () => {
  const product = getProduct();
  product.status = "Draft";
  const ordersBefore = getSeedOrders().length;
  const stockBefore = product.stock;

  await assert.rejects(
    () => createOrder(makePayload(), null, KEY_A),
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.message, "One of your selected items is no longer available.");
      return true;
    }
  );

  assert.equal(getSeedOrders().length, ordersBefore);
  assert.equal(product.stock, stockBefore);
});

test("checkout authority: out-of-stock product is rejected without creating an order", async () => {
  const product = getProduct();
  product.stock = 0;
  const ordersBefore = getSeedOrders().length;
  const productOrdersBefore = product.orders;

  await assert.rejects(
    () => createOrder(makePayload(), null, KEY_A),
    (err) => {
      assert.equal(err.status, 409);
      assert.ok(err.message.toLowerCase().includes("sold out"));
      return true;
    }
  );

  assert.equal(getSeedOrders().length, ordersBefore);
  assert.equal(product.stock, 0);
  assert.equal(product.orders, productOrdersBefore);
});

test("payment boundary: explicit card checkout is rejected before order creation or stock mutation", async () => {
  const product = getProduct();
  const ordersBefore = getSeedOrders().length;
  const stockBefore = product.stock;
  const productOrdersBefore = product.orders;

  await assert.rejects(
    () => createOrder(makePayload({}, { paymentMethod: "card" }), null, KEY_A),
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.message, "Card checkout is not available yet. Please use cash on delivery.");
      return true;
    }
  );

  assert.equal(getSeedOrders().length, ordersBefore);
  assert.equal(product.stock, stockBefore);
  assert.equal(product.orders, productOrdersBefore);
});

test("payment boundary: card rejection happens before product normalization", async () => {
  await assert.rejects(
    () => createOrder(makePayload({ productId: "missing-product" }, { paymentMethod: "card" }), null, KEY_A),
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.message, "Card checkout is not available yet. Please use cash on delivery.");
      return true;
    }
  );
});

test("payment boundary: unknown direct-service paymentMethod is rejected", async () => {
  const product = getProduct();
  const ordersBefore = getSeedOrders().length;
  const stockBefore = product.stock;

  await assert.rejects(
    () => createOrder(makePayload({}, { paymentMethod: "crypto" }), null, KEY_A),
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.message, "Card checkout is not available yet. Please use cash on delivery.");
      return true;
    }
  );

  assert.equal(getSeedOrders().length, ordersBefore);
  assert.equal(product.stock, stockBefore);
});

test("payment boundary: explicit undefined direct-service paymentMethod is rejected", async () => {
  const product = getProduct();
  const ordersBefore = getSeedOrders().length;
  const stockBefore = product.stock;

  await assert.rejects(
    () => createOrder(makePayload({}, { paymentMethod: undefined }), null, KEY_A),
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.message, "Card checkout is not available yet. Please use cash on delivery.");
      return true;
    }
  );

  assert.equal(getSeedOrders().length, ordersBefore);
  assert.equal(product.stock, stockBefore);
});

test("payment boundary: omitted paymentMethod defaults to COD safely", async () => {
  const product = getProduct();
  const payload = makePayload();
  delete payload.paymentMethod;

  const order = await createOrder(payload, null, KEY_A);

  assert.equal(order.paymentMethod, "cod");
  assert.equal(order.paymentStatus, "COD pending");
  assertAuthoritativeStandardItem(order, product);
});

test("payment boundary: COD checkout continues working", async () => {
  const product = getProduct();
  const order = await createOrder(makePayload({}, { paymentMethod: "cod" }), null, KEY_A);

  assert.equal(order.paymentMethod, "cod");
  assert.equal(order.paymentStatus, "COD pending");
  assertAuthoritativeStandardItem(order, product);
});

test("checkout authority: duplicate idempotency key ignores changed client-only price/name/shop fields", async () => {
  const product = getProduct();
  const stockBefore = product.stock;

  const first = await createOrder(makePayload({ price: 1, productName: "First Client Name", shopId: "shop-client-one" }), null, KEY_A);
  const second = await createOrder(makePayload({ price: 99999, productName: "Second Client Name", shopId: "shop-client-two" }), null, KEY_A);

  assert.equal(second.orderId, first.orderId);
  assertAuthoritativeStandardItem(second, product);
  assert.equal(product.stock, stockBefore - 1);
});

test("checkout authority: changed quantity with same idempotency key is a changed checkout conflict", async () => {
  await createOrder(makePayload({ quantity: 1 }), null, KEY_B);

  await assert.rejects(
    () => createOrder(makePayload({ quantity: 2 }), null, KEY_B),
    (err) => {
      assert.equal(err.status, 409);
      assert.ok(err.message.includes("changed") || err.message.includes("review"));
      return true;
    }
  );
});

test("checkout authority: existing Build Your Box tampered total validation is still enforced", async () => {
  await assert.rejects(
    () => createOrder(makeBuildYourBoxPayload({ price: 1 }, { totalPrice: 1 }), null, KEY_C),
    (err) => {
      assert.equal(err.status, 409);
      assert.ok(err.message.includes("Build Your Box"));
      return true;
    }
  );
});
