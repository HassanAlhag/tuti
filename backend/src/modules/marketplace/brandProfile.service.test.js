import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const {
  __resetBrandProfilesForTests,
  computeCompletenessScore,
  getPublicPublishedBrandProfileBySlug,
  getPublicSellerProductsBySlug,
  getSellerBrandProfile,
  updateSellerBrandProfile,
} = await import("./brandProfile.service.js");

const SHOP_ONE = {
  id: "shop-brand-001",
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
  id: "shop-brand-002",
  name: "Oud Lane",
  owner: "Sara Noor",
  city: "Abu Dhabi",
  status: "Pending review",
  fulfillmentRate: 88,
  serviceRating: 4.2,
  avatar: "OL",
  story: "A second perfume atelier.",
  cover: "Modern perfume atelier",
};

const PRODUCTS = [
  {
    id: "prd-live-001",
    name: "Oud Noir",
    shopId: SHOP_ONE.id,
    status: "Live",
    category: "perfume",
    price: 320,
    originalPrice: 360,
    stock: 10,
    imagePath: "/uploads/oud-noir.webp",
    rating: 4.7,
    reviews: 18,
    verifiedReviews: 12,
    family: "Oud",
    gender: "Unisex",
    notes: ["oud", "amber"],
    occasionTags: ["gift"],
    releaseType: "Signature",
    collection: "Luxury Picks",
    color: "#111111",
    accent: "#d9a441",
    size: "75ml",
    description: "A deep amber oud.",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "prd-draft-001",
    name: "Oud Draft",
    shopId: SHOP_ONE.id,
    status: "Draft",
    category: "perfume",
    price: 180,
    stock: 4,
    createdAt: "2026-06-01T11:00:00.000Z",
  },
  {
    id: "prd-live-002",
    name: "Other Shop Live",
    shopId: SHOP_TWO.id,
    status: "Live",
    category: "perfume",
    price: 190,
    stock: 7,
    createdAt: "2026-06-01T12:00:00.000Z",
  },
];

function resetState() {
  __resetBrandProfilesForTests();
  const state = seedRepository.getState();
  state.shops.splice(0, state.shops.length, structuredClone(SHOP_ONE), structuredClone(SHOP_TWO));
  state.products.splice(0, state.products.length, ...structuredClone(PRODUCTS));
}

beforeEach(() => {
  resetState();
});

test("seller gets a draft seeded from Shop when no profile exists", async () => {
  const draft = await getSellerBrandProfile(SHOP_ONE.id);
  assert.equal(draft.shopId, SHOP_ONE.id);
  assert.equal(draft.displayName, SHOP_ONE.name);
  assert.equal(draft.brandStory, SHOP_ONE.story);
  assert.equal(draft.logoUrl, SHOP_ONE.avatar);
  assert.equal(draft.bannerUrl, SHOP_ONE.cover);
  assert.equal(draft.published, false);
  assert.equal(typeof draft.slug, "string");
  assert.ok(draft.completenessScore > 0);
});

test("seller can create and update own profile", async () => {
  const created = await updateSellerBrandProfile(
    SHOP_ONE.id,
    {
      displayName: "Oud Lane",
      displayNameAr: "درب العود",
      shortTagline: "Luxury oud and amber",
      brandStory: "Hand-blended fragrance from Dubai.",
      fragranceIdentityTags: ["oud", "amber"],
      specialties: ["luxury", "gifting"],
      trustBadges: ["Approved seller"],
      sellerPolicies: [{ label: "Returns", value: "7 days" }],
      socialLinks: [{ label: "Instagram", url: "https://instagram.com/oudlane" }],
    },
    { role: "seller", shopId: SHOP_ONE.id }
  );

  assert.equal(created.shopId, SHOP_ONE.id);
  assert.equal(created.displayName, "Oud Lane");
  assert.equal(created.slug, "oud-lane");
  assert.deepEqual(created.fragranceIdentityTags, ["oud", "amber"]);

  const updated = await updateSellerBrandProfile(
    SHOP_ONE.id,
    {
      displayName: "Oud Lane House",
      shortTagline: "Luxury oud and amber",
      published: true,
    },
    { role: "seller", shopId: SHOP_ONE.id }
  );

  assert.equal(updated.displayName, "Oud Lane House");
  assert.equal(updated.slug, created.slug);
  assert.equal(updated.published, true);
  assert.equal(typeof updated.completenessScore, "number");
  assert.ok(updated.completenessScore > 0);
});

