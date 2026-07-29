import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { DriverShopAccess } from "../../models/DriverShopAccess.js";
import { Order } from "../../models/Order.js";
import { getSeedOrders } from "../orders/orders.service.js";
import {
  DRIVER_SHOP_ACCESS_STATUSES,
  CAPACITY_HOLDING_ASSIGNMENT_STATUSES,
  SELLER_ALLOWED_TRANSITIONS,
  ADMIN_ALLOWED_TRANSITIONS,
} from "../../shared/driverAccessPolicy.js";

// ── Seed-mode store ──────────────────────────────────────────────────────
// Local module state, same precedent as seedDeliveryOffers/seedDrivers in
// drivers.service.js -- not part of the shared seedRepository object.
const seedDriverShopAccess = new Map();

export function __resetDriverShopAccessForTests() {
  seedDriverShopAccess.clear();
}

export function __getSeedDriverShopAccessForTests() {
  return [...seedDriverShopAccess.values()];
}

// Test-only shortcut: seeds an already-active relationship directly,
// bypassing the request/approve workflow, for tests whose subject is
// something else (assignment, COD, delivery-failure) and only need "this
// driver already has valid access to this shop" as a precondition.
export async function __grantActiveAccessForTests(driverId, shopId, overrides = {}) {
  const now = new Date();
  const record = {
    id: `dsa-test-${driverId}-${shopId}`,
    driverId,
    shopId,
    status: "active",
    requestedByType: "admin",
    requestedByUserId: "test-admin",
    approvedByUserId: "test-admin",
    approvedAt: now,
    rejectedAt: null,
    rejectionReason: "",
    suspendedAt: null,
    suspendedByUserId: null,
    revokedAt: null,
    revokedByUserId: null,
    serviceZoneIds: [],
    canReceiveBroadcasts: true,
    canBeDirectlyAssigned: true,
    ...overrides,
  };
  if (env.mongoUri) {
    await DriverShopAccess.deleteOne({ driverId, shopId });
    const doc = await DriverShopAccess.create(record);
    return normalizeAccessRecord(doc);
  }
  // Mirror the mongo branch's delete-then-create: remove any existing
  // row(s) for this (driverId, shopId) pair first, since the Map is
  // keyed by access id, not by that pair -- an old pending/rejected row
  // left in place would otherwise be found ahead of this one and shadow
  // it (Map iteration/`.find()` returns insertion order).
  for (const [id, existing] of seedDriverShopAccess) {
    if (existing.driverId === driverId && existing.shopId === shopId) seedDriverShopAccess.delete(id);
  }
  const seedRecord = { ...record, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  seedDriverShopAccess.set(seedRecord.id, seedRecord);
  return normalizeAccessRecord(seedRecord);
}

function normalizeAccessRecord(record) {
  if (!record) return null;
  const raw = typeof record.toObject === "function" ? record.toObject() : record;
  return {
    id: raw.id,
    driverId: raw.driverId,
    shopId: raw.shopId,
    status: raw.status,
    requestedByType: raw.requestedByType,
    requestedByUserId: raw.requestedByUserId ?? null,
    approvedByUserId: raw.approvedByUserId ?? null,
    approvedAt: raw.approvedAt ?? null,
    rejectedAt: raw.rejectedAt ?? null,
    rejectionReason: raw.rejectionReason || "",
    suspendedAt: raw.suspendedAt ?? null,
    suspendedByUserId: raw.suspendedByUserId ?? null,
    revokedAt: raw.revokedAt ?? null,
    revokedByUserId: raw.revokedByUserId ?? null,
    serviceZoneIds: Array.isArray(raw.serviceZoneIds) ? raw.serviceZoneIds : [],
    canReceiveBroadcasts: raw.canReceiveBroadcasts !== false,
    canBeDirectlyAssigned: raw.canBeDirectlyAssigned !== false,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

function conflictError(message) {
  const e = new Error(message);
  e.status = 409;
  return e;
}
function notFoundError(message) {
  const e = new Error(message);
  e.status = 404;
  return e;
}
function forbiddenError(message) {
  const e = new Error(message);
  e.status = 403;
  return e;
}

function inferAssignmentStatusForAccessGuard(assignment) {
  if (!assignment) return null;
  if (assignment.status) return assignment.status;
  if (assignment.deliveredAt) return "completed";
  if (assignment.pickedUpAt) return "picked_up";
  return "accepted";
}

function isBlockingAssignmentForRevocation(order, access) {
  const assignment = order?.driverAssignment;
  if (!assignment || assignment.driverId !== access.driverId) return false;
  if (!Array.isArray(order.shopIds) || !order.shopIds.includes(access.shopId)) return false;
  return CAPACITY_HOLDING_ASSIGNMENT_STATUSES.includes(inferAssignmentStatusForAccessGuard(assignment));
}

async function assertNoBlockingAssignmentForRevocation(access) {
  if (env.mongoUri) {
    const orders = await Order.find({
      shopIds: access.shopId,
      "driverAssignment.driverId": access.driverId,
    }).select("orderId shopIds driverAssignment").lean();
    const blocking = orders.find((order) => isBlockingAssignmentForRevocation(order, access));
    if (blocking) {
      throw conflictError(`Cannot revoke this driver relationship while order ${blocking.orderId} has an active assignment.`);
    }
    return;
  }

  const blocking = getSeedOrders().find((order) => isBlockingAssignmentForRevocation(order, access));
  if (blocking) {
    throw conflictError(`Cannot revoke this driver relationship while order ${blocking.orderId} has an active assignment.`);
  }
}

// ── Reads ────────────────────────────────────────────────────────────────

export async function findDriverShopAccess(driverId, shopId) {
  if (env.mongoUri) {
    const record = await DriverShopAccess.findOne({ driverId, shopId }).lean();
    return normalizeAccessRecord(record);
  }
  const record = [...seedDriverShopAccess.values()].find((a) => a.driverId === driverId && a.shopId === shopId);
  return normalizeAccessRecord(record);
}

export async function getDriverShopAccessById(id) {
  if (env.mongoUri) {
    const record = await DriverShopAccess.findOne({ id }).lean();
    return normalizeAccessRecord(record);
  }
  return normalizeAccessRecord(seedDriverShopAccess.get(id));
}

export async function listDriverShopAccessForShop(shopId, { status } = {}) {
  if (env.mongoUri) {
    const filter = { shopId };
    if (status) filter.status = status;
    const records = await DriverShopAccess.find(filter).sort({ createdAt: -1 }).lean();
    return records.map(normalizeAccessRecord);
  }
  return [...seedDriverShopAccess.values()]
    .filter((a) => a.shopId === shopId && (!status || a.status === status))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(normalizeAccessRecord);
}

export async function listDriverShopAccessForDriver(driverId, { status } = {}) {
  if (env.mongoUri) {
    const filter = { driverId };
    if (status) filter.status = status;
    const records = await DriverShopAccess.find(filter).sort({ createdAt: -1 }).lean();
    return records.map(normalizeAccessRecord);
  }
  return [...seedDriverShopAccess.values()]
    .filter((a) => a.driverId === driverId && (!status || a.status === status))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(normalizeAccessRecord);
}

export async function listPendingDriverShopAccessRequests() {
  return env.mongoUri
    ? (await DriverShopAccess.find({ status: "pending_admin_approval" }).sort({ createdAt: -1 }).lean()).map(normalizeAccessRecord)
    : [...seedDriverShopAccess.values()]
        .filter((a) => a.status === "pending_admin_approval")
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .map(normalizeAccessRecord);
}

// Driver dashboard / eligibility helper both need "which shops can this
// driver currently work for" -- a single source of truth for that
// question, never re-derived ad hoc elsewhere.
export async function listActiveShopIdsForDriver(driverId) {
  const active = await listDriverShopAccessForDriver(driverId, { status: "active" });
  return active.map((a) => a.shopId);
}

export async function hasActiveAccess(driverId, shopId) {
  const access = await findDriverShopAccess(driverId, shopId);
  return Boolean(access && access.status === "active");
}

// ── Writes ───────────────────────────────────────────────────────────────

/**
 * Creates or re-opens a driver-shop relationship request. Idempotent by
 * design around the (driverId, shopId) uniqueness constraint: a fresh
 * pair gets a new pending row; an existing rejected/revoked pair is
 * reopened to pending (a genuine re-request); an existing
 * pending/active/suspended pair is returned as-is with no state change
 * (never silently duplicated, never silently reactivated).
 */
export async function requestDriverShopAccess({ driverId, shopId, requestedByType, requestedByUserId }) {
  const existing = await findDriverShopAccess(driverId, shopId);
  const now = new Date();

  if (existing) {
    if (["pending_admin_approval", "active", "suspended"].includes(existing.status)) {
      return { access: existing, created: false };
    }
    // rejected or revoked -- allow a fresh request, reusing the same row
    // (the unique index forbids a second row for this pair).
    const patch = {
      status: "pending_admin_approval",
      requestedByType,
      requestedByUserId: requestedByUserId || null,
      rejectedAt: null,
      rejectionReason: "",
      revokedAt: null,
      revokedByUserId: null,
    };
    if (env.mongoUri) {
      const updated = await DriverShopAccess.findOneAndUpdate({ id: existing.id }, { $set: patch }, { returnDocument: "after" }).lean();
      return { access: normalizeAccessRecord(updated), created: false };
    }
    const record = seedDriverShopAccess.get(existing.id);
    Object.assign(record, patch, { updatedAt: now.toISOString() });
    return { access: normalizeAccessRecord(record), created: false };
  }

  const record = {
    id: `dsa-${randomUUID().slice(0, 10)}`,
    driverId,
    shopId,
    status: "pending_admin_approval",
    requestedByType,
    requestedByUserId: requestedByUserId || null,
    approvedByUserId: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: "",
    suspendedAt: null,
    suspendedByUserId: null,
    revokedAt: null,
    revokedByUserId: null,
    serviceZoneIds: [],
    canReceiveBroadcasts: true,
    canBeDirectlyAssigned: true,
  };

  if (env.mongoUri) {
    const doc = await DriverShopAccess.create(record);
    return { access: normalizeAccessRecord(doc), created: true };
  }
  const seedRecord = { ...record, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  seedDriverShopAccess.set(seedRecord.id, seedRecord);
  return { access: normalizeAccessRecord(seedRecord), created: true };
}

/**
 * Admin directly creates an already-approved relationship -- the one
 * path allowed to skip the pending state, since the admin IS the
 * approval authority. Still always produces an explicit
 * DriverShopAccess row (never an implicit/hidden grant).
 */
export async function adminCreateApprovedAccess({ driverId, shopId, adminUserId, serviceZoneIds, canReceiveBroadcasts, canBeDirectlyAssigned }) {
  const existing = await findDriverShopAccess(driverId, shopId);
  const now = new Date();
  const patch = {
    status: "active",
    requestedByType: "admin",
    requestedByUserId: adminUserId || null,
    approvedByUserId: adminUserId || null,
    approvedAt: now,
    rejectedAt: null,
    rejectionReason: "",
    revokedAt: null,
    revokedByUserId: null,
    ...(serviceZoneIds ? { serviceZoneIds } : {}),
    ...(canReceiveBroadcasts !== undefined ? { canReceiveBroadcasts } : {}),
    ...(canBeDirectlyAssigned !== undefined ? { canBeDirectlyAssigned } : {}),
  };

  if (existing) {
    if (env.mongoUri) {
      const updated = await DriverShopAccess.findOneAndUpdate({ id: existing.id }, { $set: patch }, { returnDocument: "after" }).lean();
      return normalizeAccessRecord(updated);
    }
    const record = seedDriverShopAccess.get(existing.id);
    Object.assign(record, patch, { updatedAt: now.toISOString() });
    return normalizeAccessRecord(record);
  }

  const record = {
    id: `dsa-${randomUUID().slice(0, 10)}`,
    driverId,
    shopId,
    suspendedAt: null,
    suspendedByUserId: null,
    serviceZoneIds: [],
    canReceiveBroadcasts: true,
    canBeDirectlyAssigned: true,
    ...patch,
  };
  if (env.mongoUri) {
    const doc = await DriverShopAccess.create(record);
    return normalizeAccessRecord(doc);
  }
  const seedRecord = { ...record, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  seedDriverShopAccess.set(seedRecord.id, seedRecord);
  return normalizeAccessRecord(seedRecord);
}

async function transitionAccess(accessId, nextStatus, patch, { actorRole }) {
  const existing = await getDriverShopAccessById(accessId);
  if (!existing) throw notFoundError("Driver-shop access request not found.");

  const allowed = actorRole === "admin" ? ADMIN_ALLOWED_TRANSITIONS : SELLER_ALLOWED_TRANSITIONS;
  const allowedTargets = allowed[existing.status] || [];
  if (!allowedTargets.includes(nextStatus)) {
    throw conflictError(`Cannot move a "${existing.status}" relationship to "${nextStatus}".`);
  }

  const now = new Date();
  const fullPatch = { status: nextStatus, ...patch };
  if (env.mongoUri) {
    const updated = await DriverShopAccess.findOneAndUpdate({ id: accessId }, { $set: fullPatch }, { returnDocument: "after" }).lean();
    return normalizeAccessRecord(updated);
  }
  const record = seedDriverShopAccess.get(accessId);
  Object.assign(record, fullPatch, { updatedAt: now.toISOString() });
  return normalizeAccessRecord(record);
}

export async function approveDriverShopAccess(accessId, adminUserId, { serviceZoneIds, canReceiveBroadcasts, canBeDirectlyAssigned } = {}) {
  return transitionAccess(
    accessId,
    "active",
    {
      approvedByUserId: adminUserId,
      approvedAt: new Date(),
      ...(serviceZoneIds ? { serviceZoneIds } : {}),
      ...(canReceiveBroadcasts !== undefined ? { canReceiveBroadcasts } : {}),
      ...(canBeDirectlyAssigned !== undefined ? { canBeDirectlyAssigned } : {}),
    },
    { actorRole: "admin" }
  );
}

export async function rejectDriverShopAccess(accessId, adminUserId, reason = "") {
  return transitionAccess(
    accessId,
    "rejected",
    { rejectedAt: new Date(), rejectionReason: String(reason || "").slice(0, 500), approvedByUserId: adminUserId },
    { actorRole: "admin" }
  );
}

export async function reactivateDriverShopAccess(accessId, adminUserId) {
  return transitionAccess(
    accessId,
    "active",
    { approvedByUserId: adminUserId, approvedAt: new Date() },
    { actorRole: "admin" }
  );
}

export async function suspendDriverShopAccess(accessId, actorUserId, { actorRole, shopId } = {}) {
  const existing = await getDriverShopAccessById(accessId);
  if (!existing) throw notFoundError("Driver-shop access request not found.");
  if (actorRole === "seller" && existing.shopId !== shopId) {
    throw forbiddenError("This driver relationship does not belong to your shop.");
  }
  return transitionAccess(accessId, "suspended", { suspendedAt: new Date(), suspendedByUserId: actorUserId }, { actorRole });
}

export async function revokeDriverShopAccess(accessId, actorUserId, { actorRole, shopId } = {}) {
  const existing = await getDriverShopAccessById(accessId);
  if (!existing) throw notFoundError("Driver-shop access request not found.");
  if (actorRole === "seller" && existing.shopId !== shopId) {
    throw forbiddenError("This driver relationship does not belong to your shop.");
  }
  await assertNoBlockingAssignmentForRevocation(existing);
  return transitionAccess(accessId, "revoked", { revokedAt: new Date(), revokedByUserId: actorUserId }, { actorRole });
}

/**
 * Seller cancels their OWN pending request. Distinct from revoke of an
 * active relationship -- a still-pending request was never active, so
 * "cancel" reads better than "revoke" for it, but it's the same
 * underlying transition (pending_admin_approval -> revoked).
 */
export async function cancelPendingDriverShopAccessRequest(accessId, shopId) {
  const existing = await getDriverShopAccessById(accessId);
  if (!existing) throw notFoundError("Driver-shop access request not found.");
  if (existing.shopId !== shopId) throw forbiddenError("This request does not belong to your shop.");
  if (existing.status !== "pending_admin_approval") {
    throw conflictError(`Only a pending request can be cancelled (current status: "${existing.status}").`);
  }
  return transitionAccess(accessId, "revoked", { revokedAt: new Date(), revokedByUserId: null }, { actorRole: "seller" });
}

export { DRIVER_SHOP_ACCESS_STATUSES };
