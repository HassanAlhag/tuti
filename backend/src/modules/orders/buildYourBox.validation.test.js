import test from "node:test";
import assert from "node:assert/strict";
import { validateBuildYourBoxItems } from "./buildYourBox.validation.js";

const perfume = {
  id: "prf-demo",
  category: "perfume",
  name: "Demo Perfume",
  shopId: "shop-demo",
  price: 300,
  status: "Live",
};

const treat = {
  id: "cke-demo",
  category: "cake",
  name: "Demo Cake",
  shopId: "shop-demo",
  price: 150,
  status: "Live",
};

function buildBox(overrides = {}) {
  return {
    productId: "build-box",
    productName: "Build Your Box",
    shopId: "shop-demo",
    price: 450,
    quantity: 1,
    category: "bundle",
    configuration: {
      type: "build_your_box",
      version: 1,
      selectedPerfume: { productId: perfume.id, shopId: perfume.shopId },
      selectedTreat: { productId: treat.id, shopId: treat.shopId },
      totalPrice: 450,
    },
    ...overrides,
  };
}

function assertStatus(error, status) {
  assert.equal(error.status, status);
}

test("valid Build Your Box payload passes validation", () => {
  assert.doesNotThrow(() => validateBuildYourBoxItems([buildBox()], [perfume, treat]));
});

test("normal product items are ignored by Build Your Box validation", () => {
  const normalItem = {
    productId: perfume.id,
    productName: perfume.name,
    shopId: perfume.shopId,
    price: perfume.price,
    quantity: 1,
  };
  assert.doesNotThrow(() => validateBuildYourBoxItems([normalItem], []));
});

test("missing selectedPerfume is a malformed Build Your Box payload", () => {
  assert.throws(
    () => validateBuildYourBoxItems([
      buildBox({ configuration: { ...buildBox().configuration, selectedPerfume: undefined } }),
    ], [perfume, treat]),
    (error) => {
      assertStatus(error, 400);
      return true;
    }
  );
});

test("cross-shop selected products are rejected as a business conflict", () => {
  assert.throws(
    () => validateBuildYourBoxItems([buildBox()], [perfume, { ...treat, shopId: "shop-other" }]),
    (error) => {
      assertStatus(error, 409);
      return true;
    }
  );
});

test("non-live selected products are rejected as a business conflict", () => {
  assert.throws(
    () => validateBuildYourBoxItems([buildBox()], [{ ...perfume, status: "Draft" }, treat]),
    (error) => {
      assertStatus(error, 409);
      return true;
    }
  );
});

test("wrong Build Your Box total is rejected as a business conflict", () => {
  assert.throws(
    () => validateBuildYourBoxItems([buildBox({ price: 999 })], [perfume, treat]),
    (error) => {
      assertStatus(error, 409);
      return true;
    }
  );
});
