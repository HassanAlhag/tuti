import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const {
  __resetFeaturedProductPlacementsForTests,
  createFeaturedProductPlacement,
  deleteFeaturedProductPlacement,
  listAdminFeaturedProductPlacements,
  listPublicFeaturedProductPlacements,
  updateFeaturedProductPlacement,
} = await import("./featured-products.service.js");

const SHOP_APPROVED = {
  id: "shop-feat-prod-001",
  name: "Oud Lane",
  owner: "Layla Rahman",
  city: "Dubai",
  status: "Approved",
  fulfillmentRate: 97,
  serviceRating: 4.8,
  avatar: "OL",
  story: "Small-batch oud and amber perfumes blended in Dubai.",
  cover: "Reserve oud blends",
};

const SHOP_PENDING = {
  id: "shop-feat-prod-002",
  name: "Rose Vault",
  owner: "Sara Noor",
  city: "Abu Dhabi",
  status: "Pending review",
  fulfillmentRate: 95,
  serviceRating: 4.7,
  avatar: "RV",
  story: "Soft florals and gift-ready perfume.",
  cover: "Fresh floral atelier",
};

const LIVE_PRODUCT = {
  id: "prd-live-001",
  name: "Midnight Oud Reserve",
  shopId: SHOP_APPROVED.id,
  category: "perfume",
  price: 420,
  originalPrice: 490,
  stock: 14,
  status: "Live",
  tags: ["Oud", "Luxury"],
  occasionTags: ["Eid"],
  releaseType: "Featured",
  collection: "Luxury line",
  color: "#1f3a37",
  accent: "#d9a441",
  imagePath: "/uploads/live-product.jpg",
  rating: 4.8,
  reviews: 42,
  verifiedReviews: 28,
  family: "Oud",
  gender: "Unisex",
  notes: ["amber", "saffron"],
  description: "A rich oud blend with amber warmth.",
  size: "75ml",
  leadTimeDays: 2,
  customMessageAvailable: true,
  createdAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z",
};

const DRAFT_PRODUCT = {
  id: "prd-draft-001",
  name: "Hidden Oud Draft",
  shopId: SHOP_APPROVED.id,
  category: "perfume",
  price: 320,
  stock: 9,
  status: "Needs approval",
  imagePath: "/uploads/draft-product.jpg",
  rating: 4.2,
  reviews: 3,
  verifiedReviews: 1,
  family: "Oud",
  gender: "Unisex",
  notes: ["rose"],
  description: "Draft product.",
  size: "50ml",
  leadTimeDays: 3,
  customMessageAvailable: false,
  createdAt: "2026-06-04T00:00:00.000Z",
  updatedAt: "2026-06-04T00:00:00.000Z",
};

