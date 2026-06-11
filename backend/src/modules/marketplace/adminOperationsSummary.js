import { env } from "../../config/env.js";
import { DeliveryOffer } from "../../models/DeliveryOffer.js";
import { Driver } from "../../models/Driver.js";
import { Order } from "../../models/Order.js";
import { Payout } from "../../models/Payout.js";
import { Shop } from "../../models/Shop.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { getSeedOrders } from "../orders/orders.service.js";
import { getReleasePreview, listPayouts } from "../finance/payoutService.js";
import {
  listAdminDeliveryOffersSnapshot,
  listDriversSnapshot,
} from "../drivers/drivers.service.js";
import {
  listSupportTicketsSnapshot,
} from "../support/support.service.js";

const TIME_ZONE = "Asia/Dubai";
const DEFAULT_QUEUE_LIMIT = 5;
const MAX_QUEUE_LIMIT = 10;
const HIGH_COD_THRESHOLD = 500;

const ACTIVE_ORDER_STATUSES = new Set(["Pending", "Confirmed", "Processing", "Ready for Delivery", "Shipped"]);
const ACTIVE_DISPUTE_STATUSES = new Set(["open", "under_review", "waiting_customer", "waiting_seller", "waiting_driver", "escalated"]);
const OPEN_SUPPORT_STATUSES = new Set(["Open", "In Progress"]);
const UNRESOLVED_SUPPORT_STATUSES = new Set(["Open", "In Progress", "Waiting for Customer", "Waiting for Seller", "Waiting for Driver"]);
const PENDING_PAYOUT_STATUSES = new Set(["pending"]);
const PROCESSING_PAYOUT_STATUSES = new Set(["processing"]);
const FAILED_PAYOUT_STATUSES = new Set(["failed"]);
const COMPLETED_PAYOUT_STATUSES = new Set(["completed"]);

const adminAudience = { sub: "admin-operations", role: "admin", name: "Operations dashboard" };

function clampQueueLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_QUEUE_LIMIT;
  return Math.min(Math.max(Math.floor(parsed) || DEFAULT_QUEUE_LIMIT, 1), MAX_QUEUE_LIMIT);
}

function toSafeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function zonedParts(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year || 0),
    month: Number(map.month || 0),
    day: Number(map.day || 0),
  };
}

