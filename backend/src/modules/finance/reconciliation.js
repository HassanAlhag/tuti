/**
 * reconciliation.js
 *
 * Returns a summary of open financial obligations:
 *  - Unsettled COD orders (collected but not settled to sellers)
 *  - Pending payouts (requested, not yet paid)
 *  - Active disputes (orders in "Disputed" status)
 *  - Pending commission entries (calculated but not yet paid)
 */

import { env } from "../../config/env.js";
import { Order } from "../../models/Order.js";
import { Payout } from "../../models/Payout.js";
import { CommissionEntry } from "../../models/CommissionEntry.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { getSeedOrders } from "../orders/orders.service.js";

const SETTLED_STATUSES = new Set(["Delivered", "Customer Accepted"]);

// ── MongoDB mode ──────────────────────────────────────────────────────────────

async function mongoSummary() {
  const [
    unsettledCodOrders,
    pendingPayouts,
    activeDisputes,
    pendingCommissions,
  ] = await Promise.all([
    Order.find({
      paymentMethod:                    "cod",
      "driverAssignment.codCollected":  true,
      "driverAssignment.codSettledAt":  null,
      status:                           { $in: [...SETTLED_STATUSES] },
    }).lean(),
    Payout.find({ status: { $in: ["Pending", "Processing"] } }).lean(),
    Order.countDocuments({ status: "Disputed" }),
    CommissionEntry.find({ status: "Pending" }).lean(),
  ]);

  return buildSummary({ unsettledCodOrders, pendingPayouts, activeDisputes, pendingCommissions });
}

// ── Seed mode ─────────────────────────────────────────────────────────────────

function seedSummary() {
  const state = seedRepository.getState();
  const allOrders = getSeedOrders();

  const unsettledCodOrders = allOrders.filter(
    (o) =>
      o.paymentMethod === "cod" &&
      o.driverAssignment?.codCollected === true &&
      !o.driverAssignment?.codSettledAt &&
      SETTLED_STATUSES.has(o.status)
  );

  const pendingPayouts = (state.payouts || []).filter((p) =>
    ["Pending", "Processing"].includes(p.status)
  );

  const activeDisputes = allOrders.filter((o) => o.status === "Disputed").length;

  const pendingCommissions = (state.commissionEntries || []).filter(
    (e) => e.status === "Pending"
  );

  return buildSummary({ unsettledCodOrders, pendingPayouts, activeDisputes, pendingCommissions });
}

// ── Shared builder ────────────────────────────────────────────────────────────

function buildSummary({ unsettledCodOrders, pendingPayouts, activeDisputes, pendingCommissions }) {
  const unsettledCodTotal = unsettledCodOrders.reduce(
    (s, o) => s + Number(o.driverAssignment?.codAmount ?? o.subtotal ?? 0),
    0
  );

  const pendingPayoutsTotal = pendingPayouts.reduce(
    (s, p) => s + Number(p.amount || 0),
    0
  );

  const pendingCommissionsTotal = pendingCommissions.reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );

  // Group unsettled COD by driver
  const codByDriver = {};
  for (const o of unsettledCodOrders) {
    const dId = o.driverAssignment?.driverId || "unassigned";
    codByDriver[dId] = codByDriver[dId] || { driverId: dId, count: 0, total: 0 };
    codByDriver[dId].count++;
    codByDriver[dId].total += Number(o.driverAssignment?.codAmount ?? o.subtotal ?? 0);
  }

  return {
    unsettledCod: {
      count: unsettledCodOrders.length,
      total: unsettledCodTotal,
      byDriver: Object.values(codByDriver),
    },
    pendingPayouts: {
      count: pendingPayouts.length,
      total: pendingPayoutsTotal,
    },
    activeDisputes,
    pendingCommissions: {
      count: pendingCommissions.length,
      total: pendingCommissionsTotal,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getReconciliationSummary() {
  return env.mongoUri ? mongoSummary() : seedSummary();
}
