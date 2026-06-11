import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import {
  APPLICATION_STAGES,
  CHECKLIST_KEYS,
  CONTRACT_STATUSES,
  SellerApplication,
  emptyChecklist,
} from "../../models/SellerApplication.js";
import { Shop } from "../../models/Shop.js";
import { User } from "../../models/User.js";
import { normalizePermissions } from "../users/user.roles.js";
import { seedRepository } from "../../repositories/seedRepository.js";

// ── Seed data ─────────────────────────────────────────────────────────
const SEED_APPLICATIONS = [
  {
    id:             "app-001",
    businessName:   "Layla Oud Perfumes",
    contactName:    "Layla Al-Hassan",
    email:          "layla@laylaoud.ae",
    phone:          "+971 50 111 2233",
    whatsapp:       "+971 50 111 2233",
    city:           "Dubai",
    area:           "Jumeirah",
    category:       "perfume",
    instagram:      "@laylaoud",
    website:        "",
    expectedProductCount: 25,
    deliveryMethod: "seller_delivery",
    codHandling:    "Driver collects cash",
    commissionPlan: "Standard",
    proposedCommissionRate: 12,
    payoutTerms:    "Weekly",
    applicationStage: "Agreement Sent",
    contractStatus: "Sent",
    riskLevel:      "Low",
    assignedTo:     "admin",
    salesRepCode:   "",
    nextFollowUpAt: null,
    checklist:      {
      businessProof:       { completed: true,  completedAt: new Date("2025-11-01"), completedBy: "admin", note: "Trade licence received" },
      ownerId:             { completed: true,  completedAt: new Date("2025-11-01"), completedBy: "admin", note: "Emirates ID verified" },
      productSamples:      { completed: true,  completedAt: new Date("2025-11-05"), completedBy: "admin", note: "3 samples reviewed" },
      priceList:           { completed: true,  completedAt: new Date("2025-11-03"), completedBy: "admin", note: "" },
      deliveryCoverage:    { completed: true,  completedAt: new Date("2025-11-03"), completedBy: "admin", note: "Dubai + Sharjah" },
      codAgreement:        { completed: true,  completedAt: new Date("2025-11-06"), completedBy: "admin", note: "" },
      returnRefundTerms:   { completed: true,  completedAt: new Date("2025-11-06"), completedBy: "admin", note: "7-day returns agreed" },
      commissionAgreement: { completed: true,  completedAt: new Date("2025-11-07"), completedBy: "admin", note: "12% agreed" },
      payoutTerms:         { completed: true,  completedAt: new Date("2025-11-07"), completedBy: "admin", note: "Weekly payout" },
      contractSigned:      { completed: false, completedAt: null, completedBy: "", note: "" },
      adminApproval:       { completed: false, completedAt: null, completedBy: "", note: "" },
    },
    documents: [
      { id: "doc-001a", type: "Trade Licence", name: "TL-LaylaOud-2025.pdf", url: "", status: "Received", note: "", uploadedAt: new Date("2025-11-01") },
    ],
    notes: [
      { id: "anote-001a", type: "Call", text: "Spoke with Layla. Very professional. Agreed on 12% commission. Contract being prepared.", createdBy: "admin", createdRole: "admin", createdAt: new Date("2025-11-07") },
    ],
    convertedUserId: null,
    convertedShopId: null,
    convertedAt: null,
  },
  {
    id:             "app-002",
    businessName:   "Sweet Dreams Cakes",
    contactName:    "Mariam Khalid",
    email:          "mariam@sweetdreams.ae",
    phone:          "+971 55 900 8877",
    whatsapp:       "+971 55 900 8877",
    city:           "Abu Dhabi",
    area:           "Khalifa City",
    category:       "cake",
    instagram:      "@sweetdreamscakes",
    website:        "sweetdreams.ae",
    expectedProductCount: 10,
    deliveryMethod: "seller_delivery",
    codHandling:    "Accept COD",
    commissionPlan: "Standard",
    proposedCommissionRate: 14,
    payoutTerms:    "Bi-weekly",
    applicationStage: "Documents Requested",
    contractStatus: "Not Started",
    riskLevel:      "Low",
    assignedTo:     "admin",
    salesRepCode:   "",
    nextFollowUpAt: null,
    checklist:      {
      businessProof:       { completed: false, completedAt: null, completedBy: "", note: "Requested via email" },
      ownerId:             { completed: false, completedAt: null, completedBy: "", note: "" },
      productSamples:      { completed: true,  completedAt: new Date("2025-11-10"), completedBy: "admin", note: "Photos received" },
      priceList:           { completed: true,  completedAt: new Date("2025-11-10"), completedBy: "admin", note: "" },
      deliveryCoverage:    { completed: false, completedAt: null, completedBy: "", note: "" },
      codAgreement:        { completed: false, completedAt: null, completedBy: "", note: "" },
      returnRefundTerms:   { completed: false, completedAt: null, completedBy: "", note: "" },
      commissionAgreement: { completed: false, completedAt: null, completedBy: "", note: "" },
      payoutTerms:         { completed: false, completedAt: null, completedBy: "", note: "" },
      contractSigned:      { completed: false, completedAt: null, completedBy: "", note: "" },
      adminApproval:       { completed: false, completedAt: null, completedBy: "", note: "" },
    },
    documents: [],
    notes: [
      { id: "anote-002a", type: "Email", text: "Requested trade licence and ID. Waiting for response.", createdBy: "admin", createdRole: "admin", createdAt: new Date("2025-11-10") },
    ],
    convertedUserId: null,
    convertedShopId: null,
    convertedAt: null,
  },
  {
    id:             "app-003",
    businessName:   "Oud Palace",
    contactName:    "Faisal Al-Mansoori",
    email:          "faisal@oudpalace.com",
    phone:          "+971 56 333 4455",
    whatsapp:       "+971 56 333 4455",
    city:           "Sharjah",
    area:           "Al Qasimia",
    category:       "perfume",
    instagram:      "@oudpalace",
    website:        "",
    expectedProductCount: 40,
    deliveryMethod: "seller_delivery",
    codHandling:    "Driver collects",
    commissionPlan: "Premium",
    proposedCommissionRate: 10,
    payoutTerms:    "Weekly",
    applicationStage: "Submitted",
    contractStatus: "Not Started",
    riskLevel:      "Low",
    assignedTo:     "",
    salesRepCode:   "",
    nextFollowUpAt: null,
    checklist:      emptyChecklist(),
    documents: [],
    notes: [],
    convertedUserId: null,
    convertedShopId: null,
    convertedAt: null,
  },
];

