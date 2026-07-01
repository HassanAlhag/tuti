import { z } from "zod";
import { nanoid } from "nanoid";
import { env } from "../../config/env.js";
import { escapeRegex } from "../../shared/regex.js";
import { Lead } from "../../models/Lead.js";
import { SRTarget } from "../../models/SRTarget.js";
import { SellerReferral } from "../../models/SellerReferral.js";
import { CommissionEntry } from "../../models/CommissionEntry.js";
import { seedRepository } from "../../repositories/seedRepository.js";

// ── Seed-mode in-memory stores ───────────────────────────────────────────────

const seedLeads = [];
const seedTargets = [];

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  businessName: z.string().min(1).max(200).trim(),
  contactName:  z.string().max(200).trim().optional().default(""),
  phone:        z.string().max(50).trim().optional().default(""),
  city:         z.string().max(100).trim().optional().default(""),
  status:       z.enum(["new", "contacted", "interested", "followup", "converted", "lost"]).optional().default("new"),
  followUpAt:   z.coerce.date().nullable().optional(),
  note:         z.string().max(1000).optional(),
});

export const updateLeadSchema = z.object({
  businessName: z.string().min(1).max(200).trim().optional(),
  contactName:  z.string().max(200).trim().optional(),
  phone:        z.string().max(50).trim().optional(),
  city:         z.string().max(100).trim().optional(),
  status:       z.enum(["new", "contacted", "interested", "followup", "converted", "lost"]).optional(),
  followUpAt:   z.coerce.date().nullable().optional(),
  note:         z.string().max(1000).optional(),
});

export const srTargetsSchema = z.object({
  period:         z.string().regex(/^\d{4}-\d{2}$/).optional(),
  gmvTarget:      z.coerce.number().min(0).optional().default(0),
  referralTarget: z.coerce.number().int().min(0).optional().default(0),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function leadToObject(lead) {
  const obj = lead.toObject ? lead.toObject() : lead;
  return {
    id:           obj.id || obj._id?.toString(),
    srCode:       obj.srCode,
    businessName: obj.businessName,
    contactName:  obj.contactName || "",
    phone:        obj.phone || "",
    city:         obj.city || "",
    status:       obj.status,
    followUpAt:   obj.followUpAt || null,
    notes:        Array.isArray(obj.notes) ? obj.notes.map((n) => ({
      id: n._id?.toString() || n.id,
      body: n.body,
      createdAt: n.createdAt,
    })) : [],
    createdAt:    obj.createdAt,
    updatedAt:    obj.updatedAt,
  };
}

function targetToObject(t) {
  return {
    id:             t.id || t._id?.toString(),
    srCode:         t.srCode,
    period:         t.period,
    gmvTarget:      t.gmvTarget || 0,
    referralTarget: t.referralTarget || 0,
  };
}

// ── CRUD: leads ───────────────────────────────────────────────────────────────

export async function listLeads(srCode, { status, search, page = 1, limit = 50 } = {}) {
  const safePage  = Math.max(1, Number(page)  || 1);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 100);

  if (env.mongoUri) {
    const query = { srCode };
    if (status) query.status = status;
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      query.$or = [{ businessName: re }, { contactName: re }, { city: re }, { phone: re }];
    }
    const skip = (safePage - 1) * safeLimit;
    const [leads, total] = await Promise.all([
      Lead.find(query).sort({ followUpAt: 1, createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Lead.countDocuments(query),
    ]);
    return { leads: leads.map(leadToObject), total, page: safePage, limit: safeLimit };
  }

  let results = seedLeads.filter((l) => l.srCode === srCode);
  if (status) results = results.filter((l) => l.status === status);
  if (search) {
    const q = search.toLowerCase();
    results = results.filter((l) =>
      [l.businessName, l.contactName, l.city, l.phone].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  results = [...results].sort((a, b) => {
    if (a.followUpAt && b.followUpAt) return new Date(a.followUpAt) - new Date(b.followUpAt);
    if (a.followUpAt) return -1;
    if (b.followUpAt) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const skip = (safePage - 1) * safeLimit;
  return { leads: results.slice(skip, skip + safeLimit), total: results.length, page: safePage, limit: safeLimit };
}

export async function createLead(srCode, data) {
  const parsed = createLeadSchema.parse(data);
  const now = new Date();
  const notes = parsed.note
    ? [{ id: nanoid(), body: parsed.note, createdAt: now }]
    : [];

  if (env.mongoUri) {
    const lead = await Lead.create({
      srCode,
      businessName: parsed.businessName,
      contactName:  parsed.contactName,
      phone:        parsed.phone,
      city:         parsed.city,
      status:       parsed.status,
      followUpAt:   parsed.followUpAt ?? null,
      notes,
    });
    return leadToObject(lead);
  }

  const lead = {
    id:           nanoid(),
    srCode,
    businessName: parsed.businessName,
    contactName:  parsed.contactName || "",
    phone:        parsed.phone || "",
    city:         parsed.city || "",
    status:       parsed.status || "new",
    followUpAt:   parsed.followUpAt ?? null,
    notes,
    createdAt:    now,
    updatedAt:    now,
  };
  seedLeads.unshift(lead);
  return lead;
}

export async function updateLead(srCode, leadId, data) {
  const parsed = updateLeadSchema.parse(data);

  if (env.mongoUri) {
    const sets = {};
    if (parsed.businessName !== undefined) sets.businessName = parsed.businessName;
    if (parsed.contactName  !== undefined) sets.contactName  = parsed.contactName;
    if (parsed.phone        !== undefined) sets.phone        = parsed.phone;
    if (parsed.city         !== undefined) sets.city         = parsed.city;
    if (parsed.status       !== undefined) sets.status       = parsed.status;
    if (parsed.followUpAt   !== undefined) sets.followUpAt   = parsed.followUpAt;

    const op = parsed.note
      ? { $set: sets, $push: { notes: { body: parsed.note, createdAt: new Date() } } }
      : { $set: sets };
    const lead = await Lead.findOneAndUpdate({ _id: leadId, srCode }, op, { new: true }).lean();
    if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });
    return leadToObject(lead);
  }

  const lead = seedLeads.find((l) => l.id === leadId && l.srCode === srCode);
  if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });
  if (parsed.businessName !== undefined) lead.businessName = parsed.businessName;
  if (parsed.contactName  !== undefined) lead.contactName  = parsed.contactName;
  if (parsed.phone        !== undefined) lead.phone        = parsed.phone;
  if (parsed.city         !== undefined) lead.city         = parsed.city;
  if (parsed.status       !== undefined) lead.status       = parsed.status;
  if (parsed.followUpAt   !== undefined) lead.followUpAt   = parsed.followUpAt;
  if (parsed.note) lead.notes.unshift({ id: nanoid(), body: parsed.note, createdAt: new Date() });
  lead.updatedAt = new Date();
  return lead;
}

export async function deleteLead(srCode, leadId) {
  if (env.mongoUri) {
    const lead = await Lead.findOneAndDelete({ _id: leadId, srCode });
    if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });
    return { deleted: true };
  }
  const idx = seedLeads.findIndex((l) => l.id === leadId && l.srCode === srCode);
  if (idx === -1) throw Object.assign(new Error("Lead not found."), { status: 404 });
  seedLeads.splice(idx, 1);
  return { deleted: true };
}

