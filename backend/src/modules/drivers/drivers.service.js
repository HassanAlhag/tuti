import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { env } from "../../config/env.js";
import { Driver } from "../../models/Driver.js";
import { DeliveryOffer } from "../../models/DeliveryOffer.js";
import { DeliveryAttempt } from "../../models/DeliveryAttempt.js";
import { createNotificationsForRole } from "../notifications/notifications.service.js";
import { Shop } from "../../models/Shop.js";
import { Order } from "../../models/Order.js";
import { createDriverLoginAccount, deleteDriverLoginAccount } from "../auth/auth.service.js";
import { accrueDeliveredOrderCommissions } from "../orders/orderCommissions.js";
import { recordDeliveryEarning } from "../finance/sellerBalance.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { getSeedOrders } from "../orders/orders.service.js";
import { assertOwnedMediaAssets } from "../media/media.service.js";
import { logAuditEvent } from "../audit/audit.service.js";
import {
  DELIVERY_FAILURE_REASON_CODES,
  getDeliveryFailureReasonPolicy,
  isKnownDeliveryFailureReason,
  resolveNextAction,
  getCustomerSafeFailureMessage,
  MAX_DELIVERY_ATTEMPTS,
} from "../../shared/deliveryFailurePolicy.js";
import {
  isFailableAssignmentStatus,
  assertAssignmentTransition,
} from "../../shared/workflows/deliveryAssignmentWorkflow.js";
import { assertDriverEligibleForShop } from "./driverEligibility.js";
import {
  findDriverShopAccess,
  listActiveShopIdsForDriver,
  listDriverShopAccessForShop,
  listDriverShopAccessForDriver,
  listPendingDriverShopAccessRequests,
  requestDriverShopAccess,
  adminCreateApprovedAccess,
  approveDriverShopAccess,
  rejectDriverShopAccess,
  reactivateDriverShopAccess,
  suspendDriverShopAccess,
  revokeDriverShopAccess,
  cancelPendingDriverShopAccessRequest,
  getDriverShopAccessById,
} from "./driverShopAccess.service.js";
import { normalizePhone, normalizeEmail } from "../../shared/normalizeContact.js";
import { computeNormalizedContactFields, findDriverByContactInList, findDriverByContactMongo } from "./driverDirectory.js";
import { getShopDriverCodSummary, recordCodCollection } from "../finance/driverCashLedger.js";

// Re-exported so routes/tests have one import surface for the driver
// module, same convention as everything else in this file.
export {
  approveDriverShopAccess,
  rejectDriverShopAccess,
  reactivateDriverShopAccess,
  adminCreateApprovedAccess,
  suspendDriverShopAccess as adminSuspendDriverShopAccess,
  revokeDriverShopAccess as adminRevokeDriverShopAccess,
  listPendingDriverShopAccessRequests,
  listDriverShopAccessForShop,
  listDriverShopAccessForDriver,
  getDriverShopAccessById,
} from "./driverShopAccess.service.js";
export { __resetDriverShopAccessForTests, __grantActiveAccessForTests } from "./driverShopAccess.service.js";
export { __resetDriverCashLedgerForTests, __getSeedDriverCashTransactionsForTests, getShopDriverCodSummary, getDriverCodSummaryAcrossShops } from "../finance/driverCashLedger.js";

// ── In-memory seed drivers ────────────────────────────────────────────
const SEED_DRIVERS = [
  { id: "drv-001", name: "Mohammed Al-Rashidi", phone: "+971 55 111 2233", email: "drv1@tuti.example", vehicleType: "motorcycle", zone: "Dubai Marina", status: "active", codBalance: 0, totalDeliveries: 42, totalCodCollected: 12600, isActive: true, shopId: null, shopName: "", createdBySellerUserId: null },
  { id: "drv-002", name: "Khalid Bin Hamdan",   phone: "+971 50 987 6543", email: "drv2@tuti.example", vehicleType: "car",        zone: "Downtown Dubai", status: "active", codBalance: 320, totalDeliveries: 28, totalCodCollected: 8400, isActive: true, shopId: null, shopName: "", createdBySellerUserId: null },
  { id: "drv-003", name: "Saeed Al-Mansoori",   phone: "+971 54 222 3344", email: "drv3@tuti.example", vehicleType: "motorcycle", zone: "Jumeirah",       status: "inactive", codBalance: 0, totalDeliveries: 15, totalCodCollected: 4500, isActive: false, shopId: null, shopName: "", createdBySellerUserId: null },
];

const seedDrivers = new Map(SEED_DRIVERS.map((d) => [d.id, { ...d }]));
const seedDeliveryOffers = new Map();
// Immutable delivery-attempt event log (seed mode) -- see models/DeliveryAttempt.js
// for the Mongo-mode equivalent. Array, not a Map, since attempts are
// never looked up by their own id in this module (only ever queried by
// orderId/assignmentId/driverId), and ordering by insertion matters.
const seedDeliveryAttempts = [];

function getSeedDrivers() {
  return [...seedDrivers.values()];
}

function normalizeDriverRecord(driver) {
  if (!driver) return driver;
  return {
    ...driver,
    shopId: driver.shopId ?? null,
    shopName: driver.shopName ?? "",
    createdBySellerUserId: driver.createdBySellerUserId ?? null,
    userId: driver.userId ?? null,
    loginEnabled: driver.loginEnabled ?? false,
    loginEmail: driver.loginEmail ?? "",
  };
}

function getSeedDriver(id) {
  const driver = seedDrivers.get(id);
  return driver ? normalizeDriverRecord(driver) : null;
}

function isDriverEligibleForSellerAssignment(driver) {
  return Boolean(driver) && driver.isActive !== false && driver.status !== "inactive";
}

function getSellerShopIdOrThrow(shopId) {
  if (!shopId) {
    const e = new Error("Seller shop context required.");
    e.status = 403;
    throw e;
  }
  return shopId;
}

function resolveCodAmount(order, payload) {
  const explicitAmount = Number(payload?.codAmount) || 0;
  if (explicitAmount > 0) return explicitAmount;
  const assignmentAmount = Number(order?.driverAssignment?.codAmount) || 0;
  if (assignmentAmount > 0) return assignmentAmount;
  return Number(order?.subtotal) || 0;
}

function normalizeLoginEmail(loginEmail, fallbackEmail = "") {
  return String(loginEmail || fallbackEmail || "").trim().toLowerCase();
}

async function deleteCreatedDriverLoginUser(userId) {
  if (!userId) return;
  await deleteDriverLoginAccount(userId);
}

// `shopId` here is informational only (which shop's dashboard triggered
// this) -- it is NOT used as an ownership filter. The caller is
// responsible for verifying the driver relationship before calling this
// (getSellerDriver / assertDriverEligibleForShop already did that), and
// the resulting login account is intentionally NOT scoped to one shop
// (shopId: null) since a driver's accessible shops are now derived from
// DriverShopAccess, never from a fixed claim baked into their JWT.
async function attachLoginToSellerDriver({ driver, shopId, driverId, name, loginEmail }) {
  const resolvedLoginEmail = normalizeLoginEmail(loginEmail, driver?.loginEmail || driver?.email);
  if (!resolvedLoginEmail) {
    const e = new Error("Login email is required.");
    e.status = 422;
    throw e;
  }
  if (driver?.userId) {
    const e = new Error("Driver already has a linked login.");
    e.status = 409;
    throw e;
  }

  const linked = await createDriverLoginAccount({
    name: name || driver?.name || resolvedLoginEmail,
    loginEmail: resolvedLoginEmail,
    shopId: null,
    driverId: driverId || driver?.id || null,
  });

  if (env.mongoUri) {
    const updated = await Driver.findOneAndUpdate(
      { id: driverId || driver?.id, userId: null },
      { $set: { userId: linked.userId, loginEnabled: true, loginEmail: resolvedLoginEmail } },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      await deleteCreatedDriverLoginUser(linked.userId);
      const e = new Error("Driver not found.");
      e.status = 404;
      throw e;
    }

    return { driver: normalizeDriverRecord(updated), tempPassword: linked.tempPassword, userId: linked.userId, loginEmail: resolvedLoginEmail };
  }

  const seedDriver = seedDrivers.get(driverId || driver?.id);
  if (!seedDriver) {
    await deleteCreatedDriverLoginUser(linked.userId);
    const e = new Error("Driver not found.");
    e.status = 404;
    throw e;
  }
  if (seedDriver.userId) {
    await deleteCreatedDriverLoginUser(linked.userId);
    const e = new Error("Driver already has a linked login.");
    e.status = 409;
    throw e;
  }

  seedDriver.userId = linked.userId;
  seedDriver.loginEnabled = true;
  seedDriver.loginEmail = resolvedLoginEmail;
  return { driver: normalizeDriverRecord(seedDriver), tempPassword: linked.tempPassword, userId: linked.userId, loginEmail: resolvedLoginEmail };
}

// ── Zod schemas ───────────────────────────────────────────────────────
const optionalEmptyEmailSchema = z.union([z.string().email(), z.literal("")]).optional().default("");
const optionalEmptyUrlSchema = z.union([z.string().url().max(1000), z.literal("")]).optional().default("");

export const createDriverSchema = z.object({
  name:        z.string().min(2).max(80).trim(),
  phone:       z.string().min(5).max(30),
  email:       optionalEmptyEmailSchema,
  vehicleType: z.enum(["motorcycle", "car", "van"]).default("motorcycle"),
  zone:        z.string().max(80).optional().default(""),
  createLogin: z.coerce.boolean().optional().default(false),
  loginEmail:  z.union([z.string().email(), z.literal("")]).optional().default(""),
});

export const updateDriverSchema = z.object({
  name:        z.string().min(2).max(80).trim().optional(),
  phone:       z.string().min(5).max(30).optional(),
  email:       z.string().email().optional(),
  vehicleType: z.enum(["motorcycle", "car", "van"]).optional(),
  zone:        z.string().max(80).optional(),
  status:      z.enum(["active", "inactive", "on_delivery"]).optional(),
  isActive:    z.coerce.boolean().optional(),
  createLogin: z.coerce.boolean().optional().default(false),
  loginEmail:  z.union([z.string().email(), z.literal("")]).optional().default(""),
});

export const driverDeliverySchema = z.object({
  codCollected:        z.coerce.boolean().default(false),
  codAmount:           z.coerce.number().min(0).default(0),
  note:                z.string().max(500).optional().default(""),
  proofOfDeliveryUrl:  optionalEmptyUrlSchema,
});

export const sellerDriverAssignSchema = z.object({
  force: z.coerce.boolean().optional().default(false),
});

export const searchDriverSchema = z.object({
  phone: z.string().min(3).max(30).optional().default(""),
  email: z.string().max(200).optional().default(""),
}).refine((v) => v.phone || v.email, { message: "phone or email is required" });

export const requestExistingDriverSchema = z.object({
  driverId: z.string().min(1),
});

export const adminAssignDriverToShopsSchema = z.object({
  driverId: z.string().min(1),
  shopIds: z.array(z.string().min(1)).min(1),
  serviceZoneIds: z.array(z.string()).optional(),
  canReceiveBroadcasts: z.coerce.boolean().optional(),
  canBeDirectlyAssigned: z.coerce.boolean().optional(),
});

export const approveDriverShopAccessSchema = z.object({
  serviceZoneIds: z.array(z.string()).optional(),
  canReceiveBroadcasts: z.coerce.boolean().optional(),
  canBeDirectlyAssigned: z.coerce.boolean().optional(),
});

export const rejectDriverShopAccessSchema = z.object({
  reason: z.string().max(500).optional().default(""),
});

export const reportDeliveryFailureSchema = z.object({
  reason: z.enum(DELIVERY_FAILURE_REASON_CODES),
  note: z.string().max(1000).optional().default(""),
  customerReached: z.coerce.boolean().optional().default(false),
  contactAttempts: z.coerce.number().int().min(0).max(20).optional().default(0),
  requestedRetryAt: z.union([z.string().datetime(), z.string().date(), z.literal(""), z.null()]).optional().nullable(),
  evidenceMediaAssetIds: z.array(z.string()).max(10).optional().default([]),
});

export const reassignDeliverySchema = z.object({
  driverId: z.string().min(1),
});

// ── Service functions ─────────────────────────────────────────────────
export async function listDrivers({ status = "", zone = "", page = 1, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage  = Math.max(Number(page) || 1, 1);

  if (env.mongoUri) {
    const filter = {};
    if (status) filter.status = status;
    if (zone)   filter.zone   = new RegExp(zone, "i");
    const skip = (safePage - 1) * safeLimit;
    const [drivers, total] = await Promise.all([
      Driver.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Driver.countDocuments(filter),
    ]);
    return { drivers: drivers.map(normalizeDriverRecord), total, page: safePage, pages: Math.max(1, Math.ceil(total / safeLimit)) };
  }

  let list = getSeedDrivers();
  if (status) list = list.filter((d) => d.status === status);
  if (zone)   list = list.filter((d) => d.zone.toLowerCase().includes(zone.toLowerCase()));
  const total = list.length;
  const start = (safePage - 1) * safeLimit;
  return { drivers: list.slice(start, start + safeLimit).map(normalizeDriverRecord), total, page: safePage, pages: Math.max(1, Math.ceil(total / safeLimit)) };
}

export async function listDriversSnapshot({ status = "", zone = "" } = {}) {
  if (env.mongoUri) {
    const filter = {};
    if (status) filter.status = status;
    if (zone) filter.zone = new RegExp(zone, "i");
    const drivers = await Driver.find(filter).sort({ createdAt: -1 }).lean();
    return { drivers: drivers.map(normalizeDriverRecord), total: drivers.length, page: 1, pages: 1 };
  }

  let list = getSeedDrivers();
  if (status) list = list.filter((d) => d.status === status);
  if (zone) list = list.filter((d) => d.zone.toLowerCase().includes(zone.toLowerCase()));
  return { drivers: list.map(normalizeDriverRecord), total: list.length, page: 1, pages: 1 };
}

export async function getDriver(id) {
  if (env.mongoUri) {
    const driver = await Driver.findOne({ id }).lean();
    if (!driver) { const e = new Error("Driver not found."); e.status = 404; throw e; }
    return normalizeDriverRecord(driver);
  }
  const driver = getSeedDriver(id);
  if (!driver) { const e = new Error("Driver not found."); e.status = 404; throw e; }
  return driver;
}

export async function createDriver(rawPayload) {
  const parsed = createDriverSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid driver payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }
  const { createLogin, loginEmail, ...driverPayload } = parsed.data;

  const driver = {
    id:                `drv-${randomUUID().slice(0, 8)}`,
    name:              driverPayload.name,
    phone:             driverPayload.phone,
    email:             driverPayload.email || "",
    shopId:            null,
    shopName:          "",
    createdBySellerUserId: null,
    vehicleType:       driverPayload.vehicleType,
    zone:              driverPayload.zone || "",
    status:            "active",
    codBalance:        0,
    totalDeliveries:   0,
    totalCodCollected: 0,
    isActive:          true,
  };

  if (env.mongoUri) {
    const doc = await Driver.create(driver);
    return normalizeDriverRecord(doc.toObject());
  }

  seedDrivers.set(driver.id, driver);
  return normalizeDriverRecord(driver);
}

