import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const {
  createReview,
  getStorefrontData,
  searchProducts,
} = await import("./marketplace.service.js");
const {
  __injectSeedOrderForTests,
  __resetSeedOrdersForTests,
} = await import("../orders/orders.service.js");

const SHOP_APPROVED = {
  id: "shop-public-approved",
  name: "Oud Lane",
  owner: "Layla Rahman",
  ownerId: "seller-user-001",
  city: "Dubai",
  status: "Approved",
  fulfillmentRate: 97,
  disputeRate: 3,
  serviceRating: 4.8,
  payoutHoldDays: 7,
  commissionRate: 14,
  pendingBalance: 1220,
  availableBalance: 340,
  holdBalance: 80,
  paidBalance: 9200,
  avatar: "OL",
  story: "Small-batch oud and amber perfumes blended in Dubai.",
  cover: "Reserve oud blends",
  category: "perfume",
  categories: ["perfume", "gift_box"],
  deliveryModel: "seller_delivery",
  onboardingStep: "Admin review",
  repCode: "DXB-REP",
  repId: "rep-001",
  acquisitionSource: "sales_rep",
  adminNotices: [{ id: "notice-001", type: "warning", note: "Internal note" }],
  contractStatus: "Approved",
  contractTerminationReason: "Internal reason",
  contractUpdatedAt: "2026-06-01T00:00:00.000Z",
  sellerApplicationId: "seller-app-001",
  applicationContractStatus: "Approved",
  applicationConvertedAt: "2026-06-02T00:00:00.000Z",
  applicationBusinessName: "Oud Lane LLC",
};

const SHOP_PENDING = {
  id: "shop-public-pending",
  name: "Rose Vault",
  owner: "Sara Noor",
  city: "Abu Dhabi",
  status: "Pending review",
  fulfillmentRate: 95,
  serviceRating: 4.7,
  avatar: "RV",
};

const SHOP_SUSPENDED = {
  id: "shop-public-suspended",
  name: "Amber House",
  owner: "Nadia Ali",
  city: "Sharjah",
  status: "Suspended",
  fulfillmentRate: 88,
  serviceRating: 4.4,
  avatar: "AH",
};

const LIVE_APPROVED_PRODUCT = {
  id: "prd-public-live",
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
  orders: 18,
  verifiedReviews: 28,
  family: "Oud",
  gender: "Unisex",
  notes: ["amber", "saffron"],
  notePyramid: { top: ["saffron"], heart: ["oud"], base: ["amber"] },
  occasion: ["Eid"],
  intensity: "Bold",
  longevity: "Long lasting",
  description: "A rich oud blend with amber warmth.",
  ingredients: ["oud oil"],
  howToUse: "Apply lightly.",
  deliveryReturns: "Return unopened.",
  size: "75ml",
  bundledProductIds: ["prd-public-gift", "prd-hidden-draft", "prd-hidden-pending-shop"],
  includes: ["Perfume", "Gift card"],
  leadTimeDays: 2,
  customMessageAvailable: true,
  sellerLastEditedAt: "2026-06-06T00:00:00.000Z",
  approvalNote: "Internal approval note",
  workflowState: "admin-approved",
  rejectedBy: "admin-001",
  createdAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z",
};

const LIVE_APPROVED_GIFT_PRODUCT = {
  id: "prd-public-gift",
  name: "Oud Celebration Box",
  shopId: SHOP_APPROVED.id,
  category: "gift_box",
  price: 680,
  stock: 6,
  status: "Live",
  tags: ["Gift"],
  occasionTags: ["Birthday"],
  imagePath: "/uploads/live-gift.jpg",
  rating: 4.7,
  reviews: 9,
  orders: 5,
  verifiedReviews: 5,
  includes: ["Oud perfume", "Cake"],
  bundledProductIds: ["prd-public-live", "prd-hidden-rejected"],
  leadTimeDays: 2,
  customMessageAvailable: true,
};

const HIDDEN_DRAFT_PRODUCT = {
  id: "prd-hidden-draft",
  name: "Hidden Draft Oud",
  shopId: SHOP_APPROVED.id,
  category: "perfume",
  price: 310,
  stock: 9,
  status: "Draft",
  family: "Oud",
  gender: "Unisex",
};

const HIDDEN_NEEDS_APPROVAL_PRODUCT = {
  id: "prd-hidden-needs-approval",
  name: "Hidden Needs Approval Rose",
  shopId: SHOP_APPROVED.id,
  category: "perfume",
  price: 260,
  stock: 12,
  status: "Needs approval",
  family: "Floral",
  gender: "Women",
};

