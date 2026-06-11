import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { Order } from "../../models/Order.js";
import { CommissionEntry } from "../../models/CommissionEntry.js";
import { Product } from "../../models/Product.js";
import { Review } from "../../models/Review.js";
import { SalesRep } from "../../models/SalesRep.js";
import { SellerReferral } from "../../models/SellerReferral.js";
import { Shop } from "../../models/Shop.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { rankPerfumes, rankShops } from "../../shared/rating.js";
import { canTransitionProductStatus } from "../../shared/workflows/productWorkflow.js";
import { createNotificationsForRole } from "../notifications/notifications.service.js";
import { getSeedOrders } from "../orders/orders.service.js";

export const createProductSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  shopId: z.string().optional(),
  category: z.enum(["perfume", "cake", "dessert", "gift_box", "bundle"]).default("perfume"),
  family: z.enum(["Oud", "Floral", "Fresh", "Musk", "Amber", ""]).default(""),
  gender: z.enum(["Unisex", "Men", "Women", ""]).default(""),
  notes: z.string().optional().default(""),
  price: z.coerce.number().positive(),
  originalPrice: z.coerce.number().positive().optional(),
  size: z.string().optional().default(""),
  stock: z.coerce.number().int().min(0).default(0),
  imageName: z.string().optional(),
  imagePath: z.string().nullable().optional(),
  cakeType: z.string().optional(),
  servings: z.string().optional(),
  flavors: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  occasionTags: z.array(z.string()).optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  customMessageAvailable: z.coerce.boolean().optional(),
});

export const createReviewSchema = z.object({
  productId: z.string().min(1),
  customer: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().optional().default(""),
  body: z.string().optional().default(""),
  verified: z.coerce.boolean().optional().default(false),
  aspects: z
    .object({
      scent: z.coerce.number().int().min(1).max(5).default(4),
      longevity: z.coerce.number().int().min(1).max(5).default(4),
      value: z.coerce.number().int().min(1).max(5).default(4),
    })
    .optional()
    .default({}),
});

export const updateStatusSchema = z.object({
  status: z.string().min(1),
});

/* ── Seller product edit schema ──────────────────────────────────── */
export const updateSellerProductSchema = z.object({
  name:                   z.string().min(1).max(120).trim().optional(),
  price:                  z.coerce.number().positive().optional(),
  stock:                  z.coerce.number().int().min(0).optional(),
  description:            z.string().max(2000).optional(),
  family:                 z.enum(["Oud", "Floral", "Fresh", "Musk", "Amber", ""]).optional(),
  gender:                 z.enum(["Unisex", "Men", "Women", ""]).optional(),
  notes:                  z.union([z.string(), z.array(z.string())]).optional(),
  size:                   z.string().max(30).optional(),
  cakeType:               z.string().max(100).optional(),
  servings:               z.string().max(50).optional(),
  flavors:                z.union([z.string(), z.array(z.string())]).optional(),
  allergens:              z.union([z.string(), z.array(z.string())]).optional(),
  occasionTags:           z.union([z.string(), z.array(z.string())]).optional(),
  leadTimeDays:           z.coerce.number().int().min(0).optional(),
  customMessageAvailable: z.coerce.boolean().optional(),
  imagePath:              z.string().nullable().optional(),
  // Seller may explicitly set Draft (hide) or Needs approval (submit from Draft)
  status:                 z.enum(["Draft", "Needs approval"]).optional(),
  shopId:                 z.string().optional(), // admin override only
});

/* ── Seller stock quick-update schema ────────────────────────────── */
export const updateSellerStockSchema = z.object({
  delta: z.coerce.number().int().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  shopId: z.string().optional(),
}).refine((d) => d.delta != null || d.stock != null, {
  message: "Provide 'delta' (relative change) or 'stock' (absolute value).",
});

function getRankings(state) {
  const perfumesOnly = state.products.filter((p) => !p.category || p.category === "perfume");
  return {
    topPerfumes: rankPerfumes(perfumesOnly),
    topShops: rankShops(state.shops, perfumesOnly),
  };
}

