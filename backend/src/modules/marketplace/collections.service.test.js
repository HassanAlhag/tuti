import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const {
  __resetCuratedCollectionsForTests,
  createCollection: createCuratedCollection,
  deleteCollection,
  getAdminCollection,
  getPublicCollectionBySlug,
  listAdminCollections,
  listPublicCollections,
  updateCollection,
} = await import("./collections.service.js");

const {
  __resetBrandProfilesForTests,
  updateSellerBrandProfile,
} = await import("./brandProfile.service.js");

const SHOP_ONE = {
  id: "shop-collection-001",
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
  id: "shop-collection-002",
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

const SHOP_PENDING = {
  id: "shop-collection-003",
  name: "Musk Room",
  owner: "Hadi Saleh",
  city: "Sharjah",
  status: "Pending review",
  fulfillmentRate: 88,
  serviceRating: 4.2,
  avatar: "MR",
  story: "Quiet luxury skin scents.",
  cover: "Musk atelier",
};

const LIVE_PRODUCT = {
  id: "prd-collection-live-001",
  name: "Velvet Musk No. 8",
  shopId: SHOP_ONE.id,
  category: "perfume",
  price: 280,
  originalPrice: 330,
  stock: 9,
  status: "Live",
  tags: ["Musk", "Luxury"],
  occasionTags: ["Daily"],
  releaseType: "Limited Drop",
  collection: "Skin Scent Studio",
  color: "#52796f",
  accent: "#e9c46a",
  imagePath: "/uploads/velvet-musk.jpg",
  rating: 4.7,
  reviews: 35,
  verifiedReviews: 32,
  family: "Musk",
  gender: "Unisex",
  notes: ["clean musk", "tonka"],
  description: "A soft musk perfume with a quiet skin-scent profile.",
  size: "75ml",
  leadTimeDays: 1,
  customMessageAvailable: true,
  createdAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z",
};

const DRAFT_PRODUCT = {
  id: "prd-collection-draft-001",
  name: "Hidden Oud Draft",
  shopId: SHOP_ONE.id,
  category: "perfume",
  price: 320,
  stock: 4,
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
  id: "prd-collection-pending-001",
  name: "Rose Vault Live Draft",
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
  __resetBrandProfilesForTests();
  __resetCuratedCollectionsForTests();
  const state = seedRepository.getState();
  state.shops.splice(0, state.shops.length, structuredClone(SHOP_ONE), structuredClone(SHOP_TWO), structuredClone(SHOP_PENDING));
  state.products.splice(0, state.products.length, structuredClone(LIVE_PRODUCT), structuredClone(DRAFT_PRODUCT), structuredClone(PENDING_PRODUCT));
  state.curatedCollections = [];
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

async function createCollection(overrides = {}, actor = { role: "admin", sub: "admin-001" }) {
  const seedBaseItems = overrides.seedBaseItems !== false;
  const brandTwo = seedBaseItems ? await createPublishedProfile(SHOP_TWO) : null;
  const extraItems = Array.isArray(overrides.items) ? overrides.items : [];
  const {
    seedBaseItems: _seedBaseItems,
    items: _overrideItems,
    ...payloadOverrides
  } = overrides;
  return createCuratedCollection({
    title: "Eid Gifts",
    subtitle: "A gift-led perfume edit for festive occasions.",
    description: "Luxury scents and gift-ready edits.",
    bannerUrl: "/uploads/collections/eid.jpg",
    mobileBannerUrl: "/uploads/collections/eid-mobile.jpg",
    placementKey: "homepage_collections",
    theme: "festive",
    priority: 10,
    published: true,
    items: seedBaseItems
      ? [
        {
          type: "product",
          productId: LIVE_PRODUCT.id,
          shopId: SHOP_ONE.id,
          titleOverride: "Velvet Musk Edit",
          subtitleOverride: "Quiet musk and clean woods.",
          badgeLabel: "Luxury pick",
          priority: 20,
        },
        {
          type: "seller",
          shopId: SHOP_TWO.id,
          brandProfileId: brandTwo.id,
          titleOverride: "Rose Vault",
          subtitleOverride: "Soft florals and gift-ready perfume.",
          badgeLabel: "Approved seller",
          priority: 15,
        },
        ...extraItems,
      ]
      : extraItems,
    ...payloadOverrides,
  }, actor);
}

test("admin can create collection", async () => {
  const collection = await createCollection();
  assert.equal(collection.title, "Eid Gifts");
  assert.equal(collection.slug, "eid-gifts");
  assert.equal(collection.active, true);
  assert.equal(collection.published, true);
  assert.equal(collection.items.length >= 2, true);
});

test("admin can update collection items", async () => {
  const collection = await createCollection();
  const updated = await updateCollection(
    collection.id,
    {
      title: "Eid Gifts Updated",
      items: [
        {
          type: "product",
          productId: LIVE_PRODUCT.id,
          shopId: SHOP_ONE.id,
          titleOverride: "Velvet Musk No. 8",
          priority: 50,
        },
      ],
    },
    { role: "admin", sub: "admin-001" }
  );

  assert.equal(updated.title, "Eid Gifts Updated");
  assert.equal(updated.slug, collection.slug);
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].title, "Velvet Musk No. 8");
});

test("non-admin cannot create update or delete collections", async () => {
  const collection = await createCollection();

  await assert.rejects(
    createCollection(
      { title: "Another edit" },
      { role: "seller", shopId: SHOP_ONE.id }
    ),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );

  await assert.rejects(
    updateCollection(collection.id, { title: "Nope" }, { role: "seller", shopId: SHOP_ONE.id }),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );

  await assert.rejects(
    deleteCollection(collection.id, { role: "seller", shopId: SHOP_ONE.id }),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );
});