// Module-level seed Map (consistent with drivers.service.js pattern)
const seedApplications = new Map(SEED_APPLICATIONS.map((a) => [a.id, { ...a }]));

function getSeedApplications() {
  return [...seedApplications.values()];
}

// ── Zod schemas ───────────────────────────────────────────────────────

const CATEGORY_VALUES = ["perfume", "cake", "dessert", "gift_box", "mixed", "other"];
const DELIVERY_VALUES = ["seller_delivery", "pickup", "platform_later", ""];

export const createApplicationSchema = z.object({
  businessName:          z.string().min(2).max(120).trim(),
  contactName:           z.string().min(2).max(100).trim(),
  email:                 z.string().email().toLowerCase().trim().optional().default(""),
  phone:                 z.string().max(30).optional().default(""),
  whatsapp:              z.string().max(30).optional().default(""),
  city:                  z.string().min(1).max(80).trim(),
  area:                  z.string().max(80).optional().default(""),
  category:              z.enum(CATEGORY_VALUES).default("mixed"),
  instagram:             z.string().max(80).optional().default(""),
  website:               z.string().max(200).optional().default(""),
  expectedProductCount:  z.coerce.number().int().min(0).optional().default(0),
  deliveryMethod:        z.enum(DELIVERY_VALUES).optional().default(""),
  codHandling:           z.string().max(200).optional().default(""),
  commissionPlan:        z.string().max(100).optional().default(""),
  proposedCommissionRate:z.coerce.number().min(0).max(50).optional().default(null),
  payoutTerms:           z.string().max(200).optional().default(""),
  salesRepCode:          z.string().max(40).optional().default(""),
}).refine(
  (d) => Boolean(d.phone || d.email),
  { message: "At least one of phone or email is required.", path: ["phone"] }
);

export const updateApplicationSchema = z.object({
  businessName:          z.string().min(2).max(120).trim().optional(),
  contactName:           z.string().min(2).max(100).trim().optional(),
  email:                 z.string().email().toLowerCase().trim().optional(),
  phone:                 z.string().max(30).optional(),
  whatsapp:              z.string().max(30).optional(),
  city:                  z.string().min(1).max(80).trim().optional(),
  area:                  z.string().max(80).optional(),
  category:              z.enum(CATEGORY_VALUES).optional(),
  instagram:             z.string().max(80).optional(),
  website:               z.string().max(200).optional(),
  expectedProductCount:  z.coerce.number().int().min(0).optional(),
  deliveryMethod:        z.enum(DELIVERY_VALUES).optional(),
  codHandling:           z.string().max(200).optional(),
  commissionPlan:        z.string().max(100).optional(),
  proposedCommissionRate:z.coerce.number().min(0).max(50).nullable().optional(),
  payoutTerms:           z.string().max(200).optional(),
  applicationStage:      z.enum(APPLICATION_STAGES).optional(),
  contractStatus:        z.enum(CONTRACT_STATUSES).optional(),
  riskLevel:             z.enum(["Low", "Medium", "High"]).optional(),
  assignedTo:            z.string().max(100).optional(),
  salesRepCode:          z.string().max(40).optional(),
  nextFollowUpAt:        z.string().datetime({ offset: true }).nullable().optional(),
});