export async function updateDriver(id, rawPayload) {
  const parsed = updateDriverSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid driver update: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }
  const { createLogin, loginEmail, ...driverUpdate } = parsed.data;

  if (env.mongoUri) {
    const driver = await Driver.findOneAndUpdate({ id }, { $set: driverUpdate }, { returnDocument: "after" }).lean();
    if (!driver) { const e = new Error("Driver not found."); e.status = 404; throw e; }
    return normalizeDriverRecord(driver);
  }

  const driver = seedDrivers.get(id);
  if (!driver) { const e = new Error("Driver not found."); e.status = 404; throw e; }
  Object.assign(driver, driverUpdate);
  return normalizeDriverRecord(driver);
}

// ── Shared-driver, multi-shop access (Task 3/4) ─────────────────────────
// A "connected driver" for a shop is a DriverShopAccess row, not a
// Driver.shopId match -- this returns every relationship regardless of
// status (pending/active/suspended/rejected/revoked) with the driver's
// public profile merged in, for the seller's "My Drivers" view.
export async function listSellerDrivers(shopId, { status } = {}) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const accessRows = await listDriverShopAccessForShop(safeShopId, status ? { status } : {});
  if (!accessRows.length) return [];

  const driverIds = accessRows.map((a) => a.driverId);
  const drivers = await loadDriversByIds(driverIds);
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  return accessRows.map((access) => {
    const driver = driverById.get(access.driverId);
    return {
      accessId: access.id,
      driverId: access.driverId,
      status: access.status,
      requestedByType: access.requestedByType,
      approvedAt: access.approvedAt,
      rejectionReason: access.rejectionReason,
      suspendedAt: access.suspendedAt,
      revokedAt: access.revokedAt,
      canReceiveBroadcasts: access.canReceiveBroadcasts,
      canBeDirectlyAssigned: access.canBeDirectlyAssigned,
      createdAt: access.createdAt,
      name: driver?.name || "(driver record missing)",
      phone: driver?.phone || "",
      email: driver?.email || "",
      vehicleType: driver?.vehicleType || "motorcycle",
      zone: driver?.zone || "",
      isActive: driver?.isActive !== false,
      driverGlobalStatus: driver?.status || "active",
      loginEnabled: driver?.loginEnabled || false,
      codBalance: driver?.codBalance || 0,
    };
  });
}

async function loadDriversByIds(driverIds) {
  const ids = uniqueValues(driverIds);
  if (!ids.length) return [];
  if (env.mongoUri) {
    const drivers = await Driver.find({ id: { $in: ids } }).lean();
    return drivers.map(normalizeDriverRecord);
  }
  return ids.map((id) => getSeedDriver(id)).filter(Boolean);
}

async function findDriverByContact({ phone, email }) {
  if (env.mongoUri) return findDriverByContactMongo({ phone, email });
  return findDriverByContactInList(getSeedDrivers(), { phone, email });
}

/**
 * Seller looks up an existing driver by a controlled identifier (phone
 * or email) before requesting them -- never a full driver listing, so a
 * seller can only find a driver they already have real-world contact
 * info for. Returns a minimal public summary, or null.
 */
export async function searchDriverForShop(shopId, { phone, email }) {
  getSellerShopIdOrThrow(shopId);
  const driver = await findDriverByContact({ phone, email });
  if (!driver) return null;
  return {
    driverId: driver.id,
    name: driver.name,
    vehicleType: driver.vehicleType,
    zone: driver.zone || "",
    phoneLast4: String(driver.phone || "").replace(/\D/g, "").slice(-4),
  };
}

export async function requestExistingDriverForShop(shopId, userId, { driverId }) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const driver = await getDriverById(driverId);
  if (!driver) { const e = new Error("Driver not found."); e.status = 404; throw e; }
  const { access, created } = await requestDriverShopAccess({
    driverId,
    shopId: safeShopId,
    requestedByType: "seller",
    requestedByUserId: userId || null,
  });
  if (!created && access.status === "pending_admin_approval") {
    const e = new Error("A request for this driver is already pending admin approval.");
    e.status = 409;
    throw e;
  }
  if (!created && access.status === "active") {
    const e = new Error("This driver is already connected to your shop.");
    e.status = 409;
    throw e;
  }
  return access;
}

/**
 * Invite a driver who may not exist yet -- dedup-checks by normalized
 * phone/email first (Task 3's duplicate-account prevention). If a
 * matching Driver already exists (created by any shop, or by admin), no
 * new Driver record is created: the existing one is linked via a fresh
 * access request instead. Only when no match exists is a brand-new,
 * shop-unowned Driver created.
 */
export async function inviteDriverForShop(shopId, shopName, userId, rawPayload) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const parsed = createDriverSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid driver payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }
  const { createLogin, loginEmail, ...driverPayload } = parsed.data;

  const existingDriver = await findDriverByContact({ phone: driverPayload.phone, email: driverPayload.email });
  if (existingDriver) {
    const access = await requestExistingDriverForShop(safeShopId, userId, { driverId: existingDriver.id });
    return { linkedExistingDriver: true, driver: existingDriver, access };
  }

  const resolvedShopName = await resolveShopName(safeShopId, shopName || "");
  const { normalizedPhone, normalizedEmail } = computeNormalizedContactFields({
    phone: driverPayload.phone,
    email: driverPayload.email,
    loginEmail,
  });

  const driver = {
    id: `drv-${randomUUID().slice(0, 8)}`,
    name: driverPayload.name,
    phone: driverPayload.phone,
    email: driverPayload.email || "",
    normalizedPhone,
    normalizedEmail,
    // Deliberately NOT shopId: safeShopId -- ownership is access-based
    // now. shopId/shopName are left null/empty (legacy fields only).
    shopId: null,
    shopName: "",
    createdBySellerUserId: userId || null,
    vehicleType: driverPayload.vehicleType,
    zone: driverPayload.zone || "",
    status: "active",
    codBalance: 0,
    totalDeliveries: 0,
    totalCodCollected: 0,
    isActive: true,
  };

  let createdDriver;
  if (env.mongoUri) {
    const doc = await Driver.create(driver);
    createdDriver = normalizeDriverRecord(doc.toObject());
  } else {
    seedDrivers.set(driver.id, driver);
    createdDriver = normalizeDriverRecord(driver);
  }

  try {
    let tempPassword = null;
    if (createLogin) {
      const linked = await attachLoginToSellerDriver({
        driver: createdDriver,
        shopId: safeShopId,
        driverId: createdDriver.id,
        name: createdDriver.name,
        loginEmail,
      });
      createdDriver = linked.driver;
      tempPassword = linked.tempPassword;
    }
    const { access } = await requestDriverShopAccess({
      driverId: createdDriver.id,
      shopId: safeShopId,
      requestedByType: "seller",
      requestedByUserId: userId || null,
    });
    return { linkedExistingDriver: false, driver: tempPassword ? { ...createdDriver, tempPassword } : createdDriver, access, shopName: resolvedShopName };
  } catch (error) {
    if (env.mongoUri) await Driver.deleteOne({ id: createdDriver.id });
    else seedDrivers.delete(createdDriver.id);
    throw error;
  }
}

export async function cancelDriverAccessRequest(shopId, accessId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  return cancelPendingDriverShopAccessRequest(accessId, safeShopId);
}

export async function suspendShopDriverAccess(shopId, accessId, userId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  return suspendDriverShopAccess(accessId, userId, { actorRole: "seller", shopId: safeShopId });
}

export async function revokeShopDriverAccessForSeller(shopId, accessId, userId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  return revokeDriverShopAccess(accessId, userId, { actorRole: "seller", shopId: safeShopId });
}

// ── Admin driver-access management (Task 4) ─────────────────────────────

export async function adminAssignDriverToShops(driverId, shopIds, adminUserId, options = {}) {
  const driver = await getDriverById(driverId);
  if (!driver) { const e = new Error("Driver not found."); e.status = 404; throw e; }

  const results = [];
  for (const shopId of uniqueValues(shopIds)) {
    await assertShopExists(shopId);
    const access = await adminCreateApprovedAccess({
      driverId,
      shopId,
      adminUserId,
      serviceZoneIds: options.serviceZoneIds,
      canReceiveBroadcasts: options.canReceiveBroadcasts,
      canBeDirectlyAssigned: options.canBeDirectlyAssigned,
    });
    results.push(access);
  }
  return results;
}

export async function listShopsConnectedToDriver(driverId) {
  const accessRows = await listDriverShopAccessForDriver(driverId);
  const shopIds = uniqueValues(accessRows.map((a) => a.shopId));
  const shopNames = new Map();
  for (const shopId of shopIds) {
    shopNames.set(shopId, await resolveShopName(shopId, shopId));
  }
  return accessRows.map((access) => ({ ...access, shopName: shopNames.get(access.shopId) || access.shopId }));
}

export async function listDriversConnectedToShop(shopId) {
  return listSellerDrivers(shopId);
}

export async function updateSellerDriver(driverId, shopId, rawPayload) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const parsed = updateDriverSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid driver update: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }
  const { createLogin, loginEmail, ...driverUpdate } = parsed.data;
  const access = await findDriverShopAccess(driverId, safeShopId);
  if (!access || access.status !== "active") {
    const e = new Error("Driver not found."); e.status = 404; throw e;
  }

  if (env.mongoUri) {
    const existing = await Driver.findOne({ id: driverId }).lean();
    if (!existing) { const e = new Error("Driver not found."); e.status = 404; throw e; }

    const shouldCreateLogin = Boolean(createLogin);
    if (shouldCreateLogin && existing.userId) {
      const e = new Error("Driver already has a linked login.");
      e.status = 409;
      throw e;
    }

    let linked = null;
    if (shouldCreateLogin) {
      linked = await attachLoginToSellerDriver({
        driver: existing,
        shopId: safeShopId,
        driverId,
        name: driverUpdate.name || existing.name,
        loginEmail: loginEmail || driverUpdate.email || existing.loginEmail || existing.email,
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { id: driverId },
      {
        $set: {
          ...driverUpdate,
          ...(linked ? { userId: linked.userId, loginEnabled: true, loginEmail: linked.loginEmail } : {}),
        },
      },
      { returnDocument: "after" }
    ).lean();
    if (!driver) {
      if (linked?.userId) await deleteCreatedDriverLoginUser(linked.userId);
      const e = new Error("Driver not found.");
      e.status = 404;
      throw e;
    }
    return linked?.tempPassword ? { ...normalizeDriverRecord(driver), tempPassword: linked.tempPassword } : normalizeDriverRecord(driver);
  }

  const driver = seedDrivers.get(driverId);
  if (!driver) {
    const e = new Error("Driver not found.");
    e.status = 404;
    throw e;
  }
  const shouldCreateLogin = Boolean(createLogin);
  if (shouldCreateLogin && driver.userId) {
    const e = new Error("Driver already has a linked login.");
    e.status = 409;
    throw e;
  }
  let linked = null;
  if (shouldCreateLogin) {
    linked = await attachLoginToSellerDriver({
      driver,
      shopId: safeShopId,
      driverId,
      name: driverUpdate.name || driver.name,
      loginEmail: loginEmail || driverUpdate.email || driver.loginEmail || driver.email,
    });
  }
  Object.assign(driver, driverUpdate);
  if (linked) {
    driver.userId = linked.userId;
    driver.loginEnabled = true;
    driver.loginEmail = linked.loginEmail;
  }
  return linked?.tempPassword ? { ...normalizeDriverRecord(driver), tempPassword: linked.tempPassword } : normalizeDriverRecord(driver);
}

export async function createSellerDriverLogin(driverId, shopId, userId, rawPayload = {}) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const payload = typeof rawPayload === "object" && rawPayload ? rawPayload : {};
  const driver = await getSellerDriver(driverId, safeShopId);
  if (!driver) {
    const e = new Error("Driver not found.");
    e.status = 404;
    throw e;
  }
  if (driver.userId) {
    const e = new Error("Driver already has a linked login.");
    e.status = 409;
    throw e;
  }

  const linked = await attachLoginToSellerDriver({
    driver,
    shopId: safeShopId,
    driverId,
    name: driver.name,
    loginEmail: payload.loginEmail || driver.loginEmail || driver.email,
  });

  return { ...linked.driver, tempPassword: linked.tempPassword };
}

async function loadSellerOrder(orderId, shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);

  if (env.mongoUri) {
    const order = await Order.findOne({ orderId, shopIds: safeShopId });
    if (!order) {
      const e = new Error("Order not found.");
      e.status = 404;
      throw e;
    }
    return order;
  }

  const order = getSeedOrders().find((o) => o.orderId === orderId && Array.isArray(o.shopIds) && o.shopIds.includes(safeShopId));
  if (!order) {
    const e = new Error("Order not found.");
    e.status = 404;
    throw e;
  }
  return order;
}

// Resolves a driver ONLY if an active DriverShopAccess exists for
// (driverId, safeShopId) -- replaces the old `Driver.shopId ===
// safeShopId` exclusive-ownership check. A driver shared across shops
// now resolves correctly for every shop it's actively connected to.
async function getSellerDriver(driverId, shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const access = await findDriverShopAccess(driverId, safeShopId);
  if (!access || access.status !== "active") return null;

  if (env.mongoUri) {
    const driver = await Driver.findOne({ id: driverId }).lean();
    return driver ? normalizeDriverRecord(driver) : null;
  }

  const driver = getSeedDriver(driverId);
  return driver || null;
}

async function resolveShopName(shopId, fallback = "") {
  if (!shopId) return fallback;

  if (env.mongoUri) {
    const shop = await Shop.findOne({ id: shopId }).lean();
    return shop?.name || fallback;
  }

  return seedRepository.getShop(shopId)?.name || fallback;
}

async function assertShopExists(shopId) {
  if (!shopId) {
    const e = new Error("Shop ID is required.");
    e.status = 422;
    throw e;
  }
  const shop = env.mongoUri
    ? await Shop.findOne({ id: shopId }).lean()
    : seedRepository.getShop(shopId);
  if (!shop) {
    const e = new Error("Shop not found.");
    e.status = 404;
    throw e;
  }
  return shop;
}

