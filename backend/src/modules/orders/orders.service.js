import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { Order } from "../../models/Order.js";
import { Product } from "../../models/Product.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { canTransitionOrderStatus } from "../../shared/workflows/orderWorkflow.js";
import { createNotificationsForRole } from "../notifications/notifications.service.js";
import {
  getBuildYourBoxProductIds,
  validateBuildYourBoxItems,
} from "./buildYourBox.validation.js";
import {
  deductMongoStockWithRollback,
  deductSeedStock,
  resolveOrderStockLines,
  rollbackMongoStock,
} from "./orderStock.js";
import { accrueDeliveredOrderCommissions } from "./orderCommissions.js";
import {
  debitForRefund,
  freezeSellerBalanceForDispute,
  recordDeliveryEarning,
  releaseDisputeHold,
} from "../finance/sellerBalance.js";
import { reverseOrderCommissions as reverseSalesRepCommissions } from "../finance/commissionReversal.js";

const orderItemMetadataSchema = z.object({
  cakeWriting: z.string().max(120).optional(),
  itemMessage: z.string().max(240).optional(),
  allergyNote: z.string().max(240).optional(),
  giftWrap: z.boolean().optional(),
}).passthrough();

export const createOrderSchema = z.object({
  checkoutMode: z.enum(["guest", "account"]).default("guest"),
  paymentMethod: z.enum(["card", "cod"]).default("card"),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  phone: z.string().min(3).max(40).optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        shopId: z.string(),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
        category: z.string().optional(),
        family: z.string().optional(),
        gender: z.string().optional(),
        size: z.string().optional(),
        cakeType: z.string().optional(),
        flavors: z.array(z.string()).optional(),
        servings: z.string().optional(),
        allergens: z.array(z.string()).optional(),
        leadTimeDays: z.number().int().min(0).optional(),
        bundledProductIds: z.array(z.string()).optional(),
        includes: z.array(z.string()).optional(),
        occasionTags: z.array(z.string()).optional(),
        metadata: orderItemMetadataSchema.optional(),
        configuration: z.object({}).passthrough().optional(),
      })
    )
    .min(1),
  deliveryAddress: z.string().optional().default(""),
  deliveryDate: z.string().optional().default(""),
  deliveryTime: z.string().optional().default(""),
  giftMessage: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const updateOrderStatusSchema = z.object({
  status:     z.enum(["Confirmed", "Processing", "Ready for Delivery", "Shipped", "Delivered", "Customer Accepted", "Cancelled", "Refunded", "Disputed"]),
  note:       z.string().max(500).optional(),
  courierRef: z.string().max(200).optional(),
}).refine(
  (d) => d.status !== "Disputed" || (d.note && d.note.trim().length > 0),
  { message: "A note is required when marking an order as Disputed.", path: ["note"] }
);

export const customerActionSchema = z.object({
  action: z.enum(["accept", "dispute"]),
  note:   z.string().max(500).optional(),
}).refine(
  (d) => d.action !== "dispute" || (d.note && d.note.trim().length > 0),
  { message: "A note is required when reporting a problem.", path: ["note"] }
);

export const updateSupportCaseSchema = z.object({
  action: z.enum(["reviewing", "contact_customer", "contact_seller", "contact_driver", "escalate", "add_note", "resolve", "close", "reject"]),
  note: z.string().max(1000).optional(),
  priority: z.enum(["normal", "high", "urgent"]).optional(),
});

export const updateResolutionDecisionSchema = z.object({
  status: z.enum(["open", "decided", "executed", "reversed"]).optional().default("decided"),
  liability: z.enum(["seller_fault", "customer_fault", "mixed", "inconclusive"]),
  refundDecision: z.enum(["none", "required", "goodwill"]),
  payoutDecision: z.enum(["hold", "release_approved", "clawback_planned"]),
  orderDecision: z.enum(["keep_order", "cancel_order"]),
  codResolution: z.enum(["no_cash_collected", "seller_to_refund_cash", "platform_to_refund_cash", "no_refund_due"]),
  decisionNote: z.string().trim().min(1).max(1000),
  requiresFollowUp: z.boolean().optional().default(false),
  followUpBy: z.string().optional().nullable().default(null),
  gatewayProvider: z.string().optional().nullable().default(null),
  gatewayRefundIntentId: z.string().optional().nullable().default(null),
  gatewayRefundStatus: z.string().optional().nullable().default(null),
});