export const addNoteSchema = z.object({
  type: z.enum(["Note", "Call", "Email", "Follow-up", "Contract", "Document", "Risk"]).default("Note"),
  text: z.string().min(1).max(2000),
});

export const updateChecklistSchema = z.object({
  key:         z.enum(CHECKLIST_KEYS),
  completed:   z.coerce.boolean(),
  completedBy: z.string().max(100).optional().default(""),
  note:        z.string().max(500).optional().default(""),
});

// ── Helpers ───────────────────────────────────────────────────────────

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertFound(app, id) {
  if (app) return;
  const e = new Error(`Seller application not found: ${id}`); e.status = 404; throw e;
}

// ── Service functions ─────────────────────────────────────────────────

export async function createApplication(rawPayload) {
  const parsed = createApplicationSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid application: " + parsed.error.issues.map((i) => i.message).join("; "));
    e.status = 422;
    throw e;
  }

  const app = {
    id:                    `app-${randomUUID().slice(0, 8)}`,
    businessName:          parsed.data.businessName,
    contactName:           parsed.data.contactName,
    email:                 parsed.data.email,
    phone:                 parsed.data.phone,
    whatsapp:              parsed.data.whatsapp,
    city:                  parsed.data.city,
    area:                  parsed.data.area,
    category:              parsed.data.category,
    instagram:             parsed.data.instagram,
    website:               parsed.data.website,
    expectedProductCount:  parsed.data.expectedProductCount,
    deliveryMethod:        parsed.data.deliveryMethod,
    codHandling:           parsed.data.codHandling,
    commissionPlan:        parsed.data.commissionPlan,
    proposedCommissionRate:parsed.data.proposedCommissionRate,
    payoutTerms:           parsed.data.payoutTerms,
    applicationStage:      "Submitted",
    contractStatus:        "Not Started",
    riskLevel:             "Low",
    assignedTo:            "",
    salesRepCode:          parsed.data.salesRepCode,
    nextFollowUpAt:        null,
    checklist:             emptyChecklist(),
    documents:             [],
    notes:                 [],
    convertedUserId:       null,
    convertedShopId:       null,
    convertedAt:           null,
  };

  if (env.mongoUri) {
    const doc = await SellerApplication.create(app);
    return doc.toObject();
  }

  seedApplications.set(app.id, app);
  return app;
}