async function resetPreviousDriverIfNeeded(previousDriverId, shopId) {
  if (!previousDriverId) return;

  if (env.mongoUri) {
    const previousDriver = await Driver.findOne({ id: previousDriverId }).lean();
    if (previousDriver && previousDriver.status === "on_delivery") {
      await Driver.findOneAndUpdate({ id: previousDriverId, shopId }, { $set: { status: "active" } });
    }
    return;
  }

  const previousDriver = seedDrivers.get(previousDriverId);
  if (previousDriver && previousDriver.status === "on_delivery") {
    previousDriver.status = "active";
  }
}

export async function assignSellerDriverToOrder(driverId, orderId, shopId, _user, rawPayload = {}) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const parsed = sellerDriverAssignSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid assignment payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }

  const { driver } = await assertDriverEligibleForShop({ driverId, shopId: safeShopId, action: "assign" });

  const order = await loadSellerOrder(orderId, safeShopId);
  if (order.status !== "Ready for Delivery") {
    const e = new Error("Driver can only be assigned to orders that are Ready for Delivery.");
    e.status = 409;
    throw e;
  }

  const existingAssignment = order.driverAssignment;
  if (existingAssignment?.driverId === driverId && !existingAssignment.deliveredAt) {
    return env.mongoUri ? order.toObject() : order;
  }

  if (existingAssignment?.driverId && existingAssignment.driverId !== driverId && !existingAssignment.deliveredAt) {
    if (!parsed.data.force) {
      const e = new Error("Order already has an active driver assignment.");
      e.status = 409;
      throw e;
    }
    await resetPreviousDriverIfNeeded(existingAssignment.driverId, safeShopId);
  }

  const assignment = {
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone,
    assignedAt: new Date(),
    deliveredAt: null,
    codCollected: false,
    codAmount: order.paymentMethod === "cod" ? order.subtotal : 0,
    note: "",
  };

  if (env.mongoUri) {
    const updated = await Order.findOneAndUpdate(
      { orderId, shopIds: safeShopId },
      { $set: { driverAssignment: assignment } },
      { returnDocument: "after" }
    ).lean();
    await Driver.findOneAndUpdate({ id: driver.id, shopId: safeShopId }, { $set: { status: "on_delivery" } });
    return updated;
  }

  order.driverAssignment = {
    ...assignment,
    assignedAt: assignment.assignedAt.toISOString(),
  };
  order.updatedAt = new Date().toISOString();
  driver.status = "on_delivery";
  return order;
}

export async function recordSellerDriverDelivery(driverId, orderId, shopId, rawPayload, user) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const parsed = driverDeliverySchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid delivery payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }

  const now = new Date();
  const driver = await getDriverById(driverId);
  if (!driver) {
    const e = new Error("Driver not found.");
    e.status = 404;
    throw e;
  }

  if (env.mongoUri) {
    const order = await Order.findOne({ orderId, shopIds: safeShopId, "driverAssignment.driverId": driverId }).lean();
    if (!order) {
      const e = new Error("Order not found or not assigned to this driver.");
      e.status = 404;
      throw e;
    }
    if (order.status === "Delivered" || order.driverAssignment?.deliveredAt) {
      const e = new Error("Order is already delivered.");
      e.status = 409;
      throw e;
    }
    const assignmentStatus = inferAssignmentStatus(order.driverAssignment);
    assertAssignmentTransition(assignmentStatus, "completed");
    await assertDriverEligibleForShop({ driverId, shopId: safeShopId, action: "complete" });

    const codCollected = Boolean(parsed.data.codCollected);
    const codAmount = codCollected ? resolveCodAmount(order, parsed.data) : 0;
    const updatedAssignment = {
      ...order.driverAssignment,
      deliveredAt: now,
      codCollected,
      codAmount,
      note: parsed.data.note || "",
      proofOfDeliveryUrl: parsed.data.proofOfDeliveryUrl || "",
    };

    const historyEntry = {
      from: order.status,
      to: "Delivered",
      by: user?.name || user?.sub || "driver",
      role: "driver",
      note: parsed.data.note || null,
      timestamp: now,
    };

    const paymentStatus = codCollected ? "COD collected" : order.paymentStatus;

    const updated = await Order.findOneAndUpdate(
      { orderId, shopIds: safeShopId, "driverAssignment.driverId": driverId },
      {
        $set: { status: "Delivered", paymentStatus, driverAssignment: updatedAssignment },
        $push: { statusHistory: historyEntry },
      },
      { returnDocument: "after" }
    ).lean();

    const codInc = codCollected ? codAmount : 0;
    await Driver.findOneAndUpdate(
      { id: driverId },
      {
        $set: { status: "active" },
        $inc: { totalDeliveries: 1, codBalance: codInc, totalCodCollected: codInc },
      }
    );
    if (codCollected && codAmount > 0) {
      await recordCodCollection({
        driverId, shopId: safeShopId, orderId, assignmentId: order.driverAssignment?.id || null,
        amount: codAmount, recordedByUserId: user?.sub || null,
      });
    }
    await accrueDeliveredOrderCommissions(updated);
    await recordDeliveryEarning(updated);
    await notifyDeliveryCompleted(updated, { name: updated?.driverAssignment?.driverName || "driver" }, safeShopId);
    return updated;
  }

  const order = getSeedOrders().find((o) => o.orderId === orderId && o.shopIds?.includes(safeShopId) && o.driverAssignment?.driverId === driverId);
  if (!order) {
    const e = new Error("Order not found or not assigned to this driver.");
    e.status = 404;
    throw e;
  }
  if (order.status === "Delivered" || order.driverAssignment?.deliveredAt) {
    const e = new Error("Order is already delivered.");
    e.status = 409;
    throw e;
  }
  const assignmentStatus = inferAssignmentStatus(order.driverAssignment);
  assertAssignmentTransition(assignmentStatus, "completed");
  await assertDriverEligibleForShop({ driverId, shopId: safeShopId, action: "complete" });

  const codCollected = Boolean(parsed.data.codCollected);
  const codAmount = codCollected ? resolveCodAmount(order, parsed.data) : 0;

  order.driverAssignment = {
    ...order.driverAssignment,
    deliveredAt: now.toISOString(),
    codCollected,
    codAmount,
    note: parsed.data.note || "",
    proofOfDeliveryUrl: parsed.data.proofOfDeliveryUrl || "",
  };

  const historyEntry = {
    from: order.status,
    to: "Delivered",
    by: user?.name || user?.sub || "driver",
    role: "driver",
    note: parsed.data.note || null,
    timestamp: now.toISOString(),
  };

  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push(historyEntry);
  order.status = "Delivered";
  if (codCollected) order.paymentStatus = "COD collected";
  order.updatedAt = now.toISOString();

  const seedDriver = seedDrivers.get(driverId);
  if (seedDriver) {
    seedDriver.status = "active";
    seedDriver.totalDeliveries += 1;
    if (codCollected) {
      seedDriver.codBalance += codAmount;
      seedDriver.totalCodCollected += codAmount;
    }
  }
  if (codCollected && codAmount > 0) {
    await recordCodCollection({
      driverId, shopId: safeShopId, orderId, assignmentId: order.driverAssignment?.id || null,
      amount: codAmount, recordedByUserId: user?.sub || null,
    });
  }
  await accrueDeliveredOrderCommissions(order);
  await recordDeliveryEarning(order);
  await notifyDeliveryCompleted(order, { name: order?.driverAssignment?.driverName || "driver" }, safeShopId);
  return order;
}

// ── Finance helpers (used by codSettlement.js) ───────────────────────────────

/**
 * Fetches a single driver by id, regardless of shop.
 * Used by admin COD settlement to read driver codBalance.
 */
export async function getDriverById(driverId) {
  if (env.mongoUri) {
    return Driver.findOne({ id: driverId }).lean();
  }
  return Promise.resolve(normalizeDriverRecord(seedDrivers.get(driverId) || null));
}

/**
 * Decrements driver codBalance by amount, floored at 0.
 * Returns the new balance. Idempotency is managed by the caller
 * (the settlement service validates before calling this).
 */
export async function decrementDriverCodBalance(driverId, amount) {
  if (env.mongoUri) {
    const driver = await Driver.findOne({ id: driverId }).lean();
    const current = driver?.codBalance ?? 0;
    const next = Math.max(0, current - amount);
    await Driver.findOneAndUpdate({ id: driverId }, { $set: { codBalance: next } });
    return next;
  }
  const driver = seedDrivers.get(driverId);
  if (!driver) return null;
  const next = Math.max(0, (driver.codBalance ?? 0) - amount);
  driver.codBalance = next;
  return next;
}

// ── For tests only ────────────────────────────────────────────────────────────

export function __getSeedDriverForTests(driverId) {
  return seedDrivers.get(driverId) || null;
}

export function __resetSeedDriversForTests() {
  seedDrivers.clear();
  for (const d of SEED_DRIVERS) {
    seedDrivers.set(d.id, { ...d });
  }
}

export function __resetSeedDeliveryAttemptsForTests() {
  seedDeliveryAttempts.length = 0;
}

export function __getSeedDeliveryAttemptsForTests(orderId) {
  return seedDeliveryAttempts.filter((a) => a.orderId === orderId);
}

// Seller-safe COD summary: `codBalance`/`totalCodCollected` come from the
// per-shop ledger (finance/driverCashLedger.js), NEVER from
// Driver.codBalance/totalCodCollected -- those are a single number
// shared across every shop a driver serves, so reading them here would
// leak other shops' cash into this shop's reported balance the moment a
// driver is connected to more than one shop.
export async function getSellerDriverCodSummary(shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);

  const accessRows = await listDriverShopAccessForShop(safeShopId, { status: "active" });
  const driverIds = accessRows.map((a) => a.driverId);
  const drivers = await loadDriversByIds(driverIds);
  const ledger = await getShopDriverCodSummary(safeShopId);

  const summary = drivers.reduce(
    (acc, driver) => {
      const normalized = normalizeDriverRecord(driver);
      acc.driverCount += 1;
      acc.activeDrivers += normalized.isActive !== false && normalized.status !== "inactive" ? 1 : 0;
      acc.inactiveDrivers += normalized.isActive === false || normalized.status === "inactive" ? 1 : 0;
      acc.onDeliveryDrivers += normalized.status === "on_delivery" ? 1 : 0;
      // Global stat, not shop-scoped -- a rough indicator only (see
      // report's "remaining risks"). COD figures below ARE shop-scoped.
      acc.totalDeliveries += Number(normalized.totalDeliveries) || 0;
      return acc;
    },
    {
      shopId: safeShopId,
      driverCount: 0,
      activeDrivers: 0,
      inactiveDrivers: 0,
      onDeliveryDrivers: 0,
      totalDeliveries: 0,
      codBalance: ledger.pendingCollected,
      totalCodCollected: ledger.totalCollected,
    }
  );

  return summary;
}

const DELIVERY_OFFER_STATUSES = new Set(["Open", "Accepted", "Expired", "Cancelled"]);

export const createDeliveryOfferSchema = z.object({
  orderId: z.string().min(1),
  deliveryZone: z.string().max(120).optional().default(""),
  deliveryAddressSummary: z.string().max(240).optional().default(""),
  codAmount: z.coerce.number().min(0).optional().default(0),
  expiresAt: z.union([z.string(), z.date()]).optional(),
  notes: z.string().max(500).optional().default(""),
});

function normalizeDeliveryZone(value) {
  return String(value || "").trim();
}

function summarizeDeliveryAddress(value = "") {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function formatAedAmount(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(numeric);
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))];
}

function getOfferExpiry(rawExpiresAt) {
  if (!rawExpiresAt) return new Date(Date.now() + 30 * 60 * 1000);
  const expiresAt = rawExpiresAt instanceof Date ? rawExpiresAt : new Date(rawExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return new Date(Date.now() + 30 * 60 * 1000);
  return expiresAt;
}

function normalizeDeliveryOffer(offer) {
  if (!offer) return null;
  const normalized = typeof offer.toObject === "function" ? offer.toObject() : offer;
  return {
    id: normalized.id,
    orderId: normalized.orderId,
    shopId: normalized.shopId,
    shopName: normalized.shopName || "",
    sellerUserId: normalized.sellerUserId || null,
    deliveryZone: normalized.deliveryZone || "",
    deliveryAddressSummary: normalized.deliveryAddressSummary || "",
    codAmount: Number(normalized.codAmount) || 0,
    status: normalized.status,
    offeredDriverIds: Array.isArray(normalized.offeredDriverIds) ? [...normalized.offeredDriverIds] : [],
    acceptedDriverId: normalized.acceptedDriverId || null,
    acceptedDriverName: normalized.acceptedDriverName || "",
    acceptedAt: normalized.acceptedAt || null,
    expiresAt: normalized.expiresAt || null,
    createdAt: normalized.createdAt || null,
    createdBy: normalized.createdBy || "",
    notes: normalized.notes || "",
  };
}

function normalizeDeliveryOfferForDriver(offer) {
  if (!offer) return null;
  return {
    id: offer.id,
    orderId: offer.orderId,
    shopName: offer.shopName || "",
    deliveryZone: offer.deliveryZone || "",
    deliveryAddressSummary: offer.deliveryAddressSummary || "",
    codAmount: Number(offer.codAmount) || 0,
    status: offer.status,
    expiresAt: offer.expiresAt || null,
    notes: offer.notes || "",
  };
}

function isOfferExpired(offer, now = new Date()) {
  if (!offer?.expiresAt) return false;
  const expiresAt = offer.expiresAt instanceof Date ? offer.expiresAt : new Date(offer.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime();
}

function isOfferOpen(offer, now = new Date()) {
  return offer?.status === "Open" && !isOfferExpired(offer, now);
}

function matchesDriverZone(driverZone, deliveryZone) {
  const driverText = normalizeDeliveryZone(driverZone).toLowerCase();
  const offerText = normalizeDeliveryZone(deliveryZone).toLowerCase();
  if (!offerText) return true;
  return driverText.includes(offerText) || offerText.includes(driverText);
}

function buildOfferHistoryEntry(fromStatus, toStatus, user, note) {
  return {
    from: fromStatus || null,
    to: toStatus,
    by: user?.name || user?.email || user?.sub || "seller",
    role: user?.role || "seller",
    note: note || null,
    timestamp: new Date().toISOString(),
  };
}

function buildDeliveryOfferCreatedMessage(offer) {
  const segments = [`Order ${offer.orderId}`];
  if (offer.deliveryZone) segments.push(`zone ${offer.deliveryZone}`);
  let message = `${segments.join(" · ")} is ready for delivery.`;
  if (Number(offer.codAmount) > 0) {
    message += ` COD AED ${formatAedAmount(offer.codAmount)}.`;
  }
  return message;
}

async function runNotificationTasks(tasks = []) {
  const pending = tasks.filter(Boolean);
  if (!pending.length) return;
  const results = await Promise.allSettled(pending);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[delivery-offer-notification]", result.reason?.message || result.reason);
    }
  }
}