const HIDDEN_REJECTED_PRODUCT = {
  id: "prd-hidden-rejected",
  name: "Hidden Rejected Musk",
  shopId: SHOP_APPROVED.id,
  category: "perfume",
  price: 240,
  stock: 4,
  status: "Rejected",
  family: "Musk",
  gender: "Unisex",
};

const HIDDEN_PENDING_SHOP_PRODUCT = {
  id: "prd-hidden-pending-shop",
  name: "Pending Shop Live Rose",
  shopId: SHOP_PENDING.id,
  category: "perfume",
  price: 280,
  stock: 7,
  status: "Live",
  family: "Floral",
  gender: "Women",
};

const HIDDEN_SUSPENDED_SHOP_PRODUCT = {
  id: "prd-hidden-suspended-shop",
  name: "Suspended Shop Live Amber",
  shopId: SHOP_SUSPENDED.id,
  category: "perfume",
  price: 300,
  stock: 8,
  status: "Live",
  family: "Amber",
  gender: "Unisex",
};

const HIDDEN_PRODUCT_IDS = [
  HIDDEN_DRAFT_PRODUCT.id,
  HIDDEN_NEEDS_APPROVAL_PRODUCT.id,
  HIDDEN_REJECTED_PRODUCT.id,
  HIDDEN_PENDING_SHOP_PRODUCT.id,
  HIDDEN_SUSPENDED_SHOP_PRODUCT.id,
];

const INTERNAL_SHOP_FIELDS = [
  "owner",
  "ownerId",
  "pendingBalance",
  "availableBalance",
  "holdBalance",
  "paidBalance",
  "payoutHoldDays",
  "commissionRate",
  "disputeRate",
  "onboardingStep",
  "repCode",
  "repId",
  "acquisitionSource",
  "adminNotices",
  "contractStatus",
  "contractTerminationReason",
  "contractUpdatedAt",
  "sellerApplicationId",
  "applicationContractStatus",
  "applicationConvertedAt",
  "applicationBusinessName",
];

const INTERNAL_PRODUCT_FIELDS = [
  "sellerLastEditedAt",
  "approvalNote",
  "workflowState",
  "rejectedBy",
];

function resetState() {
  __resetSeedOrdersForTests();
  const state = seedRepository.getState();
  state.shops = [SHOP_APPROVED, SHOP_PENDING, SHOP_SUSPENDED].map((item) => structuredClone(item));
  state.products = [
    LIVE_APPROVED_PRODUCT,
    LIVE_APPROVED_GIFT_PRODUCT,
    HIDDEN_DRAFT_PRODUCT,
    HIDDEN_NEEDS_APPROVAL_PRODUCT,
    HIDDEN_REJECTED_PRODUCT,
    HIDDEN_PENDING_SHOP_PRODUCT,
    HIDDEN_SUSPENDED_SHOP_PRODUCT,
  ].map((item) => structuredClone(item));
  state.reviews = [
    {
      id: "rev-public",
      productId: LIVE_APPROVED_PRODUCT.id,
      customerId: "customer-internal-001",
      customer: "Aisha K.",
      rating: 5,
      title: "Beautiful oud",
      body: "A strong but polished perfume.",
      verified: true,
      helpful: 8,
      date: "2026-06-07",
      aspects: { scent: 5, longevity: 5, value: 4 },
    },
    {
      id: "rev-hidden-product",
      productId: HIDDEN_NEEDS_APPROVAL_PRODUCT.id,
      customerId: "customer-internal-002",
      customer: "Mona S.",
      rating: 4,
      title: "Hidden review",
      body: "This review should not be public.",
      verified: true,
      helpful: 1,
      date: "2026-06-08",
    },
  ];
  state.promotions = [
    {
      id: "promo-public-mixed",
      title: "Mixed promotion",
      subtitle: "Contains visible and hidden products.",
      cta: "Shop now",
      badge: "Featured",
      productIds: [LIVE_APPROVED_PRODUCT.id, HIDDEN_DRAFT_PRODUCT.id, HIDDEN_PENDING_SHOP_PRODUCT.id],
    },
    {
      id: "promo-hidden-only",
      title: "Hidden promotion",
      productIds: [HIDDEN_REJECTED_PRODUCT.id],
    },
  ];
  state.collections = [
    {
      id: "collection-public-mixed",
      title: "Mixed collection",
      description: "Contains visible and hidden products.",
      productIds: [LIVE_APPROVED_PRODUCT.id, LIVE_APPROVED_GIFT_PRODUCT.id, HIDDEN_NEEDS_APPROVAL_PRODUCT.id],
    },
    {
      id: "collection-hidden-only",
      title: "Hidden collection",
      description: "No visible products.",
      productIds: [HIDDEN_SUSPENDED_SHOP_PRODUCT.id],
    },
  ];
  state.roles = [{ id: "customer", name: "Customer" }];
}

