/**
 * sellerBalance.js
 *
 * Ledger-backed mutations for seller balance buckets.
 *
 * Balance buckets on Shop:
 *   pendingBalance   — earned but within the payout hold period
 *   availableBalance — hold expired / admin-released, ready for payout
 *   holdBalance      — frozen during an active dispute
 *   paidBalance      — cumulative paid out (running total, never decrements)
 *
 * Every mutation creates a SellerTransaction record first.
 * The unique index on (orderId, shopId, type) guarantees idempotency:
 * a duplicate attempt throws Mongo error 11000 and is silently skipped,
 * so callers may safely retry without double-crediting.
 *
 * All public functions are side-effect helpers that NEVER propagate errors —
 * a finance failure must not undo the order status change that triggered it.
 * (Exception: releaseEarningToAvailable is an explicit admin action and does throw.)
 */

import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { Shop } from "../../models/Shop.js";
import { SellerTransaction } from "../../models/SellerTransaction.js";
import { seedRepository } from "../../repositories/seedRepository.js";

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Per-shop vendor net derived from the order's own commission rate.
 * Uses order.platformFee / order.subtotal so the rate recorded at checkout
 * is always used — never a shop's current rate.
 */
function vendorNetForShop(order, shopId) {
  const shopSubtotal = (order.items || [])
    .filter((i) => i.shopId === shopId)
    .reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);

  const rate = order.subtotal > 0 ? (order.platformFee || 0) / order.subtotal : 0.14;
  const shopFee = Math.round(shopSubtotal * rate);
  return shopSubtotal - shopFee;
}

/**
 * Returns the $inc patch for a Shop document given a transaction type and amount.
 * Options:
 *   fromAvailable — for dispute_hold: source is availableBalance (hold was already released)
 *   fromHold      — for refund_debit: source is holdBalance (dispute was open)
 *   fromAvailable — for refund_debit: source is availableBalance (released before dispute)
 *   (default)     — for refund_debit: source is pendingBalance
 */
function shopIncPatch(type, amount, { fromAvailable = false, fromHold = false } = {}) {
  switch (type) {
    case "delivery_credit":
      return { pendingBalance: amount };
    case "hold_release":
      return { pendingBalance: -amount, availableBalance: amount };
    case "dispute_hold":
      return fromAvailable
        ? { availableBalance: -amount, holdBalance: amount }
        : { pendingBalance: -amount, holdBalance: amount };
    case "dispute_release":
      return { holdBalance: -amount, availableBalance: amount };
    case "refund_debit":
      // Source bucket depends on the order's history:
      //   fromHold      → money is frozen in holdBalance (dispute was open)
      //   fromAvailable → hold was released; money is in availableBalance
      //   (default)     → still in pendingBalance (no dispute, no release yet)
      if (fromHold)      return { holdBalance:      -amount };
      if (fromAvailable) return { availableBalance: -amount };
      return { pendingBalance: -amount };
    case "cod_credit":
      return { pendingBalance: amount };         // Phase 2
    case "payout_debit":
      return { availableBalance: -amount, paidBalance: amount };  // Phase 3
    default:
      throw new Error(`[sellerBalance] Unknown transaction type: ${type}`);
  }
}

// ── MongoDB mode ──────────────────────────────────────────────────────────────

/**
 * Creates the ledger entry and atomically adjusts the Shop balance.
 * Returns null if the transaction already exists (idempotent skip).
 * Throws on genuine errors so callers can decide whether to propagate.
 */
async function mongoApply(shopId, orderId, type, amount, note, opts = {}) {
  let txId;
  try {
    txId = `stx-${randomUUID()}`;
    await SellerTransaction.create({
      id: txId,
      shopId,
      orderId,
      type,
      amount,
      note: note || "",
      createdBy: opts.createdBy || "system",
    });
  } catch (e) {
    if (e.code === 11000) return null; // already applied — safe to skip
    throw e;
  }

  // The ledger record is written first; the balance update follows.
  // These two writes are NOT wrapped in a MongoDB multi-document transaction.
  // In the rare case that the Shop update fails after SellerTransaction succeeds,
  // the ledger entry acts as evidence for manual reconciliation.
  await Shop.findOneAndUpdate({ id: shopId }, { $inc: shopIncPatch(type, amount, opts) });
  return txId;
}

