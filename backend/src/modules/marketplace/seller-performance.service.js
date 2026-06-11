import { Order } from "../../models/Order.js";
import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";
import { listAdminFeaturedProductPlacements } from "./featured-products.service.js";
import { listAdminFeaturedSellerPlacements } from "./featured-sellers.service.js";
import { listAdminSellerBrandProfiles, previewSellerBrandProfile } from "./brandProfile.service.js";
import { listPublicCollections } from "./collections.service.js";
import { getSellerBalance } from "../finance/payoutService.js";
import { listSupportTicketsSnapshot } from "../support/support.service.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { env } from "../../config/env.js";

const DEFAULT_RANGE_KEY = "30d";
const ALLOWED_RANGE_KEYS = new Set(["7d", "30d", "90d"]);
const COMPLETED_STATUSES = new Set(["Delivered", "Customer Accepted"]);
const ACTIVE_DISPUTE_STATUSES = new Set(["open", "under_review", "waiting_customer", "waiting_seller", "waiting_driver", "escalated"]);
const UNRESOLVED_TICKET_STATUSES = new Set(["Open", "In Progress", "Waiting for Customer", "Waiting for Seller", "Waiting for Driver"]);
const LOW_STOCK_THRESHOLD = 5;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeRangeKey(value) {
  const normalized = normalizeText(value);
  return ALLOWED_RANGE_KEYS.has(normalized) ? normalized : DEFAULT_RANGE_KEY;
}

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcStartOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function utcEndOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function addUtcDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDay(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatWeekLabel(startDate, endDate) {
  return `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

function normalizeRange(rangeKey = DEFAULT_RANGE_KEY, now = new Date()) {
  const key = normalizeRangeKey(rangeKey);
  const days = key === "7d" ? 7 : key === "90d" ? 90 : 30;
  const endDate = utcEndOfDay(now instanceof Date ? now : new Date(now));
  const startAnchor = utcStartOfDay(endDate);
  const startDate = addUtcDays(startAnchor, -(days - 1));
  return {
    key,
    label: `Last ${days} days`,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    bucket: key === "90d" ? "week" : "day",
  };
}

function isWithinRange(value, startDate, endDate) {
  const date = toDate(value);
  if (!date) return false;
  return date >= startDate && date <= endDate;
}

function isOrderCompleted(order) {
  return COMPLETED_STATUSES.has(normalizeText(order?.status));
}

function hasActiveDisputeSignal(order) {
  if (!order) return false;
  if (normalizeText(order.status) === "Disputed" || normalizeText(order.paymentStatus) === "Dispute hold") return true;
  const supportCase = order.supportCase;
  if (!supportCase || supportCase.kind !== "dispute") return false;
  const status = normalizeText(supportCase.status).toLowerCase();
  return ACTIVE_DISPUTE_STATUSES.has(status);
}

function getOrderSellerItems(order, shopId) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.filter((item) => normalizeText(item?.shopId) === normalizeText(shopId));
}

function orderHasSellerItems(order, shopId) {
  return getOrderSellerItems(order, shopId).length > 0;
}

function sumItemRevenue(items) {
  return items.reduce((sum, item) => sum + (money(item.price) * toNumber(item.quantity, 0)), 0);
}

function getOrderGmv(order, sellerItems) {
  const shopIds = Array.isArray(order?.shopIds) ? order.shopIds.map(normalizeText).filter(Boolean) : [];
  const subtotal = Number(order?.subtotal);
  if (shopIds.length <= 1 && Number.isFinite(subtotal) && subtotal > 0) {
    return money(subtotal);
  }
  return sumItemRevenue(sellerItems);
}

function buildTrendBuckets(range, startDate, endDate) {
  const buckets = [];
  const current = new Date(startDate.getTime());

  if (range.bucket === "week") {
    while (current <= endDate) {
      const bucketStart = new Date(current.getTime());
      const bucketEnd = utcEndOfDay(new Date(Math.min(addUtcDays(bucketStart, 6).getTime(), endDate.getTime())));
      buckets.push({
        bucketStart,
        bucketEnd,
        label: formatWeekLabel(bucketStart, bucketEnd),
        totalOrders: 0,
        gmv: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        refundedOrders: 0,
        disputedOrders: 0,
      });
      current.setUTCDate(current.getUTCDate() + 7);
    }
    return buckets;
  }

  while (current <= endDate) {
    const bucketStart = new Date(current.getTime());
    const bucketEnd = utcEndOfDay(new Date(bucketStart.getTime()));
    buckets.push({
      bucketStart,
      bucketEnd,
      label: formatDay(bucketStart),
      totalOrders: 0,
      gmv: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      refundedOrders: 0,
      disputedOrders: 0,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return buckets;
}

function mergeTrendOrders(buckets, orders, shopId) {
  const bucketMs = buckets.length > 1
    ? Math.max(1, buckets[1].bucketStart.getTime() - buckets[0].bucketStart.getTime())
    : 24 * 60 * 60 * 1000;

  for (const order of orders) {
    const orderDate = toDate(order.createdAt || order.updatedAt);
    if (!orderDate) continue;
    const sellerItems = getOrderSellerItems(order, shopId);
    if (!sellerItems.length) continue;

    const index = buckets.findIndex((bucket) => orderDate >= bucket.bucketStart && orderDate <= bucket.bucketEnd);
    if (index < 0) continue;

    const bucket = buckets[index];
    bucket.totalOrders += 1;
    if (isOrderCompleted(order)) {
      bucket.completedOrders += 1;
      bucket.gmv += getOrderGmv(order, sellerItems);
    }
    if (normalizeText(order.status) === "Cancelled") bucket.cancelledOrders += 1;
    if (normalizeText(order.status) === "Refunded") bucket.refundedOrders += 1;
    if (hasActiveDisputeSignal(order)) bucket.disputedOrders += 1;
  }

  return buckets.map((bucket) => ({
    bucketStart: bucket.bucketStart.toISOString(),
    bucketEnd: bucket.bucketEnd.toISOString(),
    label: bucket.label,
    totalOrders: bucket.totalOrders,
    gmv: bucket.gmv,
    completedOrders: bucket.completedOrders,
    cancelledOrders: bucket.cancelledOrders,
    refundedOrders: bucket.refundedOrders,
    disputedOrders: bucket.disputedOrders,
  })).map(({ bucketSizeMs, ...bucket }) => bucket);
}

function groupTopProducts(orders, shopId) {
  const groups = new Map();

  for (const order of orders) {
    if (!isOrderCompleted(order)) continue;
    const sellerItems = getOrderSellerItems(order, shopId);
    if (!sellerItems.length) continue;

    const seenInOrder = new Set();
    for (const item of sellerItems) {
      const productId = normalizeText(item.productId);
      if (!productId) continue;
      const key = productId;
      const entry = groups.get(key) || {
        productId,
        name: normalizeText(item.productName) || "Unknown product",
        imageUrl: "",
        status: "Unknown",
        orderCount: 0,
        revenue: 0,
        unitsSold: 0,
        route: null,
        productSlug: null,
        lastSeenAt: null,
      };

      entry.revenue += money(item.price) * toNumber(item.quantity, 0);
      entry.unitsSold += toNumber(item.quantity, 0);
      entry.lastSeenAt = order.createdAt || order.updatedAt || entry.lastSeenAt;

      if (!seenInOrder.has(key)) {
        entry.orderCount += 1;
        seenInOrder.add(key);
      }

      groups.set(key, entry);
    }
  }

  return [...groups.values()]
    .sort((left, right) => {
      if (right.revenue !== left.revenue) return right.revenue - left.revenue;
      if (right.orderCount !== left.orderCount) return right.orderCount - left.orderCount;
      if (right.unitsSold !== left.unitsSold) return right.unitsSold - left.unitsSold;
      return new Date(right.lastSeenAt || 0).getTime() - new Date(left.lastSeenAt || 0).getTime();
    })
    .slice(0, 5);
}

async function loadShop(shopId) {
  if (env.mongoUri) {
    return Shop.findOne({ id: shopId }).lean();
  }
  return seedRepository.getState().shops.find((shop) => normalizeText(shop.id) === normalizeText(shopId)) || null;
}

async function loadOrders(shopId) {
  if (env.mongoUri) {
    return Order.find({ shopIds: shopId }).lean();
  }
  return (seedRepository.getState().orders || []).filter((order) => {
    if (Array.isArray(order.shopIds)) return order.shopIds.map(normalizeText).includes(normalizeText(shopId));
    return getOrderSellerItems(order, shopId).length > 0;
  });
}

async function loadProducts(shopId) {
  if (env.mongoUri) {
    return Product.find({ shopId }).lean();
  }
  return (seedRepository.getState().products || []).filter((product) => normalizeText(product.shopId) === normalizeText(shopId));
}

async function loadSellerTickets(shopId) {
  const snapshot = await listSupportTicketsSnapshot({ role: "seller", shopId }, { page: 1, limit: 1000 });
  return snapshot?.tickets || [];
}

async function loadBrandState(shopId) {
  const [draftProfile, adminProfiles] = await Promise.all([
    previewSellerBrandProfile(shopId),
    listAdminSellerBrandProfiles(),
  ]);

  const existingProfile = adminProfiles.find((profile) => normalizeText(profile.shopId) === normalizeText(shopId)) || null;
  const visibleProfile = existingProfile || draftProfile || null;
  const completenessScore = visibleProfile ? toNumber(visibleProfile.completenessScore, 0) : 0;
  const publicSlug = normalizeText(visibleProfile?.slug) || null;
  const missingFields = [];
  const candidate = visibleProfile || {};
  const checks = [
    ["displayName", candidate.displayName],
    ["displayNameAr", candidate.displayNameAr],
    ["shortTagline", candidate.shortTagline],
    ["shortTaglineAr", candidate.shortTaglineAr],
    ["brandStory", candidate.brandStory],
    ["brandStoryAr", candidate.brandStoryAr],
    ["logoUrl", candidate.logoUrl],
    ["bannerUrl", candidate.bannerUrl],
    ["fragranceIdentityTags", Array.isArray(candidate.fragranceIdentityTags) && candidate.fragranceIdentityTags.length > 0],
    ["specialties", Array.isArray(candidate.specialties) && candidate.specialties.length > 0],
    ["trustBadges", Array.isArray(candidate.trustBadges) && candidate.trustBadges.length > 0],
    ["sellerPolicies", Array.isArray(candidate.sellerPolicies) && candidate.sellerPolicies.length > 0],
    ["socialLinks", Array.isArray(candidate.socialLinks) && candidate.socialLinks.length > 0],
  ];
  for (const [field, value] of checks) {
    if (!value) missingFields.push(field);
  }

  return {
    hasProfile: Boolean(existingProfile),
    published: Boolean(existingProfile?.published),
    completenessScore,
    publicSlug,
    publicUrl: existingProfile?.published && publicSlug ? `/sellers/${publicSlug}` : null,
    missingFields,
  };
}

function isVisibleSellerPlacement(placement) {
  if (!placement) return false;
  if (!placement.active) return false;
  const startsAt = toDate(placement.startsAt);
  const endsAt = toDate(placement.endsAt);
  const now = new Date();
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return Boolean(placement.brandProfile?.published);
}

function isVisibleProductPlacement(placement) {
  if (!placement) return false;
  if (!placement.active) return false;
  const startsAt = toDate(placement.startsAt);
  const endsAt = toDate(placement.endsAt);
  const now = new Date();
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return normalizeText(placement.product?.status) === "Live" && normalizeText(placement.shop?.status) === "Approved";
}

async function loadMerchandisingSummary(shopId, brandState, productsById) {
  const [sellerPlacements, productPlacements, collections] = await Promise.all([
    listAdminFeaturedSellerPlacements({ shopId }),
    listAdminFeaturedProductPlacements({ shopId }),
    listPublicCollections(),
  ]);

  const visibleSellerPlacements = sellerPlacements.filter(isVisibleSellerPlacement);
  const visibleProductPlacements = productPlacements.filter(isVisibleProductPlacement);
  const productIds = new Set((productsById || new Map()).keys());
  const publicSlug = brandState.publicSlug;

  const membershipSlugs = new Set();
  for (const collection of collections) {
    const items = Array.isArray(collection.items) ? collection.items : [];
    const matches = items.some((item) => {
      if (item.type === "product") {
        return normalizeText(item?.product?.shopId) === normalizeText(shopId) || productIds.has(normalizeText(item?.product?.id));
      }
      if (item.type === "seller") {
        return publicSlug && normalizeText(item?.seller?.slug) === normalizeText(publicSlug);
      }
      return false;
    });
    if (matches) membershipSlugs.add(collection.slug || collection.id);
  }

  const featuredSellerPlacements = visibleSellerPlacements.length;
  const featuredProductPlacements = visibleProductPlacements.length;
  const collectionMemberships = membershipSlugs.size;
  const activePlacementCount = featuredSellerPlacements + featuredProductPlacements + collectionMemberships;

  const notes = [];
  if (!brandState.hasProfile || !brandState.published) {
    notes.push("Publish your brand page to make seller placements public.");
  }
  if (featuredSellerPlacements > 0) {
    notes.push(`Featured in ${featuredSellerPlacements} seller placement${featuredSellerPlacements === 1 ? "" : "s"}.`);
  }
  if (featuredProductPlacements > 0) {
    notes.push(`Featured in ${featuredProductPlacements} product placement${featuredProductPlacements === 1 ? "" : "s"}.`);
  }
  if (collectionMemberships > 0) {
    notes.push(`Included in ${collectionMemberships} collection${collectionMemberships === 1 ? "" : "s"}.`);
  }
  if (!notes.length) {
    notes.push("No active merchandising placements yet.");
  }

  return {
    featuredSellerPlacements,
    featuredProductPlacements,
    collectionMemberships,
    activePlacementCount,
    notes,
  };
}

function emptyStateForSeller(summary) {
  const isNewSeller = summary.sales.totalOrders === 0 && summary.catalog.totalProducts === 0;
  const nextActions = [];
  if (!summary.brand.hasProfile || !summary.brand.published) {
    nextActions.push({
      label: summary.brand.hasProfile ? "Publish your brand page" : "Build your brand page",
      route: "/seller/brand",
    });
  }
  if (summary.catalog.totalProducts === 0) {
    nextActions.push({
      label: "Add products",
      route: "/seller/products",
    });
  }
  if (summary.sales.totalOrders === 0) {
    nextActions.push({
      label: "Review analytics later",
      route: "/seller/analytics",
    });
  }

  return {
    isNewSeller,
    message: isNewSeller ? "Your analytics will appear once you start getting orders and publishing products." : null,
    nextActions,
  };
}

export async function getSellerPerformanceSummary(shopId, rangeKey = DEFAULT_RANGE_KEY) {
  if (!shopId) {
    throw createHttpError(403, "Seller shop context required.");
  }

  const shop = await loadShop(shopId);
  if (!shop) {
    throw createHttpError(404, `Shop ${shopId} not found.`);
  }

  const range = normalizeRange(rangeKey);
  const startDate = new Date(range.startDate);
  const endDate = new Date(range.endDate);

  const [orders, products, tickets, brandState, finance] = await Promise.all([
    loadOrders(shopId),
    loadProducts(shopId),
    loadSellerTickets(shopId),
    loadBrandState(shopId),
    getSellerBalance(shopId),
  ]);

  const orderRange = orders.filter((order) => isWithinRange(order.createdAt || order.updatedAt, startDate, endDate));
  const sellerOrders = orderRange.filter((order) => orderHasSellerItems(order, shopId));
  const sellerItemsPerOrder = new Map();

  for (const order of sellerOrders) {
    sellerItemsPerOrder.set(order.orderId || order.id || `${order.createdAt}-${order.updatedAt}`, getOrderSellerItems(order, shopId));
  }

  const totalOrders = sellerOrders.length;
  const completedOrders = sellerOrders.filter(isOrderCompleted).length;
  const cancelledOrders = sellerOrders.filter((order) => normalizeText(order.status) === "Cancelled").length;
  const refundedOrders = sellerOrders.filter((order) => normalizeText(order.status) === "Refunded").length;
  const disputedOrders = sellerOrders.filter(hasActiveDisputeSignal).length;

  let gmv = 0;
  for (const order of sellerOrders) {
    if (!isOrderCompleted(order)) continue;
    const sellerItems = sellerItemsPerOrder.get(order.orderId || order.id || `${order.createdAt}-${order.updatedAt}`) || [];
    gmv += getOrderGmv(order, sellerItems);
  }

  const averageOrderValue = completedOrders > 0 ? Math.round(gmv / completedOrders) : 0;
  const trend = mergeTrendOrders(buildTrendBuckets(range, startDate, endDate), sellerOrders, shopId);
  const topProductRows = groupTopProducts(orderRange, shopId);

  const productsById = new Map(products.map((product) => [normalizeText(product.id), product]));
  const liveProducts = products.filter((product) => normalizeText(product.status) === "Live").length;
  const draftProducts = products.filter((product) => ["Draft", "Needs approval"].includes(normalizeText(product.status))).length;
  const inactiveProducts = products.filter((product) => normalizeText(product.status) === "Rejected").length;
  const lowStockProducts = products.filter((product) => normalizeText(product.status) === "Live" && toNumber(product.stock, 0) <= LOW_STOCK_THRESHOLD).length;
  const totalProducts = products.length;

  const supportTicketCount = tickets.filter((ticket) => isWithinRange(ticket.createdAt || ticket.updatedAt, startDate, endDate)).length;
  const openSupportTicketCount = tickets.filter((ticket) => UNRESOLVED_TICKET_STATUSES.has(normalizeText(ticket.status))).length;
  const disputeCount = orders.filter((order) => hasActiveDisputeSignal(order)).length;

  const merchandising = await loadMerchandisingSummary(shopId, brandState, productsById);

  const cancellationRate = totalOrders > 0 ? Number(((cancelledOrders / totalOrders) * 100).toFixed(1)) : 0;
  const refundRate = totalOrders > 0 ? Number(((refundedOrders / totalOrders) * 100).toFixed(1)) : 0;
  const disputeRate = totalOrders > 0 ? Number(((disputedOrders / totalOrders) * 100).toFixed(1)) : 0;

  const operationsAlerts = [];
  if (openSupportTicketCount > 0) {
    operationsAlerts.push(`${openSupportTicketCount} open support ticket${openSupportTicketCount === 1 ? "" : "s"}`);
  }
  if (disputeCount > 0) {
    operationsAlerts.push(`${disputeCount} disputed order${disputeCount === 1 ? "" : "s"}`);
  }
  if (lowStockProducts > 0) {
    operationsAlerts.push(`${lowStockProducts} live product${lowStockProducts === 1 ? "" : "s"} are low stock`);
  }
  if (cancellationRate >= 10) {
    operationsAlerts.push(`Cancellation rate is ${cancellationRate}%`);
  }
  if (refundRate >= 5) {
    operationsAlerts.push(`Refund rate is ${refundRate}%`);
  }

  const summary = {
    range,
    sales: {
      totalOrders,
      gmv,
      averageOrderValue,
      completedOrders,
      cancelledOrders,
      refundedOrders,
      disputedOrders,
      trend,
    },
    topProducts: topProductRows.map((row) => {
      const product = row.productId ? productsById.get(row.productId) || null : null;
      return {
        productId: row.productId,
        name: product?.name || row.name,
        imageUrl: product?.imagePath || null,
        status: product?.status || row.status || "Unknown",
        orderCount: row.orderCount,
        revenue: row.revenue,
        unitsSold: row.unitsSold,
        route: product ? `/products/${row.productId}` : null,
        productSlug: null,
      };
    }),
    operations: {
      supportTicketCount,
      openSupportTicketCount,
      disputeCount,
      cancellationRate,
      refundRate,
      disputeRate,
      operationalAlerts: operationsAlerts,
    },
    catalog: {
      liveProducts,
      draftProducts,
      inactiveProducts,
      lowStockProducts,
      totalProducts,
    },
    brand: brandState,
    merchandising,
    finance: {
      pendingBalance: money(finance?.pendingBalance),
      availableBalance: money(finance?.availableBalance),
      holdBalance: money(finance?.holdBalance),
      paidBalance: money(finance?.paidBalance),
    },
  };

  summary.emptyState = emptyStateForSeller(summary);
  return summary;
}
