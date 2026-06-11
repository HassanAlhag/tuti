/**
 * payoutService.js
 *
 * Admin-controlled payout flow on top of the SellerTransaction ledger.
 *
 * Earning lifecycle:
 *   delivery_credit / cod_credit → pendingBalance
 *   hold_release (or dispute_release)  → availableBalance
 *   [payout created — funds locked by Payout.orderIds]
 *   payout_debit (on completed)        → availableBalance ↓  paidBalance ↑
 *
 * Payout status machine:
 *   pending → processing → completed
 *   pending → cancelled
 *   processing → failed
 *   failed → pending  (retry)
 *
 * No seller payout request in v1 — admin-initiated only.
 */

import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { Order }  from "../../models/Order.js";
import { Shop }   from "../../models/Shop.js";
import { Payout } from "../../models/Payout.js";
import { SellerTransaction } from "../../models/SellerTransaction.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { getSeedOrders } from "../orders/orders.service.js";
import { releaseEarningToAvailable } from "./sellerBalance.js";

// ── Allowed status transitions ────────────────────────────────────────────────

const TRANSITIONS = {
  pending:    new Set(["processing", "cancelled"]),
  processing: new Set(["completed",  "failed"]),
  failed:     new Set(["pending"]),
};

function assertTransition(current, next) {
  if (!TRANSITIONS[current]?.has(next)) {
    const e = new Error(`Invalid payout status transition: ${current} → ${next}.`);
    e.status = 409;
    throw e;
  }
}

// ── Earning eligibility helpers ───────────────────────────────────────────────

// Orders with these paymentStatus values may have paymentStatus set to Released on completion.
const RELEASABLE_PAYMENT_STATUSES = new Set([
  "Payout hold", "Ready for payout", "COD collected", "Captured", "Escrow",
]);

/**
 * Builds a per-order tx map from a flat array of SellerTransactions for one shop.
 * Returns: { [orderId]: { delivery_credit?, cod_credit?, hold_release?, dispute_hold?,
 *                          dispute_release?, refund_debit?, payout_debit? } }
 */
function buildTxMap(sellerTransactions, shopId) {
  const byOrder = {};
  for (const tx of sellerTransactions) {
    if (tx.shopId !== shopId) continue;
    if (!byOrder[tx.orderId]) byOrder[tx.orderId] = {};
    byOrder[tx.orderId][tx.type] = tx;
  }
  return byOrder;
}

/**
 * Returns true if orderId is in any active (pending|processing) payout for the shop.
 */
function isLockedByActivePayout(orderId, shopId, payoutRecords) {
  return payoutRecords.some(
    (p) =>
      p.shopId === shopId &&
      ["pending", "processing"].includes(p.status) &&
      (p.orderIds || []).includes(orderId)
  );
}

/**
 * Determines eligibility of a single order's SellerTransaction map.
 * Returns { eligible: bool, reason?: string, amount?: number, releasedAt?: string }
 */