export async function getStorefrontData() {
  if (env.mongoUri) {
    const [products, shops, reviews] = await Promise.all([
      Product.find({}).sort({ createdAt: -1 }).lean(),
      Shop.find({}).sort({ createdAt: -1 }).lean(),
      Review.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    const state = seedRepository.getState();
    return {
      products,
      shops,
      reviews,
      promotions: state.promotions,
      collections: state.collections,
      roles: state.roles,
      rankings: getRankings({ products, shops }),
    };
  }

  const state = seedRepository.getState();
  return {
    products: state.products,
    shops: state.shops,
    reviews: state.reviews,
    promotions: state.promotions,
    collections: state.collections,
    roles: state.roles,
    rankings: getRankings(state),
  };
}

function customerSummariesFromOrders(orders, knownCustomers) {
  const byEmail = new Map(knownCustomers.map((customer) => [customer.email, { ...customer }]));

  for (const order of orders) {
    const existing = byEmail.get(order.customerEmail);
    if (existing) continue;
    const customerOrders = orders.filter((item) => item.customerEmail === order.customerEmail);
    const lifetimeValue = customerOrders.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    byEmail.set(order.customerEmail, {
      id: `guest-${order.customerEmail}`,
      name: order.customerName,
      email: order.customerEmail,
      phone: order.phone || "",
      city: order.deliveryAddress || "UAE",
      status: "Active",
      segment: "Marketplace buyer",
      risk: "Low",
      orders: customerOrders.length,
      lifetimeValue,
      avgOrderValue: customerOrders.length ? Math.round(lifetimeValue / customerOrders.length) : 0,
      loyaltyPoints: 0,
      lastOrderAt: customerOrders
        .map((item) => item.createdAt)
        .sort((a, b) => new Date(b) - new Date(a))[0],
      preferredCategories: [],
      savedOccasions: [],
      favoriteShopIds: [],
      openTickets: 0,
      notes: "Created from live order history.",
      tags: [order.paymentMethod === "cod" ? "COD buyer" : "Card buyer"],
    });
  }

  return [...byEmail.values()];
}

export async function getSellerData(shopId = "shop-oud-lane") {
  if (env.mongoUri) {
    const shop = await Shop.findOne(shopId ? { id: shopId } : {}).lean();
    if (!shop) return { shop: null, products: [], customers: [] };

    const [products, orders] = await Promise.all([
      Product.find({ shopId: shop.id }).sort({ createdAt: -1 }).lean(),
      Order.find({ shopIds: shop.id }).sort({ createdAt: -1 }).lean(),
    ]);
    const knownCustomers = seedRepository.getState().customers.filter((customer) => {
      if ((customer.favoriteShopIds || []).includes(shop.id)) return true;
      return orders.some((order) => order.customerEmail === customer.email);
    });

    return {
      shop,
      products,
      customers: customerSummariesFromOrders(orders, knownCustomers),
    };
  }

  const state = seedRepository.getState();
  const shop = state.shops.find((item) => item.id === shopId) || state.shops[0];
  const products = state.products.filter((product) => product.shopId === shop.id);
  const customers = state.customers.filter((customer) => {
    if ((customer.favoriteShopIds || []).includes(shop.id)) return true;
    return state.orders.some((order) => order.customerEmail === customer.email && (order.shopIds || []).includes(shop.id));
  });

  return { shop, products, customers };
}

export async function createSellerProduct(payload) {
  const category = payload.category || "perfume";
  const idPrefix = {
    perfume: "prf",
    cake: "cke",
    dessert: "dss",
    gift_box: "gft",
    bundle: "bdl",
  }[category] || "prd";
  const listFrom = (value) => Array.isArray(value)
    ? value
    : String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const categoryColor = {
    perfume: ["#52796f", "#e9c46a"],
    cake: ["#b94d68", "#f4b6c4"],
    dessert: ["#7c3d24", "#d7b56d"],
    gift_box: ["#1f3a37", "#d9a441"],
    bundle: ["#1f3a37", "#d9a441"],
  }[category] || ["#52796f", "#e9c46a"];

  const isGiftProduct = category === "gift_box" || category === "bundle";
  const product = {
    id: `${idPrefix}-${randomUUID()}`,
    category,
    name: String(payload.name || "").trim(),
    shopId: payload.shopId || "shop-oud-lane",
    family: category === "perfume" ? payload.family || "Oud" : "",
    gender: category === "perfume" ? payload.gender || "Unisex" : "",
    notes: category === "perfume" ? listFrom(payload.notes) : [],
    flavors: category === "perfume" ? [] : listFrom(payload.flavors || payload.notes),
    includes: isGiftProduct ? listFrom(payload.flavors || payload.includes || payload.notes) : [],
    bundledProductIds: [],
    allergens: category === "perfume" ? [] : listFrom(payload.allergens),
    occasionTags: listFrom(payload.occasionTags),
    cakeType: category === "perfume" ? "" : payload.cakeType || (category === "gift_box" ? "Gift Box" : "Signature"),
    servings: category === "perfume" ? "" : payload.servings || "",
    leadTimeDays: category === "perfume" ? 1 : Number(payload.leadTimeDays || 2),
    customMessageAvailable: category !== "perfume" ? Boolean(payload.customMessageAvailable) : false,
    price: Number(payload.price || 0),
    originalPrice: Number(payload.originalPrice || payload.price || 0),
    size: payload.size || (category === "perfume" ? "75ml" : ""),
    stock: Number(payload.stock || 0),
    rating: 4.2,
    reviews: 0,
    orders: 0,
    verifiedReviews: 0,
    status: "Needs approval",
    tags: ["New submission"],
    collection: "New Seller Uploads",
    releaseType: "Seller Upload",
    color: categoryColor[0],
    accent: categoryColor[1],
    imagePath: payload.imagePath || null,
  };

  if (!product.name) {
    const error = new Error("Product name is required.");
    error.status = 400;
    throw error;
  }

  if (env.mongoUri) {
    const doc = await Product.create(product);
    const created = doc.toObject();
    await createNotificationsForRole({
      recipientRole: "admin",
      title: "Product requires admin approval",
      message: `${created.name} was submitted for approval by the seller.`,
      type: "product_needs_approval",
      entityType: "product",
      entityId: created.id,
    });
    return created;
  }

  const created = seedRepository.addProduct(product);
  await createNotificationsForRole({
    recipientRole: "admin",
    title: "Product requires admin approval",
    message: `${created.name} was submitted for approval by the seller.`,
    type: "product_needs_approval",
    entityType: "product",
    entityId: created.id,
  });
  return created;
}

export async function createReview(payload) {
  const rating = Number(payload.rating || 0);
  if (!payload.productId || rating < 1 || rating > 5) {
    const error = new Error("A productId and rating from 1 to 5 are required.");
    error.status = 400;
    throw error;
  }

  const review = {
    id: `rev-${randomUUID()}`,
    productId: payload.productId,
    customer: payload.customer || "Demo customer",
    rating,
    title: payload.title || "Customer rating",
    body: payload.body || "I tested this perfume and added my rating to help other customers choose.",
    verified: Boolean(payload.verified),
    helpful: 0,
    date: new Date().toISOString().slice(0, 10),
    aspects: {
      scent: Number(payload.aspects?.scent || 4),
      longevity: Number(payload.aspects?.longevity || 4),
      value: Number(payload.aspects?.value || 4),
    },
  };

  if (env.mongoUri) {
    const product = await Product.findOne({ id: payload.productId });
    if (!product) {
      const error = new Error("Product was not found.");
      error.status = 404;
      throw error;
    }

    const next = product.reviews + 1;
    product.rating = Number(((product.rating * product.reviews + review.rating) / next).toFixed(2));
    product.reviews = next;
    if (review.verified) product.verifiedReviews += 1;
    await product.save();

    const doc = await Review.create(review);
    return { review: doc.toObject(), product: product.toObject() };
  }

  const result = seedRepository.addReview(review);
  if (!result) {
    const error = new Error("Product was not found.");
    error.status = 404;
    throw error;
  }

  return result;
}

export async function getAdminData() {
  if (env.mongoUri) {
    const [products, shops, reviews] = await Promise.all([
      Product.find({}).sort({ createdAt: -1 }).lean(),
      Shop.find({}).sort({ createdAt: -1 }).lean(),
      Review.find({}).sort({ createdAt: -1 }).lean(),
    ]);
    const state = seedRepository.getState();
    return {
      customers: state.customers,
      products,
      shops,
      payments: state.payments,
      payouts: state.payouts,
      roles: state.roles,
      auditEvents: state.auditEvents,
      reviews,
      rankings: getRankings({ products, shops }),
    };
  }

  const state = seedRepository.getState();
  return {
    customers: state.customers,
    products: state.products,
    shops: state.shops,
    payments: state.payments,
    payouts: state.payouts,
    roles: state.roles,
    auditEvents: state.auditEvents,
    rankings: getRankings(state),
  };
}

function countBy(list, predicate) {
  return list.reduce((sum, item) => sum + (predicate(item) ? 1 : 0), 0);
}

function buildAdminAnalyticsSummary({ orders, products, shops }) {
  const orderSummary = {
    total: orders.length,
    pending: countBy(orders, (order) => order.status === "Pending"),
    confirmed: countBy(orders, (order) => order.status === "Confirmed"),
    processing: countBy(orders, (order) => order.status === "Processing"),
    readyForDelivery: countBy(orders, (order) => order.status === "Ready for Delivery"),
    shipped: countBy(orders, (order) => order.status === "Shipped"),
    delivered: countBy(orders, (order) => order.status === "Delivered"),
    customerAccepted: countBy(orders, (order) => order.status === "Customer Accepted"),
    disputed: countBy(orders, (order) => order.status === "Disputed"),
    cancelled: countBy(orders, (order) => order.status === "Cancelled"),
    refunded: countBy(orders, (order) => order.status === "Refunded"),
    open: countBy(orders, (order) => !["Delivered", "Customer Accepted", "Cancelled", "Refunded"].includes(order.status)),
    closed: countBy(orders, (order) => ["Cancelled", "Refunded"].includes(order.status)),
  };

  const supportSummary = {
    disputedOrders: orderSummary.disputed,
    disputeHold: countBy(orders, (order) => order.paymentStatus === "Dispute hold"),
    openSupportCases: countBy(orders, (order) => {
      const status = order.supportCase?.status;
      return Boolean(status && !["resolved", "closed", "rejected"].includes(status));
    }),
    resolvedSupportCases: countBy(orders, (order) => order.supportCase?.status === "resolved"),
    escalatedSupportCases: countBy(orders, (order) => order.supportCase?.status === "escalated"),
  };

  const productSummary = {
    total: products.length,
    live: countBy(products, (product) => product.status === "Live"),
    needsApproval: countBy(products, (product) => product.status === "Needs approval"),
    rejected: countBy(products, (product) => product.status === "Rejected"),
    draft: countBy(products, (product) => product.status === "Draft"),
    lowStock: countBy(products, (product) => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5),
    outOfStock: countBy(products, (product) => Number(product.stock || 0) <= 0),
  };

  const shopSummary = {
    total: shops.length,
    approved: countBy(shops, (shop) => shop.status === "Approved"),
    pendingReview: countBy(shops, (shop) => shop.status === "Pending review"),
    suspended: countBy(shops, (shop) => shop.status === "Suspended"),
    terminated: countBy(shops, (shop) => shop.status === "Terminated"),
  };

  const deliveredGmv = orders
    .filter((order) => ["Delivered", "Customer Accepted"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.subtotal || 0), 0);

  const financeOperational = {
    codOrders: countBy(orders, (order) => String(order.paymentMethod || "").toLowerCase() === "cod"),
    codPending: countBy(orders, (order) => order.paymentStatus === "COD pending"),
    codCollected: countBy(orders, (order) => order.paymentStatus === "COD collected"),
    payoutHold: countBy(orders, (order) => order.paymentStatus === "Payout hold"),
    disputeHold: supportSummary.disputeHold,
    deliveredGmv,
    note: "COD operational markers only. No payment gateway or payout execution.",
  };

  return {
    orders: orderSummary,
    support: supportSummary,
    products: productSummary,
    shops: shopSummary,
    financeOperational,
  };
}

export async function getAdminAnalyticsSummary() {
  if (env.mongoUri) {
    const [orders, products, shops] = await Promise.all([
      Order.find({}).select("status paymentStatus paymentMethod subtotal supportCase").lean(),
      Product.find({}).select("status stock").lean(),
      Shop.find({}).select("status").lean(),
    ]);
    return buildAdminAnalyticsSummary({ orders, products, shops });
  }

  const state = seedRepository.getState();
  return buildAdminAnalyticsSummary({
    orders: getSeedOrders(),
    products: state.products || [],
    shops: state.shops || [],
  });
}

export function listAdminCustomers({ q = "", segment = "", risk = "", page = 1, limit = 20 }) {
  const state = seedRepository.getState();
  const normalizedQ = String(q || "").trim().toLowerCase();
  const normalizedSegment = String(segment || "").trim();
  const normalizedRisk = String(risk || "").trim();

  const filtered = state.customers.filter((customer) => {
    if (normalizedQ) {
      const haystack = [
        customer.name,
        customer.email,
        customer.phone,
        customer.city,
        customer.segment,
        customer.status,
        ...(customer.tags || []),
        ...(customer.preferredCategories || []),
        ...(customer.savedOccasions || []),
      ].join(" ").toLowerCase();
      if (!haystack.includes(normalizedQ)) return false;
    }
    if (normalizedSegment && customer.segment !== normalizedSegment) return false;
    if (normalizedRisk && customer.risk !== normalizedRisk) return false;
    return true;
  });

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const start = (safePage - 1) * safeLimit;

  return {
    customers: filtered.slice(start, start + safeLimit),
    total: filtered.length,
    page: safePage,
    pages: Math.max(1, Math.ceil(filtered.length / safeLimit)),
    limit: safeLimit,
  };
}

const PRODUCT_STATUS_TARGETS = ["Live", "Needs approval", "Rejected", "Draft"];

function assertProductTransition(product, status, user) {
  if (!PRODUCT_STATUS_TARGETS.includes(status)) {
    const error = new Error("Invalid product status.");
    error.status = 400;
    throw error;
  }

  const role = user?.role;
  if (canTransitionProductStatus(product.status, status, role)) return;
  const error = new Error(`Invalid product status transition: ${product.status} -> ${status} for ${role}.`);
  error.status = 409;
  throw error;
}

export async function updateProductStatus(productId, status, user) {
  if (env.mongoUri) {
    const existing = await Product.findOne({ id: productId }).lean();
    if (!existing) {
      const error = new Error("Product was not found.");
      error.status = 404;
      throw error;
    }
    assertProductTransition(existing, status, user);
    const product = await Product.findOneAndUpdate({ id: productId }, { status }, { returnDocument: "after" }).lean();
    if (status === "Live" || status === "Rejected") {
      await createNotificationsForRole({
        recipientRole: "seller",
        shopId: product.shopId,
        title: status === "Live" ? "Product approved" : "Product needs changes",
        message: status === "Live"
          ? `${product.name} is now live in the storefront.`
          : `${product.name} was rejected and requires seller updates.`,
        type: status === "Live" ? "product_approved" : "product_rejected",
        entityType: "product",
        entityId: product.id,
      });
    }
    return product;
  }

  const existing = seedRepository.getState().products.find((product) => product.id === productId);
  if (!existing) {
    const error = new Error("Product was not found.");
    error.status = 404;
    throw error;
  }
  assertProductTransition(existing, status, user);
  const product = seedRepository.updateProductStatus(productId, status);
  if (!product) {
    const error = new Error("Product was not found.");
    error.status = 404;
    throw error;
  }
  if (status === "Live" || status === "Rejected") {
    await createNotificationsForRole({
      recipientRole: "seller",
      shopId: product.shopId,
      title: status === "Live" ? "Product approved" : "Product needs changes",
      message: status === "Live"
        ? `${product.name} is now live in the storefront.`
        : `${product.name} was rejected and requires seller updates.`,
      type: status === "Live" ? "product_approved" : "product_rejected",
      entityType: "product",
      entityId: product.id,
    });
  }
  return product;
}

export function updatePayoutStatus(payoutId, status) {
  const payout = seedRepository.updatePayoutStatus(payoutId, status);
  if (!payout) {
    const error = new Error("Payout was not found.");
    error.status = 404;
    throw error;
  }
  return payout;
}

export function capturePayment(paymentId) {
  const payment = seedRepository.capturePayment(paymentId);
  if (!payment) {
    const error = new Error("Payment was not found.");
    error.status = 404;
    throw error;
  }
  return payment;
}

const paymentRulesSchema = z.object({
  commissionRate:   z.coerce.number().min(0).max(50).optional(),
  holdDays:         z.coerce.number().int().min(0).max(30).optional(),
  refundWindowDays: z.coerce.number().int().min(0).max(60).optional(),
  minPayoutAmount:  z.coerce.number().min(0).optional(),
  manualCapture:    z.coerce.boolean().optional(),
  autoPayout:       z.coerce.boolean().optional(),
  payoutMethod:     z.enum(["bank", "wallet", "cod_hold"]).optional(),
  notes:            z.string().max(500).optional(),
});

const SHOP_ACTION_TYPES = ["warning", "action_plan_request", "suspend", "reactivate", "terminate"];
const SHOP_CONTRACT_STATUSES = ["Approved", "Pending review", "Suspended", "Terminated"];
const NOTICE_LIFECYCLE_STATUSES = ["active", "acknowledged", "resolved", "submitted"];

const addShopAdminNoticeSchema = z.object({
  type: z.enum(SHOP_ACTION_TYPES),
  note: z.string().min(1).max(1000),
  deadline: z.string().optional().default(""),
  status: z.enum(NOTICE_LIFECYCLE_STATUSES).optional().default("active"),
});

const updateShopContractStatusSchema = z.object({
  action: z.enum(SHOP_ACTION_TYPES),
  note: z.string().min(1).max(1000),
  deadline: z.string().optional().default(""),
  contractTerminationReason: z.string().max(1000).optional().default(""),
  status: z.enum(NOTICE_LIFECYCLE_STATUSES).optional().default("active"),
});

const submitSellerActionPlanSchema = z.object({
  plan: z.string().min(1).max(1000),
});

const createSalesRepSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().max(30).optional().default(""),
  code: z.string().min(3).max(40).trim().optional(),
  plan: z.enum(["Starter", "Standard", "Premium", "Enterprise"]).optional().default("Standard"),
  status: z.enum(["Active", "Pending", "Inactive"]).optional().default("Active"),
});

