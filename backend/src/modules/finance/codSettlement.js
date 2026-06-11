/**
 * codSettlement.js
 *
 * Admin-only COD cash reconciliation — per driver, per batch.
 *
 * Flow:
 *   1. Admin calls listDriverCodSettlementCandidates(driverId)
 *      → returns COD-collected, unsettled, non-disputed delivered orders for that driver.
 *
 *   2. Admin selects orders and calls settleDriverCodOrders({ driverId, orderIds, adminId, notes })
 *      → validates every order before any mutation (all-or-nothing within the batch)
 *      → marks each order driverAssignment.codSettledAt / codSettledBy / codSettlementRef
 *      → calls recordCodCredit for each order → creates SellerTransaction(cod_credit) → shop.pendingBalance += vendorNet
 *      → decrements driver.codBalance by total settled cash (floored at 0)
 *
 * Settlement is idempotent at the order level via the SellerTransaction unique index
 * and the codSettledAt marker on driverAssignment.
 *
 * Active-dispute orders are excluded from candidate list and will throw if submitted.
 */

import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { Order } from "../../models/Order.js";
import { getSeedOrders } from "../orders/orders.service.js";
import { decrementDriverCodBalance, getDriverById } from "../drivers/drivers.service.js";
import { recordCodCredit } from "./sellerBalance.js";

// ── Eligibility predicates ────────────────────────────────────────────────────

const SETTLED_STATUSES = new Set(["Delivered", "Customer Accepted"]);

const ACTIVE_SUPPORT_STATUSES = new Set([
  "open", "under_review", "waiting_customer",
  "waiting_seller", "waiting_driver", "escalated",
]);

function hasActiveDispute(order) {
  if (order.status === "Disputed") return true;
  if (!order.supportCase) return false;
  return ACTIVE_SUPPORT_STATUSES.has(order.supportCase.status);
}

function isCodSettled(order) {
  return Boolean(order.driverAssignment?.codSettledAt);
}

function isCodCandidate(order, driverId) {
  return (
    order.paymentMethod === "cod" &&
    order.driverAssignment?.driverId === driverId &&
    order.driverAssignment?.codCollected === true &&
    SETTLED_STATUSES.has(order.status) &&
    !isCodSettled(order) &&
    !hasActiveDispute(order)
  );
}

function ineligibleReason(order, driverId) {
  if (order.paymentMethod !== "cod")                        return "not a COD order";
  if (order.driverAssignment?.driverId !== driverId)        return "not assigned to this driver";
  if (!order.driverAssignment?.codCollected)                return "COD cash not collected";
  if (!SETTLED_STATUSES.has(order.status))                  return `order status is ${order.status}`;
  if (isCodSettled(order))                                  return "already settled";
  if (hasActiveDispute(order))                              return "active dispute";
  return "not eligible";
}

// ── Projector (limits fields exposed in list response) ────────────────────────

function projectCandidate(order) {
  return {
    orderId:      order.orderId,
    shopIds:      order.shopIds,
    items:        order.items,
    subtotal:     order.subtotal,
    platformFee:  order.platformFee,
    vendorNet:    order.vendorNet,
    codAmount:    order.driverAssignment?.codAmount ?? 0,
    deliveredAt:  order.driverAssignment?.deliveredAt ?? null,
    customerName: order.customerName,
    status:       order.status,
    paymentStatus: order.paymentStatus,
  };
}

// ── MongoDB mode ──────────────────────────────────────────────────────────────

async function mongoListCandidates(driverId) {
  const orders = await Order.find({
    paymentMethod: "cod",
    "driverAssignment.driverId": driverId,
    "driverAssignment.codCollected": true,
    "driverAssignment.codSettledAt": null,
    status: { $in: [...SETTLED_STATUSES] },
  }).lean();
  return orders.filter((o) => !hasActiveDispute(o));
}