function orderEligibility(orderId, txMap, shopId, payoutRecords) {
  const releasedTx = txMap["hold_release"] ?? txMap["dispute_release"];

  if (!releasedTx) {
    const creditTx = txMap["delivery_credit"] ?? txMap["cod_credit"];
    if (!creditTx) return { eligible: false, reason: "no_credit" };
    if (txMap["refund_debit"]) return { eligible: false, reason: "refunded" };
    // Dispute hold may exist even before the earning was ever released.
    if (txMap["dispute_hold"] && !txMap["dispute_release"])
      return { eligible: false, reason: "in_dispute_hold" };
    return { eligible: false, reason: "pending_hold_release" };
  }

  if (txMap["refund_debit"]) return { eligible: false, reason: "refunded" };
  if (txMap["payout_debit"]) return { eligible: false, reason: "already_paid" };
  if (txMap["dispute_hold"] && !txMap["dispute_release"])
    return { eligible: false, reason: "in_dispute_hold" };
  if (isLockedByActivePayout(orderId, shopId, payoutRecords))
    return { eligible: false, reason: "in_active_payout" };

  return { eligible: true, amount: releasedTx.amount, releasedAt: releasedTx.createdAt };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ACTIVE_DISPUTE_STATUSES = new Set(["open", "under_review", "waiting_customer", "waiting_seller", "waiting_driver", "escalated"]);

function toValidDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getShopHoldDays(shop) {
  const raw = shop?.payoutHoldDays ?? 7;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 7;
}

function isActiveDispute(order) {
  if (!order) return false;
  if (order.status === "Disputed" || order.paymentStatus === "Dispute hold") return true;
  const supportCase = order.supportCase;
  if (!supportCase || supportCase.kind !== "dispute") return false;
  const status = String(supportCase.status || "open").toLowerCase();
  return ACTIVE_DISPUTE_STATUSES.has(status);
}

function getHoldReleaseReason({ order, txMap, now, force, shop }) {
  if (!order) return { eligible: false, reason: "missing_order" };

  const creditTx = txMap["delivery_credit"] ?? txMap["cod_credit"];
  if (!creditTx) return { eligible: false, reason: "no_credit" };

  if (txMap["payout_debit"]) return { eligible: false, reason: "already_paid", amount: creditTx.amount };
  if (txMap["hold_release"] || txMap["dispute_release"]) {
    const releasedTx = txMap["hold_release"] ?? txMap["dispute_release"];
    return {
      eligible: false,
      reason: "already_released",
      amount: releasedTx?.amount ?? creditTx.amount,
      releasedAt: releasedTx?.createdAt ?? null,
    };
  }

  if (order.status === "Cancelled") return { eligible: false, reason: "cancelled" };
  if (order.status === "Refunded" || txMap["refund_debit"]) return { eligible: false, reason: "refunded" };
  if (isActiveDispute(order) || (txMap["dispute_hold"] && !txMap["dispute_release"])) {
    return { eligible: false, reason: "in_dispute_hold" };
  }
  if (String(order.paymentMethod || "").toLowerCase() === "cod" && !order.driverAssignment?.codSettledAt) {
    return { eligible: false, reason: "unsettled_cod" };
  }

  const holdDays = getShopHoldDays(shop);
  const creditAt = toValidDate(creditTx.createdAt) || toValidDate(order.updatedAt) || toValidDate(order.createdAt);
  const eligibleAt = creditAt ? new Date(creditAt.getTime() + holdDays * MS_PER_DAY) : null;
  const nowDate = toValidDate(now) || new Date();
  const matured = force || !eligibleAt || nowDate >= eligibleAt;

  if (!matured) {
    return {
      eligible: false,
      reason: "not_matured",
      eligibleAt: eligibleAt?.toISOString() || null,
      daysRemaining: Math.max(1, Math.ceil((eligibleAt.getTime() - nowDate.getTime()) / MS_PER_DAY)),
      amount: creditTx.amount,
      creditType: creditTx.type,
    };
  }

  return {
    eligible: true,
    amount: creditTx.amount,
    creditType: creditTx.type,
    releasedAt: creditTx.createdAt || null,
    eligibleAt: eligibleAt?.toISOString() || null,
  };
}

function buildReleasePreviewResponse(shop, eligible, notYetMature, skipped) {
  return {
    shopId: shop.id,
    shopName: shop.name,
    holdDays: getShopHoldDays(shop),
    balances: {
      pendingBalance: shop.pendingBalance || 0,
      availableBalance: shop.availableBalance || 0,
      holdBalance: shop.holdBalance || 0,
      paidBalance: shop.paidBalance || 0,
    },
    eligibleOrders: eligible,
    eligibleTotal: eligible.reduce((s, e) => s + e.amount, 0),
    notYetMatureOrders: notYetMature,
    notYetMatureTotal: notYetMature.reduce((s, e) => s + e.amount, 0),
    skippedOrders: skipped,
    eligibleCount: eligible.length,
    notYetMatureCount: notYetMature.length,
    skippedCount: skipped.length,
  };
}

function collectOrderRecords(orderIds, shopId) {
  if (env.mongoUri) return null;
  const orders = getSeedOrders();
  return (orderIds || []).map((orderId) => orders.find((o) => o.orderId === orderId && (o.shopIds || []).includes(shopId)) || null);
}

async function loadOrdersForRelease(orderIds, shopId) {
  if (!orderIds.length) return [];
  if (env.mongoUri) {
    const orders = await Order.find({ orderId: { $in: orderIds } }).lean();
    return orderIds.map((orderId) => orders.find((order) => order.orderId === orderId && (order.shopIds || []).includes(shopId)) || null);
  }
  return collectOrderRecords(orderIds, shopId);
}

async function loadTxMapForShop(shopId) {
  if (env.mongoUri) {
    const txs = await SellerTransaction.find({ shopId }).lean();
    return buildTxMap(txs, shopId);
  }
  return buildTxMap(seedRepository.getState().sellerTransactions || [], shopId);
}

async function loadShop(shopId) {
  if (env.mongoUri) return Shop.findOne({ id: shopId }).lean();
  return seedRepository.getState().shops.find((s) => s.id === shopId) || null;
}

async function gatherReleaseCandidates(shopId, { now = new Date() } = {}) {
  const shop = await loadShop(shopId);
  if (!shop) {
    const e = new Error(`Shop ${shopId} not found.`);
    e.status = 404;
    throw e;
  }

  const txByOrder = await loadTxMapForShop(shopId);
  const orderIds = Object.keys(txByOrder);
  const orders = await loadOrdersForRelease(orderIds, shopId);

  const eligible = [];
  const notYetMature = [];
  const skipped = [];
  const nowDate = toValidDate(now) || new Date();

  for (const orderId of orderIds) {
    const order = orders.find((item) => item?.orderId === orderId) || null;
    const txMap = txByOrder[orderId] || {};
    const result = getHoldReleaseReason({ order, txMap, now: nowDate, force: false, shop });
    if (result.eligible) {
      eligible.push({
        orderId,
        amount: result.amount,
        creditType: result.creditType,
        releasedAt: result.releasedAt,
        eligibleAt: result.eligibleAt,
        status: order?.status || null,
        paymentStatus: order?.paymentStatus || null,
      });
    } else if (result.reason === "not_matured") {
      notYetMature.push({
        orderId,
        amount: result.amount || 0,
        creditType: result.creditType || null,
        eligibleAt: result.eligibleAt,
        daysRemaining: result.daysRemaining || 0,
        status: order?.status || null,
        paymentStatus: order?.paymentStatus || null,
      });
    } else {
      skipped.push({
        orderId,
        reason: result.reason,
        amount: result.amount || 0,
        creditType: result.creditType || null,
        releasedAt: result.releasedAt || null,
        status: order?.status || null,
        paymentStatus: order?.paymentStatus || null,
      });
    }
  }

  return { shop, txByOrder, eligible, notYetMature, skipped };
}

async function applyReleaseForOrders(shopId, orderIds, { adminId, force = false, notes = "", now = new Date() } = {}) {
  const shop = await loadShop(shopId);
  if (!shop) {
    const e = new Error(`Shop ${shopId} not found.`);
    e.status = 404;
    throw e;
  }

  const txByOrder = await loadTxMapForShop(shopId);
  const selectedOrders = orderIds?.length ? [...new Set(orderIds)] : [];
  const orders = await loadOrdersForRelease(selectedOrders, shopId);
  const nowDate = toValidDate(now) || new Date();
  const releasedOrders = [];
  const skippedOrders = [];
  let totalReleasedAmount = 0;

  for (const orderId of selectedOrders) {
    const order = orders.find((item) => item?.orderId === orderId) || null;
    const txMap = txByOrder[orderId] || {};
    const result = getHoldReleaseReason({ order, txMap, now: nowDate, force, shop });

    if (!result.eligible) {
      skippedOrders.push({
        orderId,
        reason: result.reason,
        amount: result.amount || 0,
        creditType: result.creditType || null,
        eligibleAt: result.eligibleAt || null,
        daysRemaining: result.daysRemaining || 0,
      });
      continue;
    }

    try {
      const noteSuffix = notes ? `Admin note: ${notes}` : "";
      const txId = await releaseEarningToAvailable(shopId, orderId, adminId || "admin", noteSuffix);
      if (txId === null) {
        skippedOrders.push({ orderId, reason: "already_released", amount: result.amount, creditType: result.creditType || null });
        continue;
      }
      releasedOrders.push({
        orderId,
        amount: result.amount,
        creditType: result.creditType || null,
        eligibleAt: result.eligibleAt || null,
        releasedBy: adminId || "admin",
      });
      totalReleasedAmount += Number(result.amount || 0);
    } catch (err) {
      skippedOrders.push({
        orderId,
        reason: err?.message || "release_failed",
        amount: result.amount || 0,
        creditType: result.creditType || null,
      });
    }
  }

  const balances = await getSellerBalance(shopId);
  return {
    shopId,
    shopName: shop.name,
    force: Boolean(force),
    notes: notes || "",
    totalReleasedAmount,
    releasedOrders,
    skippedOrders,
    balances,
  };
}

// ── MongoDB mode ──────────────────────────────────────────────────────────────

async function mongoGetPayoutPreview(shopId) {
  const shop = await Shop.findOne({ id: shopId }).lean();
  if (!shop) { const e = new Error(`Shop ${shopId} not found.`); e.status = 404; throw e; }

  const allTxs     = await SellerTransaction.find({ shopId }).lean();
  const activePays = await Payout.find({ shopId, status: { $in: ["pending", "processing"] } }).lean();
  const txByOrder  = buildTxMap(allTxs, shopId);

  const eligible   = [];
  const ineligible = [];

  for (const [orderId, txMap] of Object.entries(txByOrder)) {
    const result = orderEligibility(orderId, txMap, shopId, activePays);
    if (result.eligible) {
      eligible.push({ orderId, amount: result.amount, releasedAt: result.releasedAt });
    } else if (result.reason !== "no_credit") {
      ineligible.push({ orderId, reason: result.reason });
    }
  }

  return buildPreviewResponse(shop, eligible, ineligible, activePays);
}

async function mongoCreatePayout({ shopId, orderIds, method, notes, adminId }) {
  const shop = await Shop.findOne({ id: shopId }).lean();
  if (!shop) { const e = new Error(`Shop ${shopId} not found.`); e.status = 404; throw e; }

  const allTxs     = await SellerTransaction.find({ shopId }).lean();
  const activePays = await Payout.find({ shopId, status: { $in: ["pending", "processing"] } }).lean();
  const txByOrder  = buildTxMap(allTxs, shopId);
  const deduped    = [...new Set(orderIds)];

  let totalAmount = 0;
  for (const orderId of deduped) {
    const txMap = txByOrder[orderId] || {};
    const result = orderEligibility(orderId, txMap, shopId, activePays);
    if (!result.eligible) {
      const e = new Error(`Order ${orderId} is not eligible for payout: ${result.reason}.`);
      e.status = 409; throw e;
    }
    totalAmount += result.amount;
  }

  if (totalAmount <= 0) {
    const e = new Error("Payout amount must be greater than 0."); e.status = 422; throw e;
  }

  const payout = await Payout.create({
    id:       `PAY-${randomUUID().slice(0, 8).toUpperCase()}`,
    shopId,
    orderIds: deduped,
    amount:   totalAmount,
    method:   method || "bank_transfer",
    status:   "pending",
    notes:    notes || "",
    createdBy: adminId || "",
  });

  return payout.toObject();
}

async function mongoUpdatePayoutStatus({ payoutId, newStatus, adminId, reason }) {
  const payout = await Payout.findOne({ id: payoutId }).lean();
  if (!payout) { const e = new Error(`Payout ${payoutId} not found.`); e.status = 404; throw e; }
  assertTransition(payout.status, newStatus);

  const now   = new Date();
  const patch = { status: newStatus };
  if (newStatus === "processing") { patch.processedAt = now; patch.processedBy = adminId || ""; }
  if (newStatus === "completed")  { patch.completedAt = now; patch.completedBy = adminId || ""; }
  if (newStatus === "failed")     { patch.failedAt = now; patch.failureReason = reason || ""; }
  if (newStatus === "cancelled")  { patch.cancelledAt = now; patch.cancelledBy = adminId || ""; patch.failureReason = reason || ""; }
  if (newStatus === "pending" /* retry from failed */) {
    patch.failedAt = null; patch.failureReason = "";
  }

  if (newStatus === "completed") {
    await mongoApplyPayoutDebit(payout, adminId);
  }

  return Payout.findOneAndUpdate({ id: payoutId }, { $set: patch }, { returnDocument: "after" }).lean();
}

async function mongoApplyPayoutDebit(payout, adminId) {
  const { shopId, orderIds } = payout;
  const allTxs    = await SellerTransaction.find({ shopId, orderId: { $in: orderIds } }).lean();
  const txByOrder = buildTxMap(allTxs, shopId);
  const orders    = await Order.find({ orderId: { $in: orderIds } }).lean();

  let totalDebited = 0;
  for (const orderId of orderIds) {
    const txMap      = txByOrder[orderId] || {};
    const releasedTx = txMap["hold_release"] ?? txMap["dispute_release"];
    if (!releasedTx) continue;
    if (txMap["payout_debit"]) continue; // idempotent skip

    const amount = releasedTx.amount;
    try {
      await SellerTransaction.create({
        id: `stx-${randomUUID()}`,
        shopId, orderId,
        type:      "payout_debit",
        amount,
        note:      `Payout debit — payout ${payout.id}.`,
        createdBy: adminId || "admin",
      });
    } catch (e) {
      if (e.code !== 11000) throw e; // duplicate — idempotent skip
      continue;
    }
    await Shop.findOneAndUpdate({ id: shopId }, { $inc: { availableBalance: -amount, paidBalance: amount } });
    totalDebited += amount;

    const order = orders.find((o) => o.orderId === orderId);
    if (order && RELEASABLE_PAYMENT_STATUSES.has(order.paymentStatus)) {
      await Order.findOneAndUpdate({ orderId }, { $set: { paymentStatus: "Released" } });
    }
  }
  return totalDebited;
}

// ── Seed mode ─────────────────────────────────────────────────────────────────

function seedGetPayoutPreview(shopId) {
  const state = seedRepository.getState();
  const shop  = state.shops.find((s) => s.id === shopId);
  if (!shop) { const e = new Error(`Shop ${shopId} not found.`); e.status = 404; throw e; }

  const txByOrder  = buildTxMap(state.sellerTransactions, shopId);
  const activePays = (state.payoutRecords || []).filter((p) => p.shopId === shopId && ["pending", "processing"].includes(p.status));

  const eligible   = [];
  const ineligible = [];

  for (const [orderId, txMap] of Object.entries(txByOrder)) {
    const result = orderEligibility(orderId, txMap, shopId, state.payoutRecords || []);
    if (result.eligible) {
      eligible.push({ orderId, amount: result.amount, releasedAt: result.releasedAt });
    } else if (result.reason !== "no_credit") {
      ineligible.push({ orderId, reason: result.reason });
    }
  }

  return buildPreviewResponse(shop, eligible, ineligible, activePays);
}

function seedCreatePayout({ shopId, orderIds, method, notes, adminId }) {
  const state = seedRepository.getState();
  const shop  = state.shops.find((s) => s.id === shopId);
  if (!shop) { const e = new Error(`Shop ${shopId} not found.`); e.status = 404; throw e; }

  const txByOrder = buildTxMap(state.sellerTransactions, shopId);
  const deduped   = [...new Set(orderIds)];
  let totalAmount = 0;

  for (const orderId of deduped) {
    const txMap = txByOrder[orderId] || {};
    const result = orderEligibility(orderId, txMap, shopId, state.payoutRecords || []);
    if (!result.eligible) {
      const e = new Error(`Order ${orderId} is not eligible for payout: ${result.reason}.`);
      e.status = 409; throw e;
    }
    totalAmount += result.amount;
  }

  if (totalAmount <= 0) {
    const e = new Error("Payout amount must be greater than 0."); e.status = 422; throw e;
  }

  const now    = new Date().toISOString();
  const payout = {
    id:        `PAY-${randomUUID().slice(0, 8).toUpperCase()}`,
    shopId,
    orderIds:  deduped,
    amount:    totalAmount,
    method:    method || "bank_transfer",
    status:    "pending",
    notes:     notes || "",
    failureReason: "",
    createdBy: adminId || "",
    processedBy: "", completedBy: "", cancelledBy: "",
    scheduledAt: null, processedAt: null, completedAt: null,
    failedAt: null,   cancelledAt: null,
    createdAt: now,   updatedAt: now,
  };

  state.payoutRecords = state.payoutRecords || [];
  state.payoutRecords.unshift(payout);
  return payout;
}

async function seedUpdatePayoutStatus({ payoutId, newStatus, adminId, reason }) {
  const state  = seedRepository.getState();
  const payout = (state.payoutRecords || []).find((p) => p.id === payoutId);
  if (!payout) { const e = new Error(`Payout ${payoutId} not found.`); e.status = 404; throw e; }
  assertTransition(payout.status, newStatus);

  const now       = new Date().toISOString();
  const oldStatus = payout.status;
  payout.status    = newStatus;
  payout.updatedAt = now;

  if (newStatus === "processing") { payout.processedAt = now; payout.processedBy = adminId || ""; }
  if (newStatus === "failed")     { payout.failedAt = now; payout.failureReason = reason || ""; }
  if (newStatus === "cancelled")  { payout.cancelledAt = now; payout.cancelledBy = adminId || ""; payout.failureReason = reason || ""; }
  if (newStatus === "pending" && oldStatus === "failed") {
    payout.failedAt = null; payout.failureReason = "";
  }

  if (newStatus === "completed") {
    await seedApplyPayoutDebit(payout, adminId, state);
    payout.completedAt = now; payout.completedBy = adminId || "";
  }

  return payout;
}

async function seedApplyPayoutDebit(payout, adminId, state) {
  const { shopId, orderIds } = payout;
  const shop  = state.shops.find((s) => s.id === shopId);
  const txByOrder = buildTxMap(state.sellerTransactions, shopId);
  const allOrders = getSeedOrders();

  for (const orderId of orderIds) {
    const txMap    = txByOrder[orderId] || {};
    const releasedTx = txMap["hold_release"] ?? txMap["dispute_release"];
    if (!releasedTx) continue;

    // Idempotent: skip if payout_debit already exists
    const alreadyDebited = (state.sellerTransactions || []).some(
      (t) => t.orderId === orderId && t.shopId === shopId && t.type === "payout_debit"
    );
    if (alreadyDebited) continue;

    const amount = releasedTx.amount;
    state.sellerTransactions.unshift({
      id: `stx-${randomUUID()}`,
      shopId, orderId,
      type:      "payout_debit",
      amount,
      note:      `Payout debit — payout ${payout.id}.`,
      createdBy: adminId || "admin",
      createdAt: new Date().toISOString(),
    });

    if (shop) {
      shop.availableBalance = (shop.availableBalance || 0) - amount;
      shop.paidBalance      = (shop.paidBalance      || 0) + amount;
    }

    const order = allOrders.find((o) => o.orderId === orderId);
    if (order && RELEASABLE_PAYMENT_STATUSES.has(order.paymentStatus)) {
      order.paymentStatus = "Released";
    }
  }
}

// ── Shared response builder ───────────────────────────────────────────────────

function buildPreviewResponse(shop, eligible, ineligible, activePays) {
  return {
    shopId:    shop.id,
    shopName:  shop.name,
    balances: {
      pendingBalance:   shop.pendingBalance   || 0,
      availableBalance: shop.availableBalance || 0,
      holdBalance:      shop.holdBalance      || 0,
      paidBalance:      shop.paidBalance      || 0,
    },
    payoutMethod:  shop.paymentRules?.payoutMethod || "bank_transfer",
    eligibleOrders: eligible,
    eligibleTotal:  eligible.reduce((s, e) => s + e.amount, 0),
    ineligibleOrders: ineligible,
    activePayout: activePays.length > 0
      ? { id: activePays[0].id, status: activePays[0].status, amount: activePays[0].amount }
      : null,
  };
}

// ── Seller read-only helpers ──────────────────────────────────────────────────

function seedGetBalance(shopId) {
  const shop = seedRepository.getState().shops.find((s) => s.id === shopId);
  if (!shop) { const e = new Error(`Shop ${shopId} not found.`); e.status = 404; throw e; }
  return {
    pendingBalance:   shop.pendingBalance   || 0,
    availableBalance: shop.availableBalance || 0,
    holdBalance:      shop.holdBalance      || 0,
    paidBalance:      shop.paidBalance      || 0,
  };
}

function seedGetTransactions(shopId, { limit = 50, offset = 0 } = {}) {
  const all = (seedRepository.getState().sellerTransactions || [])
    .filter((t) => t.shopId === shopId);
  return {
    total: all.length,
    transactions: all.slice(offset, offset + limit),
  };
}

function seedGetSellerPayouts(shopId, { limit = 20, offset = 0 } = {}) {
  const all = (seedRepository.getState().payoutRecords || [])
    .filter((p) => p.shopId === shopId);
  return {
    total: all.length,
    payouts: all.slice(offset, offset + limit),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getPayoutPreview(shopId) {
  return env.mongoUri ? mongoGetPayoutPreview(shopId) : seedGetPayoutPreview(shopId);
}

export async function getReleasePreview(shopId, opts = {}) {
  const { shop, eligible, notYetMature, skipped } = await gatherReleaseCandidates(shopId, opts);
  return buildReleasePreviewResponse(shop, eligible, notYetMature, skipped);
}

export async function releaseEarnings({ shopId, orderIds, releaseAllEligible = false, force = false, notes = "", adminId, now = new Date() } = {}) {
  if (!shopId) {
    const e = new Error("shopId is required.");
    e.status = 400;
    throw e;
  }

  if (!Array.isArray(orderIds) && !releaseAllEligible) {
    const e = new Error("Provide orderIds or set releaseAllEligible to true.");
    e.status = 400;
    throw e;
  }

  if (releaseAllEligible) {
    const preview = await gatherReleaseCandidates(shopId, { now });
    const targets = force ? [...preview.eligible, ...preview.notYetMature] : preview.eligible;
    const selectedOrderIds = targets.map((item) => item.orderId);
    const result = await applyReleaseForOrders(shopId, selectedOrderIds, { adminId, force, notes, now });
    const previewSkipped = force ? preview.skipped : [...preview.notYetMature.map((item) => ({
      orderId: item.orderId,
      reason: "not_matured",
      amount: item.amount || 0,
      creditType: item.creditType || null,
      eligibleAt: item.eligibleAt || null,
      daysRemaining: item.daysRemaining || 0,
    })), ...preview.skipped];
    const skippedMap = new Map(result.skippedOrders.map((item) => [item.orderId, item]));
    for (const item of previewSkipped) {
      if (!skippedMap.has(item.orderId)) skippedMap.set(item.orderId, item);
    }
    return { ...result, skippedOrders: [...skippedMap.values()] };
  }

  const selectedOrderIds = [...new Set((orderIds || []).filter(Boolean))];
  if (selectedOrderIds.length === 0) {
    const e = new Error("At least one orderId is required.");
    e.status = 400;
    throw e;
  }
  return applyReleaseForOrders(shopId, selectedOrderIds, { adminId, force, notes, now });
}

export async function releaseMatureEarningsForShop(shopId, { now = new Date() } = {}) {
  const preview = await gatherReleaseCandidates(shopId, { now });
  const result = await applyReleaseForOrders(shopId, preview.eligible.map((item) => item.orderId), {
    adminId: "system",
    force: false,
    notes: "Auto release helper.",
    now,
  });
  console.info(
    `[payoutService] releaseMatureEarningsForShop shop=${shopId} released=${result.releasedOrders.length} skipped=${result.skippedOrders.length}`
  );
  return result;
}

export async function listPayouts({ shopId, status } = {}) {
  if (env.mongoUri) {
    const query = {};
    if (shopId) query.shopId = shopId;
    if (status) query.status = status;
    return Payout.find(query).sort({ createdAt: -1 }).lean();
  }
  let records = seedRepository.getState().payoutRecords || [];
  if (shopId) records = records.filter((p) => p.shopId === shopId);
  if (status) records = records.filter((p) => p.status === status);
  return records;
}

export async function getPayoutById(payoutId, { shopId } = {}) {
  if (env.mongoUri) {
    const query = { id: payoutId };
    if (shopId) query.shopId = shopId;
    const p = await Payout.findOne(query).lean();
    if (!p) { const e = new Error(`Payout ${payoutId} not found.`); e.status = 404; throw e; }
    return p;
  }
  const records = seedRepository.getState().payoutRecords || [];
  const p = records.find((r) => r.id === payoutId && (!shopId || r.shopId === shopId));
  if (!p) { const e = new Error(`Payout ${payoutId} not found.`); e.status = 404; throw e; }
  return p;
}

export async function createPayout({ shopId, orderIds, method, notes, adminId }) {
  if (!shopId)   { const e = new Error("shopId is required."); e.status = 400; throw e; }
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    const e = new Error("At least one order ID is required."); e.status = 400; throw e;
  }
  return env.mongoUri
    ? mongoCreatePayout({ shopId, orderIds, method, notes, adminId })
    : seedCreatePayout({ shopId, orderIds, method, notes, adminId });
}

export async function updatePayoutStatus({ payoutId, newStatus, adminId, reason }) {
  if (!payoutId)  { const e = new Error("payoutId is required."); e.status = 400; throw e; }
  if (!newStatus) { const e = new Error("newStatus is required."); e.status = 400; throw e; }
  return env.mongoUri
    ? mongoUpdatePayoutStatus({ payoutId, newStatus, adminId, reason })
    : seedUpdatePayoutStatus({ payoutId, newStatus, adminId, reason });
}

// ── Seller read-only ──────────────────────────────────────────────────────────

export async function getSellerBalance(shopId) {
  if (env.mongoUri) {
    const shop = await Shop.findOne({ id: shopId }).lean();
    if (!shop) { const e = new Error(`Shop ${shopId} not found.`); e.status = 404; throw e; }
    return {
      pendingBalance:   shop.pendingBalance   || 0,
      availableBalance: shop.availableBalance || 0,
      holdBalance:      shop.holdBalance      || 0,
      paidBalance:      shop.paidBalance      || 0,
    };
  }
  return seedGetBalance(shopId);
}

export async function getSellerTransactions(shopId, opts) {
  if (env.mongoUri) {
    const { limit = 50, offset = 0 } = opts || {};
    const total = await SellerTransaction.countDocuments({ shopId });
    const transactions = await SellerTransaction.find({ shopId })
      .sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    return { total, transactions };
  }
  return seedGetTransactions(shopId, opts);
}

export async function getSellerPayouts(shopId, opts) {
  if (env.mongoUri) {
    const { limit = 20, offset = 0 } = opts || {};
    const total = await Payout.countDocuments({ shopId });
    const payouts = await Payout.find({ shopId })
      .sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    return { total, payouts };
  }
  return seedGetSellerPayouts(shopId, opts);
}