const DEFAULT_COMMISSION_PLANS = {
  Starter: { id: "starter", name: "Starter", signupBonus: 0, firstSaleBonus: 50, gmvRate: 0.02, tierThresholds: [], pauseOnAtRisk: false, reverseOnRefund: true },
  Standard: { id: "standard", name: "Standard", signupBonus: 50, firstSaleBonus: 100, gmvRate: 0.03, tierThresholds: [], pauseOnAtRisk: true, reverseOnRefund: true },
  Premium: { id: "premium", name: "Premium", signupBonus: 100, firstSaleBonus: 250, gmvRate: 0.04, tierThresholds: [], pauseOnAtRisk: true, reverseOnRefund: true },
  Enterprise: { id: "enterprise", name: "Enterprise", signupBonus: 500, firstSaleBonus: 1000, gmvRate: 0.05, tierThresholds: [], pauseOnAtRisk: true, reverseOnRefund: false },
};

function createAdminNotice(shopId, payload, adminUser) {
  const nowIso = new Date().toISOString();
  return {
    id: `notice-${shopId}-${randomUUID()}`,
    type: payload.type,
    note: payload.note.trim(),
    deadline: payload.deadline || "",
    issuedBy: adminUser?.name || adminUser?.email || adminUser?.sub || "admin",
    issuedAt: nowIso,
    status: payload.status || "active",
  };
}