const PENDING_PRODUCT = {
  id: "prd-pending-001",
  name: "Rose Vault Draft",
  shopId: SHOP_PENDING.id,
  category: "perfume",
  price: 260,
  stock: 12,
  status: "Live",
  imagePath: "/uploads/pending-product.jpg",
  rating: 4.4,
  reviews: 7,
  verifiedReviews: 4,
  family: "Floral",
  gender: "Women",
  notes: ["rose"],
  description: "Live product from a pending shop.",
  size: "50ml",
  leadTimeDays: 2,
  customMessageAvailable: false,
  createdAt: "2026-06-03T00:00:00.000Z",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

function resetState() {
  __resetFeaturedProductPlacementsForTests();
  const state = seedRepository.getState();
  state.shops.splice(0, state.shops.length, structuredClone(SHOP_APPROVED), structuredClone(SHOP_PENDING));
  state.products.splice(0, state.products.length, structuredClone(LIVE_PRODUCT), structuredClone(DRAFT_PRODUCT), structuredClone(PENDING_PRODUCT));
  state.featuredProductPlacements = [];
}

beforeEach(() => {
  resetState();
});

async function createPlacement(overrides = {}, actor = { role: "admin", sub: "admin-001" }) {
  return createFeaturedProductPlacement(
    {
      productId: LIVE_PRODUCT.id,
      shopId: SHOP_APPROVED.id,
      placementKey: "homepage_featured_products",
      titleOverride: "Featured in Tuti",
      subtitleOverride: "Luxury pick",
      imageOverrideUrl: "",
      badgeLabel: "New",
      priority: 5,
      ...overrides,
    },
    actor
  );
}

test("admin can create featured product placement", async () => {
  const placement = await createPlacement();
  assert.equal(placement.productId, LIVE_PRODUCT.id);
  assert.equal(placement.shopId, SHOP_APPROVED.id);
  assert.equal(placement.placementKey, "homepage_featured_products");
  assert.equal(placement.active, true);
  assert.equal(placement.product.status, "Live");
  assert.equal(placement.shop.status, "Approved");
});

test("non-admin cannot create update or delete placements", async () => {
  const placement = await createPlacement();

  await assert.rejects(
    createFeaturedProductPlacement(
      { productId: LIVE_PRODUCT.id, shopId: SHOP_APPROVED.id },
      { role: "seller", shopId: SHOP_APPROVED.id }
    ),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );

  await assert.rejects(
    updateFeaturedProductPlacement(placement.id, { priority: 20 }, { role: "seller", shopId: SHOP_APPROVED.id }),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );

  await assert.rejects(
    deleteFeaturedProductPlacement(placement.id, { role: "seller", shopId: SHOP_APPROVED.id }),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );
});

test("duplicate active placement guard works for same product and placementKey", async () => {
  await createPlacement();

  await assert.rejects(
    createFeaturedProductPlacement(
      { productId: LIVE_PRODUCT.id, shopId: SHOP_APPROVED.id, placementKey: "homepage_featured_products" },
      { role: "admin", sub: "admin-001" }
    ),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );
});

test("public endpoint returns active in-range placements only", async () => {
  await createPlacement();
  await createPlacement({ active: false, badgeLabel: "Inactive" });

  const list = await listPublicFeaturedProductPlacements("homepage_featured_products");
  assert.equal(list.length, 1);
  assert.equal(list[0].product.id, LIVE_PRODUCT.id);
  assert.equal(list[0].shop.name, SHOP_APPROVED.name);
});

test("public endpoint excludes inactive placements", async () => {
  await createPlacement({ active: false });
  const list = await listPublicFeaturedProductPlacements();
  assert.equal(list.length, 0);
});

test("public endpoint excludes out-of-date placements", async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await createPlacement({ startsAt: tomorrow.toISOString() });
  const list = await listPublicFeaturedProductPlacements();
  assert.equal(list.length, 0);
});

test("public endpoint excludes unpublished or non-live products and inactive shops", async () => {
  await createPlacement({ productId: DRAFT_PRODUCT.id, shopId: SHOP_APPROVED.id, badgeLabel: "Draft product" });
  await createPlacement({ productId: PENDING_PRODUCT.id, shopId: SHOP_PENDING.id, badgeLabel: "Pending shop" });

  const list = await listPublicFeaturedProductPlacements();
  assert.equal(list.length, 0);
});

test("priority sorting works", async () => {
  await createPlacement({ priority: 5, badgeLabel: "Low" });
  await createFeaturedProductPlacement(
    {
      productId: LIVE_PRODUCT.id,
      shopId: SHOP_APPROVED.id,
      placementKey: "luxury_picks",
      priority: 15,
      badgeLabel: "High",
    },
    { role: "admin", sub: "admin-001" }
  );

  const list = await listPublicFeaturedProductPlacements("homepage_featured_products");
  assert.equal(list.length, 1);

  const luxuryList = await listPublicFeaturedProductPlacements("luxury_picks");
  assert.equal(luxuryList.length, 1);
  assert.equal(luxuryList[0].badgeLabel, "High");
});

test("delete deactivates placement and removes it from public results", async () => {
  const placement = await createPlacement();
  const deleted = await deleteFeaturedProductPlacement(placement.id, { role: "admin", sub: "admin-001" });
  assert.equal(deleted.active, false);

  const list = await listPublicFeaturedProductPlacements("homepage_featured_products");
  assert.equal(list.length, 0);
});

test("public payload does not expose internal product or shop data", async () => {
  await createPlacement();
  const list = await listPublicFeaturedProductPlacements();
  assert.equal(list.length, 1);
  const item = list[0];
  assert.equal(item.createdBy, undefined);
  assert.equal(item.updatedBy, undefined);
  assert.equal(item.product.createdBy, undefined);
  assert.equal(item.product.updatedBy, undefined);
  assert.equal(item.product.sellerLastEditedAt, undefined);
  assert.equal(item.shop.status, undefined);
});