export const finalizeResolutionDecisionSchema = z.object({});

function makeHistoryEntry(fromStatus, toStatus, user, note, courierRef) {
  return {
    from:       fromStatus || null,
    to:         toStatus,
    by:         user?.name || user?.email || user?.sub || "system",
    role:       user?.role || "system",
    note:       note || null,
    courierRef: courierRef || null,
    timestamp:  new Date().toISOString(),
  };
}

function normalizeSupportCaseKind(order, fallbackKind = "dispute") {
  if (order?.supportCase?.kind) return order.supportCase.kind;
  if (order?.customerResponse?.action === "dispute" || order?.status === "Disputed" || order?.paymentStatus === "Dispute hold") {
    return "dispute";
  }
  return fallbackKind;
}

function createDisputeCase(now = new Date().toISOString(), note = null) {
  return {
    kind: "dispute",
    status: "open",
    priority: "high",
    internalNotes: note ? [{ note, by: "customer", role: "customer", createdAt: now }] : [],
    lastActionAt: now,
    escalatedAt: null,
  };
}

// In-memory orders for seed mode
const seedOrders = new Map(seedRepository.getState().orders.map((order) => [order.orderId, order]));
const initialSeedOrders = structuredClone(seedRepository.getState().orders);

// In-memory idempotency map for seed mode: idempotencyKey → orderId
const seedIdempotencyKeys = new Map();

async function notifyOrderCreated(order) {
  const shopIds = [...new Set(order.shopIds || [])];
  await Promise.all(shopIds.map((shopId) => createNotificationsForRole({
    recipientRole: "seller",
    shopId,
    title: "New order received",
    message: `Order ${order.orderId} requires fulfillment action.`,
    type: "new_order_created",
    entityType: "order",
    entityId: order.orderId,
  })));
}

async function notifyOrderStatusChanged(order, status) {
  if (!order?.customerId) return;
  await createNotificationsForRole({
    recipientRole: "customer",
    recipientUserIds: [order.customerId],
    title: "Order status updated",
    message: `Your order ${order.orderId} is now ${status}.`,
    type: "order_status_changed",
    entityType: "order",
    entityId: order.orderId,
  });
}

async function notifyCustomerDispute(order) {
  const targets = [];
  for (const shopId of [...new Set(order.shopIds || [])]) {
    targets.push(createNotificationsForRole({
      recipientRole: "seller",
      shopId,
      title: "Customer reported an order issue",
      message: `Order ${order.orderId} was marked as disputed by the customer.`,
      type: "order_disputed",
      entityType: "support",
      entityId: order.orderId,
    }));
  }
  targets.push(createNotificationsForRole({
    recipientRole: "admin",
    title: "New dispute requires review",
    message: `Order ${order.orderId} entered dispute review.`,
    type: "order_disputed",
    entityType: "support",
    entityId: order.orderId,
  }));
  targets.push(createNotificationsForRole({
    recipientRole: "support",
    title: "New dispute requires review",
    message: `Order ${order.orderId} entered dispute review.`,
    type: "order_disputed",
    entityType: "support",
    entityId: order.orderId,
  }));
  await Promise.all(targets);
}

async function notifyResolutionFinalized(order) {
  const tasks = [];
  if (order?.customerId) {
    tasks.push(createNotificationsForRole({
      recipientRole: "customer",
      recipientUserIds: [order.customerId],
      title: "Support decision finalized",
      message: `Resolution decision for order ${order.orderId} has been finalized.`,
      type: "resolution_finalized",
      entityType: "support",
      entityId: order.orderId,
    }));
  }
  for (const shopId of [...new Set(order.shopIds || [])]) {
    tasks.push(createNotificationsForRole({
      recipientRole: "seller",
      shopId,
      title: "Support decision recorded",
      message: `Order ${order.orderId} now has a finalized resolution decision.`,
      type: "resolution_finalized",
      entityType: "support",
      entityId: order.orderId,
    }));
  }
  await Promise.all(tasks);
}

async function notifyDisputeCaseUpdated(order, nextStatus) {
  const label = String(nextStatus || "updated").replace(/_/g, " ");
  const tasks = [];
  if (order?.customerId) {
    tasks.push(createNotificationsForRole({
      recipientRole: "customer",
      recipientUserIds: [order.customerId],
      title: "Dispute updated",
      message: `Order ${order.orderId} dispute status is now ${label}.`,
      type: "support_case_updated",
      entityType: "support",
      entityId: order.orderId,
    }));
  }
  for (const shopId of [...new Set(order.shopIds || [])]) {
    tasks.push(createNotificationsForRole({
      recipientRole: "seller",
      shopId,
      title: "Dispute updated",
      message: `Order ${order.orderId} dispute status is now ${label}.`,
      type: "support_case_updated",
      entityType: "support",
      entityId: order.orderId,
    }));
  }
  await Promise.all(tasks);
}

