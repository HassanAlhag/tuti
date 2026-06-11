import {
  auditEvents,
  collections,
  customerProfiles,
  customerReviews,
  orderHistory,
  paymentLedger,
  payoutQueue,
  products,
  promotions,
  roleModel,
  shops,
} from "../seed/marketplace.seed.js";

const state = {
  auditEvents:        structuredClone(auditEvents),
  collections:        structuredClone(collections),
  customers:          structuredClone(customerProfiles),
  orders:             structuredClone(orderHistory),
  payments:           structuredClone(paymentLedger),
  payouts:            structuredClone(payoutQueue),   // legacy mock payout queue (display only)
  products:           structuredClone(products),
  promotions:         structuredClone(promotions),
  marketplaceEvents:  [],
  reviews:            structuredClone(customerReviews),
  roles:              structuredClone(roleModel),
  shops:              structuredClone(shops),
  sellerTransactions: [],
  payoutRecords:      [],                             // real Payout model records (Phase 3)
};

export const seedRepository = {
  getState() {
    return state;
  },

  addProduct(product) {
    state.products.unshift(product);
    return product;
  },

  addMarketplaceEvent(event) {
    state.marketplaceEvents.unshift(event);
    return event;
  },

  addShop(shop) {
    state.shops.unshift(shop);
    return shop;
  },

  updateProductStatus(productId, status) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return null;
    product.status = status;
    return product;
  },

  updateProduct(productId, shopId, updates) {
    const product = state.products.find((p) => p.id === productId && p.shopId === shopId);
    if (!product) return null;
    Object.assign(product, updates);
    return product;
  },

  addReview(review) {
    const product = state.products.find((p) => p.id === review.productId);
    if (!product) return null;

    const next = product.reviews + 1;
    product.rating = Number(((product.rating * product.reviews + review.rating) / next).toFixed(2));
    product.reviews = next;
    if (review.verified) product.verifiedReviews += 1;

    state.reviews.unshift(review);
    return { review, product };
  },

  updatePayoutStatus(payoutId, status) {
    const payout = state.payouts.find((p) => p.id === payoutId);
    if (!payout) return null;
    payout.status = status;
    return payout;
  },

  capturePayment(paymentId) {
    const payment = state.payments.find((p) => p.id === paymentId);
    if (!payment) return null;
    payment.capture = "Captured";
    payment.status  = "Payout hold";
    payment.risk    = "Low";
    return payment;
  },

  getShop(shopId) {
    return state.shops.find((s) => s.id === shopId) || null;
  },

  // ── Finance helpers ─────────────────────────────────────────────────────────

  // Called from sellerBalance.test.js before each test to ensure a clean slate.
  __resetSellerTransactionsForTests() {
    state.sellerTransactions = [];
    state.payoutRecords      = [];
    for (const shop of state.shops) {
      shop.pendingBalance   = 0;
      shop.availableBalance = 0;
      shop.holdBalance      = 0;
      shop.paidBalance      = 0;
    }
  },

  __resetPayoutsForTests() {
    state.payoutRecords = [];
  },

  __resetMarketplaceEventsForTests() {
    state.marketplaceEvents = [];
  },

  updateShopPaymentRules(shopId, rules) {
    const shop = state.shops.find((s) => s.id === shopId);
    if (!shop) return null;
    shop.paymentRules = { ...(shop.paymentRules || {}), ...rules };
    // Sync top-level convenience fields used by the rest of the system
    if (rules.commissionRate !== undefined) shop.commissionRate = rules.commissionRate;
    if (rules.holdDays       !== undefined) shop.payoutHoldDays = rules.holdDays;
    state.auditEvents.unshift(
      `Payment rules updated for ${shop.name}: commission ${shop.commissionRate}%, hold ${shop.payoutHoldDays} days.`
    );
    return shop;
  },
};
