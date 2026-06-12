import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { env } from "../../config/env.js";
import { SalesRep } from "../../models/SalesRep.js";
import { SellerReferral } from "../../models/SellerReferral.js";
import { CommissionEntry } from "../../models/CommissionEntry.js";
import { User } from "../../models/User.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { getCommissionPlans } from "../marketplace/marketplace.service.js";
import {
  createLead,
  createLeadSchema,
  deleteLead,
  exportSRReport,
  getTargets,
  listLeads,
  setTargets,
  srTargetsSchema,
  updateLead,
  updateLeadSchema,
} from "./leads.service.js";

export const srRouter = Router();

async function findUserAndRep(userId) {
  if (env.mongoUri) {
    const user = await User.findById(userId).lean();
    if (!user) return { user: null, rep: null };
    const rep = await SalesRep.findOne({ email: user.email }).lean();
    return { user, rep };
  }

  // Seed mode: fall back to first rep
  const state = seedRepository.getState();
  const rep = (state.salesReps || [])[0] || null;
  return { user: null, rep };
}

// GET /api/sr/me — own SR profile
// Falls back to User record fields when no SalesRep document is linked yet.
srRouter.get("/me", authenticate, requireRole("sales_rep"), async (req, res, next) => {
  try {
    const { user, rep } = await findUserAndRep(req.user.sub);
    if (!user && !rep) return res.status(404).json({ error: "Sales rep profile not found." });

    res.json({
      data: {
        id:     rep?.id || rep?._id?.toString() || user?._id?.toString(),
        name:   rep?.name  || user?.name  || "",
        email:  rep?.email || user?.email || "",
        phone:  rep?.phone || "",
        code:   rep?.code  || "",
        plan:   rep?.plan  || "Standard",
        status: rep?.status || (user?.isActive === false ? "Inactive" : "Active"),
      },
    });
  } catch (err) { next(err); }
});

// GET /api/sr/referrals — own referrals filtered by repCode
srRouter.get("/referrals", authenticate, requireRole("sales_rep"), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.json({ data: [] });

    if (env.mongoUri) {
      const referrals = await SellerReferral.find({ repCode: rep.code }).sort({ createdAt: -1 }).lean();
      return res.json({
        data: referrals.map((item) => ({
          id: item.id || item._id?.toString(),
          repCode: item.repCode,
          shopId: item.shopId,
          shopName: item.shopName,
          status: item.status,
          approvedAt: item.approvedAt || null,
          createdAt: item.createdAt,
          gmv: item.gmv || 0,
          firstSaleDate: item.firstSaleDate || null,
        })),
      });
    }

    const state = seedRepository.getState();
    const referrals = (state.sellerReferrals || []).filter((r) => r.repCode === rep.code);
    return res.json({ data: referrals });
  } catch (err) { next(err); }
});

// GET /api/sr/commissions — own commission entries filtered by repCode
srRouter.get("/commissions", authenticate, requireRole("sales_rep"), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.json({ data: [] });

    if (env.mongoUri) {
      const entries = await CommissionEntry.find({ repCode: rep.code }).sort({ createdAt: -1 }).lean();
      return res.json({
        data: entries.map((item) => ({
          id: item.id || item._id?.toString(),
          repCode: item.repCode,
          repName: item.repName || rep.name,
          type: item.type,
          shop: item.shop || item.shopName || "",
          amount: item.amount,
          status: item.status,
          date: item.createdAt,
        })),
      });
    }

    const state = seedRepository.getState();
    const entries = (state.commissionEntries || []).filter((e) => e.repCode === rep.code);
    return res.json({ data: entries });
  } catch (err) { next(err); }
});

// GET /api/sr/commission-plans — all available commission plans
srRouter.get("/commission-plans", authenticate, requireRole("sales_rep"), (_req, res) => {
  res.json({ data: getCommissionPlans() });
});

// ── Leads / prospects ────────────────────────────────────────────────────────

// GET /api/sr/leads
srRouter.get("/leads", authenticate, requireRole("sales_rep"), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.json({ data: { leads: [], total: 0, page: 1, limit: 50 } });
    const { status, search, page, limit } = req.query;
    res.json({ data: await listLeads(rep.code, { status, search, page, limit }) });
  } catch (err) { next(err); }
});

// POST /api/sr/leads
srRouter.post("/leads", authenticate, requireRole("sales_rep"), validate(createLeadSchema), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.status(403).json({ error: "Rep code not assigned." });
    res.status(201).json({ data: await createLead(rep.code, req.body) });
  } catch (err) { next(err); }
});

// PATCH /api/sr/leads/:id
srRouter.patch("/leads/:id", authenticate, requireRole("sales_rep"), validate(updateLeadSchema), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.status(403).json({ error: "Rep code not assigned." });
    res.json({ data: await updateLead(rep.code, req.params.id, req.body) });
  } catch (err) { next(err); }
});

// DELETE /api/sr/leads/:id
srRouter.delete("/leads/:id", authenticate, requireRole("sales_rep"), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.status(403).json({ error: "Rep code not assigned." });
    res.json({ data: await deleteLead(rep.code, req.params.id) });
  } catch (err) { next(err); }
});

// ── SR targets ────────────────────────────────────────────────────────────────

// GET /api/sr/targets
srRouter.get("/targets", authenticate, requireRole("sales_rep"), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.json({ data: { srCode: "", period: "", gmvTarget: 0, referralTarget: 0 } });
    res.json({ data: await getTargets(rep.code, req.query.period) });
  } catch (err) { next(err); }
});

// PUT /api/sr/targets
srRouter.put("/targets", authenticate, requireRole("sales_rep"), validate(srTargetsSchema), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.status(403).json({ error: "Rep code not assigned." });
    res.json({ data: await setTargets(rep.code, req.body) });
  } catch (err) { next(err); }
});

// ── CSV report ────────────────────────────────────────────────────────────────

// GET /api/sr/report
srRouter.get("/report", authenticate, requireRole("sales_rep"), async (req, res, next) => {
  try {
    const { rep } = await findUserAndRep(req.user.sub);
    if (!rep?.code) return res.status(403).json({ error: "Rep code not assigned." });
    const { from, to } = req.query;
    const csv = await exportSRReport(rep.code, { from, to });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="sr-report-${rep.code}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});
