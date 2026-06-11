import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const {
  __resetBrandProfilesForTests,
  updateSellerBrandProfile,
} = await import("./brandProfile.service.js");
const {
  __resetFeaturedSellerPlacementsForTests,
  createFeaturedSellerPlacement,
} = await import("./featured-sellers.service.js");
const {
  __resetFeaturedProductPlacementsForTests,
  createFeaturedProductPlacement,
} = await import("./featured-products.service.js");
const {
  __resetCuratedCollectionsForTests,
  createCollection,
} = await import("./collections.service.js");
const {
  getSellerPerformanceSummary,
} = await import("./seller-performance.service.js");
const {
  __resetSeedOrdersForTests,
  __injectSeedOrderForTests,
} = await import("../orders/orders.service.js");
const {
  __resetSupportTicketsForTests,
  createSupportTicket,
  updateSupportTicketStatus,
} = await import("../support/support.service.js");

const SHOP_MAIN = {
  id: "shop-perf-main",
  name: "Oud Lane",
  owner: "Layla Rahman",
  city: "Dubai",
  status: "Approved",
  fulfillmentRate: 97,
  serviceRating: 4.8,
  avatar: "OL",
  story: "Small-batch oud and amber perfumes blended in Dubai.",
  cover: "Reserve oud blends",
  pendingBalance: 1800,
  availableBalance: 6420,
  holdBalance: 500,
  paidBalance: 12400,
};

const SHOP_OTHER = {
  id: "shop-perf-other",
  name: "Rose Vault",
  owner: "Sara Noor",
  city: "Abu Dhabi",
  status: "Approved",
  fulfillmentRate: 95,
  serviceRating: 4.7,
  avatar: "RV",
  story: "Soft florals and gift-ready perfume.",
  cover: "Fresh floral atelier",
  pendingBalance: 100,
  availableBalance: 200,
  holdBalance: 50,
  paidBalance: 900,
};

const SHOP_EMPTY = {
  id: "shop-perf-empty",
  name: "New Ember",
  owner: "Noor Ali",
  city: "Sharjah",
  status: "Approved",
  fulfillmentRate: 0,
  serviceRating: 0,
  avatar: "NE",
  story: "Fresh perfume start.",
  cover: "New ember cover",
  pendingBalance: 0,
  availableBalance: 0,
  holdBalance: 0,
  paidBalance: 0,
};