async function resolveDriversByIdsForShop(shopId, driverIds = []) {
  const ids = uniqueValues(driverIds);
  if (!ids.length) return [];

  if (env.mongoUri) {
    const drivers = await Driver.find({ id: { $in: ids }, shopId }).lean();
    return drivers.map(normalizeDriverRecord);
  }

  return ids
    .map((id) => getSeedDriver(id))
    .filter((driver) => driver && (driver.shopId ?? null) === shopId);
}

async function notifyDeliveryOfferCreated(offer, drivers) {
  const recipientUserIds = uniqueValues((drivers || []).map((driver) => driver?.userId));
  if (!recipientUserIds.length) return;
  await createNotificationsForRole({
    recipientRole: "driver",
    recipientUserIds,
    shopId: offer.shopId,
    title: "New delivery offer",
    message: buildDeliveryOfferCreatedMessage(offer),
    type: "delivery_offer",
    entityType: "delivery_offer",
    entityId: offer.id,
  });
}

async function notifyDeliveryOfferAccepted(offer, driver, order) {
  const message = `Driver ${driver.name} accepted order ${order.orderId}.`;
  await runNotificationTasks([
    createNotificationsForRole({
      recipientRole: "seller",
      shopId: offer.shopId,
      title: "Delivery offer accepted",
      message,
      type: "delivery_offer_accepted",
      entityType: "order",
      entityId: order.orderId,
    }),
    createNotificationsForRole({
      recipientRole: "admin",
      shopId: offer.shopId,
      title: "Delivery offer accepted",
      message,
      type: "delivery_offer_accepted",
      entityType: "order",
      entityId: order.orderId,
    }),
    createNotificationsForRole({
      recipientRole: "support",
      shopId: offer.shopId,
      title: "Delivery offer accepted",
      message,
      type: "delivery_offer_accepted",
      entityType: "order",
      entityId: order.orderId,
    }),
  ]);
}

async function notifyDeliveryOfferCancelled(offer, drivers) {
  const recipientUserIds = uniqueValues((drivers || []).map((driver) => driver?.userId));
  if (!recipientUserIds.length) return;
  await createNotificationsForRole({
    recipientRole: "driver",
    recipientUserIds,
    shopId: offer.shopId,
    title: "Delivery offer cancelled",
    message: `Order ${offer.orderId} offer was cancelled.`,
    type: "delivery_offer_cancelled",
    entityType: "delivery_offer",
    entityId: offer.id,
  });
}

async function notifyDeliveryCompleted(order, driver, shopId = null) {
  const message = `Order ${order.orderId} was delivered by ${driver.name}.`;
  const tasks = [
    createNotificationsForRole({
      recipientRole: "seller",
      shopId: shopId || order.shopIds?.[0] || null,
      title: "Order delivered",
      message,
      type: "order_delivered",
      entityType: "order",
      entityId: order.orderId,
    }),
    createNotificationsForRole({
      recipientRole: "admin",
      shopId: shopId || order.shopIds?.[0] || null,
      title: "Order delivered",
      message,
      type: "order_delivered",
      entityType: "order",
      entityId: order.orderId,
    }),
    createNotificationsForRole({
      recipientRole: "support",
      shopId: shopId || order.shopIds?.[0] || null,
      title: "Order delivered",
      message,
      type: "order_delivered",
      entityType: "order",
      entityId: order.orderId,
    }),
  ];

  if (order.customerId) {
    tasks.push(createNotificationsForRole({
      recipientRole: "customer",
      recipientUserIds: [String(order.customerId)],
      title: "Order delivered",
      message,
      type: "order_delivered",
      entityType: "order",
      entityId: order.orderId,
    }));
  }

  await runNotificationTasks(tasks);
}

function getNotificationShopId(order) {
  return Array.isArray(order?.shopIds) ? order.shopIds[0] || null : null;
}

async function persistOrderHistory(orderId, shopId, entry) {
  if (!entry) return;
  if (env.mongoUri) {
    await Order.updateOne({ orderId, shopIds: shopId }, { $push: { statusHistory: entry } });
    return;
  }
  const order = getSeedOrders().find((item) => item.orderId === orderId && Array.isArray(item.shopIds) && item.shopIds.includes(shopId));
  if (!order) return;
  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push(entry);
}

async function expireStaleDeliveryOffers(shopId = null) {
  const now = new Date();

  if (env.mongoUri) {
    const filter = { status: "Open", expiresAt: { $lte: now } };
    if (shopId) filter.shopId = shopId;
    await DeliveryOffer.updateMany(filter, { $set: { status: "Expired" } });
    return;
  }

  for (const offer of seedDeliveryOffers.values()) {
    if ((shopId && offer.shopId !== shopId) || offer.status !== "Open") continue;
    if (isOfferExpired(offer, now)) offer.status = "Expired";
  }
}

async function getSellerOfferById(offerId, shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  await expireStaleDeliveryOffers(safeShopId);

  if (env.mongoUri) {
    const offer = await DeliveryOffer.findOne({ id: offerId, shopId: safeShopId }).lean();
    return offer ? normalizeDeliveryOffer(offer) : null;
  }

  const offer = seedDeliveryOffers.get(offerId);
  return offer && offer.shopId === safeShopId ? normalizeDeliveryOffer(offer) : null;
}

async function listDeliveryOffersForShop(shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  await expireStaleDeliveryOffers(safeShopId);

  if (env.mongoUri) {
    const offers = await DeliveryOffer.find({ shopId: safeShopId }).sort({ createdAt: -1 }).lean();
    return offers.map(normalizeDeliveryOffer);
  }

  return [...seedDeliveryOffers.values()]
    .filter((offer) => offer.shopId === safeShopId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(normalizeDeliveryOffer);
}

async function listDeliveryOffersForAdmin() {
  await expireStaleDeliveryOffers();

  if (env.mongoUri) {
    const offers = await DeliveryOffer.find({}).sort({ createdAt: -1 }).lean();
    return offers.map(normalizeDeliveryOffer);
  }

  return [...seedDeliveryOffers.values()]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(normalizeDeliveryOffer);
}

export async function createSellerDeliveryOffer(shopId, shopName, userId, rawPayload) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const parsed = createDeliveryOfferSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid delivery offer payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }

  const order = await loadSellerOrder(parsed.data.orderId, safeShopId);
  if (!order || order.status !== "Ready for Delivery") {
    const e = new Error("Delivery offers can only be created for orders that are Ready for Delivery.");
    e.status = 409;
    throw e;
  }
  if (["Cancelled", "Refunded", "Disputed", "Customer Accepted", "Delivered"].includes(order.status)) {
    const e = new Error("Delivery offers cannot be created for completed or disputed orders.");
    e.status = 409;
    throw e;
  }
  if (order.driverAssignment?.driverId && !order.driverAssignment?.deliveredAt) {
    const e = new Error("Order already has an active driver assignment.");
    e.status = 409;
    throw e;
  }

  const resolvedShopName = await resolveShopName(safeShopId, shopName || "");
  // Broadcast targeting: active DriverShopAccess for this shop with
  // canReceiveBroadcasts, not Driver.shopId -- a driver shared across
  // shops is broadcast-eligible for every shop it's actively (and
  // broadcast-permitted) connected to.
  const broadcastableAccess = (await listDriverShopAccessForShop(safeShopId, { status: "active" })).filter((a) => a.canReceiveBroadcasts);
  const activeDrivers = await loadDriversByIds(broadcastableAccess.map((a) => a.driverId));
  const accessByDriverId = new Map(broadcastableAccess.map((a) => [a.driverId, a]));

  const eligibleDrivers = activeDrivers.filter((driver) => driver.isActive !== false && driver.status !== "inactive");
  const deliveryZone = normalizeDeliveryZone(parsed.data.deliveryZone);
  const zoneMatchedDrivers = eligibleDrivers.filter((driver) => {
    const access = accessByDriverId.get(driver.id);
    if (access?.serviceZoneIds?.length && deliveryZone && !access.serviceZoneIds.includes(deliveryZone)) return false;
    if (!deliveryZone) return true;
    return matchesDriverZone(driver.zone, deliveryZone);
  });
  const selectedDrivers = [];
  for (const driver of zoneMatchedDrivers) {
    try {
      await assertDriverEligibleForShop({ driverId: driver.id, shopId: safeShopId, zoneId: deliveryZone, action: "broadcast" });
      selectedDrivers.push(driver);
    } catch (err) {
      if (![403, 409].includes(err?.status)) throw err;
    }
  }

  if (!selectedDrivers.length) {
    const e = new Error(deliveryZone ? "No active drivers match the selected delivery zone." : "No active drivers are available for broadcast.");
    e.status = 409;
    throw e;
  }

  const offer = {
    id: `doff-${randomUUID().slice(0, 10)}`,
    orderId: order.orderId,
    shopId: safeShopId,
    shopName: resolvedShopName,
    sellerUserId: userId || null,
    deliveryZone,
    deliveryAddressSummary: summarizeDeliveryAddress(parsed.data.deliveryAddressSummary || order.deliveryAddress || ""),
    codAmount: parsed.data.codAmount > 0 ? Number(parsed.data.codAmount) : (order.paymentMethod === "cod" ? Number(order.subtotal) || 0 : 0),
    status: "Open",
    offeredDriverIds: selectedDrivers.map((driver) => driver.id),
    acceptedDriverId: null,
    acceptedDriverName: "",
    acceptedAt: null,
    expiresAt: getOfferExpiry(parsed.data.expiresAt),
    createdAt: new Date(),
    createdBy: userId || "",
    notes: parsed.data.notes || "",
  };

  const historyEntry = buildOfferHistoryEntry(
    order.status,
    "Delivery Offer Opened",
    { role: "seller", name: userId || shopName || "seller", sub: userId || "seller" },
    `Broadcast to ${selectedDrivers.length} driver${selectedDrivers.length === 1 ? "" : "s"}${deliveryZone ? ` in ${deliveryZone}` : ""}`
  );

  if (env.mongoUri) {
    const doc = await DeliveryOffer.create(offer);
    await persistOrderHistory(order.orderId, safeShopId, historyEntry);
    await runNotificationTasks([notifyDeliveryOfferCreated(offer, selectedDrivers)]);
    return normalizeDeliveryOffer(doc);
  }

  seedDeliveryOffers.set(offer.id, offer);
  await persistOrderHistory(order.orderId, safeShopId, historyEntry);
  await runNotificationTasks([notifyDeliveryOfferCreated(offer, selectedDrivers)]);
  return normalizeDeliveryOffer(offer);
}

export async function listSellerDeliveryOffers(shopId) {
  return listDeliveryOffersForShop(shopId);
}

export async function getSellerDeliveryOffer(offerId, shopId) {
  const offer = await getSellerOfferById(offerId, shopId);
  if (!offer) {
    const e = new Error("Delivery offer not found.");
    e.status = 404;
    throw e;
  }
  return offer;
}

export async function cancelSellerDeliveryOffer(offerId, shopId, user) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const offer = await getSellerOfferById(offerId, safeShopId);
  if (!offer) {
    const e = new Error("Delivery offer not found.");
    e.status = 404;
    throw e;
  }
  if (offer.status !== "Open") {
    const e = new Error("Only open delivery offers can be cancelled.");
    e.status = 409;
    throw e;
  }

  const historyEntry = buildOfferHistoryEntry(
    offer.status,
    "Delivery Offer Cancelled",
    user,
    `Delivery offer ${offer.id} was cancelled.`
  );

  if (env.mongoUri) {
    const updated = await DeliveryOffer.findOneAndUpdate(
      { id: offerId, shopId: safeShopId, status: "Open" },
      { $set: { status: "Cancelled" } },
      { returnDocument: "after" }
    ).lean();
    if (!updated) {
      const e = new Error("Delivery offer is no longer open.");
      e.status = 409;
      throw e;
    }
    await persistOrderHistory(offer.orderId, safeShopId, historyEntry);
    const cancelledDrivers = await resolveDriversByIdsForShop(safeShopId, offer.offeredDriverIds);
    await runNotificationTasks([notifyDeliveryOfferCancelled(offer, cancelledDrivers)]);
    return normalizeDeliveryOffer(updated);
  }

  const seedOffer = seedDeliveryOffers.get(offerId);
  if (!seedOffer || seedOffer.shopId !== safeShopId || seedOffer.status !== "Open") {
    const e = new Error("Delivery offer is no longer open.");
    e.status = 409;
    throw e;
  }
  seedOffer.status = "Cancelled";
  await persistOrderHistory(offer.orderId, safeShopId, historyEntry);
  const cancelledDrivers = await resolveDriversByIdsForShop(safeShopId, offer.offeredDriverIds);
  await runNotificationTasks([notifyDeliveryOfferCancelled(offer, cancelledDrivers)]);
  return normalizeDeliveryOffer(seedOffer);
}

export async function listAdminDeliveryOffers() {
  return listDeliveryOffersForAdmin();
}

export async function listAdminDeliveryOffersSnapshot() {
  if (env.mongoUri) {
    const offers = await DeliveryOffer.find({}).sort({ createdAt: -1 }).lean();
    return offers.map(normalizeDeliveryOffer);
  }

  return [...seedDeliveryOffers.values()]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(normalizeDeliveryOffer);
}