async function mongoSettle({ driverId, orderIds, adminId, notes, settlementRef }) {
  const now = new Date();
  const toSettle = [];

  // Validate every order before any mutation.
  for (const orderId of orderIds) {
    const order = await Order.findOne({ orderId }).lean();
    if (!order) {
      const e = new Error(`Order ${orderId} not found.`);
      e.status = 404;
      throw e;
    }
    if (!isCodCandidate(order, driverId)) {
      const e = new Error(`Order ${orderId} cannot be settled: ${ineligibleReason(order, driverId)}.`);
      e.status = 409;
      throw e;
    }
    toSettle.push(order);
  }

  // All valid — apply mutations.
  let totalCash = 0;
  for (const order of toSettle) {
    await Order.findOneAndUpdate(
      { orderId: order.orderId },
      {
        $set: {
          "driverAssignment.codSettledAt":    now,
          "driverAssignment.codSettledBy":    adminId,
          "driverAssignment.codSettlementRef": settlementRef,
        },
      }
    );
    totalCash += order.driverAssignment?.codAmount ?? 0;
    await recordCodCredit(order, adminId);
  }

  const driverBalanceAfter = await decrementDriverCodBalance(driverId, totalCash);

  return {
    settlementRef,
    settledOrders: toSettle.map((o) => o.orderId),
    totalCashAmount: totalCash,
    driverCodBalanceAfter: driverBalanceAfter ?? 0,
  };
}

// ── Seed mode ─────────────────────────────────────────────────────────────────

function seedListCandidates(driverId) {
  return getSeedOrders().filter((o) => isCodCandidate(o, driverId));
}

async function seedSettle({ driverId, orderIds, adminId, notes, settlementRef }) {
  const now = new Date().toISOString();
  const allOrders = getSeedOrders();
  const toSettle = [];

  // Validate every order before any mutation.
  for (const orderId of orderIds) {
    const order = allOrders.find((o) => o.orderId === orderId);
    if (!order) {
      const e = new Error(`Order ${orderId} not found.`);
      e.status = 404;
      throw e;
    }
    if (!isCodCandidate(order, driverId)) {
      const e = new Error(`Order ${orderId} cannot be settled: ${ineligibleReason(order, driverId)}.`);
      e.status = 409;
      throw e;
    }
    toSettle.push(order);
  }

  // All valid — apply mutations.
  // (Objects are live references into the seedOrders Map, so direct mutation persists.)
  let totalCash = 0;
  for (const order of toSettle) {
    order.driverAssignment.codSettledAt    = now;
    order.driverAssignment.codSettledBy    = adminId;
    order.driverAssignment.codSettlementRef = settlementRef;
    totalCash += order.driverAssignment?.codAmount ?? 0;
    await recordCodCredit(order, adminId);
  }

  const driverBalanceAfter = await decrementDriverCodBalance(driverId, totalCash);

  return {
    settlementRef,
    settledOrders: toSettle.map((o) => o.orderId),
    totalCashAmount: totalCash,
    driverCodBalanceAfter: driverBalanceAfter ?? 0,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all COD-collected, unsettled, non-disputed delivered orders assigned to driverId.
 * Admin uses this to decide which orders to include in a settlement batch.
 */
export async function listDriverCodSettlementCandidates(driverId) {
  if (!driverId) {
    const e = new Error("Driver ID is required.");
    e.status = 400;
    throw e;
  }

  const driver = await getDriverById(driverId);
  if (!driver) {
    const e = new Error(`Driver ${driverId} not found.`);
    e.status = 404;
    throw e;
  }

  const candidates = env.mongoUri
    ? await mongoListCandidates(driverId)
    : seedListCandidates(driverId);

  return {
    driverId,
    driverName:   driver.name,
    codBalance:   driver.codBalance ?? 0,
    candidates:   candidates.map(projectCandidate),
    totalEligible: candidates.length,
    totalCash:    candidates.reduce((s, o) => s + (o.driverAssignment?.codAmount ?? 0), 0),
  };
}

/**
 * Settles a batch of COD orders for a driver.
 * Validates all orders before touching anything (all-or-nothing).
 * Idempotent at the order level: already-settled orders are rejected before any mutation.
 */
export async function settleDriverCodOrders({ driverId, orderIds, adminId, notes }) {
  if (!driverId) {
    const e = new Error("Driver ID is required.");
    e.status = 400;
    throw e;
  }
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    const e = new Error("At least one order ID is required.");
    e.status = 400;
    throw e;
  }

  const driver = await getDriverById(driverId);
  if (!driver) {
    const e = new Error(`Driver ${driverId} not found.`);
    e.status = 404;
    throw e;
  }

  const deduped = [...new Set(orderIds)];
  const settlementRef = `SETTLE-${randomUUID().slice(0, 8).toUpperCase()}`;

  return env.mongoUri
    ? mongoSettle({ driverId, orderIds: deduped, adminId, notes, settlementRef })
    : seedSettle({ driverId, orderIds: deduped, adminId, notes, settlementRef });
}
