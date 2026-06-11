import test from "node:test";
import assert from "node:assert/strict";
import {
  deductMongoStockWithRollback,
  deductSeedStock,
  preflightMongoStock,
  resolveOrderStockLines,
  rollbackMongoStock,
} from "./orderStock.js";

function makeProductModel({ products, failUpdateIds = [] }) {
  const calls = [];
  return {
    calls,
    find(query) {
      const ids = query.id.$in;
      return {
        lean: async () => products.filter((product) => ids.includes(product.id)).map((product) => ({ ...product })),
      };
    },
    async updateOne(filter, update) {
      calls.push({ filter, update });
      const product = products.find((item) => item.id === filter.id);
      if (!product) return { matchedCount: 0, modifiedCount: 0 };
      if (failUpdateIds.includes(filter.id)) return { matchedCount: 0, modifiedCount: 0 };
      if (filter.stock?.$gte !== undefined && product.stock < filter.stock.$gte) {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      product.stock += update.$inc.stock || 0;
      product.orders += update.$inc.orders || 0;
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
}

test("normal item resolves to one stock line", () => {
  assert.deepEqual(
    resolveOrderStockLines([{ productId: "prf-001", quantity: 2 }]),
    [{ productId: "prf-001", quantity: 2 }]
  );
});

test("Build Your Box resolves to perfume and treat stock lines", () => {
  const lines = resolveOrderStockLines([
    {
      productId: "build-box",
      quantity: 1,
      configuration: {
        type: "build_your_box",
        selectedPerfume: { productId: "prf-007" },
        selectedTreat: { productId: "cke-001" },
      },
    },
  ]);

  assert.deepEqual(lines, [
    { productId: "prf-007", quantity: 1 },
    { productId: "cke-001", quantity: 1 },
  ]);
  assert.equal(lines.some((line) => line.productId === "build-box"), false);
});

test("duplicate stock lines aggregate quantities", () => {
  assert.deepEqual(
    resolveOrderStockLines([
      { productId: "prf-001", quantity: 2 },
      { productId: "prf-001", quantity: 1 },
      {
        productId: "build-box",
        quantity: 1,
        configuration: {
          type: "build_your_box",
          selectedPerfume: { productId: "prf-001" },
          selectedTreat: { productId: "cke-001" },
        },
      },
    ]),
    [
      { productId: "prf-001", quantity: 4 },
      { productId: "cke-001", quantity: 1 },
    ]
  );
});

test("seed stock deduction decrements stock and increments orders", () => {
  const products = [
    { id: "prf-007", name: "Perfume", stock: 3, orders: 10 },
    { id: "cke-001", name: "Cake", stock: 2, orders: 5 },
  ];
  deductSeedStock(products, [
    { productId: "prf-007", quantity: 1 },
    { productId: "cke-001", quantity: 1 },
  ]);
  assert.deepEqual(products, [
    { id: "prf-007", name: "Perfume", stock: 2, orders: 11 },
    { id: "cke-001", name: "Cake", stock: 1, orders: 6 },
  ]);
});

test("insufficient seed stock throws 409 without mutation", () => {
  const products = [{ id: "prf-007", name: "Perfume", stock: 0, orders: 10 }];
  assert.throws(
    () => deductSeedStock(products, [{ productId: "prf-007", quantity: 1 }]),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );
  assert.deepEqual(products, [{ id: "prf-007", name: "Perfume", stock: 0, orders: 10 }]);
});

test("missing Mongo product preflight throws 404", async () => {
  const ProductModel = makeProductModel({ products: [] });
  await assert.rejects(
    () => preflightMongoStock(ProductModel, [{ productId: "missing", quantity: 1 }]),
    (error) => {
      assert.equal(error.status, 404);
      return true;
    }
  );
});

test("insufficient Mongo stock preflight throws 409", async () => {
  const ProductModel = makeProductModel({ products: [{ id: "prf-007", name: "Perfume", stock: 0, orders: 1 }] });
  await assert.rejects(
    () => preflightMongoStock(ProductModel, [{ productId: "prf-007", quantity: 1 }]),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );
});

test("failed second Mongo update rolls back first successful update", async () => {
  const products = [
    { id: "prf-007", name: "Perfume", stock: 3, orders: 10 },
    { id: "cke-001", name: "Cake", stock: 2, orders: 5 },
  ];
  const ProductModel = makeProductModel({ products, failUpdateIds: ["cke-001"] });

  await assert.rejects(
    () => deductMongoStockWithRollback(ProductModel, [
      { productId: "prf-007", quantity: 1 },
      { productId: "cke-001", quantity: 1 },
    ]),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );

  assert.deepEqual(products, [
    { id: "prf-007", name: "Perfume", stock: 3, orders: 10 },
    { id: "cke-001", name: "Cake", stock: 2, orders: 5 },
  ]);
});

test("Mongo rollback helper restores applied stock lines", async () => {
  const products = [
    { id: "prf-007", name: "Perfume", stock: 2, orders: 11 },
    { id: "cke-001", name: "Cake", stock: 1, orders: 6 },
  ];
  const ProductModel = makeProductModel({ products });

  await rollbackMongoStock(ProductModel, [
    { productId: "prf-007", quantity: 1 },
    { productId: "cke-001", quantity: 1 },
  ]);

  assert.deepEqual(products, [
    { id: "prf-007", name: "Perfume", stock: 3, orders: 10 },
    { id: "cke-001", name: "Cake", stock: 2, orders: 5 },
  ]);
});
