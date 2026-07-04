import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatTutiPrice,
  getProductCategory,
  getProductCompareAtPrice,
  getProductId,
  getProductImage,
  getProductName,
  getProductPrice,
  getProductTags,
  getProductTypeLabel,
  resolveShop,
} from "./commerceUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("commerce index exposes expected foundation components", () => {
  const source = readFileSync(join(__dirname, "index.js"), "utf8");
  const expectedExports = [
    "TutiCartItem",
    "TutiPrice",
    "TutiProductCard",
    "TutiProductGrid",
    "TutiProductRail",
    "TutiQuantityControl",
    "TutiTrustStrip",
  ];

  for (const exportName of expectedExports) {
    assert.match(source, new RegExp(`export \\{ ${exportName} \\}`), `missing ${exportName} export`);
  }
});

test("commerce product helpers tolerate current product shape aliases", () => {
  const product = {
    _id: "mongo-1",
    title: "Velvet Oud",
    category: "bundle",
    priceFrom: "325",
    compareAtPrice: "390",
    images: [{ url: "/uploads/velvet.png" }],
    sellerId: "shop-1",
    family: "Oud",
    notes: ["Rose", "Amber"],
    occasionTags: ["birthday"],
  };

  assert.equal(getProductId(product), "mongo-1");
  assert.equal(getProductName(product), "Velvet Oud");
  assert.equal(getProductCategory(product), "gift_box");
  assert.equal(getProductPrice(product), 325);
  assert.equal(getProductCompareAtPrice(product), 390);
  assert.equal(getProductImage(product), "/uploads/velvet.png");
  assert.equal(getProductTypeLabel(product), "Oud");
  assert.deepEqual(getProductTags(product, 3), ["Oud", "Rose", "Amber"]);
  assert.equal(resolveShop(product, { "shop-1": { name: "Maison Test" } })?.name, "Maison Test");
});

test("TutiPrice formatter returns safe output for valid and invalid values", () => {
  assert.equal(formatTutiPrice(null), "");
  assert.equal(formatTutiPrice("not-a-price"), "");
  assert.match(formatTutiPrice(120), /AED|د\.إ|120/);
});