function computeFingerprint(payload) {
  const items = [...(payload.items || [])]
    .sort((a, b) => String(a.productId).localeCompare(String(b.productId)))
    .map((i) => `${i.productId}:${i.quantity}`)
    .join(",");
  return createHash("sha256").update(`${payload.customerEmail}|${items}`).digest("hex").slice(0, 32);
}

function toCustomerSafeError(err) {
  if (!err) return err;
  const msg = err.message || "";
  if ((err.status === 404 || err.status === 400) && msg.toLowerCase().includes("not found")) {
    return Object.assign(new Error("One of your selected items is no longer available."), { status: 422 });
  }
  if (err.status === 409 && msg.toLowerCase().includes("insufficient stock")) {
    return Object.assign(new Error("One of your selected items has just sold out. Please review your cart."), { status: 409 });
  }
  if (err.status === 409 && msg.toLowerCase().includes("pairing")) {
    return Object.assign(new Error("This gift pairing is no longer available. Please rebuild your box."), { status: 409 });
  }
  if (err.status === 400 && msg.toLowerCase().includes("build your box")) {
    return Object.assign(new Error("Your Build Your Box configuration is invalid. Please rebuild your gift."), { status: 400 });
  }
  return err;
}

async function resolveBuildYourBoxProducts(items) {
  const productIds = getBuildYourBoxProductIds(items);
  if (!productIds.length) return [];
  if (env.mongoUri) return Product.find({ id: { $in: productIds } }).lean();
  return seedRepository.getState().products.filter((product) => productIds.includes(product.id));
}

