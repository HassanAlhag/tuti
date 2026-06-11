import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const {
  __resetFeaturedSellerPlacementsForTests,
  createFeaturedSellerPlacement,
  deleteFeaturedSellerPlacement,
  listAdminFeaturedSellerPlacements,
  listPublicFeaturedSellerPlacements,
  updateFeaturedSellerPlacement,
} = await import("./featured-sellers.service.js");

const {
  __resetBrandProfilesForTests,
  listAdminSellerBrandProfiles,
  updateSellerBrandProfile,
} = await import("./brandProfile.service.js");

const SHOP_ONE = {
  id: "shop-featured-001",
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

const SHOP_TWO = {
  id: "shop-featured-002",
  name: "Rose Vault",
  owner: "Sara Noor",
  city: "Abu Dhabi",
  status: "Approved",
  fulfillmentRate: 95,
  serviceRating: 4.7,
  avatar: "RV",
  story: "Soft florals, rose oils, and modern gift-ready perfume.",
  cover: "Fresh floral atelier",
};

function resetState() {
  __resetBrandProfilesForTests();
  __resetFeaturedSellerPlacementsForTests();
  const state = seedRepository.getState();
  state.shops.splice(0, state.shops.length, structuredClone(SHOP_ONE), structuredClone(SHOP_TWO));
}

async function createPublishedProfile(shop, overrides = {}) {
  return updateSellerBrandProfile(
    shop.id,
    {
      displayName: shop.name,
      brandStory: shop.story,
      logoUrl: shop.avatar,
      bannerUrl: shop.cover,
      shortTagline: `${shop.name} luxury fragrance`,
      fragranceIdentityTags: ["oud", "amber"],
      specialties: ["luxury", "gifting"],
      trustBadges: ["Approved seller"],
      sellerPolicies: [{ label: "Returns", value: "7 days" }],
      socialLinks: [{ label: "Instagram", url: "https://instagram.com/example" }],
      published: true,
      ...overrides,
    },
    { role: "seller", shopId: shop.id }
  );
}

beforeEach(() => {
  resetState();
});

test("admin can create featured seller placement", async () => {
  const brandProfile = await createPublishedProfile(SHOP_ONE);
  const placement = await createFeaturedSellerPlacement(
    {
      shopId: SHOP_ONE.id,
      brandProfileId: brandProfile.id,
      placementKey: "homepage_featured_sellers",
      titleOverride: "Featured on Tuti",
      subtitleOverride: "Luxury fragrance spotlight",
      priority: 9,
    },
    { role: "admin", sub: "admin-001" }
  );

  assert.equal(placement.shopId, SHOP_ONE.id);
  assert.equal(placement.brandProfile.id, brandProfile.id);
  assert.equal(placement.placementKey, "homepage_featured_sellers");
  assert.equal(placement.active, true);
  assert.equal(placement.priority, 9);

  const adminList = await listAdminFeaturedSellerPlacements();
  assert.equal(adminList[0].brandProfile.published, true);
});

test("admin brand profile selector list includes seller metadata", async () => {
  await createPublishedProfile(SHOP_ONE);
  const profiles = await listAdminSellerBrandProfiles();
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].shopName, SHOP_ONE.name);
  assert.equal(profiles[0].published, true);
});

test("non-admin cannot create update or delete placements", async () => {
  const brandProfile = await createPublishedProfile(SHOP_ONE);
  const placement = await createFeaturedSellerPlacement(
    { shopId: SHOP_ONE.id, brandProfileId: brandProfile.id },
    { role: "admin", sub: "admin-001" }
  );

  await assert.rejects(
    createFeaturedSellerPlacement(
      { shopId: SHOP_ONE.id, brandProfileId: brandProfile.id },
      { role: "seller", shopId: SHOP_ONE.id }
    ),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );

  await assert.rejects(
    updateFeaturedSellerPlacement(placement.id, { priority: 12 }, { role: "seller", shopId: SHOP_ONE.id }),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );

  await assert.rejects(
    deleteFeaturedSellerPlacement(placement.id, { role: "seller", shopId: SHOP_ONE.id }),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );
});