function assertNoHiddenProductIds(value) {
  const serialized = JSON.stringify(value);
  for (const id of HIDDEN_PRODUCT_IDS) {
    assert.equal(serialized.includes(id), false, `${id} should not be exposed publicly`);
  }
}

beforeEach(resetState);

function customerUser(sub = "customer-review-001") {
  return { sub, role: "customer", name: "Verified Customer" };
}

function injectReviewOrder(overrides = {}) {
  __injectSeedOrderForTests({
    orderId: `ORD-REVIEW-${Math.random().toString(16).slice(2)}`,
    customerId: "customer-review-001",
    status: "Delivered",
    items: [{ productId: LIVE_APPROVED_PRODUCT.id, bundledProductIds: [] }],
    ...overrides,
  });
}

function reviewProduct() {
  return seedRepository.getState().products.find((product) => product.id === LIVE_APPROVED_PRODUCT.id);
}

function expectedRatingAfter(product, rating) {
  return Number(((product.rating * product.reviews + rating) / (product.reviews + 1)).toFixed(2));
}

test("public storefront returns only live products from approved shops and only approved shops", async () => {
  const storefront = await getStorefrontData();

  assert.deepEqual(storefront.products.map((product) => product.id).sort(), [
    LIVE_APPROVED_GIFT_PRODUCT.id,
    LIVE_APPROVED_PRODUCT.id,
  ].sort());
  assert.deepEqual(storefront.shops.map((shop) => shop.id), [SHOP_APPROVED.id]);
  assert.ok(storefront.products.every((product) => product.status === "Live"));
  assert.ok(storefront.products.every((product) => product.shopId === SHOP_APPROVED.id));
  assert.ok(storefront.shops.every((shop) => shop.status === "Approved"));
});

test("public storefront sanitizes product and shop internals", async () => {
  const storefront = await getStorefrontData();
  const product = storefront.products.find((item) => item.id === LIVE_APPROVED_PRODUCT.id);
  const shop = storefront.shops.find((item) => item.id === SHOP_APPROVED.id);
  const review = storefront.reviews.find((item) => item.id === "rev-public");

  assert.equal(product.name, LIVE_APPROVED_PRODUCT.name);
  assert.equal(product.shopId, SHOP_APPROVED.id);
  assert.equal(product.price, LIVE_APPROVED_PRODUCT.price);
  assert.deepEqual(product.bundledProductIds, [LIVE_APPROVED_GIFT_PRODUCT.id]);
  for (const field of INTERNAL_PRODUCT_FIELDS) {
    assert.equal(product[field], undefined, `${field} should be removed from public product data`);
  }

  assert.equal(shop.name, SHOP_APPROVED.name);
  assert.equal(shop.city, SHOP_APPROVED.city);
  assert.equal(shop.fulfillmentRate, SHOP_APPROVED.fulfillmentRate);
  for (const field of INTERNAL_SHOP_FIELDS) {
    assert.equal(shop[field], undefined, `${field} should be removed from public shop data`);
  }

  assert.equal(review.customerId, undefined);
});

test("public storefront references do not leak hidden product IDs", async () => {
  const storefront = await getStorefrontData();

  assertNoHiddenProductIds(storefront.products);
  assertNoHiddenProductIds(storefront.reviews);
  assertNoHiddenProductIds(storefront.promotions);
  assertNoHiddenProductIds(storefront.collections);
  assertNoHiddenProductIds(storefront.rankings);

  assert.deepEqual(storefront.promotions.map((promotion) => promotion.id), ["promo-public-mixed"]);
  assert.deepEqual(storefront.promotions[0].productIds, [LIVE_APPROVED_PRODUCT.id]);
  assert.deepEqual(storefront.collections.map((collection) => collection.id), ["collection-public-mixed"]);
  assert.deepEqual(storefront.collections[0].productIds.sort(), [
    LIVE_APPROVED_GIFT_PRODUCT.id,
    LIVE_APPROVED_PRODUCT.id,
  ].sort());

  const rankedProduct = storefront.rankings.topPerfumes.find((item) => item.id === LIVE_APPROVED_PRODUCT.id);
  const rankedShop = storefront.rankings.topShops.find((item) => item.id === SHOP_APPROVED.id);
  assert.ok(rankedProduct);
  assert.ok(rankedShop);
  for (const field of INTERNAL_PRODUCT_FIELDS) {
    assert.equal(rankedProduct[field], undefined, `${field} should be removed from ranked product data`);
  }
  for (const field of INTERNAL_SHOP_FIELDS) {
    assert.equal(rankedShop[field], undefined, `${field} should be removed from ranked shop data`);
  }
});