const MAIN_PRODUCTS = [
  {
    id: "prd-perf-main-a",
    name: "Midnight Oud Reserve",
    shopId: SHOP_MAIN.id,
    category: "perfume",
    price: 100,
    stock: 4,
    status: "Live",
    imagePath: "/uploads/main-a.jpg",
    rating: 4.8,
    reviews: 12,
    verifiedReviews: 8,
    family: "Oud",
    gender: "Unisex",
    notes: ["amber", "saffron"],
    occasionTags: ["gift"],
    releaseType: "Signature",
    collection: "Luxury line",
    description: "Rich oud with amber warmth.",
    size: "75ml",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "prd-perf-main-b",
    name: "Velvet Musk No. 8",
    shopId: SHOP_MAIN.id,
    category: "perfume",
    price: 150,
    stock: 12,
    status: "Live",
    imagePath: "/uploads/main-b.jpg",
    rating: 4.6,
    reviews: 18,
    verifiedReviews: 13,
    family: "Musk",
    gender: "Unisex",
    notes: ["clean musk"],
    occasionTags: ["daily"],
    releaseType: "Featured",
    collection: "Skin scent studio",
    description: "Quiet luxury musk.",
    size: "50ml",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "prd-perf-main-low",
    name: "Low Stock Oud",
    shopId: SHOP_MAIN.id,
    category: "perfume",
    price: 300,
    stock: 3,
    status: "Live",
    imagePath: "/uploads/main-low.jpg",
    rating: 4.4,
    reviews: 5,
    verifiedReviews: 4,
    family: "Oud",
    gender: "Men",
    notes: ["smoke"],
    occasionTags: ["evening"],
    releaseType: "Seasonal",
    collection: "Night edit",
    description: "Smoky evening oud.",
    size: "100ml",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "prd-perf-main-draft",
    name: "Draft Amber",
    shopId: SHOP_MAIN.id,
    category: "perfume",
    price: 200,
    stock: 7,
    status: "Needs approval",
    imagePath: "/uploads/main-draft.jpg",
    rating: 0,
    reviews: 0,
    verifiedReviews: 0,
    family: "Amber",
    gender: "Women",
    notes: ["amber"],
    description: "Draft product.",
    size: "50ml",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "prd-perf-main-rejected",
    name: "Rejected Rose",
    shopId: SHOP_MAIN.id,
    category: "perfume",
    price: 120,
    stock: 2,
    status: "Rejected",
    imagePath: "/uploads/main-rejected.jpg",
    rating: 0,
    reviews: 0,
    verifiedReviews: 0,
    family: "Floral",
    gender: "Women",
    notes: ["rose"],
    description: "Rejected product.",
    size: "50ml",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
];

const OTHER_PRODUCT = {
  id: "prd-perf-other-a",
  name: "Other Shop Oud",
  shopId: SHOP_OTHER.id,
  category: "perfume",
  price: 999,
  stock: 10,
  status: "Live",
  imagePath: "/uploads/other-a.jpg",
  rating: 4.9,
  reviews: 22,
  verifiedReviews: 18,
  family: "Oud",
  gender: "Unisex",
  notes: ["oud"],
  occasionTags: ["gift"],
  releaseType: "Signature",
  collection: "Other line",
  description: "Another seller product.",
  size: "100ml",
  createdAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z",
};

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function resetState() {
  __resetBrandProfilesForTests();
  __resetFeaturedSellerPlacementsForTests();
  __resetFeaturedProductPlacementsForTests();
  __resetCuratedCollectionsForTests();
  __resetSupportTicketsForTests();
  seedRepository.__resetSellerTransactionsForTests();

  const state = seedRepository.getState();
  state.shops.splice(0, state.shops.length, structuredClone(SHOP_MAIN), structuredClone(SHOP_OTHER), structuredClone(SHOP_EMPTY));
  state.products.splice(0, state.products.length, ...structuredClone([...MAIN_PRODUCTS, OTHER_PRODUCT]));
  state.orders.splice(0, state.orders.length, ...structuredClone([
    {
      orderId: "ord-perf-001",
      customerId: "cust-001",
      customerName: "Customer One",
      customerEmail: "customer1@example.com",
      subtotal: 1000,
      platformFee: 140,
      vendorNet: 860,
      status: "Delivered",
      paymentStatus: "Released",
      shopIds: [SHOP_MAIN.id],
      items: [
        { productId: MAIN_PRODUCTS[0].id, productName: MAIN_PRODUCTS[0].name, shopId: SHOP_MAIN.id, price: 100, quantity: 2 },
        { productId: OTHER_PRODUCT.id, productName: OTHER_PRODUCT.name, shopId: SHOP_OTHER.id, price: 800, quantity: 1 },
      ],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      orderId: "ord-perf-002",
      customerId: "cust-002",
      customerName: "Customer Two",
      customerEmail: "customer2@example.com",
      subtotal: 0,
      platformFee: 21,
      vendorNet: 129,
      status: "Customer Accepted",
      paymentStatus: "Released",
      shopIds: [SHOP_MAIN.id],
      items: [
        { productId: MAIN_PRODUCTS[1].id, productName: MAIN_PRODUCTS[1].name, shopId: SHOP_MAIN.id, price: 150, quantity: 1 },
      ],
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      orderId: "ord-perf-003",
      customerId: "cust-003",
      customerName: "Customer Three",
      customerEmail: "customer3@example.com",
      subtotal: 500,
      platformFee: 70,
      vendorNet: 430,
      status: "Cancelled",
      paymentStatus: "Captured",
      shopIds: [SHOP_MAIN.id],
      items: [
        { productId: MAIN_PRODUCTS[0].id, productName: MAIN_PRODUCTS[0].name, shopId: SHOP_MAIN.id, price: 500, quantity: 1 },
      ],
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    {
      orderId: "ord-perf-004",
      customerId: "cust-004",
      customerName: "Customer Four",
      customerEmail: "customer4@example.com",
      subtotal: 250,
      platformFee: 35,
      vendorNet: 215,
      status: "Refunded",
      paymentStatus: "Refunded",
      shopIds: [SHOP_MAIN.id],
      items: [
        { productId: MAIN_PRODUCTS[1].id, productName: MAIN_PRODUCTS[1].name, shopId: SHOP_MAIN.id, price: 250, quantity: 1 },
      ],
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      orderId: "ord-perf-005",
      customerId: "cust-005",
      customerName: "Customer Five",
      customerEmail: "customer5@example.com",
      subtotal: 300,
      platformFee: 42,
      vendorNet: 258,
      status: "Delivered",
      paymentStatus: "Released",
      supportCase: { kind: "dispute", status: "open" },
      shopIds: [SHOP_MAIN.id],
      items: [
        { productId: MAIN_PRODUCTS[2].id, productName: MAIN_PRODUCTS[2].name, shopId: SHOP_MAIN.id, price: 300, quantity: 1 },
      ],
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    },
    {
      orderId: "ord-perf-006",
      customerId: "cust-006",
      customerName: "Customer Six",
      customerEmail: "customer6@example.com",
      subtotal: 400,
      platformFee: 56,
      vendorNet: 344,
      status: "Disputed",
      paymentStatus: "Dispute hold",
      shopIds: [SHOP_MAIN.id],
      items: [
        { productId: MAIN_PRODUCTS[0].id, productName: MAIN_PRODUCTS[0].name, shopId: SHOP_MAIN.id, price: 400, quantity: 1 },
      ],
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    },
    {
      orderId: "ord-perf-007",
      customerId: "cust-007",
      customerName: "Customer Seven",
      customerEmail: "customer7@example.com",
      subtotal: 600,
      platformFee: 84,
      vendorNet: 516,
      status: "Delivered",
      paymentStatus: "Released",
      shopIds: [SHOP_MAIN.id],
      items: [
        { productId: MAIN_PRODUCTS[0].id, productName: MAIN_PRODUCTS[0].name, shopId: SHOP_MAIN.id, price: 600, quantity: 1 },
      ],
      createdAt: daysAgo(8),
      updatedAt: daysAgo(8),
    },
    {
      orderId: "ord-perf-008",
      customerId: "cust-008",
      customerName: "Customer Eight",
      customerEmail: "customer8@example.com",
      subtotal: 1100,
      platformFee: 154,
      vendorNet: 946,
      status: "Delivered",
      paymentStatus: "Released",
      shopIds: [SHOP_MAIN.id, SHOP_OTHER.id],
      items: [
        { productId: MAIN_PRODUCTS[0].id, productName: MAIN_PRODUCTS[0].name, shopId: SHOP_MAIN.id, price: 100, quantity: 1 },
        { productId: OTHER_PRODUCT.id, productName: OTHER_PRODUCT.name, shopId: SHOP_OTHER.id, price: 1000, quantity: 1 },
      ],
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      orderId: "ord-perf-009",
      customerId: "cust-009",
      customerName: "Customer Nine",
      customerEmail: "customer9@example.com",
      subtotal: 700,
      platformFee: 98,
      vendorNet: 602,
      status: "Delivered",
      paymentStatus: "Released",
      shopIds: [SHOP_MAIN.id],
      items: [
        { productId: MAIN_PRODUCTS[1].id, productName: MAIN_PRODUCTS[1].name, shopId: SHOP_MAIN.id, price: 700, quantity: 1 },
      ],
      createdAt: daysAgo(40),
      updatedAt: daysAgo(40),
    },
    {
      orderId: "ord-perf-other-001",
      customerId: "cust-other-001",
      customerName: "Other Shop Customer",
      customerEmail: "other@example.com",
      subtotal: 999,
      platformFee: 140,
      vendorNet: 859,
      status: "Delivered",
      paymentStatus: "Released",
      shopIds: [SHOP_OTHER.id],
      items: [
        { productId: OTHER_PRODUCT.id, productName: OTHER_PRODUCT.name, shopId: SHOP_OTHER.id, price: 999, quantity: 1 },
      ],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  ]));

  state.shops[0].pendingBalance = SHOP_MAIN.pendingBalance;
  state.shops[0].availableBalance = SHOP_MAIN.availableBalance;
  state.shops[0].holdBalance = SHOP_MAIN.holdBalance;
  state.shops[0].paidBalance = SHOP_MAIN.paidBalance;
  state.shops[1].pendingBalance = SHOP_OTHER.pendingBalance;
  state.shops[1].availableBalance = SHOP_OTHER.availableBalance;
  state.shops[1].holdBalance = SHOP_OTHER.holdBalance;
  state.shops[1].paidBalance = SHOP_OTHER.paidBalance;

  __resetSeedOrdersForTests();
  for (const order of state.orders) {
    __injectSeedOrderForTests(order);
  }
  seedRepository.getState().sellerTransactions = [];
  seedRepository.getState().payoutRecords = [];
}

async function createBrandAndMerch() {
  const mainBrand = await updateSellerBrandProfile(
    SHOP_MAIN.id,
    {
      displayName: SHOP_MAIN.name,
      shortTagline: "Luxury oud and amber",
      brandStory: "Hand-blended fragrance from Dubai.",
      logoUrl: SHOP_MAIN.avatar,
      bannerUrl: SHOP_MAIN.cover,
      fragranceIdentityTags: ["oud", "amber"],
      specialties: ["luxury", "gifting"],
      trustBadges: ["Approved seller"],
      sellerPolicies: [{ label: "Returns", value: "7 days" }],
      socialLinks: [{ label: "Instagram", url: "https://instagram.com/oudlane" }],
      published: true,
    },
    { role: "seller", shopId: SHOP_MAIN.id }
  );

  const otherBrand = await updateSellerBrandProfile(
    SHOP_OTHER.id,
    {
      displayName: SHOP_OTHER.name,
      shortTagline: "Soft florals and gifts",
      brandStory: "Modern floral perfume.",
      logoUrl: SHOP_OTHER.avatar,
      bannerUrl: SHOP_OTHER.cover,
      fragranceIdentityTags: ["floral"],
      specialties: ["gift-ready"],
      trustBadges: ["Approved seller"],
      sellerPolicies: [{ label: "Returns", value: "7 days" }],
      socialLinks: [{ label: "Instagram", url: "https://instagram.com/rosevault" }],
      published: true,
    },
    { role: "seller", shopId: SHOP_OTHER.id }
  );

  await createFeaturedSellerPlacement(
    {
      shopId: SHOP_MAIN.id,
      brandProfileId: mainBrand.id,
      placementKey: "homepage_featured_sellers",
      titleOverride: "Featured on Tuti",
      subtitleOverride: "Luxury fragrance spotlight",
      priority: 10,
      active: true,
    },
    { role: "admin", sub: "admin-001" }
  );

  await createFeaturedSellerPlacement(
    {
      shopId: SHOP_OTHER.id,
      brandProfileId: otherBrand.id,
      placementKey: "homepage_featured_sellers",
      titleOverride: "Other spotlight",
      subtitleOverride: "Should not leak",
      priority: 12,
      active: true,
    },
    { role: "admin", sub: "admin-001" }
  );

  await createFeaturedProductPlacement(
    {
      productId: MAIN_PRODUCTS[0].id,
      shopId: SHOP_MAIN.id,
      placementKey: "luxury_picks",
      titleOverride: "Luxury Pick",
      badgeLabel: "Main",
      priority: 10,
      active: true,
    },
    { role: "admin", sub: "admin-001" }
  );

  await createFeaturedProductPlacement(
    {
      productId: OTHER_PRODUCT.id,
      shopId: SHOP_OTHER.id,
      placementKey: "luxury_picks",
      titleOverride: "Other Pick",
      badgeLabel: "Other",
      priority: 20,
      active: true,
    },
    { role: "admin", sub: "admin-001" }
  );

  await createCollection(
    {
      title: "Eid Gifts",
      subtitle: "A festive perfume edit.",
      description: "Luxury gifts and bold oud stories.",
      bannerUrl: "/uploads/eid.jpg",
      mobileBannerUrl: "/uploads/eid-mobile.jpg",
      placementKey: "homepage_collections",
      theme: "festive",
      priority: 10,
      published: true,
      active: true,
      items: [
        {
          type: "product",
          productId: MAIN_PRODUCTS[0].id,
          shopId: SHOP_MAIN.id,
          titleOverride: "Velvet Oud Edit",
          subtitleOverride: "Rich oud and amber.",
          badgeLabel: "Luxury pick",
          priority: 20,
        },
        {
          type: "seller",
          shopId: SHOP_MAIN.id,
          brandProfileId: mainBrand.id,
          titleOverride: "Oud Lane",
          subtitleOverride: "Dubai fragrance atelier.",
          badgeLabel: "Published seller",
          priority: 10,
        },
      ],
    },
    { role: "admin", sub: "admin-001" }
  );

  await createCollection(
    {
      title: "Other Seller Edit",
      subtitle: "Should not count for main seller.",
      description: "Other shop only.",
      bannerUrl: "/uploads/other.jpg",
      mobileBannerUrl: "/uploads/other-mobile.jpg",
      placementKey: "homepage_collections",
      theme: "fresh",
      priority: 5,
      published: true,
      active: true,
      items: [
        {
          type: "product",
          productId: OTHER_PRODUCT.id,
          shopId: SHOP_OTHER.id,
          titleOverride: "Other product",
          badgeLabel: "Other",
          priority: 10,
        },
      ],
    },
    { role: "admin", sub: "admin-001" }
  );
}

beforeEach(resetState);

test("seller performance summary aggregates range data and stays shop-scoped", async () => {
  await createBrandAndMerch();
  __resetSeedOrdersForTests();
  for (const order of seedRepository.getState().orders) {
    __injectSeedOrderForTests(order);
  }

  const mainOpenTicket = await createSupportTicket(
    {
      category: "order",
      subject: "Missing item",
      description: "Customer reported a missing item.",
      orderId: "ord-perf-001",
    },
    { role: "seller", shopId: SHOP_MAIN.id, sub: "seller-main" }
  );
  const mainResolvedTicket = await createSupportTicket(
    {
      category: "shipping",
      subject: "Late delivery",
      description: "Customer asked for a delivery update.",
      orderId: "ord-perf-002",
    },
    { role: "seller", shopId: SHOP_MAIN.id, sub: "seller-main" }
  );
  await updateSupportTicketStatus(mainResolvedTicket.ticketNumber, "Resolved", { role: "admin", sub: "admin-001" });
  await createSupportTicket(
    {
      category: "order",
      subject: "Other shop ticket",
      description: "Should not count for main.",
      orderId: "ord-perf-other-001",
    },
    { role: "seller", shopId: SHOP_OTHER.id, sub: "seller-other" }
  );

  const summary30 = await getSellerPerformanceSummary(SHOP_MAIN.id, "30d");
  assert.equal(summary30.range.key, "30d");
  assert.equal(summary30.range.label, "Last 30 days");
  assert.equal(summary30.sales.totalOrders, 8);
  assert.equal(summary30.sales.completedOrders, 5);
  assert.equal(summary30.sales.cancelledOrders, 1);
  assert.equal(summary30.sales.refundedOrders, 1);
  assert.equal(summary30.sales.disputedOrders, 2);
  assert.equal(summary30.sales.gmv, 2150);
  assert.equal(summary30.sales.averageOrderValue, 430);
  assert.equal(summary30.sales.trend.length, 30);

  assert.equal(summary30.operations.supportTicketCount, 2);
  assert.equal(summary30.operations.openSupportTicketCount, 1);
  assert.equal(summary30.operations.disputeCount, 2);
  assert.equal(summary30.operations.cancellationRate, 12.5);
  assert.equal(summary30.operations.refundRate, 12.5);
  assert.equal(summary30.operations.disputeRate, 25);

  assert.equal(summary30.catalog.liveProducts, 3);
  assert.equal(summary30.catalog.draftProducts, 1);
  assert.equal(summary30.catalog.inactiveProducts, 1);
  assert.equal(summary30.catalog.lowStockProducts, 2);
  assert.equal(summary30.catalog.totalProducts, 5);

  assert.equal(summary30.brand.hasProfile, true);
  assert.equal(summary30.brand.published, true);
  assert.equal(summary30.brand.publicSlug, "oud-lane");
  assert.equal(summary30.brand.publicUrl, "/sellers/oud-lane");
  assert.ok(Array.isArray(summary30.brand.missingFields));
  assert.ok(summary30.brand.missingFields.includes("displayNameAr"));

  assert.equal(summary30.merchandising.featuredSellerPlacements, 1);
  assert.equal(summary30.merchandising.featuredProductPlacements, 1);
  assert.equal(summary30.merchandising.collectionMemberships, 1);
  assert.equal(summary30.merchandising.activePlacementCount, 3);

  assert.equal(summary30.finance.pendingBalance, SHOP_MAIN.pendingBalance);
  assert.equal(summary30.finance.availableBalance, SHOP_MAIN.availableBalance);
  assert.equal(summary30.finance.holdBalance, SHOP_MAIN.holdBalance);
  assert.equal(summary30.finance.paidBalance, SHOP_MAIN.paidBalance);

  assert.equal(summary30.topProducts.length, 3);
  assert.equal(summary30.topProducts[0].productId, MAIN_PRODUCTS[0].id);
  assert.equal(summary30.topProducts[0].orderCount, 3);
  assert.equal(summary30.topProducts[0].unitsSold, 4);
  assert.equal(summary30.topProducts[0].revenue, 900);
  assert.equal(summary30.topProducts[0].route, `/products/${MAIN_PRODUCTS[0].id}`);
  assert.equal(summary30.topProducts[1].productId, MAIN_PRODUCTS[2].id);
  assert.equal(summary30.topProducts[1].revenue, 300);
  assert.equal(summary30.topProducts[2].productId, MAIN_PRODUCTS[1].id);
  assert.equal(summary30.topProducts[2].revenue, 150);

  assert.equal(summary30.emptyState.isNewSeller, false);
  assert.equal(summary30.emptyState.nextActions.length, 0);

  const summary7 = await getSellerPerformanceSummary(SHOP_MAIN.id, "7d");
  assert.equal(summary7.range.key, "7d");
  assert.equal(summary7.sales.totalOrders, 6);
  assert.equal(summary7.sales.completedOrders, 4);
  assert.equal(summary7.sales.gmv, 1550);
  assert.equal(summary7.sales.trend.length, 7);

  const summary90 = await getSellerPerformanceSummary(SHOP_MAIN.id, "90d");
  assert.equal(summary90.range.key, "90d");
  assert.equal(summary90.sales.totalOrders, 9);
  assert.equal(summary90.sales.trend.length, 13);

  assert.equal(summary30.sales.totalOrders, summary30.sales.trend.reduce((sum, bucket) => sum + bucket.totalOrders, 0));
  assert.ok(summary30.operations.operationalAlerts.includes("1 open support ticket"));
  assert.ok(summary30.operations.operationalAlerts.includes("2 disputed orders"));
  assert.ok(summary30.operations.operationalAlerts.includes("2 live products are low stock"));
});

test("invalid or missing range falls back cleanly to 30d", async () => {
  await createBrandAndMerch();

  const defaultSummary = await getSellerPerformanceSummary(SHOP_MAIN.id);
  const invalidSummary = await getSellerPerformanceSummary(SHOP_MAIN.id, "bogus");

  assert.equal(defaultSummary.range.key, "30d");
  assert.equal(invalidSummary.range.key, "30d");
  assert.equal(defaultSummary.sales.trend.length, 30);
  assert.equal(invalidSummary.sales.trend.length, 30);
});

test("empty seller state returns a clean empty summary", async () => {
  resetState();
  const state = seedRepository.getState();
  state.shops.splice(0, state.shops.length, structuredClone(SHOP_EMPTY));
  state.products.splice(0, state.products.length);
  state.orders.splice(0, state.orders.length);
  __resetSeedOrdersForTests();

  const summary = await getSellerPerformanceSummary(SHOP_EMPTY.id, "30d");
  assert.equal(summary.sales.totalOrders, 0);
  assert.equal(summary.sales.gmv, 0);
  assert.equal(summary.catalog.totalProducts, 0);
  assert.equal(summary.brand.hasProfile, false);
  assert.equal(summary.brand.published, false);
  assert.equal(summary.emptyState.isNewSeller, true);
  assert.equal(typeof summary.emptyState.message, "string");
  assert.ok(summary.emptyState.nextActions.length >= 1);
});