function sameZonedDay(a, b, timeZone = TIME_ZONE) {
  if (!a || !b) return false;
  const left = zonedParts(new Date(a), timeZone);
  const right = zonedParts(new Date(b), timeZone);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

function sameZonedMonth(a, b, timeZone = TIME_ZONE) {
  if (!a || !b) return false;
  const left = zonedParts(new Date(a), timeZone);
  const right = zonedParts(new Date(b), timeZone);
  return left.year === right.year && left.month === right.month;
}

function formatDayRange(now = new Date(), timeZone = TIME_ZONE) {
  const parts = zonedParts(now, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return {
    rangeStart: `${parts.year}-${month}-${day}T00:00:00.000Z`,
    rangeEnd: `${parts.year}-${month}-${day}T23:59:59.999Z`,
  };
}

function buildShopMap(shops = []) {
  return new Map((shops || []).map((shop) => [shop.id, shop]));
}

function shopLabel(shopId, shopMap) {
  const shop = shopMap.get(shopId);
  if (!shop) return shopId ? `Deleted shop (${shopId})` : "Unknown shop";
  return shop.name || shop.id || "Unknown shop";
}

function formatQueueStatusLabel(status) {
  return String(status || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (s) => s.toUpperCase());
}

function toneForSupportStatus(status) {
  if (status === "Open") return "warning";
  if (status === "In Progress") return "brand";
  if (status === "Waiting for Customer" || status === "Waiting for Seller" || status === "Waiting for Driver") return "amber";
  if (status === "Resolved") return "success";
  if (status === "Closed") return "muted";
  return "brand";
}

function toneForPriority(priority) {
  if (priority === "urgent" || priority === "high") return "danger";
  if (priority === "normal") return "brand";
  return "muted";
}

function toneForRisk(risk) {
  if (risk === "high" || risk === "danger") return "danger";
  if (risk === "warning") return "warning";
  if (risk === "success") return "success";
  if (risk === "brand") return "brand";
  return "muted";
}

function buildStatusPill(status, tone) {
  return { label: status, tone: tone || "muted" };
}

function buildMoneyQueueItem({
  id,
  reference,
  title,
  subtitle,
  amount,
  status,
  priority = null,
  risk = null,
  createdAt = null,
  updatedAt = null,
  route,
}) {
  return {
    id,
    reference,
    title,
    subtitle,
    amount: toSafeNumber(amount),
    status,
    priority,
    risk,
    createdAt,
    updatedAt,
    route,
  };
}

function extractSupportContext(ticket, shopMap) {
  if (ticket.orderId) return `Order ${ticket.orderId}`;
  if (ticket.shopId) return shopLabel(ticket.shopId, shopMap);
  if (ticket.driverId) return `Driver ${ticket.driverId}`;
  return "General help";
}

function hasActiveDispute(order) {
  if (!order) return false;
  if (order.status === "Disputed" || order.paymentStatus === "Dispute hold") return true;
  const supportCase = order.supportCase;
  if (!supportCase || supportCase.kind !== "dispute") return false;
  const status = String(supportCase.status || "open").toLowerCase();
  return ACTIVE_DISPUTE_STATUSES.has(status);
}

function isActiveDeliveryAssignment(order) {
  if (!order?.driverAssignment?.driverId) return false;
  return !order.driverAssignment.deliveredAt && ["Ready for Delivery", "Shipped"].includes(order.status);
}

function normalizeOrderStatusForQueue(order) {
  if (order?.supportCase?.kind === "dispute") return "Disputed";
  return order?.status || "—";
}

async function loadOrders() {
  if (env.mongoUri) {
    return Order.find({})
      .select("orderId customerName subtotal status paymentMethod paymentStatus shopIds createdAt updatedAt supportCase driverAssignment deliveryAddress")
      .lean();
  }
  return getSeedOrders();
}

async function loadSupportTickets() {
  if (env.mongoUri) {
    const tickets = await SupportTicket.find({})
      .select("id ticketNumber requesterUserId requesterName requesterEmail requesterRole shopId driverId orderId category priority status subject assignedToUserId assignedToUserName assignedToUserEmail assignedToRole createdAt updatedAt lastMessageAt lastStatusAt convertedAt convertedOrderId convertedDisputeRef")
      .sort({ updatedAt: -1 })
      .lean();
    return tickets;
  }
  const result = await listSupportTicketsSnapshot(adminAudience, {});
  return result.tickets || [];
}

async function loadDeliveryOffers() {
  if (env.mongoUri) {
    const offers = await DeliveryOffer.find({})
      .select("id orderId shopId shopName sellerUserId deliveryZone deliveryAddressSummary codAmount status offeredDriverIds acceptedDriverId acceptedDriverName acceptedAt expiresAt createdBy notes createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();
    return offers;
  }
  return listAdminDeliveryOffersSnapshot();
}

async function loadDrivers() {
  if (env.mongoUri) {
    return Driver.find({})
      .select("id name phone email shopId shopName vehicleType zone status codBalance totalDeliveries totalCodCollected isActive createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();
  }
  const result = await listDriversSnapshot({});
  return result.drivers || [];
}

async function loadShops() {
  if (env.mongoUri) {
    return Shop.find({})
      .select("id name pendingBalance availableBalance holdBalance paidBalance payoutHoldDays")
      .lean();
  }
  return seedRepository.getState().shops || [];
}

async function loadPayouts() {
  if (env.mongoUri) {
    return Payout.find({})
      .select("id shopId orderIds amount method status notes failureReason createdBy processedBy completedBy cancelledBy createdAt updatedAt processedAt completedAt failedAt cancelledAt")
      .sort({ createdAt: -1 })
      .lean();
  }
  return listPayouts();
}

function buildOrderQueues(orders, shopMap, now, queueLimit) {
  const newOrders = orders.filter((order) => {
    if (!sameZonedDay(order.createdAt, now)) return false;
    return ACTIVE_ORDER_STATUSES.has(order.status);
  });

  const readyForDelivery = orders.filter((order) => order.status === "Ready for Delivery");
  const assignedDeliveries = orders.filter((order) => isActiveDeliveryAssignment(order));
  const deliveredToday = orders.filter((order) => {
    const deliveredAt = order.driverAssignment?.deliveredAt;
    return Boolean(deliveredAt) && sameZonedDay(deliveredAt, now);
  });
  const readyUnassignedOrders = orders.filter((order) => order.status === "Ready for Delivery" && !order.driverAssignment?.driverId);
  const disputesWaitingForAdmin = orders.filter((order) => hasActiveDispute(order));
  const unsettledCodOrders = orders.filter((order) => String(order.paymentMethod || "").toLowerCase() === "cod" && Boolean(order.driverAssignment?.codCollected) && !order.driverAssignment?.codSettledAt);

  return {
    newOrders: {
      count: newOrders.length,
      label: "New orders",
      route: "/admin/orders",
    },
    readyForDelivery: {
      count: readyForDelivery.length,
      label: "Ready for delivery",
      route: "/admin/orders",
    },
    assignedDeliveries: {
      count: assignedDeliveries.length,
      label: "Assigned deliveries",
      route: "/admin/drivers",
    },
    deliveredToday: {
      count: deliveredToday.length,
      label: "Delivered today",
      route: "/admin/orders",
    },
    readyUnassignedOrders: {
      total: readyUnassignedOrders.length,
      limit: queueLimit,
      items: readyUnassignedOrders
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, queueLimit)
        .map((order) => {
          const shopName = order.shopIds?.map((shopId) => shopLabel(shopId, shopMap)).filter(Boolean).join(", ") || "Unknown shop";
          return buildMoneyQueueItem({
            id: order.orderId,
            reference: order.orderId,
            title: order.customerName || order.orderId,
            subtitle: `${shopName} · ${order.deliveryAddress || "No delivery address"}`,
            amount: order.subtotal || 0,
            status: order.status,
            priority: String(order.paymentMethod || "").toLowerCase() === "cod" ? "high" : "normal",
            risk: null,
            createdAt: order.createdAt || null,
            updatedAt: order.updatedAt || null,
            route: `/admin/orders?order=${encodeURIComponent(order.orderId)}`,
          });
        }),
    },
    disputesWaitingForAdmin: {
      total: disputesWaitingForAdmin.length,
      limit: queueLimit,
      items: disputesWaitingForAdmin
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, queueLimit)
        .map((order) => {
          const supportCase = order.supportCase || {};
          const shopName = order.shopIds?.map((shopId) => shopLabel(shopId, shopMap)).filter(Boolean).join(", ") || "Unknown shop";
          const status = supportCase.status ? formatQueueStatusLabel(supportCase.status) : "Disputed";
          const priority = supportCase.priority || "normal";
          const risk = priority === "urgent" || priority === "high" ? "high" : null;
          return buildMoneyQueueItem({
            id: order.orderId,
            reference: order.orderId,
            title: order.customerName || order.orderId,
            subtitle: `${shopName} · ${supportCase.issueType || "formal dispute"}`,
            amount: order.subtotal || 0,
            status,
            priority,
            risk,
            createdAt: order.createdAt || null,
            updatedAt: order.updatedAt || null,
            route: `/admin/support?section=support&order=${encodeURIComponent(order.orderId)}`,
          });
        }),
    },
    unsettledCodOrders: {
      total: unsettledCodOrders.length,
      limit: queueLimit,
      items: unsettledCodOrders
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, queueLimit)
        .map((order) => {
          const shopName = order.shopIds?.map((shopId) => shopLabel(shopId, shopMap)).filter(Boolean).join(", ") || "Unknown shop";
          return buildMoneyQueueItem({
            id: order.orderId,
            reference: order.orderId,
            title: order.customerName || order.orderId,
            subtitle: `${shopName} · COD collected${order.driverAssignment?.driverName ? ` · ${order.driverAssignment.driverName}` : ""}`,
            amount: order.driverAssignment?.codAmount || order.subtotal || 0,
            status: "COD collected",
            priority: "high",
            risk: "warning",
            createdAt: order.createdAt || null,
            updatedAt: order.updatedAt || null,
            route: "/admin/drivers",
          });
        }),
    },
  };
}

function buildSupportQueue(supportTickets, shopMap, queueLimit) {
  const openSupportTickets = supportTickets.filter((ticket) => UNRESOLVED_SUPPORT_STATUSES.has(ticket.status));
  const supportWaitingForAdmin = supportTickets.filter((ticket) => OPEN_SUPPORT_STATUSES.has(ticket.status));

  return {
    openSupportTickets: {
      count: openSupportTickets.length,
      label: "Open support tickets",
      route: "/admin/support-tickets",
    },
    supportWaitingForAdmin: {
      total: supportWaitingForAdmin.length,
      limit: queueLimit,
      items: supportWaitingForAdmin
        .sort((a, b) => new Date(b.updatedAt || b.lastMessageAt || b.createdAt || 0) - new Date(a.updatedAt || a.lastMessageAt || a.createdAt || 0))
        .slice(0, queueLimit)
        .map((ticket) => {
          const context = extractSupportContext(ticket, shopMap);
          return buildMoneyQueueItem({
            id: ticket.id || ticket.ticketNumber,
            reference: ticket.ticketNumber || ticket.id,
            title: ticket.subject || ticket.ticketNumber || ticket.id,
            subtitle: `${ticket.requesterRole || "customer"} · ${context}`,
            amount: 0,
            status: ticket.status || "Open",
            priority: ticket.priority || "normal",
            risk: ticket.priority === "urgent" || ticket.priority === "high" ? "high" : null,
            createdAt: ticket.createdAt || null,
            updatedAt: ticket.updatedAt || ticket.lastMessageAt || ticket.lastStatusAt || null,
            route: `/admin/support-tickets?ticket=${encodeURIComponent(ticket.ticketNumber || ticket.id)}`,
          });
        }),
    },
  };
}

function buildDriverQueue(drivers, queueLimit) {
  const driverCodOutstanding = drivers.reduce((sum, driver) => sum + toSafeNumber(driver.codBalance), 0);
  const highCodDrivers = drivers.filter((driver) => toSafeNumber(driver.codBalance) >= HIGH_COD_THRESHOLD);

  return {
    driverCodOutstanding: {
      count: driverCodOutstanding,
      label: "Driver COD outstanding",
      route: "/admin/drivers",
    },
    highCodDrivers: {
      total: highCodDrivers.length,
      limit: queueLimit,
      items: highCodDrivers
        .sort((a, b) => toSafeNumber(b.codBalance) - toSafeNumber(a.codBalance))
        .slice(0, queueLimit)
        .map((driver) => buildMoneyQueueItem({
          id: driver.id,
          reference: driver.id,
          title: driver.name || driver.id,
          subtitle: `${driver.shopName || driver.shopId || "Platform driver"}${driver.zone ? ` · ${driver.zone}` : ""}`,
          amount: driver.codBalance || 0,
          status: driver.status || "active",
          priority: null,
          risk: "high",
          createdAt: driver.createdAt || null,
          updatedAt: driver.updatedAt || null,
          route: "/admin/drivers",
        })),
    },
  };
}

function buildDeliveryOfferQueue(deliveryOffers, shopMap, queueLimit, now) {
  const activeOffers = deliveryOffers.filter((offer) => offer.status === "Open" && new Date(offer.expiresAt || 0).getTime() > now.getTime());
  const expiredOffers = deliveryOffers.filter((offer) => {
    const expiresAt = new Date(offer.expiresAt || 0).getTime();
    return offer.status === "Expired" || (offer.status === "Open" && expiresAt <= now.getTime());
  });

  return {
    activeDeliveryOffers: {
      count: activeOffers.length,
      label: "Active delivery offers",
      route: "/admin/drivers",
    },
    expiredDeliveryOffers: {
      total: expiredOffers.length,
      limit: queueLimit,
      items: expiredOffers
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, queueLimit)
        .map((offer) => {
          const shopName = shopLabel(offer.shopId, shopMap);
          return buildMoneyQueueItem({
            id: offer.id,
            reference: offer.orderId,
            title: offer.orderId,
            subtitle: `${shopName}${offer.deliveryZone ? ` · ${offer.deliveryZone}` : ""} · ${offer.status === "Expired" ? "expired" : "waiting"}`,
            amount: offer.codAmount || 0,
            status: offer.status || "Open",
            priority: null,
            risk: offer.status === "Expired" ? "warning" : null,
            createdAt: offer.createdAt || null,
            updatedAt: offer.updatedAt || null,
            route: "/admin/drivers",
          });
        }),
    },
  };
}