test("search returns only sanitized live products from approved shops", async () => {
  const visibleResult = await searchProducts({ q: "Midnight", page: 1, limit: 10 });
  assert.equal(visibleResult.total, 1);
  assert.deepEqual(visibleResult.results.map((product) => product.id), [LIVE_APPROVED_PRODUCT.id]);
  assert.equal(visibleResult.results[0].sellerLastEditedAt, undefined);
  assert.deepEqual(visibleResult.results[0].bundledProductIds, [LIVE_APPROVED_GIFT_PRODUCT.id]);

  const hiddenByStatus = await searchProducts({ q: "Hidden", page: 1, limit: 10 });
  assert.equal(hiddenByStatus.total, 0);
  assert.deepEqual(hiddenByStatus.results, []);

  const hiddenByShop = await searchProducts({ q: "Pending Shop", page: 1, limit: 10 });
  assert.equal(hiddenByShop.total, 0);
  assert.deepEqual(hiddenByShop.results, []);
});

test("review creation ignores client-supplied verified for guests while preserving rating aggregation", async () => {
  const productBefore = structuredClone(reviewProduct());

  const result = await createReview({
    productId: LIVE_APPROVED_PRODUCT.id,
    customer: "Guest reviewer",
    rating: 5,
    title: "Loved it",
    body: "A polished scent.",
    verified: true,
  });

  assert.equal(result.review.verified, false);
  assert.equal(result.review.customerId, null);
  assert.equal(result.product.reviews, productBefore.reviews + 1);
  assert.equal(result.product.rating, expectedRatingAfter(productBefore, 5));
  assert.equal(result.product.verifiedReviews, productBefore.verifiedReviews);
});

test("review creation verifies authenticated customer with delivered matching order", async () => {
  const productBefore = structuredClone(reviewProduct());
  const user = customerUser();
  injectReviewOrder({ customerId: user.sub, status: "Delivered" });

  const result = await createReview({
    productId: LIVE_APPROVED_PRODUCT.id,
    rating: 4,
    verified: false,
  }, user);

  assert.equal(result.review.verified, true);
  assert.equal(result.review.customerId, user.sub);
  assert.equal(result.product.reviews, productBefore.reviews + 1);
  assert.equal(result.product.rating, expectedRatingAfter(productBefore, 4));
  assert.equal(result.product.verifiedReviews, productBefore.verifiedReviews + 1);
});

test("review creation verifies customer accepted orders containing reviewed bundled product", async () => {
  const productBefore = structuredClone(seedRepository.getState().products.find((product) => product.id === LIVE_APPROVED_GIFT_PRODUCT.id));
  const user = customerUser("customer-review-bundle-001");
  injectReviewOrder({
    customerId: user.sub,
    status: "Customer Accepted",
    items: [{ productId: "gift-box-parent", bundledProductIds: [LIVE_APPROVED_GIFT_PRODUCT.id] }],
  });

  const result = await createReview({
    productId: LIVE_APPROVED_GIFT_PRODUCT.id,
    rating: 5,
  }, user);

  assert.equal(result.review.verified, true);
  assert.equal(result.review.customerId, user.sub);
  assert.equal(result.product.verifiedReviews, productBefore.verifiedReviews + 1);
});

test("review creation does not verify pending or non-delivered orders", async () => {
  const productBefore = structuredClone(reviewProduct());
  const user = customerUser("customer-review-pending-001");
  injectReviewOrder({ customerId: user.sub, status: "Pending" });

  const result = await createReview({
    productId: LIVE_APPROVED_PRODUCT.id,
    rating: 3,
    verified: true,
  }, user);

  assert.equal(result.review.verified, false);
  assert.equal(result.review.customerId, user.sub);
  assert.equal(result.product.verifiedReviews, productBefore.verifiedReviews);
});

test("review creation does not verify another customer's delivered order", async () => {
  const productBefore = structuredClone(reviewProduct());
  const user = customerUser("customer-review-owner-001");
  injectReviewOrder({
    customerId: "customer-review-other-001",
    status: "Delivered",
    items: [{ productId: LIVE_APPROVED_PRODUCT.id, bundledProductIds: [] }],
  });

  const result = await createReview({
    productId: LIVE_APPROVED_PRODUCT.id,
    rating: 5,
    verified: true,
  }, user);

  assert.equal(result.review.verified, false);
  assert.equal(result.review.customerId, user.sub);
  assert.equal(result.product.verifiedReviews, productBefore.verifiedReviews);
});
