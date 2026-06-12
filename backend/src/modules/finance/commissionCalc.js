/**
 * commissionCalc.js
 *
 * Triggered by admin to create gmv_commission entries for all active referrals.
 *
 * Flow:
 *   1. Scan every active SellerReferral.
 *   2. For each referral, load the rep's commission plan.
 *   3. Find all "Delivered" / "Customer Accepted" orders for that shop
 *      that do not already have a gmv_commission CommissionEntry.
 *   4. Create a CommissionEntry(gmv_commission) for each such order.
 *
 * Idempotent: the unique index on (orderId, shopId, type) prevents
 * double-creation; duplicate attempts are silently skipped.
 */

import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { CommissionEntry } from "../../models/CommissionEntry.js";
import { SalesRep } from "../../models/SalesRep.js";
import { SellerReferral } from "../../models/SellerReferral.js";
import { Order } from "../../models/Order.js";
import { getSeedOrders } from "../orders/orders.service.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { DEFAULT_COMMISSION_PLANS } from "../../../../packages/shared/constants/commission.js";

const ELIGIBLE_STATUSES = new Set(["Delivered", "Customer Accepted"]);

function tierRate(plan, monthlyGmv) {
  const tiers = plan.tierThresholds || [];
  const sorted = [...tiers].sort((a, b) => b.minMonthlyGmv - a.minMonthlyGmv);
  for (const tier of sorted) {
    if (monthlyGmv >= tier.minMonthlyGmv) return tier.rate;
  }
  return plan.gmvRate || 0.05;
}

// ── MongoDB mode ──────────────────────────────────────────────────────────────

async function mongoRun(dryRun) {
  const created = [];
  const skipped = [];

  const referrals = await SellerReferral.find({ status: "active" }).lean();

  for (const referral of referrals) {
    const rep = await SalesRep.findById(referral.repId).lean();
    if (!rep) continue;

    const plan = DEFAULT_COMMISSION_PLANS[rep.plan] || DEFAULT_COMMISSION_PLANS.Standard;

    const existingOrderIds = await CommissionEntry.distinct("orderId", {
      repCode: referral.repCode,
      shopId:  referral.shopId,
      type:    "gmv_commission",
    });

    const orders = await Order.find({
      shopIds: referral.shopId,
      status:  { $in: [...ELIGIBLE_STATUSES] },
      orderId: { $nin: existingOrderIds },
    }).lean();

    // Approximate monthly GMV for tier calculation
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthlyGmv = orders
      .filter((o) => new Date(o.createdAt) >= monthStart)
      .reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const rate = tierRate(plan, monthlyGmv);

    for (const order of orders) {
      const shopSubtotal = (order.items || [])
        .filter((i) => i.shopId === referral.shopId)
        .reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);

      if (shopSubtotal <= 0) { skipped.push({ reason: "zero subtotal", orderId: order.orderId }); continue; }

      const amount = Math.round(shopSubtotal * rate);
      const entry = {
        id:          `com-${randomUUID().slice(0, 8)}`,
        repId:       referral.repId,
        repCode:     referral.repCode,
        referralId:  referral._id,
        shopId:      referral.shopId,
        shopName:    referral.shopName || "",
        type:        "gmv_commission",
        amount,
        status:      "Pending",
        orderId:     order.orderId,
        note:        `GMV commission (${(rate * 100).toFixed(1)}%) for order ${order.orderId}`,
        effectiveAt: new Date(),
      };

      if (!dryRun) {
        try {
          await CommissionEntry.create(entry);
        } catch (err) {
          if (err.code === 11000) { skipped.push({ reason: "duplicate", orderId: order.orderId }); continue; }
          throw err;
        }
      }
      created.push({ repCode: referral.repCode, shopId: referral.shopId, orderId: order.orderId, amount, rate });
    }
  }

  return { created: created.length, skipped: skipped.length, dryRun, entries: dryRun ? created : [] };
}

// ── Seed mode ─────────────────────────────────────────────────────────────────

function seedRun(dryRun) {
  const state = seedRepository.getState();
  const referrals = (state.sellerReferrals || []).filter((r) => r.status === "active");
  const allOrders = getSeedOrders();
  state.commissionEntries = state.commissionEntries || [];

  const created = [];
  const skipped = [];

  for (const ref of referrals) {
    const rep = (state.salesReps || []).find((r) => r.code === ref.repCode);
    if (!rep) continue;

    const plan = DEFAULT_COMMISSION_PLANS[rep.plan] || DEFAULT_COMMISSION_PLANS.Standard;
    const rate = plan.gmvRate || 0.05;

    const shopOrders = allOrders.filter(
      (o) => (o.shopIds || []).includes(ref.shopId) && ELIGIBLE_STATUSES.has(o.status)
    );

    for (const order of shopOrders) {
      const exists = state.commissionEntries.some(
        (e) => e.repCode === ref.repCode && e.shopId === ref.shopId && e.orderId === order.orderId && e.type === "gmv_commission"
      );
      if (exists) { skipped.push({ reason: "duplicate", orderId: order.orderId }); continue; }

      const shopSubtotal = (order.items || [])
        .filter((i) => i.shopId === ref.shopId)
        .reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);

      if (shopSubtotal <= 0) { skipped.push({ reason: "zero subtotal", orderId: order.orderId }); continue; }

      const amount = Math.round(shopSubtotal * rate);
      const entry = {
        id:          `com-${randomUUID().slice(0, 8)}`,
        repId:       rep.id || "",
        repCode:     ref.repCode,
        referralId:  ref.id,
        shopId:      ref.shopId,
        shopName:    ref.shopName || "",
        type:        "gmv_commission",
        amount,
        status:      "Pending",
        orderId:     order.orderId,
        note:        `GMV commission (${(rate * 100).toFixed(1)}%) for order ${order.orderId}`,
        createdAt:   new Date().toISOString(),
      };

      if (!dryRun) state.commissionEntries.unshift(entry);
      created.push({ repCode: ref.repCode, shopId: ref.shopId, orderId: order.orderId, amount, rate });
    }
  }

  return { created: created.length, skipped: skipped.length, dryRun, entries: dryRun ? created : [] };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runCommissionCalculation({ dryRun = false } = {}) {
  return env.mongoUri ? mongoRun(dryRun) : seedRun(dryRun);
}