export async function listApplications({
  q = "", stage = "", risk = "", category = "", page = 1, limit = 20,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage  = Math.max(Number(page) || 1, 1);

  if (env.mongoUri) {
    const filter = {};
    if (q) {
      const pattern = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { businessName: pattern },
        { contactName:  pattern },
        { email:        pattern },
        { phone:        pattern },
        { city:         pattern },
      ];
    }
    if (stage)    filter.applicationStage = stage;
    if (risk)     filter.riskLevel        = risk;
    if (category) filter.category         = category;

    const skip = (safePage - 1) * safeLimit;
    const [applications, total] = await Promise.all([
      SellerApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      SellerApplication.countDocuments(filter),
    ]);
    return { applications, total, page: safePage, pages: Math.max(1, Math.ceil(total / safeLimit)) };
  }

  const normalizedQ = String(q || "").trim().toLowerCase();
  let list = getSeedApplications();

  if (normalizedQ) {
    list = list.filter((a) =>
      [a.businessName, a.contactName, a.email, a.phone, a.city].join(" ").toLowerCase().includes(normalizedQ)
    );
  }
  if (stage)    list = list.filter((a) => a.applicationStage === stage);
  if (risk)     list = list.filter((a) => a.riskLevel === risk);
  if (category) list = list.filter((a) => a.category === category);

  const total = list.length;
  const start = (safePage - 1) * safeLimit;
  return {
    applications: list.slice(start, start + safeLimit),
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getApplication(id) {
  if (env.mongoUri) {
    const app = await SellerApplication.findOne({ id }).lean();
    assertFound(app, id);
    return app;
  }
  const app = seedApplications.get(id);
  assertFound(app, id);
  return app;
}

export async function updateApplication(id, rawPayload) {
  const parsed = updateApplicationSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid update: " + parsed.error.issues.map((i) => i.message).join("; "));
    e.status = 422;
    throw e;
  }

  if (env.mongoUri) {
    const app = await SellerApplication.findOneAndUpdate(
      { id },
      { $set: parsed.data },
      { returnDocument: "after" }
    ).lean();
    assertFound(app, id);
    return app;
  }

  const app = seedApplications.get(id);
  assertFound(app, id);
  Object.assign(app, parsed.data);
  return app;
}

export async function addNote(id, rawPayload, user) {
  const parsed = addNoteSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid note: " + parsed.error.issues.map((i) => i.message).join("; "));
    e.status = 422;
    throw e;
  }

  const note = {
    id:          `anote-${randomUUID().slice(0, 8)}`,
    type:        parsed.data.type,
    text:        parsed.data.text.trim(),
    createdBy:   user?.name || user?.email || user?.sub || "admin",
    createdRole: user?.role || "admin",
    createdAt:   new Date().toISOString(),
  };

  if (env.mongoUri) {
    const app = await SellerApplication.findOneAndUpdate(
      { id },
      { $push: { notes: { $each: [note], $position: 0 } } },
      { returnDocument: "after" }
    ).lean();
    assertFound(app, id);
    return app;
  }

  const app = seedApplications.get(id);
  assertFound(app, id);
  if (!Array.isArray(app.notes)) app.notes = [];
  app.notes.unshift(note);
  return app;
}

export async function deleteNote(applicationId, noteId) {
  if (env.mongoUri) {
    const app = await SellerApplication.findOneAndUpdate(
      { id: applicationId },
      { $pull: { notes: { id: noteId } } },
      { returnDocument: "after" }
    ).lean();
    assertFound(app, applicationId);
    return app;
  }

  const app = seedApplications.get(applicationId);
  assertFound(app, applicationId);
  app.notes = (app.notes || []).filter((n) => n.id !== noteId);
  return app;
}

export async function updateChecklist(applicationId, rawPayload, user) {
  const parsed = updateChecklistSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid checklist update: " + parsed.error.issues.map((i) => i.message).join("; "));
    e.status = 422;
    throw e;
  }

  const { key, completed, completedBy, note } = parsed.data;
  const actor = completedBy || user?.name || user?.email || user?.sub || "admin";
  const item  = {
    completed,
    completedAt: completed ? new Date() : null,
    completedBy: completed ? actor : "",
    note:        note || "",
  };

  if (env.mongoUri) {
    const app = await SellerApplication.findOneAndUpdate(
      { id: applicationId },
      { $set: { [`checklist.${key}`]: item } },
      { returnDocument: "after" }
    ).lean();
    assertFound(app, applicationId);
    return app;
  }

  const app = seedApplications.get(applicationId);
  assertFound(app, applicationId);
  if (!app.checklist) app.checklist = emptyChecklist();
  app.checklist[key] = item;
  return app;
}

// ── Convert to Seller ─────────────────────────────────────────────────
// Phase 1 foundation: creates the seller User + Shop from application data.
// The caller receives a temp password that must be shared securely with the seller.
// The existing /auth/register flow is NOT changed.

const CONVERSION_ALLOWED_STAGES = new Set(["Agreement Signed", "Approved for Onboarding"]);
const CONVERSION_REQUIRED_CHECKS = ["contractSigned", "adminApproval"];