// Driver dashboard (Task 6): combines offers from every shop this driver
// currently has ACTIVE access to -- never a single shopId from the
// driver's JWT (a shared driver's token no longer carries one
// meaningful shopId). Having access to Shop A must never surface Shop
// B's offers, so this always filters by the driver's live active-shop
// set, not by "any offer that happens to name this driver."
export async function listDriverOffers(driverId) {
  const now = new Date();
  await expireStaleDeliveryOffers();
  const activeShopIds = await listActiveShopIdsForDriver(driverId);
  if (!activeShopIds.length) return [];

  const allOffers = env.mongoUri
    ? await DeliveryOffer.find({ shopId: { $in: activeShopIds }, status: "Open", expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean()
    : [...seedDeliveryOffers.values()].filter((offer) => activeShopIds.includes(offer.shopId) && isOfferOpen(offer, now));

  return allOffers
    .filter((offer) => Array.isArray(offer.offeredDriverIds) && offer.offeredDriverIds.includes(driverId))
    .map(normalizeDeliveryOfferForDriver);
}

// Driver dashboard (Task 6): shopId is resolved from the OFFER itself
// (offer.shopId), never trusted from the caller/JWT -- a shared driver's
// token doesn't carry a single shopId anymore. Eligibility (including
// canReceiveBroadcasts/capacity) is checked against that resolved shopId.
export async function acceptDriverOffer(offerId, driverId, user) {
  const now = new Date();
  await expireStaleDeliveryOffers();

  const existingOffer = env.mongoUri
    ? await DeliveryOffer.findOne({ id: offerId }).lean()
    : seedDeliveryOffers.get(offerId);
  if (!existingOffer || !Array.isArray(existingOffer.offeredDriverIds) || !existingOffer.offeredDriverIds.includes(driverId)) {
    const e = new Error("Delivery offer is no longer available.");
    e.status = 409;
    throw e;
  }
  const safeShopId = existingOffer.shopId;

  const { driver } = await assertDriverEligibleForShop({ driverId, shopId: safeShopId, action: "offer_accept" });

  let offer = null;
  if (env.mongoUri) {
    offer = await DeliveryOffer.findOneAndUpdate(
      {
        id: offerId,
        shopId: safeShopId,
        status: "Open",
        offeredDriverIds: driverId,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          status: "Accepted",
          acceptedDriverId: driver.id,
          acceptedDriverName: driver.name,
          acceptedAt: now,
        },
      },
      { returnDocument: "after" }
    ).lean();
  } else {
    const seedOffer = seedDeliveryOffers.get(offerId);
    if (!seedOffer || seedOffer.shopId !== safeShopId || seedOffer.status !== "Open" || !isOfferOpen(seedOffer, now) || !seedOffer.offeredDriverIds.includes(driverId)) {
      const e = new Error("Delivery offer is no longer available.");
      e.status = 409;
      throw e;
    }
    seedOffer.status = "Accepted";
    seedOffer.acceptedDriverId = driver.id;
    seedOffer.acceptedDriverName = driver.name;
    seedOffer.acceptedAt = now;
    offer = seedOffer;
  }

  if (!offer) {
    const e = new Error("Delivery offer is no longer available.");
    e.status = 409;
    throw e;
  }

  const order = await loadSellerOrder(offer.orderId, safeShopId);
  if (!order || order.status !== "Ready for Delivery" || (order.driverAssignment?.driverId && !order.driverAssignment?.deliveredAt)) {
    if (env.mongoUri) {
      await DeliveryOffer.updateOne({ id: offer.id, shopId: safeShopId }, { $set: { status: "Cancelled" } });
    } else {
      const seedOffer = seedDeliveryOffers.get(offer.id);
      if (seedOffer) seedOffer.status = "Cancelled";
    }
    const e = new Error("Order is no longer available for driver assignment.");
    e.status = 409;
    throw e;
  }

  const assignment = {
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone,
    assignedAt: now,
    deliveredAt: null,
    codCollected: false,
    codAmount: order.paymentMethod === "cod" ? Number(offer.codAmount) || Number(order.subtotal) || 0 : 0,
    note: `Accepted from offer ${offer.id}`,
  };

  const historyEntry = buildOfferHistoryEntry(
    order.status,
    "Driver Assigned",
    user,
    `Offer ${offer.id} accepted by ${driver.name}.`
  );

  if (env.mongoUri) {
    const updatedOrder = await Order.findOneAndUpdate(
      {
        orderId: offer.orderId,
        shopIds: safeShopId,
        $or: [
          { driverAssignment: { $exists: false } },
          { "driverAssignment.deliveredAt": { $ne: null } },
        ],
        status: "Ready for Delivery",
      },
      {
        $set: { driverAssignment: assignment },
        $push: { statusHistory: historyEntry },
      },
      { returnDocument: "after" }
    ).lean();

    if (!updatedOrder) {
      await DeliveryOffer.updateOne({ id: offer.id, shopId: safeShopId, status: "Accepted" }, { $set: { status: "Cancelled" } });
      const e = new Error("Order already has an active assignment.");
      e.status = 409;
      throw e;
    }

    await Driver.findOneAndUpdate({ id: driver.id }, { $set: { status: "on_delivery" } });
    await notifyDeliveryOfferAccepted(offer, driver, updatedOrder);
    return { offer: normalizeDeliveryOffer(await DeliveryOffer.findOne({ id: offer.id, shopId: safeShopId }).lean()), order: await normalizeDriverTaskOrder(updatedOrder) };
  }

  if (order.driverAssignment?.driverId && !order.driverAssignment?.deliveredAt) {
    const seedOffer = seedDeliveryOffers.get(offer.id);
    if (seedOffer) seedOffer.status = "Cancelled";
    const e = new Error("Order already has an active assignment.");
    e.status = 409;
    throw e;
  }

  order.driverAssignment = {
    ...assignment,
    assignedAt: assignment.assignedAt.toISOString(),
  };
  order.updatedAt = new Date().toISOString();
  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push({ ...historyEntry, timestamp: new Date().toISOString() });
  driver.status = "on_delivery";
  await notifyDeliveryOfferAccepted(offer, driver, order);
  return { offer: normalizeDeliveryOffer(offer), order: await normalizeDriverTaskOrder(order) };
}

const DRIVER_TASK_STATUSES = new Set(["Ready for Delivery", "Shipped", "Delivered"]);

// Missing `status` on a pre-existing (pre-delivery-failure-workflow)
// assignment is treated as "accepted" -- see the schema comment in
// models/Order.js. `pickedUpAt` being set with no status recorded yet
// (documents written between the pickup-confirm and delivery-failure
// features) upgrades that default to "picked_up" instead.
function inferAssignmentStatus(assignment) {
  if (assignment.status) return assignment.status;
  if (assignment.deliveredAt) return "completed";
  if (assignment.pickedUpAt) return "picked_up";
  return "accepted";
}

function normalizeDriverAssignment(assignment) {
  if (!assignment) return undefined;
  return {
    id: assignment.id || null,
    driverId: assignment.driverId,
    driverName: assignment.driverName || "",
    driverPhone: assignment.driverPhone || "",
    status: inferAssignmentStatus(assignment),
    assignedAt: assignment.assignedAt || null,
    pickedUpAt: assignment.pickedUpAt || null,
    deliveredAt: assignment.deliveredAt || null,
    codCollected: Boolean(assignment.codCollected),
    codAmount: Number(assignment.codAmount) || 0,
    note: assignment.note || "",
    proofOfDeliveryUrl: assignment.proofOfDeliveryUrl || "",
    attemptCount: Number(assignment.attemptCount) || 0,
    lastFailureReason: assignment.lastFailureReason || null,
    nextAction: assignment.nextAction || null,
    retryScheduledAt: assignment.retryScheduledAt || null,
    supersededAt: assignment.supersededAt || null,
    supersededByAssignmentId: assignment.supersededByAssignmentId || null,
  };
}

function normalizeDriverTaskItem(item) {
  return {
    productId: item.productId,
    productName: item.productName,
    quantity: Number(item.quantity) || 0,
    price: Number(item.price) || 0,
    category: item.category || "",
    family: item.family || "",
    gender: item.gender || "",
    size: item.size || "",
    cakeType: item.cakeType || "",
    servings: item.servings || "",
    flavors: Array.isArray(item.flavors) ? item.flavors : [],
    allergens: Array.isArray(item.allergens) ? item.allergens : [],
    occasionTags: Array.isArray(item.occasionTags) ? item.occasionTags : [],
    includes: Array.isArray(item.includes) ? item.includes : [],
    bundledProductIds: Array.isArray(item.bundledProductIds) ? item.bundledProductIds : [],
    metadata: item.metadata || undefined,
    configuration: item.configuration || undefined,
  };
}

async function normalizeDriverTaskOrder(order) {
  if (!order) return null;
  const codAmount = Number(order?.driverAssignment?.codAmount) || (order.paymentMethod === "cod" ? Number(order.subtotal) || 0 : 0);
  const attempts = await getDeliveryAttemptsForOrder(order.orderId);
  return {
    orderId: order.orderId,
    status: order.status,
    customerName: order.customerName,
    phone: order.phone || "",
    deliveryAddress: order.deliveryAddress || "",
    deliveryDate: order.deliveryDate || "",
    deliveryTime: order.deliveryTime || "",
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    codAmount,
    items: Array.isArray(order.items) ? order.items.map(normalizeDriverTaskItem) : [],
    driverAssignment: normalizeDriverAssignment(order.driverAssignment),
    driverAssignmentHistory: Array.isArray(order.driverAssignmentHistory)
      ? order.driverAssignmentHistory.map(normalizeDriverAssignment)
      : [],
    deliveryAttempts: attempts.map(sanitizeDeliveryAttempt),
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
  };
}

async function listVisibleShopIdsForDriverTasks(driverId) {
  const visibleAccess = await listDriverShopAccessForDriver(driverId);
  return visibleAccess
    .filter((access) => ["active", "suspended"].includes(access.status))
    .map((access) => access.shopId);
}

// Task 6: a driver may only access an order they're currently assigned
// to (checked here) -- having active access to Shop A never exposes
// Shop A's OTHER, unassigned orders. The shop-membership check (against
// the driver's live active-access set, not a single JWT shopId) is an
// extra belt-and-braces guard for the edge case of a stale assignment
// surviving a suspended/revoked relationship.
async function findDriverTaskOrder(driverId, orderId) {
  const visibleShopIds = await listVisibleShopIdsForDriverTasks(driverId);
  if (!visibleShopIds.length) return null;

  if (env.mongoUri) {
    const order = await Order.findOne({
      orderId,
      shopIds: { $in: visibleShopIds },
      "driverAssignment.driverId": driverId,
      status: { $in: [...DRIVER_TASK_STATUSES] },
    }).lean();
    return order ? await normalizeDriverTaskOrder(order) : null;
  }

  const order = getSeedOrders().find(
    (item) =>
      item.orderId === orderId &&
      Array.isArray(item.shopIds) &&
      item.shopIds.some((id) => visibleShopIds.includes(id)) &&
      item.driverAssignment?.driverId === driverId &&
      DRIVER_TASK_STATUSES.has(item.status)
  );
  return order ? await normalizeDriverTaskOrder(order) : null;
}

// Task 6: profile now reports every shop this driver is actively
// connected to (`shops`), not one fixed shopId/shopName -- a shared
// driver's dashboard header needs to show all of them at once.
export async function getDriverProfile(driverId) {
  const driver = await getDriverById(driverId);
  if (!driver) {
    const e = new Error("Driver not found.");
    e.status = 404;
    throw e;
  }
  const activeAccess = await listDriverShopAccessForDriver(driverId, { status: "active" });
  const shops = await Promise.all(
    activeAccess.map(async (a) => ({ shopId: a.shopId, shopName: await resolveShopName(a.shopId, a.shopId) }))
  );

  return {
    driverId: driver.id,
    name: driver.name,
    phone: driver.phone,
    vehicleType: driver.vehicleType,
    zone: driver.zone || "",
    status: driver.status,
    shops,
    codBalance: Number(driver.codBalance) || 0,
    totalDeliveries: Number(driver.totalDeliveries) || 0,
    loginEmail: driver.loginEmail || "",
  };
}

export async function confirmDriverPickup(driverId, orderId, user) {
  const now = new Date();

  if (env.mongoUri) {
    const order = await Order.findOne({ orderId, "driverAssignment.driverId": driverId }).lean();
    if (!order) { const e = new Error("Order not found or not assigned to this driver."); e.status = 404; throw e; }
    if (order.status === "Shipped" || order.status === "Delivered") {
      const e = new Error("Order is already picked up or delivered."); e.status = 409; throw e;
    }
    if (!["Ready for Delivery", "Processing"].includes(order.status)) {
      const e = new Error(`Cannot confirm pickup from status "${order.status}".`); e.status = 409; throw e;
    }
    const historyEntry = {
      from: order.status, to: "Shipped",
      by: user?.name || user?.sub || "driver", role: "driver",
      note: "Driver confirmed pickup.", timestamp: now,
    };
    const updated = await Order.findOneAndUpdate(
      { orderId },
      { $set: { status: "Shipped", "driverAssignment.pickedUpAt": now }, $push: { statusHistory: historyEntry } },
      { returnDocument: "after" }
    ).lean();
    return updated;
  }

  const orders = getSeedOrders();
  const order = orders.find((o) => o.orderId === orderId && o.driverAssignment?.driverId === driverId);
  if (!order) { const e = new Error("Order not found or not assigned to this driver."); e.status = 404; throw e; }
  if (order.status === "Shipped" || order.status === "Delivered") {
    const e = new Error("Order is already picked up or delivered."); e.status = 409; throw e;
  }
  if (!["Ready for Delivery", "Processing"].includes(order.status)) {
    const e = new Error(`Cannot confirm pickup from status "${order.status}".`); e.status = 409; throw e;
  }
  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push({
    from: order.status, to: "Shipped",
    by: user?.name || user?.sub || "driver", role: "driver",
    note: "Driver confirmed pickup.", timestamp: now.toISOString(),
  });
  order.status = "Shipped";
  order.driverAssignment = { ...order.driverAssignment, pickedUpAt: now.toISOString() };
  order.updatedAt = now.toISOString();
  return order;
}

const DRIVER_HISTORY_STATUSES = new Set(["Delivered", "Customer Accepted", "Refunded", "Cancelled"]);

// Task 6: history/active-deliveries combine every shop the driver is
// currently ACTIVELY connected to -- resolved fresh on every call
// (never cached on the driver's JWT), so a mid-session suspension takes
// effect on the very next request.
export async function listDriverHistory(driverId, { from, to, limit = 50, page = 1 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage  = Math.max(Number(page) || 1, 1);
  const skip      = (safePage - 1) * safeLimit;
  const activeShopIds = await listActiveShopIdsForDriver(driverId);
  if (!activeShopIds.length) return { orders: [], total: 0, page: safePage };

  if (env.mongoUri) {
    const filter = {
      shopIds: { $in: activeShopIds },
      "driverAssignment.driverId": driverId,
      status: { $in: [...DRIVER_HISTORY_STATUSES] },
    };
    if (from || to) {
      filter["driverAssignment.deliveredAt"] = {};
      if (from) filter["driverAssignment.deliveredAt"].$gte = new Date(from);
      if (to)   filter["driverAssignment.deliveredAt"].$lte = new Date(to);
    }
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ "driverAssignment.deliveredAt": -1 }).skip(skip).limit(safeLimit).lean(),
      Order.countDocuments(filter),
    ]);
    return { orders: await Promise.all(orders.map(normalizeDriverTaskOrder)), total, page: safePage };
  }

  let orders = getSeedOrders().filter(
    (o) => Array.isArray(o.shopIds) && o.shopIds.some((id) => activeShopIds.includes(id)) &&
      o.driverAssignment?.driverId === driverId &&
      DRIVER_HISTORY_STATUSES.has(o.status)
  );
  if (from) { const d = new Date(from); orders = orders.filter((o) => new Date(o.driverAssignment?.deliveredAt || 0) >= d); }
  if (to)   { const d = new Date(to);   orders = orders.filter((o) => new Date(o.driverAssignment?.deliveredAt || 0) <= d); }
  orders.sort((a, b) => new Date(b.driverAssignment?.deliveredAt || 0) - new Date(a.driverAssignment?.deliveredAt || 0));
  return { orders: await Promise.all(orders.slice(skip, skip + safeLimit).map(normalizeDriverTaskOrder)), total: orders.length, page: safePage };
}