test("duplicate slug guard works", async () => {
  const first = await createCollection({ title: "Luxury Evening Scents" });
  const second = await createCollection({ title: "Luxury Evening Scents" });
  assert.notEqual(first.slug, second.slug);
});

test("slug remains stable after title changes", async () => {
  const collection = await createCollection({ title: "Office / Daily Wear" });
  const updated = await updateCollection(
    collection.id,
    { title: "Office / Daily Wear Updated" },
    { role: "admin", sub: "admin-001" }
  );

  assert.equal(updated.slug, collection.slug);
});

test("public only sees active published in-range collections", async () => {
  await createCollection({ title: "Eid Gifts" });
  await createCollection({ title: "Inactive Collection", active: false });
  await createCollection({ title: "Unpublished Collection", published: false });
  await createCollection({ title: "Future Collection", startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });

  const list = await listPublicCollections();
  assert.equal(list.length, 1);
  assert.equal(list[0].slug, "eid-gifts");
});

test("product items are filtered by live visibility and shop approval", async () => {
  await createPublishedProfile(SHOP_ONE);
  const collection = await createCollection({
    title: "Filter Check",
    seedBaseItems: false,
    items: [
      { type: "product", productId: LIVE_PRODUCT.id, shopId: SHOP_ONE.id, priority: 30 },
      { type: "product", productId: DRAFT_PRODUCT.id, shopId: SHOP_ONE.id, priority: 20 },
      { type: "product", productId: PENDING_PRODUCT.id, shopId: SHOP_PENDING.id, priority: 10 },
    ],
  });

  const publicCollection = await getPublicCollectionBySlug(collection.slug);
  assert.equal(publicCollection.items.length, 1);
  assert.equal(publicCollection.items[0].type, "product");
  assert.equal(publicCollection.items[0].product.id, LIVE_PRODUCT.id);
});

test("seller items are filtered by published brand profile", async () => {
  const publishedBrand = await createPublishedProfile(SHOP_ONE);
  const unpublishedBrand = await updateSellerBrandProfile(
    SHOP_TWO.id,
    {
      displayName: SHOP_TWO.name,
      brandStory: SHOP_TWO.story,
      logoUrl: SHOP_TWO.avatar,
      bannerUrl: SHOP_TWO.cover,
      shortTagline: `${SHOP_TWO.name} luxury fragrance`,
      published: false,
    },
    { role: "seller", shopId: SHOP_TWO.id }
  );

  const collection = await createCollection({
    title: "Seller Filter",
    seedBaseItems: false,
    items: [
      { type: "product", productId: LIVE_PRODUCT.id, shopId: SHOP_ONE.id, priority: 30 },
      { type: "seller", shopId: SHOP_ONE.id, brandProfileId: publishedBrand.id, priority: 20 },
      { type: "seller", shopId: SHOP_TWO.id, brandProfileId: unpublishedBrand.id, priority: 10 },
    ],
  });

  const publicCollection = await getPublicCollectionBySlug(collection.slug);
  assert.equal(publicCollection.items.length, 2);
  assert.equal(publicCollection.items.some((item) => item.seller?.slug === "oud-lane"), true);
  assert.equal(publicCollection.items.some((item) => item.seller?.slug === "rose-vault"), false);
  assert.equal(publicCollection.items.some((item) => item.product?.id === LIVE_PRODUCT.id), true);
});

test("priority sorting works for collections and items", async () => {
  const first = await createCollection({ title: "Low Priority", priority: 1 });
  const second = await createCollection({ title: "High Priority", priority: 20 });

  const list = await listPublicCollections();
  assert.equal(list[0].slug, second.slug);
  assert.equal(list[1].slug, first.slug);

  const updated = await updateCollection(
    first.id,
    {
      items: [
        { type: "product", productId: LIVE_PRODUCT.id, shopId: SHOP_ONE.id, priority: 5, titleOverride: "B" },
        { type: "product", productId: LIVE_PRODUCT.id, shopId: SHOP_ONE.id, priority: 15, titleOverride: "A" },
      ],
    },
    { role: "admin", sub: "admin-001" }
  );

  assert.equal(updated.items[0].title, "A");
  assert.equal(updated.items[1].title, "B");
});

test("delete deactivates collection and hides it from public results", async () => {
  const collection = await createCollection({ title: "Seasonal Collection" });
  const deleted = await deleteCollection(collection.id, { role: "admin", sub: "admin-001" });
  assert.equal(deleted.active, false);

  await assert.rejects(
    getPublicCollectionBySlug(collection.slug),
    (error) => {
      assert.equal(error.status, 404);
      return true;
    }
  );

  const list = await listPublicCollections();
  assert.equal(list.some((item) => item.slug === collection.slug), false);
});

test("public payload does not expose internal data", async () => {
  const collection = await createCollection();
  const publicCollection = await getPublicCollectionBySlug(collection.slug);
  assert.equal(publicCollection.createdBy, undefined);
  assert.equal(publicCollection.updatedBy, undefined);
  assert.equal(publicCollection.items[0].createdBy, undefined);
  assert.equal(publicCollection.items[0].updatedBy, undefined);
  assert.equal(publicCollection.items[0].shop.status, undefined);
  assert.equal(publicCollection.items[0].product.shopId, undefined);
});