function buildPayoutQueue(payouts, shopMap, queueLimit, now) {
  const pending = payouts.filter((payout) => PENDING_PAYOUT_STATUSES.has(payout.status));
  const processing = payouts.filter((payout) => PROCESSING_PAYOUT_STATUSES.has(payout.status));
  const failed = payouts.filter((payout) => FAILED_PAYOUT_STATUSES.has(payout.status));
  const completedThisMonth = payouts.filter((payout) => COMPLETED_PAYOUT_STATUSES.has(payout.status) && sameZonedMonth(payout.completedAt || payout.updatedAt || payout.createdAt, now));

  return {
    pendingPayouts: {
      count: pending.length,
      label: "Pending payouts",
      route: "/admin/payouts",
    },
    payoutsInProgress: {
      total: pending.length + processing.length,
      limit: queueLimit,
      items: [...pending, ...processing]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, queueLimit)
        .map((payout) => {
          const shopName = shopLabel(payout.shopId, shopMap);
          return buildMoneyQueueItem({
            id: payout.id,
            reference: payout.id,
            title: `Payout ${payout.id}`,
            subtitle: `${shopName} · ${payout.method || "bank_transfer"} · ${(payout.orderIds || []).length} orders`,
            amount: payout.amount || 0,
            status: payout.status || "pending",
            priority: null,
            risk: payout.status === "failed" ? "danger" : null,
            createdAt: payout.createdAt || null,
            updatedAt: payout.updatedAt || payout.processedAt || null,
            route: "/admin/payouts",
          });
        }),
    },
    failedPayouts: {
      total: failed.length,
      limit: queueLimit,
      items: failed
        .sort((a, b) => new Date(b.updatedAt || b.failedAt || b.createdAt || 0) - new Date(a.updatedAt || a.failedAt || a.createdAt || 0))
        .slice(0, queueLimit)
        .map((payout) => {
          const shopName = shopLabel(payout.shopId, shopMap);
          return buildMoneyQueueItem({
            id: payout.id,
            reference: payout.id,
            title: `Payout ${payout.id}`,
            subtitle: `${shopName} · ${payout.failureReason || "Failed payout"}`,
            amount: payout.amount || 0,
            status: "failed",
            priority: "high",
            risk: "warning",
            createdAt: payout.createdAt || null,
            updatedAt: payout.updatedAt || payout.failedAt || null,
            route: "/admin/payouts",
          });
        }),
    },
    totalPendingPayouts: {
      count: pending.length,
      amount: pending.reduce((sum, payout) => sum + toSafeNumber(payout.amount), 0),
    },
    totalProcessingPayouts: {
      count: processing.length,
      amount: processing.reduce((sum, payout) => sum + toSafeNumber(payout.amount), 0),
    },
    totalCompletedPayoutsThisMonth: {
      count: completedThisMonth.length,
      amount: completedThisMonth.reduce((sum, payout) => sum + toSafeNumber(payout.amount), 0),
    },
  };
}