export async function listDriverDeliveries(driverId) {
  const visibleShopIds = await listVisibleShopIdsForDriverTasks(driverId);
  if (!visibleShopIds.length) return [];

  if (env.mongoUri) {
    const orders = await Order.find({
      shopIds: { $in: visibleShopIds },
      "driverAssignment.driverId": driverId,
      status: { $in: [...DRIVER_TASK_STATUSES] },
    }).sort({ updatedAt: -1 }).lean();
    return Promise.all(orders.map(normalizeDriverTaskOrder));
  }

  const filtered = getSeedOrders()
    .filter(
      (order) =>
        Array.isArray(order.shopIds) &&
        order.shopIds.some((id) => visibleShopIds.includes(id)) &&
        order.driverAssignment?.driverId === driverId &&
        DRIVER_TASK_STATUSES.has(order.status)
    )
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  return Promise.all(filtered.map(normalizeDriverTaskOrder));
}

export async function getDriverDelivery(driverId, orderId) {
  const task = await findDriverTaskOrder(driverId, orderId);
  if (!task) {
    const e = new Error("Order not found.");
    e.status = 404;
    throw e;
  }
  return task;
}

// Admin direct assignment. Requires an active DriverShopAccess for the
// order's shop -- Task 7 is explicit that this must never silently
// bypass relationship creation: if none exists, this throws (403/409
// from assertDriverEligibleForShop) and the admin must first create one
// via POST /api/drivers/access/direct.
export async function assignDriverToOrder(driverId, orderId, user) {
  if (env.mongoUri) {
    const order = await Order.findOne({ orderId }).lean();
    if (!order) { const e = new Error("Order not found."); e.status = 404; throw e; }
    if (order.status !== "Ready for Delivery") {
      const e = new Error("Driver can only be assigned to orders that are Ready for Delivery.");
      e.status = 409;
      throw e;
    }
    const { driver } = await assertDriverEligibleForShop({ driverId, shopId: getNotificationShopId(order), action: "assign" });

    const assignment = {
      driverId:    driver.id,
      driverName:  driver.name,
      driverPhone: driver.phone,
      assignedAt:  new Date(),
      deliveredAt: null,
      codCollected: false,
      codAmount:   order.paymentMethod === "cod" ? order.subtotal : 0,
      note:        "",
    };

    const updated = await Order.findOneAndUpdate(
      { orderId },
      { $set: { driverAssignment: assignment } },
      { returnDocument: "after" }
    ).lean();

    await Driver.findOneAndUpdate({ id: driverId }, { $set: { status: "on_delivery" } });
    return updated;
  }

  // Seed mode
  const orders = getSeedOrders();
  const order = orders.find((o) => o.orderId === orderId);
  if (!order) { const e = new Error("Order not found."); e.status = 404; throw e; }
  if (order.status !== "Ready for Delivery") {
    const e = new Error("Driver can only be assigned to orders that are Ready for Delivery.");
    e.status = 409;
    throw e;
  }
  const { driver } = await assertDriverEligibleForShop({ driverId, shopId: getNotificationShopId(order), action: "assign" });

  order.driverAssignment = {
    driverId:    driver.id,
    driverName:  driver.name,
    driverPhone: driver.phone,
    assignedAt:  new Date().toISOString(),
    deliveredAt: null,
    codCollected: false,
    codAmount:   order.paymentMethod === "cod" ? order.subtotal : 0,
    note:        "",
  };
  order.updatedAt = new Date().toISOString();

  driver.status = "on_delivery";
  return order;
}

export async function recordDriverDelivery(driverId, orderId, rawPayload, user) {
  const parsed = driverDeliverySchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid delivery payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }

  const now = new Date();

  if (env.mongoUri) {
    const order = await Order.findOne({ orderId, "driverAssignment.driverId": driverId }).lean();
    if (!order) {
      const e = new Error("Order not found or not assigned to this driver.");
      e.status = 404;
      throw e;
    }
    if (order.status === "Delivered") {
      const e = new Error("Order is already delivered."); e.status = 409; throw e;
    }
    // Completion must be mutually exclusive with failure: an assignment
    // that failed/was rescheduled must be retried (moved back to an
    // active status) before it can be completed -- prevents
    // complete-after-failure-without-retry.
    const assignmentStatus = inferAssignmentStatus(order.driverAssignment);
    assertAssignmentTransition(assignmentStatus, "completed");
    await assertDriverEligibleForShop({ driverId, shopId: getNotificationShopId(order), action: "complete" });

    const codCollected = Boolean(parsed.data.codCollected);
    const codAmount = codCollected ? resolveCodAmount(order, parsed.data) : 0;
    const updatedAssignment = {
      ...order.driverAssignment,
      status:             "completed",
      deliveredAt:        now,
      codCollected,
      codAmount,
      note:               parsed.data.note || "",
      proofOfDeliveryUrl: parsed.data.proofOfDeliveryUrl || "",
    };

    const historyEntry = {
      from:      order.status,
      to:        "Delivered",
      by:        user?.name || user?.sub || "driver",
      role:      "driver",
      note:      parsed.data.note || null,
      timestamp: now,
    };

    const paymentStatus = codCollected ? "COD collected" : order.paymentStatus;

    // Optimistic-concurrency guard, same technique as reportDeliveryFailure:
    // re-checks attemptCount and current assignment status so a concurrent
    // failure report or a stale (superseded) assignment's completion
    // request cannot both win against this one.
    const updated = await Order.findOneAndUpdate(
      {
        orderId,
        "driverAssignment.driverId": driverId,
        "driverAssignment.attemptCount": order.driverAssignment.attemptCount || 0,
      },
      {
        $set:  { status: "Delivered", paymentStatus, driverAssignment: updatedAssignment },
        $push: { statusHistory: historyEntry },
      },
      { returnDocument: "after" }
    ).lean();
    if (!updated) {
      const e = new Error("Delivery assignment changed before this completion could be recorded."); e.status = 409; throw e;
    }

    // Update driver stats
    const codInc = codCollected ? codAmount : 0;
    await Driver.findOneAndUpdate(
      { id: driverId },
      {
        $set: { status: "active" },
        $inc: { totalDeliveries: 1, codBalance: codInc, totalCodCollected: codInc },
      }
    );
    if (codCollected && codAmount > 0) {
      await recordCodCollection({
        driverId, shopId: getNotificationShopId(updated), orderId, assignmentId: order.driverAssignment?.id || null,
        amount: codAmount, recordedByUserId: user?.sub || null,
      });
    }
    // Accrue referral commissions — same trigger as the regular Delivered transition.
    // Errors are swallowed inside accrueDeliveredOrderCommissions to avoid reversing delivery.
    await accrueDeliveredOrderCommissions(updated);
    await notifyDeliveryCompleted(updated, { name: updated?.driverAssignment?.driverName || "driver" }, getNotificationShopId(updated));
    return updated;
  }

  // Seed mode
  const orders = getSeedOrders();
  const order = orders.find((o) => o.orderId === orderId && o.driverAssignment?.driverId === driverId);
  if (!order) {
    const e = new Error("Order not found or not assigned to this driver."); e.status = 404; throw e;
  }
  if (order.status === "Delivered") {
    const e = new Error("Order is already delivered."); e.status = 409; throw e;
  }
  const assignmentStatus = inferAssignmentStatus(order.driverAssignment);
  assertAssignmentTransition(assignmentStatus, "completed");
  await assertDriverEligibleForShop({ driverId, shopId: getNotificationShopId(order), action: "complete" });

  const codCollected = Boolean(parsed.data.codCollected);
  const codAmount = codCollected ? resolveCodAmount(order, parsed.data) : 0;

  order.driverAssignment = {
    ...order.driverAssignment,
    status:             "completed",
    deliveredAt:        now.toISOString(),
    codCollected,
    codAmount,
    note:               parsed.data.note || "",
    proofOfDeliveryUrl: parsed.data.proofOfDeliveryUrl || "",
  };

  const historyEntry = {
    from:      order.status,
    to:        "Delivered",
    by:        user?.name || user?.sub || "driver",
    role:      "driver",
    note:      parsed.data.note || null,
    timestamp: now.toISOString(),
  };

  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push(historyEntry);
  order.status = "Delivered";
  if (codCollected) order.paymentStatus = "COD collected";
  order.updatedAt = now.toISOString();

  const driver = seedDrivers.get(driverId);
  if (driver) {
    driver.status = "active";
    driver.totalDeliveries += 1;
    if (codCollected) {
      driver.codBalance        += codAmount;
      driver.totalCodCollected += codAmount;
    }
  }
  if (codCollected && codAmount > 0) {
    await recordCodCollection({
      driverId, shopId: getNotificationShopId(order), orderId, assignmentId: order.driverAssignment?.id || null,
      amount: codAmount, recordedByUserId: user?.sub || null,
    });
  }
  // Accrue referral commissions — same trigger as the regular Delivered transition.
  await accrueDeliveredOrderCommissions(order);
  await notifyDeliveryCompleted(order, { name: order?.driverAssignment?.driverName || "driver" }, getNotificationShopId(order));
  return order;
}

// ── Delivery-attempt history (see models/DeliveryAttempt.js) ───────────
async function getDeliveryAttemptsForOrder(orderId) {
  if (env.mongoUri) {
    return DeliveryAttempt.find({ orderId }).sort({ attemptNumber: 1 }).lean();
  }
  return seedDeliveryAttempts
    .filter((attempt) => attempt.orderId === orderId)
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
}

// Public shape for seller/admin/driver views -- deliberately omits the raw
// `driverId`/`createdBy` fields; callers that need to attribute an attempt
// to a specific driver (seller/admin UX) attach driver name separately from
// the assignment/history they already have, rather than trusting this
// generic sanitizer to decide who's allowed to see raw actor identifiers.
function sanitizeDeliveryAttempt(attempt) {
  if (!attempt) return null;
  return {
    id: attempt.id,
    assignmentId: attempt.assignmentId,
    attemptNumber: attempt.attemptNumber,
    result: attempt.result,
    reasonCode: attempt.reasonCode || null,
    note: attempt.note || "",
    customerReached: Boolean(attempt.customerReached),
    contactAttempts: Number(attempt.contactAttempts) || 0,
    requestedRetryAt: attempt.requestedRetryAt || null,
    evidenceMediaAssetIds: Array.isArray(attempt.evidenceMediaAssetIds) ? attempt.evidenceMediaAssetIds : [],
    nextAction: attempt.nextAction || null,
    occurredAt: attempt.occurredAt || attempt.createdAt || null,
    createdByRole: attempt.createdByRole || "driver",
  };
}

// ── Delivery-failure notifications (Phase K) ────────────────────────────
// Every one of these is called at most once per state change (the calling
// command only reaches the notify step after successfully committing a new
// attempt/assignment state), so idempotent retries of the *same* attempt
// short-circuit before ever reaching these -- no separate dedup needed here.
async function notifyDeliveryFailed(order, attempt) {
  const shopId = attempt.shopId || getNotificationShopId(order);
  const internalMessage = `Order ${order.orderId}: delivery attempt #${attempt.attemptNumber} failed (${attempt.reasonCode}). Next action: ${attempt.nextAction}.`;
  const tasks = [
    createNotificationsForRole({
      recipientRole: "seller", shopId, title: "Delivery attempt failed", message: internalMessage,
      type: "delivery_attempt_failed", entityType: "order", entityId: order.orderId,
    }),
    createNotificationsForRole({
      recipientRole: "admin", shopId, title: "Delivery attempt failed", message: internalMessage,
      type: "delivery_attempt_failed", entityType: "order", entityId: order.orderId,
    }),
  ];

  if (attempt.nextAction === "ADMIN_REVIEW" || attempt.nextAction === "SUPPORT_REVIEW") {
    tasks.push(createNotificationsForRole({
      recipientRole: "support", shopId, title: "Delivery attempt needs review", message: internalMessage,
      type: "delivery_attempt_failed", entityType: "order", entityId: order.orderId,
    }));
  }

  if (order.customerId) {
    tasks.push(createNotificationsForRole({
      recipientRole: "customer", recipientUserIds: [String(order.customerId)],
      title: "Delivery update", message: getCustomerSafeFailureMessage(attempt.reasonCode),
      type: "delivery_attempt_failed", entityType: "order", entityId: order.orderId,
    }));
  }

  await runNotificationTasks(tasks);
}

async function notifyMaxAttemptsReached(order, attempt) {
  const shopId = attempt.shopId || getNotificationShopId(order);
  const message = `Order ${order.orderId} has reached the maximum delivery attempts (${MAX_DELIVERY_ATTEMPTS}) and now requires action.`;
  await runNotificationTasks([
    createNotificationsForRole({
      recipientRole: "seller", shopId, title: "Delivery attempts exhausted", message,
      type: "delivery_attempts_exhausted", entityType: "order", entityId: order.orderId,
    }),
    createNotificationsForRole({
      recipientRole: "admin", shopId, title: "Delivery attempts exhausted", message,
      type: "delivery_attempts_exhausted", entityType: "order", entityId: order.orderId,
    }),
    createNotificationsForRole({
      recipientRole: "support", shopId, title: "Delivery attempts exhausted", message,
      type: "delivery_attempts_exhausted", entityType: "order", entityId: order.orderId,
    }),
  ]);
}

/**
 * Phase D core command: POST /api/driver/deliveries/:orderId/fail
 *
 * Deliberately NOT a generic status patch -- every branch below preserves
 * the reason, attempt number, reporting driver, and resulting next action
 * as an immutable DeliveryAttempt row, and only ever moves the assignment
 * to delivery_failed/rescheduled (never Delivered, never a raw commercial
 * cancellation/refund -- those remain admin/seller-only decisions made
 * downstream of `nextAction`).
 */