test("public endpoint only returns active placements", async () => {
  const brandProfile = await createPublishedProfile(SHOP_ONE);
  await createFeaturedSellerPlacement(
    { shopId: SHOP_ONE.id, brandProfileId: brandProfile.id, priority: 5 },
    { role: "admin", sub: "admin-001" }
  );
  await createFeaturedSellerPlacement(
    {
      shopId: SHOP_ONE.id,
      brandProfileId: brandProfile.id,
      placementKey: "homepage_featured_sellers",
      priority: 2,
      active: false,
    },
    { role: "admin", sub: "admin-001" }
  );

  const publicList = await listPublicFeaturedSellerPlacements();
  assert.equal(publicList.length, 1);
  assert.equal(publicList[0].seller.slug, "oud-lane");
});

test("public endpoint excludes out-of-date placements", async () => {
  const brandProfile = await createPublishedProfile(SHOP_ONE);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const publicList = await createFeaturedSellerPlacement(
    {
      shopId: SHOP_ONE.id,
      brandProfileId: brandProfile.id,
      startsAt: tomorrow.toISOString(),
      priority: 1,
    },
    { role: "admin", sub: "admin-001" }
  );

  const list = await listPublicFeaturedSellerPlacements();
  assert.equal(list.length, 0);
  assert.equal(publicList.active, true);
});

test("public endpoint excludes unpublished seller brand profiles", async () => {
  const brandProfile = await createPublishedProfile(SHOP_ONE);
  await createFeaturedSellerPlacement(
    { shopId: SHOP_ONE.id, brandProfileId: brandProfile.id, priority: 4 },
    { role: "admin", sub: "admin-001" }
  );

  await updateSellerBrandProfile(
    SHOP_ONE.id,
    { published: false },
    { role: "seller", shopId: SHOP_ONE.id }
  );

  const list = await listPublicFeaturedSellerPlacements();
  assert.equal(list.length, 0);
});

test("priority sorting works", async () => {
  const brandOne = await createPublishedProfile(SHOP_ONE);
  const brandTwo = await createPublishedProfile(SHOP_TWO);

  await createFeaturedSellerPlacement(
    { shopId: SHOP_ONE.id, brandProfileId: brandOne.id, priority: 5 },
    { role: "admin", sub: "admin-001" }
  );
  await createFeaturedSellerPlacement(
    { shopId: SHOP_TWO.id, brandProfileId: brandTwo.id, priority: 15 },
    { role: "admin", sub: "admin-001" }
  );

  const list = await listPublicFeaturedSellerPlacements();
  assert.equal(list.length, 2);
  assert.equal(list[0].seller.slug, "rose-vault");
  assert.equal(list[1].seller.slug, "oud-lane");
});

test("delete deactivates placement and removes it from public results", async () => {
  const brandProfile = await createPublishedProfile(SHOP_ONE);
  const placement = await createFeaturedSellerPlacement(
    { shopId: SHOP_ONE.id, brandProfileId: brandProfile.id, priority: 7 },
    { role: "admin", sub: "admin-001" }
  );

  const deleted = await deleteFeaturedSellerPlacement(placement.id, { role: "admin", sub: "admin-001" });
  assert.equal(deleted.active, false);

  const list = await listPublicFeaturedSellerPlacements();
  assert.equal(list.length, 0);
});

test("duplicate active placement guard works for same shop and placementKey", async () => {
  const brandProfile = await createPublishedProfile(SHOP_ONE);
  await createFeaturedSellerPlacement(
    { shopId: SHOP_ONE.id, brandProfileId: brandProfile.id, placementKey: "homepage_featured_sellers" },
    { role: "admin", sub: "admin-001" }
  );

  await assert.rejects(
    createFeaturedSellerPlacement(
      { shopId: SHOP_ONE.id, brandProfileId: brandProfile.id, placementKey: "homepage_featured_sellers" },
      { role: "admin", sub: "admin-001" }
    ),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );
});

test("public payload does not expose operational shop data", async () => {
  const brandProfile = await createPublishedProfile(SHOP_ONE);
  await createFeaturedSellerPlacement(
    { shopId: SHOP_ONE.id, brandProfileId: brandProfile.id, priority: 8 },
    { role: "admin", sub: "admin-001" }
  );

  const list = await listPublicFeaturedSellerPlacements();
  assert.equal(list.length, 1);
  const item = list[0];
  assert.equal(item.shopId, undefined);
  assert.equal(item.brandProfileId, undefined);
  assert.equal(item.createdBy, undefined);
  assert.equal(item.updatedBy, undefined);
  assert.equal(item.seller.shopId, undefined);
});