function ensureShopFound(shop, shopId) {
  if (shop) return;
  const error = new Error(`Shop not found: ${shopId}`);
  error.status = 404;
  throw error;
}

function contractStatusFromAction(shop, action) {
  if (action === "suspend") return "Suspended";
  if (action === "reactivate") return "Approved";
  if (action === "terminate") return "Terminated";
  return shop.contractStatus || shop.status || "Pending review";
}

function asRepCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeRepCode(name) {
  return asRepCode(name).slice(0, 24) || `REP-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function computeRepOverview({ reps, referrals, entries }) {
  return reps.map((rep) => {
    const ownReferrals = referrals.filter((item) => item.repCode === rep.code);
    const ownEntries = entries.filter((item) => item.repCode === rep.code);
    const pendingCommission = ownEntries
      .filter((item) => item.status !== "Paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidCommission = ownEntries
      .filter((item) => item.status === "Paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalGmv = ownReferrals.reduce((sum, item) => sum + Number(item.gmv || 0), 0);
    return {
      ...rep,
      referrals: ownReferrals.length,
      activeShops: ownReferrals.filter((item) => item.status === "active").length,
      totalGmv,
      pendingCommission,
      paidCommission,
    };
  });
}

export function updateShopPaymentRules(shopId, rules) {
  const parsed = paymentRulesSchema.safeParse(rules);
  if (!parsed.success) {
    const error = new Error("Invalid payment rules: " + parsed.error.issues.map((i) => i.message).join(", "));
    error.status = 422;
    throw error;
  }
  const shop = seedRepository.getShop(shopId);
  if (!shop) {
    const error = new Error("Shop not found.");
    error.status = 404;
    throw error;
  }
  return seedRepository.updateShopPaymentRules(shopId, parsed.data);
}

export async function addShopAdminNotice(shopId, payload, adminUser) {
  const parsed = addShopAdminNoticeSchema.safeParse(payload);
  if (!parsed.success) {
    const error = new Error("Invalid admin notice payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    error.status = 400;
    throw error;
  }

  if (env.mongoUri) {
    const shop = await Shop.findOne({ id: shopId });
    ensureShopFound(shop, shopId);
    const notice = createAdminNotice(shopId, parsed.data, adminUser);
    shop.adminNotices = [notice, ...(shop.adminNotices || [])].slice(0, 30);
    shop.contractStatus = shop.contractStatus || shop.status || "Pending review";
    shop.contractUpdatedAt = new Date().toISOString();
    await shop.save();
    await createNotificationsForRole({
      recipientRole: "seller",
      shopId: shop.id,
      title: "New admin notice",
      message: `${parsed.data.type === "action_plan_request" ? "Action plan requested" : "Seller notice issued"}: ${parsed.data.note.trim()}`,
      type: parsed.data.type,
      entityType: "shop",
      entityId: shop.id,
    });
    return shop.toObject();
  }

  const state = seedRepository.getState();
  const shop = state.shops.find((item) => item.id === shopId);
  ensureShopFound(shop, shopId);
  const notice = createAdminNotice(shopId, parsed.data, adminUser);
  shop.adminNotices = [notice, ...(shop.adminNotices || [])].slice(0, 30);
  shop.contractStatus = shop.contractStatus || shop.status || "Pending review";
  shop.contractUpdatedAt = new Date().toISOString();
  await createNotificationsForRole({
    recipientRole: "seller",
    shopId: shop.id,
    title: "New admin notice",
    message: `${parsed.data.type === "action_plan_request" ? "Action plan requested" : "Seller notice issued"}: ${parsed.data.note.trim()}`,
    type: parsed.data.type,
    entityType: "shop",
    entityId: shop.id,
  });
  return shop;
}

export async function updateShopContractStatus(shopId, payload, adminUser) {
  const parsed = updateShopContractStatusSchema.safeParse(payload);
  if (!parsed.success) {
    const error = new Error("Invalid contract action payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    error.status = 400;
    throw error;
  }

  const action = parsed.data.action;
  const notice = createAdminNotice(shopId, { ...parsed.data, type: action }, adminUser);

  if (env.mongoUri) {
    const shop = await Shop.findOne({ id: shopId });
    ensureShopFound(shop, shopId);

    if (action === "suspend") shop.status = "Suspended";
    if (action === "reactivate") shop.status = "Approved";
    if (action === "terminate") {
      shop.status = "Terminated";
      shop.contractTerminationReason = parsed.data.contractTerminationReason || parsed.data.note.trim();
    }

    const nextContractStatus = contractStatusFromAction(shop, action);
    if (!SHOP_CONTRACT_STATUSES.includes(nextContractStatus)) {
      const error = new Error("Unsupported contract status transition.");
      error.status = 409;
      throw error;
    }

    shop.contractStatus = nextContractStatus;
    shop.contractUpdatedAt = new Date().toISOString();
    shop.adminNotices = [notice, ...(shop.adminNotices || [])].slice(0, 30);
    await shop.save();
    await createNotificationsForRole({
      recipientRole: "seller",
      shopId: shop.id,
      title: "Seller contract action updated",
      message: `Contract action "${action}" recorded for ${shop.name}.`,
      type: `contract_${action}`,
      entityType: "shop",
      entityId: shop.id,
    });

    // "reactivate" is the sole action that sets shop.status = "Approved" (covers both
    // initial approval of new sellers and reactivation after suspension). It is therefore
    // the correct and only trigger for referral activation and signup-bonus creation.
    const becameApproved = action === "reactivate";
    if (becameApproved && shop.repId && shop.repCode) {
      const referral = await SellerReferral.findOne({ shopId: shop.id, repCode: shop.repCode });
      if (referral) {
        referral.status = "active";
        referral.approvedAt = referral.approvedAt || new Date();
        await referral.save();
        const existingSignup = await CommissionEntry.findOne({
          referralId: referral._id,
          type: "signup_bonus",
        }).lean();
        if (!existingSignup) {
          const rep = await SalesRep.findById(shop.repId).lean();
          const plan = DEFAULT_COMMISSION_PLANS[rep?.plan || "Standard"] || DEFAULT_COMMISSION_PLANS.Standard;
          const signupBonus = Number(plan.signupBonus || 0);
          if (signupBonus > 0) {
            await CommissionEntry.create({
              id: `com-${randomUUID()}`,
              repId: shop.repId,
              repCode: shop.repCode,
              referralId: referral._id,
              shopId: shop.id,
              shopName: shop.name,
              type: "signup_bonus",
              amount: signupBonus,
              currency: "AED",
              status: "Pending",
              note: "Signup bonus after seller approval.",
            });
          }
        }
      }
    }
    return shop.toObject();
  }

  const state = seedRepository.getState();
  const shop = state.shops.find((item) => item.id === shopId);
  ensureShopFound(shop, shopId);

  if (action === "suspend") shop.status = "Suspended";
  if (action === "reactivate") shop.status = "Approved";
  if (action === "terminate") {
    shop.status = "Terminated";
    shop.contractTerminationReason = parsed.data.contractTerminationReason || parsed.data.note.trim();
  }

  shop.contractStatus = contractStatusFromAction(shop, action);
  shop.contractUpdatedAt = new Date().toISOString();
  shop.adminNotices = [notice, ...(shop.adminNotices || [])].slice(0, 30);
  await createNotificationsForRole({
    recipientRole: "seller",
    shopId: shop.id,
    title: "Seller contract action updated",
    message: `Contract action "${action}" recorded for ${shop.name}.`,
    type: `contract_${action}`,
    entityType: "shop",
    entityId: shop.id,
  });

  // Seed mode: same "reactivate"-only trigger as MongoDB path above.
  if (action === "reactivate" && shop.repCode) {
    const state = seedRepository.getState();
    state.sellerReferrals = state.sellerReferrals || [];
    const referral = state.sellerReferrals.find((item) => item.shopId === shop.id && item.repCode === shop.repCode);
    if (referral) {
      referral.status = "active";
      referral.approvedAt = referral.approvedAt || new Date().toISOString();
      state.commissionEntries = state.commissionEntries || [];
      const hasSignup = state.commissionEntries.some((item) => item.referralId === referral.id && item.type === "signup_bonus");
      if (!hasSignup) {
        const rep = (state.salesReps || []).find((item) => item.code === shop.repCode);
        const plan = DEFAULT_COMMISSION_PLANS[rep?.plan || "Standard"] || DEFAULT_COMMISSION_PLANS.Standard;
        const signupBonus = Number(plan.signupBonus || 0);
        if (signupBonus > 0) {
          state.commissionEntries.unshift({
            id: `com-${randomUUID()}`,
            repId: rep?.id || "",
            repCode: shop.repCode,
            referralId: referral.id,
            shopId: shop.id,
            shopName: shop.name,
            type: "signup_bonus",
            amount: signupBonus,
            status: "Pending",
            currency: "AED",
            note: "Signup bonus after seller approval.",
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }
  }
  return shop;
}

export async function submitSellerActionPlan(noticeId, payload, sellerUser) {
  const parsed = submitSellerActionPlanSchema.safeParse(payload);
  if (!parsed.success) {
    const error = new Error("Invalid action plan payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    error.status = 400;
    throw error;
  }

  const sellerShopId = sellerUser?.shopId;
  if (!sellerShopId) {
    const error = new Error("Seller shop not found.");
    error.status = 404;
    throw error;
  }

  if (env.mongoUri) {
    const shop = await Shop.findOne({ id: sellerShopId });
    ensureShopFound(shop, sellerShopId);
    const notice = (shop.adminNotices || []).find((item) => item.id === noticeId);
    if (!notice) {
      const error = new Error("Notice was not found for this seller.");
      error.status = 404;
      throw error;
    }
    if (notice.type !== "action_plan_request") {
      const error = new Error("Action plan response is only allowed for action plan request notices.");
      error.status = 409;
      throw error;
    }

    notice.sellerPlan = parsed.data.plan.trim();
    notice.sellerPlanAt = new Date().toISOString();
    notice.status = "submitted";
    shop.contractUpdatedAt = new Date().toISOString();
    await shop.save();
    return shop.toObject();
  }

  const state = seedRepository.getState();
  const shop = state.shops.find((item) => item.id === sellerShopId);
  ensureShopFound(shop, sellerShopId);

  const notices = shop.adminNotices || [];
  const notice = notices.find((item) => item.id === noticeId);
  if (!notice) {
    const error = new Error("Notice was not found for this seller.");
    error.status = 404;
    throw error;
  }
  if (notice.type !== "action_plan_request") {
    const error = new Error("Action plan response is only allowed for action plan request notices.");
    error.status = 409;
    throw error;
  }

  notice.sellerPlan = parsed.data.plan.trim();
  notice.sellerPlanAt = new Date().toISOString();
  notice.status = "submitted";
  shop.contractUpdatedAt = new Date().toISOString();
  return shop;
}

export async function createSalesRep(payload) {
  const parsed = createSalesRepSchema.safeParse(payload);
  if (!parsed.success) {
    const error = new Error("Invalid sales rep payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    error.status = 400;
    throw error;
  }

  if (env.mongoUri) {
    const code = asRepCode(parsed.data.code || makeRepCode(parsed.data.name));
    const existing = await SalesRep.findOne({ $or: [{ code }, { email: parsed.data.email }] }).lean();
    if (existing) {
      const error = new Error("Sales rep already exists.");
      error.status = 409;
      throw error;
    }
    const rep = await SalesRep.create({
      id: `rep-${randomUUID()}`,
      code,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      plan: parsed.data.plan,
      status: parsed.data.status,
    });
    return rep.toObject();
  }

  const state = seedRepository.getState();
  state.salesReps = state.salesReps || [];
  const code = asRepCode(parsed.data.code || makeRepCode(parsed.data.name));
  if (state.salesReps.some((item) => item.code === code || item.email === parsed.data.email)) {
    const error = new Error("Sales rep already exists.");
    error.status = 409;
    throw error;
  }
  const rep = {
    id: `rep-${randomUUID()}`,
    code,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    plan: parsed.data.plan,
    status: parsed.data.status,
  };
  state.salesReps.unshift(rep);
  return rep;
}

export async function listSalesReps() {
  if (env.mongoUri) {
    const [reps, referrals, entries] = await Promise.all([
      SalesRep.find({}).sort({ createdAt: -1 }).lean(),
      SellerReferral.find({}).lean(),
      CommissionEntry.find({}).lean(),
    ]);
    const normalizedReferrals = referrals.map((item) => ({
      id: item.id,
      repCode: item.repCode,
      shopId: item.shopId,
      shopName: item.shopName,
      status: item.status,
      gmv: 0,
      firstSaleDate: null,
      approvedAt: item.approvedAt || null,
      createdAt: item.createdAt,
    }));
    return computeRepOverview({ reps, referrals: normalizedReferrals, entries });
  }

  const state = seedRepository.getState();
  const reps = state.salesReps || [];
  const referrals = state.sellerReferrals || [];
  const entries = state.commissionEntries || [];
  return computeRepOverview({ reps, referrals, entries });
}

export async function listSellerReferrals() {
  if (env.mongoUri) {
    const referrals = await SellerReferral.find({}).sort({ createdAt: -1 }).lean();
    return referrals.map((item) => ({
      id: item.id,
      repCode: item.repCode,
      shopId: item.shopId,
      shopName: item.shopName,
      status: item.status,
      approvedAt: item.approvedAt || null,
      createdAt: item.createdAt,
      gmv: 0,
      firstSaleDate: null,
    }));
  }
  return seedRepository.getState().sellerReferrals || [];
}

export async function listCommissionEntries() {
  if (env.mongoUri) {
    const entries = await CommissionEntry.find({}).sort({ createdAt: -1 }).lean();
    return entries.map((item) => ({
      ...item,
      date: item.createdAt,
    }));
  }
  return seedRepository.getState().commissionEntries || [];
}

export function getCommissionPlans() {
  return Object.values(DEFAULT_COMMISSION_PLANS);
}

/* ─── Seller product editing ──────────────────────────────────────
   Fields that require admin re-approval when changed by a seller.
   Stock, lead time, custom-message flag, and occasion tags do NOT
   require re-approval; everything customer-visible does.
   ─────────────────────────────────────────────────────────────── */
const SENSITIVE_PRODUCT_FIELDS = new Set([
  "name", "price", "description", "category",
  "family", "gender", "notes", "size",
  "allergens", "flavors", "cakeType", "servings",
  "includes", "ingredients", "imagePath",
]);

function listFrom(value) {
  return Array.isArray(value)
    ? value
    : String(value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function updateSellerProduct(productId, shopId, rawPayload) {
  const parsed = updateSellerProductSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const err = new Error("Invalid product update: " + parsed.error.issues.map((i) => i.message).join(", "));
    err.status = 422;
    throw err;
  }
  const payload = parsed.data;

  // Normalise CSV strings to arrays for array fields
  if (payload.notes        != null) payload.notes        = listFrom(payload.notes);
  if (payload.flavors      != null) payload.flavors      = listFrom(payload.flavors);
  if (payload.allergens    != null) payload.allergens    = listFrom(payload.allergens);
  if (payload.occasionTags != null) payload.occasionTags = listFrom(payload.occasionTags);

  const touchesSensitive = Object.keys(payload).some((k) => SENSITIVE_PRODUCT_FIELDS.has(k));

  // Build the field-level update object (status resolved separately)
  function buildUpdate(product) {
    const update = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key !== "status" && key !== "shopId") update[key] = value;
    }

    if (payload.status === "Draft") {
      update.status = "Draft";
    } else if (payload.status === "Needs approval") {
      // Explicit re-submit from Draft
      update.status = "Needs approval";
    } else if (touchesSensitive && product.status !== "Draft") {
      // Sensitive fields changed on a non-draft product → back to review queue
      update.status = "Needs approval";
    }
    // Otherwise, keep existing status (stock / non-sensitive-only edit)

    if (touchesSensitive || payload.status != null) {
      update.sellerLastEditedAt = new Date();
    }
    return update;
  }

  if (env.mongoUri) {
    const product = await Product.findOne({ id: productId }).lean();
    if (!product) { const e = new Error("Product not found."); e.status = 404; throw e; }
    if (product.shopId !== shopId) { const e = new Error("You do not own this product."); e.status = 403; throw e; }

    const update = buildUpdate(product);
    const updated = await Product.findOneAndUpdate(
      { id: productId },
      { $set: update },
      { returnDocument: "after" }
    ).lean();
    if (updated.status === "Needs approval" && product.status !== "Needs approval") {
      await createNotificationsForRole({
        recipientRole: "admin",
        title: "Product requires admin approval",
        message: `${updated.name} was submitted for approval by the seller.`,
        type: "product_needs_approval",
        entityType: "product",
        entityId: updated.id,
      });
    }
    return updated;
  }

  // Seed mode
  const product = seedRepository.getState().products.find((p) => p.id === productId);
  if (!product) { const e = new Error("Product not found."); e.status = 404; throw e; }
  if (product.shopId !== shopId) { const e = new Error("You do not own this product."); e.status = 403; throw e; }

  const update = buildUpdate(product);
  if (update.sellerLastEditedAt instanceof Date) {
    update.sellerLastEditedAt = update.sellerLastEditedAt.toISOString();
  }
  const updated = seedRepository.updateProduct(productId, shopId, update);
  if (updated?.status === "Needs approval" && product.status !== "Needs approval") {
    await createNotificationsForRole({
      recipientRole: "admin",
      title: "Product requires admin approval",
      message: `${updated.name} was submitted for approval by the seller.`,
      type: "product_needs_approval",
      entityType: "product",
      entityId: updated.id,
    });
  }
  return updated;
}

export async function updateSellerStock(productId, shopId, rawPayload) {
  const parsed = updateSellerStockSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const err = new Error("Invalid stock update: " + parsed.error.issues.map((i) => i.message).join(", "));
    err.status = 422;
    throw err;
  }
  const { delta, stock } = parsed.data;

  function resolveStock(current) {
    if (stock != null) return stock;
    return Math.max(0, current + delta);
  }

  if (env.mongoUri) {
    const product = await Product.findOne({ id: productId }).lean();
    if (!product) { const e = new Error("Product not found."); e.status = 404; throw e; }
    if (product.shopId !== shopId) { const e = new Error("You do not own this product."); e.status = 403; throw e; }

    const newStock = resolveStock(product.stock);
    const updated = await Product.findOneAndUpdate(
      { id: productId },
      { $set: { stock: newStock } },
      { returnDocument: "after" }
    ).lean();
    return updated;
  }

  // Seed mode
  const product = seedRepository.getState().products.find((p) => p.id === productId);
  if (!product) { const e = new Error("Product not found."); e.status = 404; throw e; }
  if (product.shopId !== shopId) { const e = new Error("You do not own this product."); e.status = 403; throw e; }

  return seedRepository.updateProduct(productId, shopId, { stock: resolveStock(product.stock) });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchProducts({ q = "", category, family, gender, occasion, minPrice, maxPrice, inStock, page = 1, limit = 20 }) {
  if (env.mongoUri) {
    const filter = { status: "Live" };
    const normalizedQ = String(q || "").trim();

    if (normalizedQ) {
      const pattern = new RegExp(escapeRegex(normalizedQ), "i");
      filter.$or = [
        { name: pattern },
        { family: pattern },
        { gender: pattern },
        { cakeType: pattern },
        { notes: pattern },
        { flavors: pattern },
        { tags: pattern },
        { occasionTags: pattern },
      ];
    }

    if (category) filter.category = category;
    if (family) filter.family = family;
    if (gender) filter.gender = gender;
    if (occasion) filter.occasionTags = occasion;
    if (minPrice != null || maxPrice != null) {
      filter.price = {};
      if (minPrice != null) filter.price.$gte = minPrice;
      if (maxPrice != null) filter.price.$lte = maxPrice;
    }
    if (inStock === "true") filter.stock = { $gt: 0 };

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;
    const [results, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Product.countDocuments(filter),
    ]);

    return { results, total, page: safePage, pages: Math.max(1, Math.ceil(total / safeLimit)) };
  }

  const state = seedRepository.getState();
  const normalizedQ = q.trim().toLowerCase();

  let results = state.products.filter((product) => {
    if (product.status !== "Live") return false;

    if (normalizedQ) {
      const haystack = [
        product.name, product.family, product.gender, product.cakeType,
        ...(product.notes || []), ...(product.flavors || []), ...(product.tags || []),
        ...(product.occasionTags || []),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(normalizedQ)) return false;
    }

    if (category && product.category !== category) return false;
    if (family && product.family !== family) return false;
    if (gender && product.gender !== gender) return false;
    if (occasion && !(product.occasionTags || []).includes(occasion)) return false;
    if (minPrice != null && product.price < minPrice) return false;
    if (maxPrice != null && product.price > maxPrice) return false;
    if (inStock === "true" && product.stock <= 0) return false;

    return true;
  });

  const total = results.length;
  const start = (page - 1) * limit;
  results = results.slice(start, start + limit);

  return { results, total, page, pages: Math.ceil(total / limit) };
}