export async function reportDeliveryFailure(driverId, orderId, rawPayload, user) {
  const parsed = reportDeliveryFailureSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid delivery-failure payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }

  const { reason, note, customerReached, contactAttempts, evidenceMediaAssetIds } = parsed.data;
  if (!isKnownDeliveryFailureReason(reason)) {
    const e = new Error("Unknown delivery failure reason."); e.status = 422; throw e;
  }
  const policy = getDeliveryFailureReasonPolicy(reason);

  if (policy.noteRequired && !note.trim()) {
    const e = new Error(`A note is required when reporting "${reason}".`); e.status = 422; throw e;
  }
  if (policy.evidenceRequired && evidenceMediaAssetIds.length === 0) {
    const e = new Error(`Evidence photo(s) are required when reporting "${reason}".`); e.status = 422; throw e;
  }

  let requestedRetryAt = null;
  if (parsed.data.requestedRetryAt) {
    requestedRetryAt = new Date(parsed.data.requestedRetryAt);
    if (Number.isNaN(requestedRetryAt.getTime())) {
      const e = new Error("Invalid requested retry date/time."); e.status = 422; throw e;
    }
    if (requestedRetryAt.getTime() <= Date.now()) {
      const e = new Error("Requested retry date/time must be in the future."); e.status = 422; throw e;
    }
  }
  if (policy.requestedRetryAtRequired && !requestedRetryAt) {
    const e = new Error(`A requested retry date/time is required when reporting "${reason}".`); e.status = 422; throw e;
  }

  // Evidence ownership is verified against the reporting driver -- never
  // trust a client-supplied mediaAssetId's ownership or moderation state.
  if (evidenceMediaAssetIds.length) {
    await assertOwnedMediaAssets("driver", driverId, evidenceMediaAssetIds);
  }

  const context = { driverId, orderId, reason, note, customerReached, contactAttempts, requestedRetryAt, evidenceMediaAssetIds, policy, user, now: new Date() };
  return env.mongoUri ? reportDeliveryFailureMongo(context) : reportDeliveryFailureSeed(context);
}

async function reportDeliveryFailureMongo(context) {
  const { driverId, orderId, reason, note, customerReached, contactAttempts, requestedRetryAt, evidenceMediaAssetIds, user, now } = context;

  const order = await Order.findOne({ orderId, "driverAssignment.driverId": driverId }).lean();
  if (!order) {
    const e = new Error("Delivery not found or not assigned to this driver."); e.status = 404; throw e;
  }
  if (["Delivered", "Cancelled", "Refunded"].includes(order.status)) {
    const e = new Error(`Delivery failure cannot be reported once the order is "${order.status}".`); e.status = 409; throw e;
  }
  await assertDriverEligibleForShop({ driverId, shopId: getNotificationShopId(order), action: "access" });

  const assignment = order.driverAssignment;
  const assignmentStatus = inferAssignmentStatus(assignment);

  if (assignmentStatus === "completed") {
    const e = new Error("This delivery has already been completed."); e.status = 409; throw e;
  }

  // Idempotent replay: a resubmission of the *same* attempt (e.g. a
  // retried network request) after the assignment already moved to
  // delivery_failed/rescheduled returns the existing latest attempt
  // instead of creating attempt N+1 or erroring.
  if (["delivery_failed", "rescheduled"].includes(assignmentStatus)) {
    const [latest] = await DeliveryAttempt.find({ orderId, assignmentId: assignment.id }).sort({ attemptNumber: -1 }).limit(1).lean();
    if (latest) {
      return { attempt: sanitizeDeliveryAttempt(latest), order: await normalizeDriverTaskOrder(order), idempotentReplay: true };
    }
  }

  if (!isFailableAssignmentStatus(assignmentStatus)) {
    const e = new Error(`Delivery failure cannot be reported from assignment status "${assignmentStatus}".`); e.status = 409; throw e;
  }

  // COD safety: if COD was already marked collected before this failure
  // report reached us, block outright rather than silently discarding the
  // collected flag -- an admin must reconcile the cash manually.
  if (assignment.codCollected) {
    const e = new Error("COD was already marked collected on this delivery -- an admin must reconcile this manually before a failure can be recorded.");
    e.status = 409;
    throw e;
  }

  const nextAssignmentStatus = reason === "CUSTOMER_REQUESTED_RESCHEDULE" ? "rescheduled" : "delivery_failed";
  assertAssignmentTransition(assignmentStatus, nextAssignmentStatus);

  const assignmentId = assignment.id || randomUUID();
  const attemptNumber = (await DeliveryAttempt.countDocuments({ orderId })) + 1;
  const nextAction = resolveNextAction(reason, attemptNumber);

  const attemptDoc = {
    id: `datt-${randomUUID().slice(0, 10)}`,
    orderId,
    assignmentId,
    driverId,
    shopId: getNotificationShopId(order),
    attemptNumber,
    result: "failed",
    reasonCode: reason,
    note,
    customerReached,
    contactAttempts,
    requestedRetryAt,
    evidenceMediaAssetIds,
    nextAction,
    occurredAt: now,
    createdBy: user?.sub || driverId,
    createdByRole: "driver",
  };

  const historyEntry = {
    from: order.status,
    to: order.status,
    by: user?.name || user?.sub || "driver",
    role: "driver",
    note: `Delivery attempt #${attemptNumber} failed: ${reason}.`,
    timestamp: now,
  };

  const session = await mongoose.startSession();
  let updatedOrder;
  try {
    await session.withTransaction(async () => {
      await DeliveryAttempt.create([attemptDoc], { session });
      // Optimistic-concurrency guard: the filter re-checks driverId,
      // attemptCount (the value read above), and codCollected so a
      // concurrent second failure/completion report on the same
      // assignment cannot both win -- one of them will find no matching
      // document and surface a 409 instead of silently overwriting.
      updatedOrder = await Order.findOneAndUpdate(
        {
          orderId,
          "driverAssignment.driverId": driverId,
          "driverAssignment.attemptCount": assignment.attemptCount || 0,
          "driverAssignment.codCollected": { $ne: true },
        },
        {
          $set: {
            "driverAssignment.id": assignmentId,
            "driverAssignment.status": nextAssignmentStatus,
            "driverAssignment.attemptCount": attemptNumber,
            "driverAssignment.lastFailureReason": reason,
            "driverAssignment.nextAction": nextAction,
            "driverAssignment.retryScheduledAt": requestedRetryAt,
          },
          $push: { statusHistory: historyEntry },
        },
        { session, returnDocument: "after" }
      ).lean();
      if (!updatedOrder) {
        const conflict = new Error("Delivery assignment changed before this failure could be recorded.");
        conflict.status = 409;
        throw conflict;
      }
    });
  } finally {
    await session.endSession();
  }

  await Driver.findOneAndUpdate({ id: driverId }, { $set: { status: "active" } });

  logAuditEvent({
    action: "delivery.attempt.failed",
    actorId: user?.sub,
    actorName: user?.name,
    actorRole: "driver",
    entityType: "order",
    entityId: orderId,
    summary: `Delivery attempt #${attemptNumber} for order ${orderId} failed: ${reason}.`,
    meta: { assignmentId, reason, nextAction, attemptNumber },
  });

  await notifyDeliveryFailed(updatedOrder, attemptDoc);
  if (attemptNumber >= MAX_DELIVERY_ATTEMPTS) await notifyMaxAttemptsReached(updatedOrder, attemptDoc);

  return { attempt: sanitizeDeliveryAttempt(attemptDoc), order: await normalizeDriverTaskOrder(updatedOrder), idempotentReplay: false };
}

async function reportDeliveryFailureSeed(context) {
  const { driverId, orderId, reason, note, customerReached, contactAttempts, requestedRetryAt, evidenceMediaAssetIds, user, now } = context;

  const orders = getSeedOrders();
  const order = orders.find((o) => o.orderId === orderId && o.driverAssignment?.driverId === driverId);
  if (!order) {
    const e = new Error("Delivery not found or not assigned to this driver."); e.status = 404; throw e;
  }
  if (["Delivered", "Cancelled", "Refunded"].includes(order.status)) {
    const e = new Error(`Delivery failure cannot be reported once the order is "${order.status}".`); e.status = 409; throw e;
  }
  await assertDriverEligibleForShop({ driverId, shopId: getNotificationShopId(order), action: "access" });

  const assignment = order.driverAssignment;
  const assignmentStatus = inferAssignmentStatus(assignment);

  if (assignmentStatus === "completed") {
    const e = new Error("This delivery has already been completed."); e.status = 409; throw e;
  }

  if (["delivery_failed", "rescheduled"].includes(assignmentStatus)) {
    const [latest] = seedDeliveryAttempts
      .filter((a) => a.orderId === orderId && a.assignmentId === assignment.id)
      .sort((a, b) => b.attemptNumber - a.attemptNumber);
    if (latest) {
      return { attempt: sanitizeDeliveryAttempt(latest), order: await normalizeDriverTaskOrder(order), idempotentReplay: true };
    }
  }

  if (!isFailableAssignmentStatus(assignmentStatus)) {
    const e = new Error(`Delivery failure cannot be reported from assignment status "${assignmentStatus}".`); e.status = 409; throw e;
  }

  if (assignment.codCollected) {
    const e = new Error("COD was already marked collected on this delivery -- an admin must reconcile this manually before a failure can be recorded.");
    e.status = 409;
    throw e;
  }

  const nextAssignmentStatus = reason === "CUSTOMER_REQUESTED_RESCHEDULE" ? "rescheduled" : "delivery_failed";
  assertAssignmentTransition(assignmentStatus, nextAssignmentStatus);

  if (!assignment.id) assignment.id = randomUUID();
  const attemptNumber = seedDeliveryAttempts.filter((a) => a.orderId === orderId).length + 1;
  const nextAction = resolveNextAction(reason, attemptNumber);

  const attemptDoc = {
    id: `datt-${randomUUID().slice(0, 10)}`,
    orderId,
    assignmentId: assignment.id,
    driverId,
    shopId: getNotificationShopId(order),
    attemptNumber,
    result: "failed",
    reasonCode: reason,
    note,
    customerReached,
    contactAttempts,
    requestedRetryAt: requestedRetryAt ? requestedRetryAt.toISOString() : null,
    evidenceMediaAssetIds,
    nextAction,
    occurredAt: now.toISOString(),
    createdBy: user?.sub || driverId,
    createdByRole: "driver",
  };
  seedDeliveryAttempts.push(attemptDoc);

  assignment.status = nextAssignmentStatus;
  assignment.attemptCount = attemptNumber;
  assignment.lastFailureReason = reason;
  assignment.nextAction = nextAction;
  assignment.retryScheduledAt = requestedRetryAt ? requestedRetryAt.toISOString() : null;

  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push({
    from: order.status,
    to: order.status,
    by: user?.name || user?.sub || "driver",
    role: "driver",
    note: `Delivery attempt #${attemptNumber} failed: ${reason}.`,
    timestamp: now.toISOString(),
  });
  order.updatedAt = now.toISOString();

  const driver = seedDrivers.get(driverId);
  if (driver) driver.status = "active";

  logAuditEvent({
    action: "delivery.attempt.failed",
    actorId: user?.sub,
    actorName: user?.name,
    actorRole: "driver",
    entityType: "order",
    entityId: orderId,
    summary: `Delivery attempt #${attemptNumber} for order ${orderId} failed: ${reason}.`,
    meta: { assignmentId: assignment.id, reason, nextAction, attemptNumber },
  });

  await notifyDeliveryFailed(order, attemptDoc);
  if (attemptNumber >= MAX_DELIVERY_ATTEMPTS) await notifyMaxAttemptsReached(order, attemptDoc);

  return { attempt: sanitizeDeliveryAttempt(attemptDoc), order: await normalizeDriverTaskOrder(order), idempotentReplay: false };
}

// ── Phase E: post-failure resolution actions ────────────────────────────
// `scopeShopId` is the server-resolved seller shop id, or null for an
// admin/support caller acting without shop scoping -- never trust a
// client-supplied shopId for the admin path.
async function loadOrderForDeliveryAction(scopeShopId, orderId) {
  if (env.mongoUri) {
    const filter = scopeShopId ? { orderId, shopIds: scopeShopId } : { orderId };
    const order = await Order.findOne(filter).lean();
    if (!order) { const e = new Error("Order not found."); e.status = 404; throw e; }
    return order;
  }
  const order = getSeedOrders().find(
    (o) => o.orderId === orderId && (!scopeShopId || (Array.isArray(o.shopIds) && o.shopIds.includes(scopeShopId)))
  );
  if (!order) { const e = new Error("Order not found."); e.status = 404; throw e; }
  return order;
}

// Reassignment must never bypass the relationship model: the target
// driver needs an active DriverShopAccess for the ORDER's shop --
// exactly the same rule for seller and admin callers alike. Per Task 7,
// if no relationship exists, this throws rather than creating one
// implicitly; the admin must explicitly create/approve access first
// (POST /api/drivers/access/direct) before reassigning to that driver.
async function resolveDriverForReassignment(orderShopId, driverId) {
  const { driver } = await assertDriverEligibleForShop({ driverId, shopId: orderShopId, action: "reassign" });
  return driver;
}

async function notifyDeliveryRetryScheduled(order, driverId) {
  const shopId = getNotificationShopId(order);
  const message = `Order ${order.orderId} delivery will be retried by the same driver.`;
  const tasks = [
    createNotificationsForRole({ recipientRole: "seller", shopId, title: "Delivery retry scheduled", message, type: "delivery_retry_scheduled", entityType: "order", entityId: order.orderId }),
    createNotificationsForRole({ recipientRole: "admin", shopId, title: "Delivery retry scheduled", message, type: "delivery_retry_scheduled", entityType: "order", entityId: order.orderId }),
    createNotificationsForRole({ recipientRole: "driver", recipientUserIds: [driverId], title: "Delivery retry", message: `Please retry delivery for order ${order.orderId}.`, type: "delivery_retry_scheduled", entityType: "order", entityId: order.orderId }),
  ];
  if (order.customerId) {
    tasks.push(createNotificationsForRole({ recipientRole: "customer", recipientUserIds: [String(order.customerId)], title: "Delivery update", message: "We'll attempt your delivery again shortly.", type: "delivery_retry_scheduled", entityType: "order", entityId: order.orderId }));
  }
  await runNotificationTasks(tasks);
}