test("partial seller profile updates preserve existing fields", async () => {
  const created = await updateSellerBrandProfile(
    SHOP_ONE.id,
    {
      displayName: "Oud Lane",
      displayNameAr: "درب العود",
      shortTagline: "Luxury oud and amber",
      brandStory: "Hand-blended fragrance from Dubai.",
      fragranceIdentityTags: ["oud", "amber"],
      specialties: ["luxury", "gifting"],
      trustBadges: ["Approved seller"],
      sellerPolicies: [{ label: "Returns", value: "7 days" }],
      socialLinks: [{ label: "Instagram", url: "https://instagram.com/oudlane" }],
    },
    { role: "seller", shopId: SHOP_ONE.id }
  );

  const republished = await updateSellerBrandProfile(
    SHOP_ONE.id,
    { published: true },
    { role: "seller", shopId: SHOP_ONE.id }
  );

  assert.equal(republished.slug, created.slug);
  assert.equal(republished.displayName, "Oud Lane");
  assert.equal(republished.shortTagline, "Luxury oud and amber");
  assert.equal(republished.brandStory, "Hand-blended fragrance from Dubai.");
  assert.deepEqual(republished.fragranceIdentityTags, ["oud", "amber"]);
  assert.equal(republished.published, true);
});

test("seller cannot update another shop profile", async () => {
  await assert.rejects(
    updateSellerBrandProfile(
      SHOP_ONE.id,
      { displayName: "Should not pass" },
      { role: "seller", shopId: SHOP_TWO.id }
    ),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );
});

test("slug is unique across shops with the same display name", async () => {
  const one = await updateSellerBrandProfile(SHOP_ONE.id, { displayName: "Shared Name" }, { role: "seller", shopId: SHOP_ONE.id });
  const two = await updateSellerBrandProfile(SHOP_TWO.id, { displayName: "Shared Name" }, { role: "seller", shopId: SHOP_TWO.id });

  assert.notEqual(one.slug, two.slug);
  assert.equal(one.slug.startsWith("shared-name"), true);
  assert.equal(two.slug.startsWith("shared-name"), true);
});

test("slug stays stable after display name changes", async () => {
  const created = await updateSellerBrandProfile(SHOP_ONE.id, { displayName: "Rose Vault" }, { role: "seller", shopId: SHOP_ONE.id });
  const changed = await updateSellerBrandProfile(SHOP_ONE.id, { displayName: "Rose Vault Atelier" }, { role: "seller", shopId: SHOP_ONE.id });

  assert.equal(created.slug, changed.slug);
});

test("completeness score is computed from filled fields", () => {
  const score = computeCompletenessScore({
    displayName: "Oud Lane",
    shortTagline: "Luxury oud",
    brandStory: "Hand-blended in Dubai.",
    logoUrl: "/logo.png",
    bannerUrl: "/banner.png",
    fragranceIdentityTags: ["oud"],
    specialties: ["gifting"],
    trustBadges: ["Approved seller"],
    sellerPolicies: [{ label: "Returns", value: "7 days" }],
    socialLinks: [{ label: "Instagram", url: "https://instagram.com/oudlane" }],
    displayNameAr: "",
    shortTaglineAr: "",
    brandStoryAr: "",
  });

  assert.equal(score > 0, true);
  assert.equal(score <= 100, true);
});

test("public cannot see unpublished profile", async () => {
  const created = await updateSellerBrandProfile(SHOP_ONE.id, { displayName: "Oud Lane" }, { role: "seller", shopId: SHOP_ONE.id });

  await assert.rejects(
    getPublicPublishedBrandProfileBySlug(created.slug),
    (error) => {
      assert.equal(error.status, 404);
      return true;
    }
  );
});

test("public can view published profile by slug", async () => {
  const created = await updateSellerBrandProfile(
    SHOP_ONE.id,
    { displayName: "Oud Lane", brandStory: "Luxury oud.", published: true },
    { role: "seller", shopId: SHOP_ONE.id }
  );

  const publicProfile = await getPublicPublishedBrandProfileBySlug(created.slug);
  assert.equal(publicProfile.slug, created.slug);
  assert.equal(publicProfile.displayName, "Oud Lane");
  assert.equal(publicProfile.published, true);
  assert.equal(publicProfile.shopId, undefined);
});

test("public products endpoint returns only live products for that seller", async () => {
  const created = await updateSellerBrandProfile(SHOP_ONE.id, { displayName: "Oud Lane", published: true }, { role: "seller", shopId: SHOP_ONE.id });
  const products = await getPublicSellerProductsBySlug(created.slug);

  assert.deepEqual(products.map((product) => product.id), ["prd-live-001"]);
  assert.ok(products.every((product) => product.shopId === undefined));
});

test("public payload does not expose operational data", async () => {
  const created = await updateSellerBrandProfile(SHOP_ONE.id, { displayName: "Oud Lane", published: true }, { role: "seller", shopId: SHOP_ONE.id });
  const publicProfile = await getPublicPublishedBrandProfileBySlug(created.slug);

  assert.equal(publicProfile.shopId, undefined);
  assert.equal(publicProfile.owner, undefined);
  assert.equal(publicProfile.city, undefined);
  assert.equal(publicProfile.availableBalance, undefined);
  assert.equal(publicProfile.pendingBalance, undefined);
  assert.equal(publicProfile.status, undefined);
});