function buildFinanceSummary(shops, payouts, drivers, now) {
  const totals = shops.reduce((acc, shop) => {
    acc.totalPendingSellerBalance += toSafeNumber(shop.pendingBalance);
    acc.totalAvailableSellerBalance += toSafeNumber(shop.availableBalance);
    acc.totalHoldSellerBalance += toSafeNumber(shop.holdBalance);
    acc.totalPaidSellerBalance += toSafeNumber(shop.paidBalance);
    return acc;
  }, {
    totalPendingSellerBalance: 0,
    totalAvailableSellerBalance: 0,
    totalHoldSellerBalance: 0,
    totalPaidSellerBalance: 0,
  });

  const totalDriverCodOutstanding = drivers.reduce((sum, driver) => sum + toSafeNumber(driver.codBalance), 0);
  const pendingPayouts = payouts.filter((payout) => PENDING_PAYOUT_STATUSES.has(payout.status));
  const processingPayouts = payouts.filter((payout) => PROCESSING_PAYOUT_STATUSES.has(payout.status));
  const completedThisMonth = payouts.filter((payout) => COMPLETED_PAYOUT_STATUSES.has(payout.status) && sameZonedMonth(payout.completedAt || payout.updatedAt || payout.createdAt, now));

  return {
    ...totals,
    totalDriverCodOutstanding,
    totalPendingPayouts: {
      count: pendingPayouts.length,
      amount: pendingPayouts.reduce((sum, payout) => sum + toSafeNumber(payout.amount), 0),
    },
    totalProcessingPayouts: {
      count: processingPayouts.length,
      amount: processingPayouts.reduce((sum, payout) => sum + toSafeNumber(payout.amount), 0),
    },
    totalCompletedPayoutsThisMonth: {
      count: completedThisMonth.length,
      amount: completedThisMonth.reduce((sum, payout) => sum + toSafeNumber(payout.amount), 0),
    },
  };
}