async function notifyDeliveryReassigned(order, newDriver) {
  const shopId = getNotificationShopId(order);
  const internalMessage = `Order ${order.orderId} was reassigned to driver ${newDriver.name}.`;
  const tasks = [
    createNotificationsForRole({ recipientRole: "seller", shopId, title: "Delivery reassigned", message: internalMessage, type: "delivery_reassigned", entityType: "order", entityId: order.orderId }),
    createNotificationsForRole({ recipientRole: "admin", shopId, title: "Delivery reassigned", message: internalMessage, type: "delivery_reassigned", entityType: "order", entityId: order.orderId }),
  ];
  if (newDriver.userId) {
    tasks.push(createNotificationsForRole({ recipientRole: "driver", recipientUserIds: [newDriver.userId], title: "New delivery assigned", message: `You've been assigned order ${order.orderId}.`, type: "delivery_reassigned", entityType: "order", entityId: order.orderId }));
  }
  if (order.customerId) {
    tasks.push(createNotificationsForRole({ recipientRole: "customer", recipientUserIds: [String(order.customerId)], title: "Delivery update", message: "A new driver has been assigned to your delivery.", type: "delivery_reassigned", entityType: "order", entityId: order.orderId }));
  }
  await runNotificationTasks(tasks);
}

async function notifyReturnedToSeller(order, reasonCode) {
  const shopId = getNotificationShopId(order);
  const internalMessage = `Order ${order.orderId} was returned to the seller${reasonCode ? ` (${reasonCode})` : ""}.`;
  const tasks = [
    createNotificationsForRole({ recipientRole: "seller", shopId, title: "Order returned", message: internalMessage, type: "delivery_returned_to_seller", entityType: "order", entityId: order.orderId }),
    createNotificationsForRole({ recipientRole: "admin", shopId, title: "Order returned", message: internalMessage, type: "delivery_returned_to_seller", entityType: "order", entityId: order.orderId }),
    createNotificationsForRole({ recipientRole: "support", shopId, title: "Order returned", message: internalMessage, type: "delivery_returned_to_seller", entityType: "order", entityId: order.orderId }),
  ];
  if (order.customerId) {
    tasks.push(createNotificationsForRole({ recipientRole: "customer", recipientUserIds: [String(order.customerId)], title: "Delivery update", message: getCustomerSafeFailureMessage(reasonCode), type: "delivery_returned_to_seller", entityType: "order", entityId: order.orderId }));
  }
  await runNotificationTasks(tasks);
}

/**
 * Seller/admin action: retry the same driver on a failed/rescheduled
 * assignment. Blocked when the failure reason requires return-to-seller,
 * or when the attempt ceiling has already been reached -- in both cases
 * the caller must use reassignFailedDelivery/returnFailedDeliveryToSeller
 * instead. Never usable by the driver themself (no driver route calls this).
 */
export async function retryFailedDelivery(scopeShopId, orderId, user) {
  const now = new Date();
  const order = await loadOrderForDeliveryAction(scopeShopId, orderId);
  const assignment = order.driverAssignment;
  if (!assignment?.driverId) { const e = new Error("Order has no driver assignment to retry."); e.status = 409; throw e; }

  const assignmentStatus = inferAssignmentStatus(assignment);
  const reasonPolicy = assignment.lastFailureReason ? getDeliveryFailureReasonPolicy(assignment.lastFailureReason) : null;
  if (reasonPolicy?.mustReturnToSeller) {
    const e = new Error(`This delivery failure ("${assignment.lastFailureReason}") must be returned to the seller, not retried with the same driver.`);
    e.status = 409;
    throw e;
  }
  if ((assignment.attemptCount || 0) >= MAX_DELIVERY_ATTEMPTS) {
    const e = new Error(`Maximum delivery attempts (${MAX_DELIVERY_ATTEMPTS}) reached -- this delivery requires admin review or return-to-seller, not a same-driver retry.`);
    e.status = 409;
    throw e;
  }
  assertAssignmentTransition(assignmentStatus, "accepted");
  await assertDriverEligibleForShop({
    driverId: assignment.driverId,
    shopId: scopeShopId || getNotificationShopId(order),
    action: "retry",
    excludeOrderId: orderId,
  });

  const actorRole = scopeShopId ? "seller" : "admin";
  const historyEntry = {
    from: order.status,
    to: order.status,
    by: user?.name || user?.sub || actorRole,
    role: actorRole,
    note: `Delivery retry scheduled with the same driver (attempt ${assignment.attemptCount || 0} of ${MAX_DELIVERY_ATTEMPTS}).`,
    timestamp: now,
  };

  let updatedOrder;
  if (env.mongoUri) {
    updatedOrder = await Order.findOneAndUpdate(
      { orderId, "driverAssignment.driverId": assignment.driverId, "driverAssignment.attemptCount": assignment.attemptCount || 0 },
      {
        $set: { "driverAssignment.status": "accepted", "driverAssignment.nextAction": null, "driverAssignment.retryScheduledAt": null },
        $push: { statusHistory: historyEntry },
      },
      { returnDocument: "after" }
    ).lean();
    if (!updatedOrder) { const e = new Error("Delivery assignment changed before this retry could be recorded."); e.status = 409; throw e; }
  } else {
    assignment.status = "accepted";
    assignment.nextAction = null;
    assignment.retryScheduledAt = null;
    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    order.statusHistory.push({ ...historyEntry, timestamp: now.toISOString() });
    order.updatedAt = now.toISOString();
    updatedOrder = order;
  }

  logAuditEvent({
    action: "delivery.retry.same_driver", actorId: user?.sub, actorName: user?.name, actorRole,
    entityType: "order", entityId: orderId,
    summary: `Order ${orderId} delivery retry scheduled with the same driver.`,
    meta: { driverId: assignment.driverId },
  });
  await notifyDeliveryRetryScheduled(updatedOrder, assignment.driverId);
  return normalizeDriverTaskOrder(updatedOrder);
}

/**
 * Seller/admin action: supersede the failed assignment with a new driver.
 * The previous assignment is preserved in driverAssignmentHistory (never
 * mutated in place), and the new assignment starts a fresh attempt count --
 * MAX_DELIVERY_ATTEMPTS is a per-order ceiling on DeliveryAttempt rows
 * (see reportDeliveryFailureMongo/Seed), not a per-assignment one, so this
 * does not let reassignment bypass the ceiling.
 */
export async function reassignFailedDelivery(scopeShopId, orderId, rawPayload, user) {
  const parsed = reassignDeliverySchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid reassignment payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }

  const now = new Date();
  const order = await loadOrderForDeliveryAction(scopeShopId, orderId);
  const assignment = order.driverAssignment;
  if (!assignment?.driverId) { const e = new Error("Order has no driver assignment to reassign."); e.status = 409; throw e; }

  const assignmentStatus = inferAssignmentStatus(assignment);
  if (["completed", "returned_to_seller", "cancelled"].includes(assignmentStatus)) {
    const e = new Error(`Delivery cannot be reassigned while the assignment is "${assignmentStatus}".`); e.status = 409; throw e;
  }
  const reasonPolicy = assignment.lastFailureReason ? getDeliveryFailureReasonPolicy(assignment.lastFailureReason) : null;
  if (reasonPolicy && reasonPolicy.reassignAllowed === false) {
    const e = new Error(`This delivery failure ("${assignment.lastFailureReason}") cannot be reassigned to another driver.`); e.status = 409; throw e;
  }
  if (parsed.data.driverId === assignment.driverId) {
    const e = new Error("Reassignment must select a different driver."); e.status = 422; throw e;
  }

  const orderShopId = scopeShopId || getNotificationShopId(order);
  const newDriver = await resolveDriverForReassignment(orderShopId, parsed.data.driverId);
  const newAssignmentId = randomUUID();
  const wasShipped = order.status === "Shipped";
  const newAssignment = {
    id: newAssignmentId,
    driverId: newDriver.id,
    driverName: newDriver.name,
    driverPhone: newDriver.phone,
    assignedAt: now,
    pickedUpAt: wasShipped ? now : null,
    deliveredAt: null,
    codCollected: false,
    codAmount: order.paymentMethod === "cod" ? Number(order.subtotal) || 0 : 0,
    note: "",
    proofOfDeliveryUrl: "",
    status: wasShipped ? "picked_up" : "accepted",
    attemptCount: 0,
    lastFailureReason: null,
    nextAction: null,
    retryScheduledAt: null,
    supersededAt: null,
    supersededByAssignmentId: null,
  };
  const supersededAssignment = { ...assignment, supersededAt: now, supersededByAssignmentId: newAssignmentId };

  const actorRole = scopeShopId ? "seller" : "admin";
  const historyEntry = {
    from: order.status,
    to: order.status,
    by: user?.name || user?.sub || actorRole,
    role: actorRole,
    note: `Delivery reassigned from ${assignment.driverName || assignment.driverId} to ${newDriver.name}.`,
    timestamp: now,
  };

  let updatedOrder;
  if (env.mongoUri) {
    updatedOrder = await Order.findOneAndUpdate(
      { orderId, "driverAssignment.driverId": assignment.driverId, "driverAssignment.attemptCount": assignment.attemptCount || 0 },
      {
        $set: { driverAssignment: newAssignment },
        $push: { driverAssignmentHistory: supersededAssignment, statusHistory: historyEntry },
      },
      { returnDocument: "after" }
    ).lean();
    if (!updatedOrder) { const e = new Error("Delivery assignment changed before this reassignment could be recorded."); e.status = 409; throw e; }
    await Driver.findOneAndUpdate({ id: assignment.driverId }, { $set: { status: "active" } });
    await Driver.findOneAndUpdate({ id: newDriver.id }, { $set: { status: "on_delivery" } });
  } else {
    if (!Array.isArray(order.driverAssignmentHistory)) order.driverAssignmentHistory = [];
    order.driverAssignmentHistory.push(supersededAssignment);
    order.driverAssignment = { ...newAssignment, assignedAt: now.toISOString(), pickedUpAt: wasShipped ? now.toISOString() : null };
    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    order.statusHistory.push({ ...historyEntry, timestamp: now.toISOString() });
    order.updatedAt = now.toISOString();

    const oldDriver = seedDrivers.get(assignment.driverId);
    if (oldDriver) oldDriver.status = "active";
    const newSeedDriver = seedDrivers.get(newDriver.id);
    if (newSeedDriver) newSeedDriver.status = "on_delivery";
    updatedOrder = order;
  }

  logAuditEvent({
    action: "delivery.reassigned", actorId: user?.sub, actorName: user?.name, actorRole,
    entityType: "order", entityId: orderId,
    summary: `Order ${orderId} delivery reassigned to driver ${newDriver.id}.`,
    meta: { fromDriverId: assignment.driverId, toDriverId: newDriver.id },
  });
  await notifyDeliveryReassigned(updatedOrder, newDriver);
  return normalizeDriverTaskOrder(updatedOrder);
}

/**
 * Seller/admin action: end the driver-delivery attempt entirely and hand
 * the order back to the seller for re-fulfillment (damaged goods,
 * packaging issues, customer refusal, etc). Terminal for this assignment --
 * the assignment moves to `returned_to_seller` (no further transitions,
 * see deliveryAssignmentWorkflow.js) and is archived to history; the order
 * itself reverts to "Ready for Delivery" so the seller's existing
 * delivery-offer/assign flow can start a clean new assignment.
 */
export async function returnFailedDeliveryToSeller(scopeShopId, orderId, user) {
  const now = new Date();
  const order = await loadOrderForDeliveryAction(scopeShopId, orderId);
  const assignment = order.driverAssignment;
  if (!assignment?.driverId) { const e = new Error("Order has no driver assignment to return."); e.status = 409; throw e; }

  const assignmentStatus = inferAssignmentStatus(assignment);
  assertAssignmentTransition(assignmentStatus, "returned_to_seller");

  const archivedAssignment = { ...assignment, status: "returned_to_seller", supersededAt: now, supersededByAssignmentId: null };
  const actorRole = scopeShopId ? "seller" : "admin";
  const historyEntry = {
    from: order.status,
    to: "Ready for Delivery",
    by: user?.name || user?.sub || actorRole,
    role: actorRole,
    note: `Delivery returned to seller${assignment.lastFailureReason ? ` (${assignment.lastFailureReason})` : ""}.`,
    timestamp: now,
  };

  let updatedOrder;
  if (env.mongoUri) {
    updatedOrder = await Order.findOneAndUpdate(
      { orderId, "driverAssignment.driverId": assignment.driverId, "driverAssignment.attemptCount": assignment.attemptCount || 0 },
      {
        $set: { status: "Ready for Delivery" },
        $unset: { driverAssignment: "" },
        $push: { driverAssignmentHistory: archivedAssignment, statusHistory: historyEntry },
      },
      { returnDocument: "after" }
    ).lean();
    if (!updatedOrder) { const e = new Error("Delivery assignment changed before this return could be recorded."); e.status = 409; throw e; }
    await Driver.findOneAndUpdate({ id: assignment.driverId }, { $set: { status: "active" } });
  } else {
    if (!Array.isArray(order.driverAssignmentHistory)) order.driverAssignmentHistory = [];
    order.driverAssignmentHistory.push(archivedAssignment);
    order.driverAssignment = undefined;
    order.status = "Ready for Delivery";
    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    order.statusHistory.push({ ...historyEntry, timestamp: now.toISOString() });
    order.updatedAt = now.toISOString();

    const driver = seedDrivers.get(assignment.driverId);
    if (driver) driver.status = "active";
    updatedOrder = order;
  }

  logAuditEvent({
    action: "delivery.returned_to_seller", actorId: user?.sub, actorName: user?.name, actorRole,
    entityType: "order", entityId: orderId,
    summary: `Order ${orderId} delivery returned to seller.`,
    meta: { driverId: assignment.driverId, reason: assignment.lastFailureReason || null },
  });
  await notifyReturnedToSeller(updatedOrder, assignment.lastFailureReason);
  return normalizeDriverTaskOrder(updatedOrder);
}

export async function remitDriverCod(driverId, amount, user) {
  if (env.mongoUri) {
    const driver = await Driver.findOne({ id: driverId }).lean();
    if (!driver) { const e = new Error("Driver not found."); e.status = 404; throw e; }
    const remitAmount = Math.min(Number(amount) || driver.codBalance, driver.codBalance);
    const updated = await Driver.findOneAndUpdate(
      { id: driverId },
      { $inc: { codBalance: -remitAmount } },
      { returnDocument: "after" }
    ).lean();
    return updated;
  }

  const driver = seedDrivers.get(driverId);
  if (!driver) { const e = new Error("Driver not found."); e.status = 404; throw e; }
  const remitAmount = Math.min(Number(amount) || driver.codBalance, driver.codBalance);
  driver.codBalance = Math.max(0, driver.codBalance - remitAmount);
  return driver;
}
