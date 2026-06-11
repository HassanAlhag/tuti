/**
 * orderCommissions.js
 *
 * Triggered when an order status transitions to "Delivered".
 * For each shop in the order that has an active SellerReferral:
 *   1. First-sale bonus  — created once per referral (atomic, idempotent).
 *   2. GMV commission    — created once per order+shop (idempotent via unique index).
 *
 * Commission accrual is a side effect: errors are logged but never propagated
 * so a DB failure here cannot reverse a completed order status transition.
 */

import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { CommissionEntry } from "../../models/CommissionEntry.js";
import { SalesRep } from "../../models/SalesRep.js";
import { SellerReferral } from "../../models/SellerReferral.js";
import { seedRepository } from "../../repositories/seedRepository.js";

// Commission plan rates. Keep in sync with DEFAULT_COMMISSION_PLANS in marketplace.service.js.
const PLANS = {
  Starter:    { firstSaleBonus:   50, gmvRate: 0.02 },
  Standard:   { firstSaleBonus:  100, gmvRate: 0.03 },
  Premium:    { firstSaleBonus:  250, gmvRate: 0.04 },
  Enterprise: { firstSaleBonus: 1000, gmvRate: 0.05 },
};

function planFor(repPlan) {
  return PLANS[repPlan] || PLANS.Standard;
}

// Per-shop GMV within a multi-shop order.
function shopGmv(order, shopId) {
  return (order.items || [])
    .filter((item) => item.shopId === shopId)
    .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

// ── MongoDB mode ─────────────────────────────────────────────────────────────

async function accrueMongoCommissions(order) {
  for (const shopId of (order.shopIds || [])) {
    try {
      const referral = await SellerReferral.findOne({ shopId, status: "active" }).lean();
      if (!referral) continue;

      const rep = await SalesRep.findById(referral.repId).lean();
      if (!rep) continue;

      const plan = planFor(rep.plan);
      const gmv  = shopGmv(order, shopId);
      if (gmv <= 0) continue;

      const now = new Date();

      // ── First-sale bonus ─────────────────────────────────────────────
      // Atomically claim the first-sale slot. Only the process that sets
      // firstSaleAt from null to now will proceed to create the bonus entry.
      if (!referral.firstSaleAt) {
        const claimed = await SellerReferral.findOneAndUpdate(
          { _id: referral._id, firstSaleAt: null },
          { firstSaleAt: now },
          { new: false }          // return the PRE-update doc; null = someone else won
        ).lean();

        if (claimed && plan.firstSaleBonus > 0) {
          try {
            await CommissionEntry.create({
              id:         `com-${randomUUID()}`,
              repId:      referral.repId,
              repCode:    referral.repCode,
              referralId: referral._id,
              shopId,
              shopName:   referral.shopName || "",
              type:       "first_sale_bonus",
              amount:     plan.firstSaleBonus,
              currency:   "AED",
              status:     "Pending",
              orderId:    order.orderId,
              note:       `First sale bonus — shop ${shopId}, order ${order.orderId}.`,
            });
          } catch (e) {
            if (e.code !== 11000) throw e;  // unique index race — already exists, safe to swallow
          }
        }
      }

      // ── GMV commission ───────────────────────────────────────────────
      const gmvAmount = Math.round(gmv * plan.gmvRate * 100) / 100;
      if (gmvAmount > 0) {
        try {
          await CommissionEntry.create({
            id:         `com-${randomUUID()}`,
            repId:      referral.repId,
            repCode:    referral.repCode,
            referralId: referral._id,
            shopId,
            shopName:   referral.shopName || "",
            type:       "gmv_commission",
            amount:     gmvAmount,
            currency:   "AED",
            status:     "Pending",
            orderId:    order.orderId,
            note:       `GMV ${(plan.gmvRate * 100).toFixed(1)}% on AED ${gmv.toFixed(2)} · order ${order.orderId}.`,
          });
        } catch (e) {
          if (e.code !== 11000) throw e;  // (orderId, shopId, type) index — already created, skip
        }
      }
    } catch (shopErr) {
      // Never propagate; commission failure must not undo the order status update.
      console.error(`[orderCommissions] mongo shop=${shopId} order=${order.orderId}:`, shopErr.message);
    }
  }
}

// ── Seed mode ────────────────────────────────────────────────────────────────

function accrueSeedCommissions(order) {
  const state = seedRepository.getState();
  state.sellerReferrals  = state.sellerReferrals  || [];
  state.commissionEntries = state.commissionEntries || [];

  for (const shopId of (order.shopIds || [])) {
    try {
      const referral = state.sellerReferrals.find(
        (r) => r.shopId === shopId && r.status === "active"
      );
      if (!referral) continue;

      const rep = (state.salesReps || []).find(
        (r) => r.id === String(referral.repId) || String(r._id) === String(referral.repId)
      );
      if (!rep) continue;

      const plan    = planFor(rep.plan);
      const gmv     = shopGmv(order, shopId);
      if (gmv <= 0) continue;

      const dateStr = new Date().toISOString().slice(0, 10);

      // ── First-sale bonus ─────────────────────────────────────────────
      if (!referral.firstSaleAt) {
        referral.firstSaleAt = new Date().toISOString();

        const bonusExists = state.commissionEntries.some(
          (e) => e.referralId === referral.id && e.type === "first_sale_bonus"
        );
        if (!bonusExists && plan.firstSaleBonus > 0) {
          state.commissionEntries.unshift({
            id:         `com-${randomUUID()}`,
            repId:      referral.repId,
            repCode:    referral.repCode,
            referralId: referral.id,
            shopId,
            shopName:   referral.shopName || "",
            type:       "first_sale_bonus",
            amount:     plan.firstSaleBonus,
            currency:   "AED",
            status:     "Pending",
            orderId:    order.orderId,
            note:       `First sale bonus — shop ${shopId}, order ${order.orderId}.`,
            date:       dateStr,
          });
        }
      }

      // ── GMV commission ───────────────────────────────────────────────
      const gmvExists = state.commissionEntries.some(
        (e) => e.orderId === order.orderId && e.shopId === shopId && e.type === "gmv_commission"
      );
      if (!gmvExists) {
        const gmvAmount = Math.round(gmv * plan.gmvRate * 100) / 100;
        if (gmvAmount > 0) {
          state.commissionEntries.unshift({
            id:         `com-${randomUUID()}`,
            repId:      referral.repId,
            repCode:    referral.repCode,
            referralId: referral.id,
            shopId,
            shopName:   referral.shopName || "",
            type:       "gmv_commission",
            amount:     gmvAmount,
            currency:   "AED",
            status:     "Pending",
            orderId:    order.orderId,
            note:       `GMV ${(plan.gmvRate * 100).toFixed(1)}% on AED ${gmv.toFixed(2)} · order ${order.orderId}.`,
            date:       dateStr,
          });
        }
      }
    } catch (shopErr) {
      console.error(`[orderCommissions] seed shop=${shopId} order=${order.orderId}:`, shopErr.message);
    }
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function accrueDeliveredOrderCommissions(order) {
  try {
    if (env.mongoUri) {
      await accrueMongoCommissions(order);
    } else {
      accrueSeedCommissions(order);
    }
  } catch (err) {
    console.error("[orderCommissions] top-level error:", err.message);
  }
}
