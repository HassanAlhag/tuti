import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { env } from "../../config/env.js";
import { Order } from "../../models/Order.js";
import { Payout } from "../../models/Payout.js";
import { CommissionEntry } from "../../models/CommissionEntry.js";
import { seedRepository } from "../../repositories/seedRepository.js";

export const reportsRouter = Router();

reportsRouter.use(authenticate, requireRole("admin"));

// ── Helpers ────────────────────────────────────────────────────────────
function dateFilter(from, to) {
  const filter = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to)   filter.createdAt.$lte = new Date(to);
  }
  return filter;
}

function csvEscape(v) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function sendCsv(res, filename, header, rows) {
  const csv = [header, ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}-${Date.now()}.csv"`);
  res.send(csv);
}

// ── Orders ─────────────────────────────────────────────────────────────
reportsRouter.get("/orders", async (req, res, next) => {
  try {
    const { from, to, format = "json" } = req.query;
    const filter = dateFilter(from, to);
    const orders = env.mongoUri
      ? await Order.find(filter).sort({ createdAt: -1 }).limit(5000).lean()
      : (seedRepository.getState().orders || []).filter((o) => {
          if (from && new Date(o.createdAt) < new Date(from)) return false;
          if (to   && new Date(o.createdAt) > new Date(to))   return false;
          return true;
        });

    if (format === "csv") {
      const header = "orderId,status,paymentStatus,customerName,customerEmail,subtotal,shopIds,createdAt";
      const rows = orders.map((o) => [
        o.orderId, o.status, o.paymentStatus, o.customerName, o.customerEmail,
        o.subtotal, (o.shopIds || []).join("|"),
        o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
      ]);
      return sendCsv(res, "orders", header, rows);
    }

    res.json({ data: { orders, total: orders.length } });
  } catch (err) { next(err); }
});

// ── Payouts ────────────────────────────────────────────────────────────
reportsRouter.get("/payouts", async (req, res, next) => {
  try {
    const { from, to, format = "json" } = req.query;
    const filter = dateFilter(from, to);
    const payouts = env.mongoUri
      ? await Payout.find(filter).sort({ createdAt: -1 }).limit(5000).lean()
      : (seedRepository.getState().payouts || []).filter((p) => {
          if (from && new Date(p.createdAt) < new Date(from)) return false;
          if (to   && new Date(p.createdAt) > new Date(to))   return false;
          return true;
        });

    if (format === "csv") {
      const header = "id,shopId,amount,status,method,reference,createdAt,releasedAt";
      const rows = payouts.map((p) => [
        p.id, p.shopId, p.amount, p.status, p.method, p.reference,
        p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        p.releasedAt instanceof Date ? p.releasedAt.toISOString() : (p.releasedAt ?? ""),
      ]);
      return sendCsv(res, "payouts", header, rows);
    }

    res.json({ data: { payouts, total: payouts.length } });
  } catch (err) { next(err); }
});

// ── Commissions ────────────────────────────────────────────────────────
reportsRouter.get("/commissions", async (req, res, next) => {
  try {
    const { from, to, format = "json" } = req.query;
    const filter = dateFilter(from, to);
    const entries = env.mongoUri
      ? await CommissionEntry.find(filter).sort({ createdAt: -1 }).limit(5000).lean()
      : (seedRepository.getState().commissionEntries || []).filter((c) => {
          if (from && new Date(c.createdAt) < new Date(from)) return false;
          if (to   && new Date(c.createdAt) > new Date(to))   return false;
          return true;
        });

    if (format === "csv") {
      const header = "id,repId,shopId,orderId,type,amount,status,createdAt";
      const rows = entries.map((c) => [
        c.id, c.repId, c.shopId, c.orderId, c.type, c.amount, c.status,
        c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      ]);
      return sendCsv(res, "commissions", header, rows);
    }

    res.json({ data: { entries, total: entries.length } });
  } catch (err) { next(err); }
});

// ── Financial summary (used by admin KPI dashboard) ────────────────────
reportsRouter.get("/summary", async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const orders = env.mongoUri
      ? await Order.find({}).lean()
      : (seedRepository.getState().orders || []);

    const todayOrders  = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= todayStart && d <= todayEnd;
    });

    const completedStatuses = new Set(["Delivered", "Customer Accepted"]);
    const todayGmv = todayOrders
      .filter((o) => completedStatuses.has(o.status))
      .reduce((sum, o) => sum + Number(o.subtotal || 0), 0);

    const disputedOrders  = orders.filter((o) => o.status === "Disputed").length;
    const pendingPayouts  = (env.mongoUri
      ? await Payout.countDocuments({ status: { $in: ["Pending", "Processing"] } })
      : (seedRepository.getState().payouts || []).filter((p) => ["Pending", "Processing"].includes(p.status)).length
    );

    res.json({
      data: {
        ordersToday:    todayOrders.length,
        gmvToday:       todayGmv,
        disputedOrders,
        pendingPayouts,
        totalOrders:    orders.length,
      },
    });
  } catch (err) { next(err); }
});