function makeOrderFromPayload(payload, userId, idempotencyKey, fingerprint, guestTokenHash) {
  const subtotal = payload.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const platformFee = Math.round(subtotal * 0.14);
  const shopIds = [...new Set(payload.items.map((i) => i.shopId))];

  return {
    orderId: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
    customerId: userId || null,
    checkoutMode: userId ? "account" : payload.checkoutMode,
    paymentMethod: payload.paymentMethod,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    phone: payload.phone,
    items: payload.items,
    subtotal,
    platformFee,
    vendorNet: subtotal - platformFee,
    status: "Pending",
    paymentStatus: payload.paymentMethod === "cod" ? "COD pending" : "Authorization",
    deliveryAddress: payload.deliveryAddress,
    deliveryDate: payload.deliveryDate,
    deliveryTime: payload.deliveryTime,
    giftMessage: payload.giftMessage,
    notes: payload.notes,
    shopIds,
    idempotencyKey: idempotencyKey || null,
    requestFingerprint: fingerprint || null,
    guestConfirmationToken: guestTokenHash || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function stripInternalOrderFields(order) {
  if (!order) return order;
  const { guestConfirmationToken: _gct, idempotencyKey: _ik, requestFingerprint: _rf, ...safe } = order;
  return safe;
}

export async function createOrder(payload, userId, idempotencyKey = null) {
  const validatedKey = idempotencyKey && /^[0-9a-f-]{8,128}$/i.test(idempotencyKey) ? idempotencyKey : null;
  const fingerprint = computeFingerprint(payload);

  // Guest orders get a one-time access token returned to caller
  const isGuest = !userId;
  let rawGuestToken = null;
  let guestTokenHash = null;
  if (isGuest) {
    rawGuestToken = randomBytes(32).toString("hex");
    guestTokenHash = createHash("sha256").update(rawGuestToken).digest("hex");
  }

  if (env.mongoUri) {
    // Idempotency check: if key exists, look for existing order before attempting creation
    if (validatedKey) {
      const existing = await Order.findOne({ idempotencyKey: validatedKey }).lean();
      if (existing) {
        if (existing.requestFingerprint && existing.requestFingerprint !== fingerprint) {
          const err = new Error("Your checkout changed. Please review the order and try again.");
          err.status = 409;
          throw err;
        }
        return stripInternalOrderFields(existing);
      }
    }

    try {
      validateBuildYourBoxItems(payload.items, await resolveBuildYourBoxProducts(payload.items));
    } catch (err) { throw toCustomerSafeError(err); }

    const stockLines = resolveOrderStockLines(payload.items);
    const order = makeOrderFromPayload(payload, userId, validatedKey, fingerprint, guestTokenHash);

    let appliedStockLines;
    try {
      appliedStockLines = await deductMongoStockWithRollback(Product, stockLines);
    } catch (err) { throw toCustomerSafeError(err); }

    try {
      const doc = await Order.create(order);
      const created = doc.toObject();
      await notifyOrderCreated(created);
      const safe = stripInternalOrderFields(created);
      if (rawGuestToken) safe.guestToken = rawGuestToken;
      return safe;
    } catch (error) {
      await rollbackMongoStock(Product, appliedStockLines);
      // Duplicate idempotency key: a concurrent request already created the order
      if (error.code === 11000 && validatedKey) {
        const existing = await Order.findOne({ idempotencyKey: validatedKey }).lean();
        if (existing) {
          if (existing.requestFingerprint && existing.requestFingerprint !== fingerprint) {
            const conflictErr = new Error("Your checkout changed. Please review the order and try again.");
            conflictErr.status = 409;
            throw conflictErr;
          }
          return stripInternalOrderFields(existing);
        }
      }
      throw error;
    }
  }

  // Seed mode — check idempotency map before proceeding
  if (validatedKey) {
    const existingOrderId = seedIdempotencyKeys.get(validatedKey);
    if (existingOrderId) {
      const existing = seedOrders.get(existingOrderId);
      if (existing) {
        if (existing.requestFingerprint && existing.requestFingerprint !== fingerprint) {
          const err = new Error("Your checkout changed. Please review the order and try again.");
          err.status = 409;
          throw err;
        }
        return stripInternalOrderFields(existing);
      }
    }
  }

  try {
    validateBuildYourBoxItems(payload.items, await resolveBuildYourBoxProducts(payload.items));
  } catch (err) { throw toCustomerSafeError(err); }

  const stockLines = resolveOrderStockLines(payload.items);
  try {
    deductSeedStock(seedRepository.getState().products, stockLines);
  } catch (err) { throw toCustomerSafeError(err); }

  const order = makeOrderFromPayload(payload, userId, validatedKey, fingerprint, guestTokenHash);
  seedOrders.set(order.orderId, order);
  if (validatedKey) seedIdempotencyKeys.set(validatedKey, order.orderId);
  seedRepository.getState().orders.unshift(order);
  await notifyOrderCreated(order);
  const safe = stripInternalOrderFields(order);
  if (rawGuestToken) safe.guestToken = rawGuestToken;
  return safe;
}

export async function listOrders({ userId, role, shopId, page = 1, limit = 20 }) {
  if (env.mongoUri) {
    const filter = {};
    if (role === "customer") filter.customerId = userId;
    if (role === "seller") filter.shopIds = shopId;

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return { orders, total, page, pages: Math.ceil(total / limit) };
  }

  let orders = [...seedOrders.values()];
  if (role === "customer") orders = orders.filter((o) => o.customerId === userId);
  if (role === "seller") orders = orders.filter((o) => o.shopIds.includes(shopId));
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const start = (page - 1) * limit;
  return { orders: orders.slice(start, start + limit), total: orders.length, page, pages: Math.ceil(orders.length / limit) };
}

export async function getOrder(orderId, user, guestToken = null) {
  if (env.mongoUri) {
    const order = await Order.findOne({ orderId }).lean();
    if (!order) { const err = new Error("Order not found."); err.status = 404; throw err; }
    assertOrderAccess(order, user, guestToken);
    return stripInternalOrderFields(order);
  }

  const order = seedOrders.get(orderId);
  if (!order) { const err = new Error("Order not found."); err.status = 404; throw err; }
  assertOrderAccess(order, user, guestToken);
  return stripInternalOrderFields(order);
}

function assertOrderAccess(order, user, guestToken) {
  const role = user?.role;
  // Privileged roles always have access
  if (["admin", "support"].includes(role)) return;
  // Sellers can access orders for their shop
  if (role === "seller" && order.shopIds?.includes(user.shopId)) return;
  // Authenticated customer: must own the order
  if (role === "customer") {
    if (order.customerId?.toString() !== user.sub) {
      const err = new Error("Access denied."); err.status = 403; throw err;
    }
    return;
  }
  // Unauthenticated or unknown role: guest token required for guest orders
  if (order.customerId === null && order.guestConfirmationToken && guestToken) {
    const tokenHash = createHash("sha256").update(String(guestToken)).digest("hex");
    if (tokenHash === order.guestConfirmationToken) return;
  }
  const err = new Error("Access denied."); err.status = 403; throw err;
}

function assertOrderTransition(order, status, user) {
  const role = user?.role;
  if (canTransitionOrderStatus(order.status, status, role)) return;
  const error = new Error(`Invalid order status transition: ${order.status} -> ${status} for ${role}.`);
  error.status = 409;
  throw error;
}

async function reverseCommissionsForOrder(order, reason) {
  if (!["Cancelled", "Refunded"].includes(order?.status)) return;
  try {
    await reverseSalesRepCommissions(order, { reason });
  } catch (err) {
    console.error(`[commissionReversal] order=${order?.orderId || "unknown"}:`, err.message);
  }
}

export async function updateOrderStatus(orderId, status, user, note = null, courierRef = null) {
  if (env.mongoUri) {
    const existing = await Order.findOne({ orderId }).lean();
    if (!existing) { const err = new Error("Order not found."); err.status = 404; throw err; }
    assertOrderTransition(existing, status, user);
    const entry = makeHistoryEntry(existing.status, status, user, note, courierRef);
    const patch = { status, $push: { statusHistory: entry } };
    if (status === "Cancelled" && note) patch.cancellationReason = note;
    const order = await Order.findOneAndUpdate({ orderId }, patch, { returnDocument: "after" }).lean();
    await reverseCommissionsForOrder(order, note || `Order status changed to ${status}.`);
    if (status === "Delivered") {
      await accrueDeliveredOrderCommissions(order);
      await recordDeliveryEarning(order);
    }
    await notifyOrderStatusChanged(order, status);
    return order;
  }

  const order = seedOrders.get(orderId);
  if (!order) { const err = new Error("Order not found."); err.status = 404; throw err; }
  assertOrderTransition(order, status, user);
  const entry = makeHistoryEntry(order.status, status, user, note, courierRef);
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push(entry);
  order.status = status;
  if (status === "Cancelled" && note) order.cancellationReason = note;
  order.updatedAt = new Date().toISOString();
  await reverseCommissionsForOrder(order, note || `Order status changed to ${status}.`);
  if (status === "Delivered") {
    await accrueDeliveredOrderCommissions(order);
    await recordDeliveryEarning(order);
  }
  await notifyOrderStatusChanged(order, status);
  return order;
}

export async function customerAction(orderId, action, note, user) {
  const newStatus = action === "accept" ? "Customer Accepted" : "Disputed";

  if (env.mongoUri) {
    const existing = await Order.findOne({ orderId }).lean();
    if (!existing) { const err = new Error("Order not found."); err.status = 404; throw err; }
    if (existing.customerId?.toString() !== user.sub) {
      const err = new Error("Access denied."); err.status = 403; throw err;
    }
    if (existing.status !== "Delivered") {
      const err = new Error("Customer action only allowed on delivered orders."); err.status = 409; throw err;
    }
    const entry = makeHistoryEntry("Delivered", newStatus, user, note, null);
    const patch = {
      status: newStatus,
      customerResponse: { action, note: note || null, at: new Date().toISOString() },
      $push: { statusHistory: entry },
    };
    if (action === "dispute") {
      patch.paymentStatus = "Dispute hold";
      patch.supportCase = createDisputeCase(new Date().toISOString());
    }
    const order = await Order.findOneAndUpdate({ orderId }, patch, { returnDocument: "after" }).lean();
    if (action === "dispute") {
      await notifyCustomerDispute(order);
      await freezeSellerBalanceForDispute(order);
    }
    return order;
  }

  const order = seedOrders.get(orderId);
  if (!order) { const err = new Error("Order not found."); err.status = 404; throw err; }
  if (order.customerId !== user.sub) {
    const err = new Error("Access denied."); err.status = 403; throw err;
  }
  if (order.status !== "Delivered") {
    const err = new Error("Customer action only allowed on delivered orders."); err.status = 409; throw err;
  }
  const entry = makeHistoryEntry("Delivered", newStatus, user, note, null);
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push(entry);
  order.status = newStatus;
  order.customerResponse = { action, note: note || null, at: new Date().toISOString() };
  if (action === "dispute") {
    order.paymentStatus = "Dispute hold";
    order.supportCase = createDisputeCase(new Date().toISOString());
  }
  order.updatedAt = new Date().toISOString();
  if (action === "dispute") {
    await notifyCustomerDispute(order);
    await freezeSellerBalanceForDispute(order);
  }
  return order;
}

function ensureSupportCaseAccess(user, order) {
  if (["admin", "support"].includes(user?.role)) return;
  if (user?.role === "seller" && order?.shopIds?.includes(user.shopId)) return;
  const err = new Error("Access denied.");
  err.status = 403;
  throw err;
}

function ensureSupportRole(user) {
  if (!["admin", "support"].includes(user?.role)) {
    const err = new Error("Access denied.");
    err.status = 403;
    throw err;
  }
}

function ensureDisputeCaseEligible(order) {
  const isEligible =
    order.supportCase?.kind === "dispute" ||
    order.status === "Disputed" ||
    order.paymentStatus === "Dispute hold" ||
    order.customerResponse?.action === "dispute";
  if (isEligible) return;
  const err = new Error("Dispute updates are only allowed for disputed or dispute-hold orders.");
  err.status = 409;
  throw err;
}

function resolutionDecisionSummary(payload) {
  return [
    `liability=${payload.liability}`,
    `refund=${payload.refundDecision}`,
    `payout=${payload.payoutDecision}`,
    `order=${payload.orderDecision}`,
    `cod=${payload.codResolution}`,
  ].join(" | ");
}

function normalizeResolutionDecision(payload, user) {
  return {
    status: payload.status || "decided",
    liability: payload.liability,
    refundDecision: payload.refundDecision,
    payoutDecision: payload.payoutDecision,
    orderDecision: payload.orderDecision,
    codResolution: payload.codResolution,
    decisionNote: payload.decisionNote.trim(),
    decidedBy: user?.name || user?.email || user?.sub || "system",
    decidedRole: user?.role || "system",
    decidedAt: new Date().toISOString(),
    requiresFollowUp: Boolean(payload.requiresFollowUp),
    followUpBy: payload.followUpBy ? new Date(payload.followUpBy).toISOString() : null,
    gatewayProvider: payload.gatewayProvider || null,
    gatewayRefundIntentId: payload.gatewayRefundIntentId || null,
    gatewayRefundStatus: payload.gatewayRefundStatus || null,
  };
}

function ensureAdminRole(user) {
  if (user?.role === "admin") return;
  const err = new Error("Access denied.");
  err.status = 403;
  throw err;
}

function ensureDecisionReadyForFinalization(order) {
  const decision = order?.resolutionDecision;
  if (!decision) {
    const err = new Error("Resolution decision is required before finalization.");
    err.status = 409;
    throw err;
  }
  if (decision.status === "executed") {
    const err = new Error("Resolution decision is already finalized.");
    err.status = 409;
    throw err;
  }
  if (decision.status !== "decided") {
    const err = new Error("Only decided resolution records can be finalized.");
    err.status = 409;
    throw err;
  }

  const requiredFields = ["liability", "refundDecision", "payoutDecision", "orderDecision", "codResolution", "decisionNote"];
  const missing = requiredFields.filter((key) => {
    const value = decision[key];
    if (typeof value === "string") return value.trim().length === 0;
    return value == null;
  });
  if (missing.length > 0) {
    const err = new Error(`Resolution decision is incomplete: ${missing.join(", ")}.`);
    err.status = 409;
    throw err;
  }
}

function finalizedSupportNote(decision) {
  return `Resolution finalized (${resolutionDecisionSummary(decision)}). COD mode marker only; no automated transfer executed.`;
}

function mapSupportActionToStatus(action, currentStatus) {
  if (action === "reviewing") return "under_review";
  if (action === "contact_customer") return "waiting_customer";
  if (action === "contact_seller") return "waiting_seller";
  if (action === "contact_driver") return "waiting_driver";
  if (action === "escalate") return "escalated";
  if (action === "resolve") return "resolved";
  if (action === "reject") return "rejected";
  if (action === "close") return "closed";
  return currentStatus || "open";
}

function supportNoteFromPayload(payload, user) {
  if (!payload?.note || !payload.note.trim()) return null;
  return {
    note: payload.note.trim(),
    by: user?.name || user?.email || user?.sub || "system",
    role: user?.role || "system",
    createdAt: new Date().toISOString(),
  };
}

export async function updateSupportCase(orderId, payload, user) {
  if (env.mongoUri) {
    const existing = await Order.findOne({ orderId }).lean();
    if (!existing) { const err = new Error("Order not found."); err.status = 404; throw err; }
    ensureSupportCaseAccess(user, existing);
    ensureDisputeCaseEligible(existing);

    const nextStatus = mapSupportActionToStatus(payload.action, existing.supportCase?.status);
    const nextPriority = payload.priority || existing.supportCase?.priority || "normal";
    const noteEntry = supportNoteFromPayload(payload, user);
    const nextNotes = [...(existing.supportCase?.internalNotes || []), ...(noteEntry ? [noteEntry] : [])];

    const patch = {
      supportCase: {
        kind: existing.supportCase?.kind || normalizeSupportCaseKind(existing),
        status: nextStatus,
        priority: nextPriority,
        internalNotes: nextNotes,
        lastActionAt: new Date().toISOString(),
        escalatedAt: payload.action === "escalate" ? new Date().toISOString() : existing.supportCase?.escalatedAt || null,
      },
    };

    const updated = await Order.findOneAndUpdate({ orderId }, patch, { returnDocument: "after" }).lean();
    if (payload.action !== "add_note" && nextStatus !== existing.supportCase?.status) {
      await notifyDisputeCaseUpdated(updated, nextStatus);
    }
    return updated;
  }

  const order = seedOrders.get(orderId);
  if (!order) { const err = new Error("Order not found."); err.status = 404; throw err; }
  ensureSupportCaseAccess(user, order);
  ensureDisputeCaseEligible(order);

  const noteEntry = supportNoteFromPayload(payload, user);
  const previous = order.supportCase || {};
  const nextStatus = mapSupportActionToStatus(payload.action, previous.status);
  order.supportCase = {
    kind: previous.kind || normalizeSupportCaseKind(order),
    status: nextStatus,
    priority: payload.priority || previous.priority || "normal",
    internalNotes: [...(previous.internalNotes || []), ...(noteEntry ? [noteEntry] : [])],
    lastActionAt: new Date().toISOString(),
    escalatedAt: payload.action === "escalate" ? new Date().toISOString() : previous.escalatedAt || null,
  };
  order.updatedAt = new Date().toISOString();
  if (payload.action !== "add_note" && nextStatus !== previous.status) {
    await notifyDisputeCaseUpdated(order, nextStatus);
  }
  return order;
}

export async function updateResolutionDecision(orderId, payload, user) {
  ensureSupportRole(user);

  const decision = normalizeResolutionDecision(payload, user);

  if (env.mongoUri) {
    const existing = await Order.findOne({ orderId }).lean();
    if (!existing) { const err = new Error("Order not found."); err.status = 404; throw err; }
    ensureDisputeCaseEligible(existing);

    const historyEntry = makeHistoryEntry(
      existing.status,
      "Resolution Decision",
      user,
      resolutionDecisionSummary(decision),
      null
    );

    const patch = {
      resolutionDecision: decision,
      $push: { statusHistory: historyEntry },
    };

    if (decision.payoutDecision === "hold") {
      patch.paymentStatus = "Dispute hold";
    }

    return Order.findOneAndUpdate({ orderId }, patch, { returnDocument: "after" }).lean();
  }

  const order = seedOrders.get(orderId);
  if (!order) { const err = new Error("Order not found."); err.status = 404; throw err; }
  ensureDisputeCaseEligible(order);

  order.resolutionDecision = decision;
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push(
    makeHistoryEntry(order.status, "Resolution Decision", user, resolutionDecisionSummary(decision), null)
  );
  if (decision.payoutDecision === "hold") {
    order.paymentStatus = "Dispute hold";
  }
  order.updatedAt = new Date().toISOString();
  return order;
}

export async function finalizeResolutionDecision(orderId, user) {
  ensureAdminRole(user);

  if (env.mongoUri) {
    const existing = await Order.findOne({ orderId }).lean();
    if (!existing) { const err = new Error("Order not found."); err.status = 404; throw err; }
    ensureDisputeCaseEligible(existing);
    ensureDecisionReadyForFinalization(existing);

    const now = new Date().toISOString();
    const executedDecision = {
      ...existing.resolutionDecision,
      status: "executed",
      executedBy: user?.name || user?.email || user?.sub || "system",
      executedRole: user?.role || "system",
      executedAt: now,
    };
    const summary = resolutionDecisionSummary(executedDecision);
    const patch = {
      resolutionDecision: executedDecision,
      $push: {
        statusHistory: makeHistoryEntry(existing.status, "Resolution Finalized", user, summary, null),
      },
    };

    if (executedDecision.orderDecision === "cancel_order") {
      patch.status = "Cancelled";
      patch.cancellationReason = executedDecision.decisionNote;
    }

    if (executedDecision.refundDecision === "required" || executedDecision.refundDecision === "goodwill") {
      patch.paymentStatus = "Dispute hold";
    } else if (executedDecision.payoutDecision === "release_approved") {
      patch.paymentStatus = "Payout hold";
    } else if (executedDecision.payoutDecision === "hold" || executedDecision.payoutDecision === "clawback_planned") {
      patch.paymentStatus = "Dispute hold";
    }

    if (existing.supportCase) {
      patch.supportCase = {
        ...(existing.supportCase || {}),
        status: "closed",
        internalNotes: [
          ...(existing.supportCase?.internalNotes || []),
          {
            note: finalizedSupportNote(executedDecision),
            by: user?.name || user?.email || user?.sub || "system",
            role: user?.role || "system",
            createdAt: now,
          },
        ],
        lastActionAt: now,
      };
    }

    const finalized = await Order.findOneAndUpdate({ orderId }, patch, { returnDocument: "after" }).lean();
    await reverseCommissionsForOrder(finalized, executedDecision.decisionNote || summary);
    if (executedDecision.payoutDecision === "release_approved") {
      await releaseDisputeHold(finalized);
    } else if (executedDecision.refundDecision === "required" || executedDecision.refundDecision === "goodwill") {
      await debitForRefund(finalized);
    }
    return finalized;
  }

  const order = seedOrders.get(orderId);
  if (!order) { const err = new Error("Order not found."); err.status = 404; throw err; }
  ensureDisputeCaseEligible(order);
  ensureDecisionReadyForFinalization(order);

  const now = new Date().toISOString();
  order.resolutionDecision = {
    ...order.resolutionDecision,
    status: "executed",
    executedBy: user?.name || user?.email || user?.sub || "system",
    executedRole: user?.role || "system",
    executedAt: now,
  };

  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push(
    makeHistoryEntry(order.status, "Resolution Finalized", user, resolutionDecisionSummary(order.resolutionDecision), null)
  );

  if (order.resolutionDecision.orderDecision === "cancel_order") {
    order.status = "Cancelled";
    order.cancellationReason = order.resolutionDecision.decisionNote;
  }

  if (order.resolutionDecision.refundDecision === "required" || order.resolutionDecision.refundDecision === "goodwill") {
    order.paymentStatus = "Dispute hold";
  } else if (order.resolutionDecision.payoutDecision === "release_approved") {
    order.paymentStatus = "Payout hold";
  } else if (order.resolutionDecision.payoutDecision === "hold" || order.resolutionDecision.payoutDecision === "clawback_planned") {
    order.paymentStatus = "Dispute hold";
  }

  if (order.supportCase) {
    order.supportCase = {
      ...(order.supportCase || {}),
      status: "closed",
      internalNotes: [
        ...(order.supportCase?.internalNotes || []),
        {
          note: finalizedSupportNote(order.resolutionDecision),
          by: user?.name || user?.email || user?.sub || "system",
          role: user?.role || "system",
          createdAt: now,
        },
      ],
      lastActionAt: now,
    };
  }

  order.updatedAt = now;
  await reverseCommissionsForOrder(order, order.resolutionDecision.decisionNote || resolutionDecisionSummary(order.resolutionDecision));
  await notifyResolutionFinalized(order);
  if (order.resolutionDecision.payoutDecision === "release_approved") {
    await releaseDisputeHold(order);
  } else if (order.resolutionDecision.refundDecision === "required" || order.resolutionDecision.refundDecision === "goodwill") {
    await debitForRefund(order);
  }
  return order;
}

export function getSeedOrders() {
  return [...seedOrders.values()];
}

export function __resetSeedOrdersForTests() {
  seedOrders.clear();
  seedIdempotencyKeys.clear();
  for (const order of structuredClone(initialSeedOrders)) {
    seedOrders.set(order.orderId, order);
  }
}

// Adds a single order to the seed map for test isolation.
// Always call __resetSeedOrdersForTests() in beforeEach to clean up.
export function __injectSeedOrderForTests(order) {
  seedOrders.set(order.orderId, structuredClone(order));
}