async function mongoFindTx(orderId, shopId, type) {
  return SellerTransaction.findOne({ orderId, shopId, type }).lean();
}

// Returns the earning-credit anchor for an order+shop — whichever type was used
// to record the seller's earning (delivery_credit for card orders, cod_credit for COD).
async function mongoCreditAnchor(orderId, shopId) {
  return (
    (await mongoFindTx(orderId, shopId, "delivery_credit")) ??
    (await mongoFindTx(orderId, shopId, "cod_credit"))
  );
}

// ── Seed mode ─────────────────────────────────────────────────────────────────

function seedApply(shopId, orderId, type, amount, note, opts = {}) {
  const state = seedRepository.getState();
  state.sellerTransactions = state.sellerTransactions || [];

  // Idempotency: skip if this (orderId, shopId, type) combination already exists.
  const exists = state.sellerTransactions.some(
    (t) => t.orderId === orderId && t.shopId === shopId && t.type === type
  );
  if (exists) return null;

  const txId = `stx-${randomUUID()}`;
  state.sellerTransactions.unshift({
    id: txId,
    shopId,
    orderId,
    type,
    amount,
    note: note || "",
    createdBy: opts.createdBy || "system",
    createdAt: new Date().toISOString(),
  });

  // Apply the balance change to the shop.
  const shop = state.shops.find((s) => s.id === shopId);
  if (!shop) {
    console.warn(`[sellerBalance] seed shop not found: ${shopId}`);
    return txId;
  }

  const patch = shopIncPatch(type, amount, opts);
  for (const [field, delta] of Object.entries(patch)) {
    shop[field] = (shop[field] || 0) + delta;
  }

  return txId;
}

function seedFindTx(orderId, shopId, type) {
  const state = seedRepository.getState();
  return (state.sellerTransactions || []).find(
    (t) => t.orderId === orderId && t.shopId === shopId && t.type === type
  ) || null;
}