function buildQuickLinks() {
  return [
    {
      id: "orders",
      label: "Orders",
      route: "/admin/orders",
      description: "Review active order flow and assigned deliveries.",
    },
    {
      id: "drivers",
      label: "Drivers",
      route: "/admin/drivers",
      description: "Monitor fleets, offers, and COD balances.",
    },
    {
      id: "cod-settlement",
      label: "COD settlement",
      route: "/admin/drivers",
      description: "Reconcile collected cash with driver records.",
    },
    {
      id: "support-tickets",
      label: "Support Tickets",
      route: "/admin/support-tickets",
      description: "General help cases and admin follow-up.",
    },
    {
      id: "disputes",
      label: "Disputes",
      route: "/admin/support?section=support",
      description: "Formal order-linked disputes and case resolution.",
    },
    {
      id: "release-earnings",
      label: "Release earnings",
      route: "/admin/payouts",
      description: "Move matured pending earnings into available balance.",
    },
    {
      id: "payouts",
      label: "Payouts",
      route: "/admin/payouts",
      description: "Track payout batches, progress, and failures.",
    },
    {
      id: "shops",
      label: "Sellers / Shops",
      route: "/admin/shops",
      description: "Review seller health, balances, and watch lists.",
    },
  ];
}

export async function getAdminOperationsSummary({ queueLimit = DEFAULT_QUEUE_LIMIT, now = new Date() } = {}) {
  const limit = clampQueueLimit(queueLimit);
  const currentNow = now instanceof Date ? now : new Date(now);

  const [orders, supportTickets, deliveryOffers, drivers, shops, payouts] = await Promise.all([
    loadOrders(),
    loadSupportTickets(),
    loadDeliveryOffers(),
    loadDrivers(),
    loadShops(),
    loadPayouts(),
  ]);

  const shopMap = buildShopMap(shops);
  const snapshotOrders = buildOrderQueues(orders, shopMap, currentNow, limit);
  const snapshotSupport = buildSupportQueue(supportTickets, shopMap, limit);
  const snapshotDrivers = buildDriverQueue(drivers, limit);
  const snapshotOffers = buildDeliveryOfferQueue(deliveryOffers, shopMap, limit, currentNow);
  const snapshotPayouts = buildPayoutQueue(payouts, shopMap, limit, currentNow);
  const finance = buildFinanceSummary(shops, payouts, drivers, currentNow);
  const releasePreviews = await Promise.all(
    shops.map(async (shop) => {
      try {
        return await getReleasePreview(shop.id, { now: currentNow });
      } catch (_err) {
        return null;
      }
    })
  );

  const earningsReadyForRelease = releasePreviews
    .filter(Boolean)
    .flatMap((preview) => (preview.eligibleOrders || []).map((item) => ({
      ...item,
      shopId: preview.shopId,
      shopName: preview.shopName,
    })))
    .sort((a, b) => new Date(b.eligibleAt || b.releasedAt || 0) - new Date(a.eligibleAt || a.releasedAt || 0))
    .slice(0, limit)
    .map((item) => buildMoneyQueueItem({
      id: `${item.shopId}:${item.orderId}`,
      reference: item.orderId,
      title: item.shopName || item.shopId || item.orderId,
      subtitle: `${item.creditType === "cod_credit" ? "COD credit" : "Delivery credit"} · ${item.orderId}`,
      amount: item.amount || 0,
      status: "Eligible",
      priority: null,
      risk: null,
      createdAt: item.releasedAt || item.eligibleAt || null,
      updatedAt: item.releasedAt || item.eligibleAt || null,
      route: "/admin/payouts",
    }));

  return {
    snapshot: {
      newOrders: snapshotOrders.newOrders,
      readyForDelivery: snapshotOrders.readyForDelivery,
      activeDeliveryOffers: snapshotOffers.activeDeliveryOffers,
      assignedDeliveries: snapshotOrders.assignedDeliveries,
      deliveredToday: snapshotOrders.deliveredToday,
      openDisputes: {
        count: snapshotOrders.disputesWaitingForAdmin.total,
        label: "Open disputes",
        route: "/admin/support?section=support",
      },
      openSupportTickets: snapshotSupport.openSupportTickets,
      pendingPayouts: snapshotPayouts.pendingPayouts,
      driverCodOutstanding: snapshotDrivers.driverCodOutstanding,
    },
    queues: {
      readyUnassignedOrders: snapshotOrders.readyUnassignedOrders,
      expiredDeliveryOffers: snapshotOffers.expiredDeliveryOffers,
      highCodDrivers: snapshotDrivers.highCodDrivers,
      unsettledCodOrders: snapshotOrders.unsettledCodOrders,
      disputesWaitingForAdmin: snapshotOrders.disputesWaitingForAdmin,
      supportWaitingForAdmin: snapshotSupport.supportWaitingForAdmin,
      earningsReadyForRelease: {
        total: earningsReadyForRelease.length,
        limit,
        items: earningsReadyForRelease,
      },
      payoutsInProgress: snapshotPayouts.payoutsInProgress,
      failedPayouts: snapshotPayouts.failedPayouts,
    },
    finance,
    quickLinks: buildQuickLinks(),
    meta: {
      generatedAt: currentNow.toISOString(),
      timezone: TIME_ZONE,
      ...formatDayRange(currentNow, TIME_ZONE),
      queueLimit: limit,
      queueMaxLimit: MAX_QUEUE_LIMIT,
      highCodThreshold: HIGH_COD_THRESHOLD,
      countsAreExact: true,
      version: "admin-operations-summary-v1",
    },
  };
}