export async function convertToSeller(applicationId, user) {
  const app = await getApplication(applicationId);

  if (!CONVERSION_ALLOWED_STAGES.has(app.applicationStage)) {
    const e = new Error(
      `Application must be in "Agreement Signed" or "Approved for Onboarding" before conversion. Current stage: ${app.applicationStage}.`
    );
    e.status = 409;
    throw e;
  }

  if (app.convertedAt) {
    const e = new Error("This application has already been converted to a seller.");
    e.status = 409;
    throw e;
  }

  const missingChecks = CONVERSION_REQUIRED_CHECKS.filter(
    (k) => !app.checklist?.[k]?.completed
  );
  if (missingChecks.length) {
    const e = new Error(`Checklist items required before conversion: ${missingChecks.join(", ")}.`);
    e.status = 409;
    throw e;
  }

  // Build seller registration payload from application data
  const shopName  = app.businessName;
  const shopCity  = app.city;
  const shopStory = `${app.businessName} — verified Tuti seller.`;
  const category  = app.category === "other" || app.category === "mixed" ? "mixed" : app.category;
  const tempPassword = `Tuti-${randomUUID().slice(0, 10)}`;

  if (!app.email) {
    const e = new Error("Application must have an email address to create a seller account.");
    e.status = 409;
    throw e;
  }

  if (env.mongoUri) {
    // Check for existing user
    const existing = await User.findOne({ email: app.email }).lean();
    if (existing) {
      const e = new Error(`A user account already exists for email: ${app.email}.`);
      e.status = 409;
      throw e;
    }

    const shopIdSlug = String(shopName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42) || "seller-shop";
    const shopId = `shop-${shopIdSlug}-${randomUUID().slice(0, 5)}`;

    const newUser = await User.create({
      name:           app.contactName,
      email:          app.email,
      password:       tempPassword,
      role:           "seller",
      shopId,
      shopCategory:   category,
      shopCategories: [category],
      permissions:    normalizePermissions("seller"),
    });

    const now = new Date();
    await Shop.create({
      id:              shopId,
      name:            shopName,
      owner:           app.contactName,
      ownerId:         newUser._id,
      city:            shopCity,
      status:          "Pending review",
      fulfillmentRate: 0,
      disputeRate:     0,
      serviceRating:   0,
      payoutHoldDays:  7,
      commissionRate:  app.proposedCommissionRate ?? 14,
      pendingBalance:  0,
      avatar:          app.contactName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
      story:           shopStory,
      cover:           shopName,
      category,
      categories:      [category],
      deliveryModel:   app.deliveryMethod || "seller_delivery",
      onboardingStep:  "Admin review",
      repCode:         app.salesRepCode || "",
      acquisitionSource:         app.salesRepCode ? "sales_rep" : "organic",
      sellerApplicationId:       applicationId,
      applicationContractStatus: "Signed",
      applicationConvertedAt:    now,
      applicationBusinessName:   app.businessName,
    });
    const updated = await SellerApplication.findOneAndUpdate(
      { id: applicationId },
      {
        $set: {
          applicationStage: "Converted to Seller",
          contractStatus:   "Signed",
          convertedUserId:  newUser._id.toString(),
          convertedShopId:  shopId,
          convertedAt:      now,
        },
      },
      { returnDocument: "after" }
    ).lean();

    return {
      application:  updated,
      shopId,
      userId:       newUser._id.toString(),
      tempPassword,
      note:         "Seller account created. Share the temp password securely. The seller must change it on first login.",
    };
  }

  // Seed mode
  const state = seedRepository.getState();
  if ((state.sellerApplicationSeedUsers || []).some((u) => u.email === app.email)) {
    const e = new Error(`A user account already exists for email: ${app.email}.`);
    e.status = 409;
    throw e;
  }

  const shopIdSlug = String(shopName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "seller-shop";
  const shopId = `shop-${shopIdSlug}-${randomUUID().slice(0, 5)}`;
  const userId = randomUUID();

  const nowSeed = new Date().toISOString();
  const newShop = {
    id:              shopId,
    name:            shopName,
    owner:           app.contactName,
    ownerId:         userId,
    city:            shopCity,
    status:          "Pending review",
    fulfillmentRate: 0,
    disputeRate:     0,
    serviceRating:   0,
    payoutHoldDays:  7,
    commissionRate:  app.proposedCommissionRate ?? 14,
    pendingBalance:  0,
    avatar:          app.contactName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
    story:           shopStory,
    cover:           shopName,
    category,
    categories:      [category],
    deliveryModel:   app.deliveryMethod || "seller_delivery",
    onboardingStep:  "Admin review",
    repCode:         app.salesRepCode || "",
    acquisitionSource:         app.salesRepCode ? "sales_rep" : "organic",
    sellerApplicationId:       applicationId,
    applicationContractStatus: "Signed",
    applicationConvertedAt:    nowSeed,
    applicationBusinessName:   app.businessName,
  };
  seedRepository.addShop(newShop);

  // Track converted user in a seed-mode side-list (not persisted across restarts)
  state.sellerApplicationSeedUsers = state.sellerApplicationSeedUsers || [];
  state.sellerApplicationSeedUsers.unshift({ id: userId, email: app.email, shopId });

  Object.assign(app, {
    applicationStage: "Converted to Seller",
    contractStatus:   "Signed",
    convertedUserId:  userId,
    convertedShopId:  shopId,
    convertedAt:      nowSeed,
  });

  return {
    application:  app,
    shopId,
    userId,
    tempPassword,
    note:         "Seller account created (seed mode). Share the temp password securely. The seller must change it on first login.",
  };
}