// ── Targets ───────────────────────────────────────────────────────────────────

export async function getTargets(srCode, period) {
  const p = period || currentPeriod();

  if (env.mongoUri) {
    const target = await SRTarget.findOne({ srCode, period: p }).lean();
    return target ? targetToObject(target) : { srCode, period: p, gmvTarget: 0, referralTarget: 0 };
  }

  return seedTargets.find((t) => t.srCode === srCode && t.period === p)
    || { srCode, period: p, gmvTarget: 0, referralTarget: 0 };
}

export async function setTargets(srCode, data) {
  const parsed = srTargetsSchema.parse(data);
  const period = parsed.period || currentPeriod();

  if (env.mongoUri) {
    const target = await SRTarget.findOneAndUpdate(
      { srCode, period },
      { $set: { gmvTarget: parsed.gmvTarget, referralTarget: parsed.referralTarget } },
      { upsert: true, new: true }
    ).lean();
    return targetToObject(target);
  }

  const existing = seedTargets.find((t) => t.srCode === srCode && t.period === period);
  if (existing) {
    existing.gmvTarget      = parsed.gmvTarget;
    existing.referralTarget = parsed.referralTarget;
    return existing;
  }
  const target = {
    id: nanoid(), srCode, period,
    gmvTarget: parsed.gmvTarget,
    referralTarget: parsed.referralTarget,
  };
  seedTargets.push(target);
  return target;
}

// ── CSV report ────────────────────────────────────────────────────────────────

function toCsvRow(cells) {
  return cells.map((v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }).join(",");
}

export async function exportSRReport(srCode, { from, to } = {}) {
  const fromDate = from ? new Date(from) : null;
  const toDate   = to   ? new Date(to)   : null;
  const inRange  = (d) => {
    if (!d) return true;
    const dt = new Date(d);
    if (fromDate && dt < fromDate) return false;
    if (toDate   && dt > toDate)   return false;
    return true;
  };

  let referrals, commissions, leads;

  if (env.mongoUri) {
    const rangeFilter = {};
    if (fromDate || toDate) {
      const r = {};
      if (fromDate) r.$gte = fromDate;
      if (toDate)   r.$lte = toDate;
      rangeFilter.createdAt = r;
    }
    [referrals, commissions, leads] = await Promise.all([
      SellerReferral.find({ repCode: srCode, ...rangeFilter }).lean(),
      CommissionEntry.find({ repCode: srCode, ...rangeFilter }).lean(),
      Lead.find({ srCode }).lean(),
    ]);
  } else {
    const state = seedRepository.getState();
    referrals   = (state.sellerReferrals   || []).filter((r) => r.repCode === srCode && inRange(r.createdAt));
    commissions = (state.commissionEntries || []).filter((e) => e.repCode === srCode && inRange(e.createdAt));
    leads       = seedLeads.filter((l) => l.srCode === srCode);
  }

  const lines = [
    "## Referrals",
    toCsvRow(["Shop", "Status", "GMV", "Referred At", "First Sale"]),
    ...referrals.map((r) => toCsvRow([r.shopName || "", r.status || "", r.gmv || 0, r.createdAt, r.firstSaleDate || ""])),
    "",
    "## Commissions",
    toCsvRow(["Type", "Shop", "Amount", "Status", "Date"]),
    ...commissions.map((c) => toCsvRow([c.type || "", c.shop || c.shopName || "", c.amount || 0, c.status || "", c.createdAt])),
    "",
    "## Leads",
    toCsvRow(["Business", "Contact", "Phone", "City", "Status", "Follow-up", "Created"]),
    ...leads.map((l) => toCsvRow([l.businessName, l.contactName || "", l.phone || "", l.city || "", l.status, l.followUpAt || "", l.createdAt])),
  ];

  return lines.join("\n");
}