// Returns the earning-credit anchor for an order+shop — whichever type was used
// to record the seller's earning (delivery_credit for card orders, cod_credit for COD).
function seedCreditAnchor(orderId, shopId) {
  return (
    seedFindTx(orderId, shopId, "delivery_credit") ??
    seedFindTx(orderId, shopId, "cod_credit")
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Called when an order reaches "Delivered".
 * Credits each shop's vendorNet into pendingBalance (card orders only).
 *
 * COD orders are intentionally skipped: cash hasn't been physically received
 * by the platform yet. Seller credit for COD happens via recordCodCredit()
 * when admin confirms cash receipt during COD settlement (Phase 2).
 *
 * Never throws — commission-style side effect.
 */
export async function recordDeliveryEarning(order) {
  if (order.paymentMethod === "cod") return;

  for (const shopId of (order.shopIds || [])) {
    try {
      const amount = vendorNetForShop(order, shopId);
      if (amount <= 0) continue;

      const note = `Delivery credit for order ${order.orderId}.`;
      if (env.mongoUri) {
        await mongoApply(shopId, order.orderId, "delivery_credit", amount, note);
      } else {
        seedApply(shopId, order.orderId, "delivery_credit", amount, note);
      }
    } catch (err) {
      console.error(`[sellerBalance] recordDeliveryEarning shop=${shopId} order=${order.orderId}:`, err.message);
    }
  }
}

/**
 * Called during admin COD cash settlement for a specific order.
 * Credits each shop's vendorNet into pendingBalance via a cod_credit transaction.
 *
 * Guard: if a delivery_credit already exists for this order+shop (shouldn't happen
 * after the Phase 1 COD skip, but defensive), the credit is skipped and a warning
 * is logged to prevent double-crediting.
 *
 * Never throws — side-effect helper called from codSettlement service.
 */
export async function recordCodCredit(order, settledBy) {
  for (const shopId of (order.shopIds || [])) {
    try {
      const amount = vendorNetForShop(order, shopId);
      if (amount <= 0) continue;

      // Defensive guard: skip if a delivery_credit already exists for this order+shop.
      const existingDeliveryCredit = env.mongoUri
        ? await mongoFindTx(order.orderId, shopId, "delivery_credit")
        : seedFindTx(order.orderId, shopId, "delivery_credit");

      if (existingDeliveryCredit) {
        console.warn(
          `[sellerBalance] recordCodCredit skipped — delivery_credit already exists` +
          ` for order ${order.orderId} shop ${shopId}. No double-credit applied.`
        );
        continue;
      }

      const note = `COD cash settled — earnings credit for order ${order.orderId}.`;
      if (env.mongoUri) {
        await mongoApply(shopId, order.orderId, "cod_credit", amount, note, { createdBy: settledBy || "admin" });
      } else {
        seedApply(shopId, order.orderId, "cod_credit", amount, note, { createdBy: settledBy || "admin" });
      }
    } catch (err) {
      console.error(`[sellerBalance] recordCodCredit shop=${shopId} order=${order.orderId}:`, err.message);
    }
  }
}

/**
 * Moves a seller's pending earning for an order into availableBalance (ready for payout).
 * Supports both card earnings (delivery_credit) and settled COD earnings (cod_credit).
 * Called by admin for manual hold release; Phase 5 scheduled release will use this too.
 *
 * Guards (throws 409):
 *   - dispute_hold exists without a matching dispute_release → earnings frozen in dispute
 *   - refund_debit exists → earnings have been debited
 *
 * Idempotent:
 *   - hold_release already exists → return null (normal path)
 *   - dispute_release already exists → return null (money already in available via dispute resolution)
 *
 * COD note: cod_credit only exists after admin confirms COD settlement, so if no cod_credit
 * exists the function correctly throws 404 — unsettled COD cannot be released.
 *
 * This function DOES throw — it is an explicit admin action, not a passive side-effect.
 */
export async function releaseEarningToAvailable(shopId, orderId, releasedBy, releaseNote = "") {
  if (env.mongoUri) {
    const creditTx = await mongoCreditAnchor(orderId, shopId);
    if (!creditTx) {
      const e = new Error(`No earning credit found for order ${orderId}, shop ${shopId}.`);
      e.status = 404;
      throw e;
    }

    const disputeHoldTx    = await mongoFindTx(orderId, shopId, "dispute_hold");
    const disputeReleaseTx = await mongoFindTx(orderId, shopId, "dispute_release");
    const refundDebitTx    = await mongoFindTx(orderId, shopId, "refund_debit");

    if (disputeHoldTx && !disputeReleaseTx) {
      const e = new Error(`Cannot release order ${orderId}: earnings are frozen in an active dispute hold.`);
      e.status = 409;
      throw e;
    }
    if (refundDebitTx) {
      const e = new Error(`Cannot release order ${orderId}: earnings have been debited for refund.`);
      e.status = 409;
      throw e;
    }

    // Money is already in availableBalance — either via normal hold_release or dispute_release.
    const holdReleaseTx = await mongoFindTx(orderId, shopId, "hold_release");
    if (holdReleaseTx || disputeReleaseTx) return null; // idempotent

    return mongoApply(
      shopId, orderId, "hold_release", creditTx.amount,
      `Hold released for order ${orderId}.${releaseNote ? ` ${releaseNote}` : ""}`,
      { createdBy: releasedBy || "admin" }
    );
  }

  const creditTx = seedCreditAnchor(orderId, shopId);
  if (!creditTx) {
    const e = new Error(`No earning credit found for order ${orderId}, shop ${shopId}.`);
    e.status = 404;
    throw e;
  }

  const disputeHoldTx    = seedFindTx(orderId, shopId, "dispute_hold");
  const disputeReleaseTx = seedFindTx(orderId, shopId, "dispute_release");
  const refundDebitTx    = seedFindTx(orderId, shopId, "refund_debit");

  if (disputeHoldTx && !disputeReleaseTx) {
    const e = new Error(`Cannot release order ${orderId}: earnings are frozen in an active dispute hold.`);
    e.status = 409;
    throw e;
  }
  if (refundDebitTx) {
    const e = new Error(`Cannot release order ${orderId}: earnings have been debited for refund.`);
    e.status = 409;
    throw e;
  }

  const holdReleaseTx = seedFindTx(orderId, shopId, "hold_release");
  if (holdReleaseTx || disputeReleaseTx) return null; // idempotent

  return seedApply(
    shopId, orderId, "hold_release", creditTx.amount,
    `Hold released for order ${orderId}.${releaseNote ? ` ${releaseNote}` : ""}`,
    { createdBy: releasedBy || "admin" }
  );
}

/**
 * Called when a customer dispute is opened on an order.
 * Moves the delivery earning from pending (or available, if hold already released) to holdBalance.
 * Never throws — side-effect helper.
 */
export async function freezeSellerBalanceForDispute(order) {
  for (const shopId of (order.shopIds || [])) {
    try {
      const orderId = order.orderId;

      // Works for both card (delivery_credit) and settled COD (cod_credit) orders.
      const creditTx = env.mongoUri
        ? await mongoCreditAnchor(orderId, shopId)
        : seedCreditAnchor(orderId, shopId);

      if (!creditTx) continue; // no earning recorded yet — nothing to freeze

      const holdReleaseTx = env.mongoUri
        ? await mongoFindTx(orderId, shopId, "hold_release")
        : seedFindTx(orderId, shopId, "hold_release");

      const fromAvailable = Boolean(holdReleaseTx);
      const note = `Dispute opened — earnings frozen for order ${orderId}.`;

      if (env.mongoUri) {
        await mongoApply(shopId, orderId, "dispute_hold", creditTx.amount, note, { fromAvailable });
      } else {
        seedApply(shopId, orderId, "dispute_hold", creditTx.amount, note, { fromAvailable });
      }
    } catch (err) {
      console.error(`[sellerBalance] freezeSellerBalanceForDispute shop=${shopId} order=${order.orderId}:`, err.message);
    }
  }
}

/**
 * Called when a resolution decision finalizes with payoutDecision === "release_approved".
 * Moves earnings from holdBalance back to availableBalance.
 * Never throws — side-effect helper.
 */
export async function releaseDisputeHold(order) {
  for (const shopId of (order.shopIds || [])) {
    try {
      const orderId = order.orderId;

      const holdTx = env.mongoUri
        ? await mongoFindTx(orderId, shopId, "dispute_hold")
        : seedFindTx(orderId, shopId, "dispute_hold");

      if (!holdTx) continue; // no freeze to release

      const note = `Dispute resolved in seller's favour — hold released for order ${orderId}.`;
      if (env.mongoUri) {
        await mongoApply(shopId, orderId, "dispute_release", holdTx.amount, note);
      } else {
        seedApply(shopId, orderId, "dispute_release", holdTx.amount, note);
      }
    } catch (err) {
      console.error(`[sellerBalance] releaseDisputeHold shop=${shopId} order=${order.orderId}:`, err.message);
    }
  }
}

/**
 * Called when a resolution decision finalizes with refundDecision === "required" or "goodwill".
 * Debits the held earnings (holdBalance if a dispute_hold exists, else pendingBalance).
 * Never throws — side-effect helper.
 */
export async function debitForRefund(order) {
  for (const shopId of (order.shopIds || [])) {
    try {
      const orderId = order.orderId;

      // Works for both card (delivery_credit) and settled COD (cod_credit) orders.
      const creditTx = env.mongoUri
        ? await mongoCreditAnchor(orderId, shopId)
        : seedCreditAnchor(orderId, shopId);

      if (!creditTx) continue; // no earning to debit

      const holdTx    = env.mongoUri ? await mongoFindTx(orderId, shopId, "dispute_hold")  : seedFindTx(orderId, shopId, "dispute_hold");
      const releaseTx = env.mongoUri ? await mongoFindTx(orderId, shopId, "hold_release")  : seedFindTx(orderId, shopId, "hold_release");

      // Determine which bucket currently holds the money:
      //   dispute_hold exists  → holdBalance
      //   hold_release exists  → availableBalance (hold already released before dispute)
      //   neither              → pendingBalance (still within hold period)
      const fromHold      = Boolean(holdTx);
      const fromAvailable = !holdTx && Boolean(releaseTx);
      const note = `Refund debit for order ${orderId}.`;

      if (env.mongoUri) {
        await mongoApply(shopId, orderId, "refund_debit", creditTx.amount, note, { fromHold, fromAvailable });
      } else {
        seedApply(shopId, orderId, "refund_debit", creditTx.amount, note, { fromHold, fromAvailable });
      }
    } catch (err) {
      console.error(`[sellerBalance] debitForRefund shop=${shopId} order=${order.orderId}:`, err.message);
    }
  }
}
