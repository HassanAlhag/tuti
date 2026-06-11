import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { Customer } from "../../models/Customer.js";
import { seedRepository } from "../../repositories/seedRepository.js";

export const updateCustomerSchema = z.object({
  segment:       z.string().max(80).optional(),
  status:        z.enum(["Active", "VIP", "Inactive", "Blocked"]).optional(),
  risk:          z.enum(["Low", "Medium", "High"]).optional(),
  tags:          z.array(z.string().max(50)).optional(),
  notes:         z.string().max(2000).optional(),
  loyaltyPoints: z.coerce.number().int().min(0).optional(),
});

export const addCrmNoteSchema = z.object({
  text: z.string().min(1).max(1000),
  type: z.enum(["note", "call", "email", "follow_up", "complaint", "compliment"]).optional().default("note"),
});

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listCrmCustomers({ q = "", segment = "", risk = "", status = "", page = 1, limit = 20 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage  = Math.max(Number(page) || 1, 1);

  if (env.mongoUri) {
    const filter = {};
    if (q) {
      const pattern = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { city: pattern }];
    }
    if (segment) filter.segment = segment;
    if (risk)    filter.risk    = risk;
    if (status)  filter.status  = status;

    const skip = (safePage - 1) * safeLimit;
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Customer.countDocuments(filter),
    ]);
    return { customers, total, page: safePage, pages: Math.max(1, Math.ceil(total / safeLimit)) };
  }

  const normalizedQ = String(q || "").trim().toLowerCase();
  let list = [...(seedRepository.getState().customers || [])];

  if (normalizedQ) {
    list = list.filter((c) =>
      [c.name, c.email, c.phone, c.city, ...(c.tags || [])].join(" ").toLowerCase().includes(normalizedQ)
    );
  }
  if (segment) list = list.filter((c) => c.segment === segment);
  if (risk)    list = list.filter((c) => c.risk === risk);
  if (status)  list = list.filter((c) => c.status === status);

  const total = list.length;
  const start = (safePage - 1) * safeLimit;
  return {
    customers: list.slice(start, start + safeLimit),
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getCrmCustomer(id) {
  if (env.mongoUri) {
    const customer = await Customer.findOne({ id }).lean();
    if (!customer) { const e = new Error("Customer not found."); e.status = 404; throw e; }
    return customer;
  }

  const customer = (seedRepository.getState().customers || []).find((c) => c.id === id);
  if (!customer) { const e = new Error("Customer not found."); e.status = 404; throw e; }
  return customer;
}

export async function updateCrmCustomer(id, rawPayload) {
  const parsed = updateCustomerSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid customer update: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }

  if (env.mongoUri) {
    const customer = await Customer.findOneAndUpdate({ id }, { $set: parsed.data }, { returnDocument: "after" }).lean();
    if (!customer) { const e = new Error("Customer not found."); e.status = 404; throw e; }
    return customer;
  }

  const customer = (seedRepository.getState().customers || []).find((c) => c.id === id);
  if (!customer) { const e = new Error("Customer not found."); e.status = 404; throw e; }
  Object.assign(customer, parsed.data);
  return customer;
}

export async function addCrmNote(customerId, rawPayload, user) {
  const parsed = addCrmNoteSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid note: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }

  const note = {
    id:        `cnote-${randomUUID().slice(0, 8)}`,
    text:      parsed.data.text.trim(),
    type:      parsed.data.type,
    by:        user?.name || user?.email || user?.sub || "admin",
    role:      user?.role || "admin",
    createdAt: new Date().toISOString(),
  };

  if (env.mongoUri) {
    const customer = await Customer.findOneAndUpdate(
      { id: customerId },
      { $push: { crmNotes: { $each: [note], $position: 0 } } },
      { returnDocument: "after" }
    ).lean();
    if (!customer) { const e = new Error("Customer not found."); e.status = 404; throw e; }
    return customer;
  }

  const customer = (seedRepository.getState().customers || []).find((c) => c.id === customerId);
  if (!customer) { const e = new Error("Customer not found."); e.status = 404; throw e; }
  if (!Array.isArray(customer.crmNotes)) customer.crmNotes = [];
  customer.crmNotes.unshift(note);
  return customer;
}

export async function deleteCrmNote(customerId, noteId) {
  if (env.mongoUri) {
    const customer = await Customer.findOneAndUpdate(
      { id: customerId },
      { $pull: { crmNotes: { id: noteId } } },
      { returnDocument: "after" }
    ).lean();
    if (!customer) { const e = new Error("Customer not found."); e.status = 404; throw e; }
    return customer;
  }

  const customer = (seedRepository.getState().customers || []).find((c) => c.id === customerId);
  if (!customer) { const e = new Error("Customer not found."); e.status = 404; throw e; }
  customer.crmNotes = (customer.crmNotes || []).filter((n) => n.id !== noteId);
  return customer;
}
