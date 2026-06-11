import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { Driver } from "../../models/Driver.js";
import { DeliveryOffer } from "../../models/DeliveryOffer.js";
import { createNotificationsForRole } from "../notifications/notifications.service.js";
import { Shop } from "../../models/Shop.js";
import { Order } from "../../models/Order.js";
import { createDriverLoginAccount, deleteDriverLoginAccount } from "../auth/auth.service.js";
import { accrueDeliveredOrderCommissions } from "../orders/orderCommissions.js";
import { recordDeliveryEarning } from "../finance/sellerBalance.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { getSeedOrders } from "../orders/orders.service.js";

// ── In-memory seed drivers ────────────────────────────────────────────
const SEED_DRIVERS = [
  { id: "drv-001", name: "Mohammed Al-Rashidi", phone: "+971 55 111 2233", email: "drv1@tuti.example", vehicleType: "motorcycle", zone: "Dubai Marina", status: "active", codBalance: 0, totalDeliveries: 42, totalCodCollected: 12600, isActive: true, shopId: null, shopName: "", createdBySellerUserId: null },
  { id: "drv-002", name: "Khalid Bin Hamdan",   phone: "+971 50 987 6543", email: "drv2@tuti.example", vehicleType: "car",        zone: "Downtown Dubai", status: "active", codBalance: 320, totalDeliveries: 28, totalCodCollected: 8400, isActive: true, shopId: null, shopName: "", createdBySellerUserId: null },
  { id: "drv-003", name: "Saeed Al-Mansoori",   phone: "+971 54 222 3344", email: "drv3@tuti.example", vehicleType: "motorcycle", zone: "Jumeirah",       status: "inactive", codBalance: 0, totalDeliveries: 15, totalCodCollected: 4500, isActive: false, shopId: null, shopName: "", createdBySellerUserId: null },
];

const seedDrivers = new Map(SEED_DRIVERS.map((d) => [d.id, { ...d }]));
const seedDeliveryOffers = new Map();

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

async function attachLoginToSellerDriver({ driver, shopId, driverId, name, loginEmail }) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
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
    shopId: safeShopId,
    driverId: driverId || driver?.id || null,
  });

  if (env.mongoUri) {
    const updated = await Driver.findOneAndUpdate(
      { id: driverId || driver?.id, shopId: safeShopId, userId: null },
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
  if (!seedDriver || (seedDriver.shopId ?? null) !== safeShopId) {
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
export const createDriverSchema = z.object({
  name:        z.string().min(2).max(80).trim(),
  phone:       z.string().min(5).max(30),
  email:       z.string().email().optional().default(""),
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
  codCollected: z.coerce.boolean().default(false),
  codAmount:    z.coerce.number().min(0).default(0),
  note:         z.string().max(500).optional().default(""),
});

export const sellerDriverAssignSchema = z.object({
  force: z.coerce.boolean().optional().default(false),
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

export async function listSellerDrivers(shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);

  if (env.mongoUri) {
    const drivers = await Driver.find({ shopId: safeShopId }).sort({ createdAt: -1 }).lean();
    return drivers.map(normalizeDriverRecord);
  }

  return getSeedDrivers()
    .filter((driver) => (driver.shopId ?? null) === safeShopId)
    .map(normalizeDriverRecord);
}

export async function createSellerDriver(shopId, shopName, userId, rawPayload) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const resolvedShopName = await resolveShopName(safeShopId, shopName || "");
  const parsed = createDriverSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const e = new Error("Invalid driver payload: " + parsed.error.issues.map((i) => i.message).join(", "));
    e.status = 422;
    throw e;
  }
  const { createLogin, loginEmail, ...driverPayload } = parsed.data;

  const driver = {
    id: `drv-${randomUUID().slice(0, 8)}`,
    name: driverPayload.name,
    phone: driverPayload.phone,
    email: driverPayload.email || "",
    shopId: safeShopId,
    shopName: resolvedShopName,
    createdBySellerUserId: userId || null,
    vehicleType: driverPayload.vehicleType,
    zone: driverPayload.zone || "",
    status: "active",
    codBalance: 0,
    totalDeliveries: 0,
    totalCodCollected: 0,
    isActive: true,
  };

  if (env.mongoUri) {
    const doc = await Driver.create(driver);
    try {
      if (createLogin) {
        const linked = await attachLoginToSellerDriver({
          driver: doc.toObject(),
          shopId: safeShopId,
          driverId: doc.id,
          name: doc.name,
          loginEmail,
        });
        return { ...linked.driver, tempPassword: linked.tempPassword };
      }
      return normalizeDriverRecord(doc.toObject());
    } catch (error) {
      await Driver.deleteOne({ id: doc.id, shopId: safeShopId });
      throw error;
    }
  }

  seedDrivers.set(driver.id, driver);
  if (createLogin) {
    try {
      const linked = await attachLoginToSellerDriver({
        driver,
        shopId: safeShopId,
        driverId: driver.id,
        name: driver.name,
        loginEmail,
      });
      return { ...linked.driver, tempPassword: linked.tempPassword };
    } catch (error) {
      seedDrivers.delete(driver.id);
      throw error;
    }
  }
  return normalizeDriverRecord(driver);
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

  if (env.mongoUri) {
    const existing = await Driver.findOne({ id: driverId, shopId: safeShopId }).lean();
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
      { id: driverId, shopId: safeShopId },
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
  if (!driver || (driver.shopId ?? null) !== safeShopId) {
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

async function getSellerDriver(driverId, shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);

  if (env.mongoUri) {
    const driver = await Driver.findOne({ id: driverId, shopId: safeShopId }).lean();
    return driver ? normalizeDriverRecord(driver) : null;
  }

  const driver = getSeedDriver(driverId);
  return driver && (driver.shopId ?? null) === safeShopId ? driver : null;
}

async function resolveShopName(shopId, fallback = "") {
  if (!shopId) return fallback;

  if (env.mongoUri) {
    const shop = await Shop.findOne({ id: shopId }).lean();
    return shop?.name || fallback;
  }

  return seedRepository.getShop(shopId)?.name || fallback;
}

async function resetPreviousDriverIfNeeded(previousDriverId, shopId) {
  if (!previousDriverId) return;

  if (env.mongoUri) {
    const previousDriver = await Driver.findOne({ id: previousDriverId, shopId }).lean();
    if (previousDriver && previousDriver.status === "on_delivery") {
      await Driver.findOneAndUpdate({ id: previousDriverId, shopId }, { $set: { status: "active" } });
    }
    return;
  }

  const previousDriver = seedDrivers.get(previousDriverId);
  if (previousDriver && (previousDriver.shopId ?? null) === shopId && previousDriver.status === "on_delivery") {
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

  const driver = await getSellerDriver(driverId, safeShopId);
  if (!driver) {
    const e = new Error("Driver not found.");
    e.status = 404;
    throw e;
  }
  if (!isDriverEligibleForSellerAssignment(driver)) {
    const e = new Error("Driver is inactive.");
    e.status = 409;
    throw e;
  }

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
  const driver = await getSellerDriver(driverId, safeShopId);
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

    const codCollected = Boolean(parsed.data.codCollected);
    const codAmount = codCollected ? resolveCodAmount(order, parsed.data) : 0;
    const updatedAssignment = {
      ...order.driverAssignment,
      deliveredAt: now,
      codCollected,
      codAmount,
      note: parsed.data.note || "",
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
      { id: driverId, shopId: safeShopId },
      {
        $set: { status: "active" },
        $inc: { totalDeliveries: 1, codBalance: codInc, totalCodCollected: codInc },
      }
    );
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

  const codCollected = Boolean(parsed.data.codCollected);
  const codAmount = codCollected ? resolveCodAmount(order, parsed.data) : 0;

  order.driverAssignment = {
    ...order.driverAssignment,
    deliveredAt: now.toISOString(),
    codCollected,
    codAmount,
    note: parsed.data.note || "",
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
  if (seedDriver && (seedDriver.shopId ?? null) === safeShopId) {
    seedDriver.status = "active";
    seedDriver.totalDeliveries += 1;
    if (codCollected) {
      seedDriver.codBalance += codAmount;
      seedDriver.totalCodCollected += codAmount;
    }
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

export async function getSellerDriverCodSummary(shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);

  const drivers = env.mongoUri
    ? await Driver.find({ shopId: safeShopId }).lean()
    : getSeedDrivers().filter((driver) => (driver.shopId ?? null) === safeShopId);

  const summary = drivers.reduce(
    (acc, driver) => {
      const normalized = normalizeDriverRecord(driver);
      acc.driverCount += 1;
      acc.activeDrivers += normalized.isActive !== false && normalized.status !== "inactive" ? 1 : 0;
      acc.inactiveDrivers += normalized.isActive === false || normalized.status === "inactive" ? 1 : 0;
      acc.onDeliveryDrivers += normalized.status === "on_delivery" ? 1 : 0;
      acc.codBalance += Number(normalized.codBalance) || 0;
      acc.totalDeliveries += Number(normalized.totalDeliveries) || 0;
      acc.totalCodCollected += Number(normalized.totalCodCollected) || 0;
      return acc;
    },
    {
      shopId: safeShopId,
      driverCount: 0,
      activeDrivers: 0,
      inactiveDrivers: 0,
      onDeliveryDrivers: 0,
      codBalance: 0,
      totalDeliveries: 0,
      totalCodCollected: 0,
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
  const activeDrivers = env.mongoUri
    ? await Driver.find({ shopId: safeShopId }).lean()
    : getSeedDrivers().filter((driver) => (driver.shopId ?? null) === safeShopId);

  const eligibleDrivers = activeDrivers.filter((driver) => driver.isActive !== false && driver.status !== "inactive");
  const deliveryZone = normalizeDeliveryZone(parsed.data.deliveryZone);
  const selectedDrivers = deliveryZone
    ? eligibleDrivers.filter((driver) => matchesDriverZone(driver.zone, deliveryZone))
    : eligibleDrivers;

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

export async function listDriverOffers(driverId, shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const now = new Date();
  await expireStaleDeliveryOffers(safeShopId);

  const allOffers = env.mongoUri
    ? await DeliveryOffer.find({ shopId: safeShopId, status: "Open", expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean()
    : [...seedDeliveryOffers.values()].filter((offer) => offer.shopId === safeShopId && isOfferOpen(offer, now));

  return allOffers
    .filter((offer) => Array.isArray(offer.offeredDriverIds) && offer.offeredDriverIds.includes(driverId))
    .map(normalizeDeliveryOfferForDriver);
}

export async function acceptDriverOffer(offerId, driverId, shopId, user) {
  const safeShopId = getSellerShopIdOrThrow(shopId);
  const now = new Date();
  await expireStaleDeliveryOffers(safeShopId);

  const driver = await getSellerDriver(driverId, safeShopId);
  if (!driver) {
    const e = new Error("Driver not found.");
    e.status = 404;
    throw e;
  }
  if (!isDriverEligibleForSellerAssignment(driver)) {
    const e = new Error("Driver is inactive.");
    e.status = 409;
    throw e;
  }

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

    await Driver.findOneAndUpdate({ id: driver.id, shopId: safeShopId }, { $set: { status: "on_delivery" } });
    await notifyDeliveryOfferAccepted(offer, driver, updatedOrder);
    return { offer: normalizeDeliveryOffer(await DeliveryOffer.findOne({ id: offer.id, shopId: safeShopId }).lean()), order: normalizeDriverTaskOrder(updatedOrder) };
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
  return { offer: normalizeDeliveryOffer(offer), order: normalizeDriverTaskOrder(order) };
}

const DRIVER_TASK_STATUSES = new Set(["Ready for Delivery", "Shipped", "Delivered"]);

function normalizeDriverAssignment(assignment) {
  if (!assignment) return undefined;
  return {
    driverId: assignment.driverId,
    driverName: assignment.driverName || "",
    driverPhone: assignment.driverPhone || "",
    assignedAt: assignment.assignedAt || null,
    deliveredAt: assignment.deliveredAt || null,
    codCollected: Boolean(assignment.codCollected),
    codAmount: Number(assignment.codAmount) || 0,
    note: assignment.note || "",
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

function normalizeDriverTaskOrder(order) {
  if (!order) return null;
  const codAmount = Number(order?.driverAssignment?.codAmount) || (order.paymentMethod === "cod" ? Number(order.subtotal) || 0 : 0);
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
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
  };
}

async function findDriverTaskOrder(driverId, shopId, orderId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);

  if (env.mongoUri) {
    const order = await Order.findOne({
      orderId,
      shopIds: safeShopId,
      "driverAssignment.driverId": driverId,
      status: { $in: [...DRIVER_TASK_STATUSES] },
    }).lean();
    return order ? normalizeDriverTaskOrder(order) : null;
  }

  const order = getSeedOrders().find(
    (item) =>
      item.orderId === orderId &&
      Array.isArray(item.shopIds) &&
      item.shopIds.includes(safeShopId) &&
      item.driverAssignment?.driverId === driverId &&
      DRIVER_TASK_STATUSES.has(item.status)
  );
  return order ? normalizeDriverTaskOrder(order) : null;
}

export async function getDriverProfile(driverId, shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);

  if (env.mongoUri) {
    const driver = await Driver.findOne({ id: driverId, shopId: safeShopId }).lean();
    if (!driver) {
      const e = new Error("Driver not found.");
      e.status = 404;
      throw e;
    }
    return {
      driverId: driver.id,
      name: driver.name,
      phone: driver.phone,
      vehicleType: driver.vehicleType,
      zone: driver.zone || "",
      status: driver.status,
      shopId: driver.shopId ?? null,
      shopName: driver.shopName ?? "",
      codBalance: Number(driver.codBalance) || 0,
      totalDeliveries: Number(driver.totalDeliveries) || 0,
      loginEmail: driver.loginEmail || "",
    };
  }

  const driver = getSeedDriver(driverId);
  if (!driver || (driver.shopId ?? null) !== safeShopId) {
    const e = new Error("Driver not found.");
    e.status = 404;
    throw e;
  }
  return {
    driverId: driver.id,
    name: driver.name,
    phone: driver.phone,
    vehicleType: driver.vehicleType,
    zone: driver.zone || "",
    status: driver.status,
    shopId: driver.shopId ?? null,
    shopName: driver.shopName ?? "",
    codBalance: Number(driver.codBalance) || 0,
    totalDeliveries: Number(driver.totalDeliveries) || 0,
    loginEmail: driver.loginEmail || "",
  };
}

export async function listDriverDeliveries(driverId, shopId) {
  const safeShopId = getSellerShopIdOrThrow(shopId);

  if (env.mongoUri) {
    const orders = await Order.find({
      shopIds: safeShopId,
      "driverAssignment.driverId": driverId,
      status: { $in: [...DRIVER_TASK_STATUSES] },
    }).sort({ updatedAt: -1 }).lean();
    return orders.map(normalizeDriverTaskOrder);
  }

  return getSeedOrders()
    .filter(
      (order) =>
        Array.isArray(order.shopIds) &&
        order.shopIds.includes(safeShopId) &&
        order.driverAssignment?.driverId === driverId &&
        DRIVER_TASK_STATUSES.has(order.status)
    )
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .map(normalizeDriverTaskOrder);
}

export async function getDriverDelivery(driverId, shopId, orderId) {
  const task = await findDriverTaskOrder(driverId, shopId, orderId);
  if (!task) {
    const e = new Error("Order not found.");
    e.status = 404;
    throw e;
  }
  return task;
}

export async function assignDriverToOrder(driverId, orderId, user) {
  if (env.mongoUri) {
    const driver = await Driver.findOne({ id: driverId, isActive: true }).lean();
    if (!driver) { const e = new Error("Driver not found or inactive."); e.status = 404; throw e; }

    const order = await Order.findOne({ orderId }).lean();
    if (!order) { const e = new Error("Order not found."); e.status = 404; throw e; }
    if (order.status !== "Ready for Delivery") {
      const e = new Error("Driver can only be assigned to orders that are Ready for Delivery.");
      e.status = 409;
      throw e;
    }

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
  const driver = seedDrivers.get(driverId);
  if (!driver || !driver.isActive) { const e = new Error("Driver not found or inactive."); e.status = 404; throw e; }

  const orders = getSeedOrders();
  const order = orders.find((o) => o.orderId === orderId);
  if (!order) { const e = new Error("Order not found."); e.status = 404; throw e; }
  if (order.status !== "Ready for Delivery") {
    const e = new Error("Driver can only be assigned to orders that are Ready for Delivery.");
    e.status = 409;
    throw e;
  }

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

    const codCollected = Boolean(parsed.data.codCollected);
    const codAmount = codCollected ? resolveCodAmount(order, parsed.data) : 0;
    const updatedAssignment = {
      ...order.driverAssignment,
      deliveredAt:  now,
      codCollected,
      codAmount,
      note:         parsed.data.note || "",
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

    const updated = await Order.findOneAndUpdate(
      { orderId },
      {
        $set:  { status: "Delivered", paymentStatus, driverAssignment: updatedAssignment },
        $push: { statusHistory: historyEntry },
      },
      { returnDocument: "after" }
    ).lean();

    // Update driver stats
    const codInc = codCollected ? codAmount : 0;
    await Driver.findOneAndUpdate(
      { id: driverId },
      {
        $set: { status: "active" },
        $inc: { totalDeliveries: 1, codBalance: codInc, totalCodCollected: codInc },
      }
    );
    // Accrue referral commissions — same trigger as the regular Delivered transition.
    // Errors are swallowed inside accrueDeliveredOrderCommissions to avoid reversing delivery.
    await accrueDeliveredOrderCommissions(updated);
    await notifyDeliveryCompleted(updated, { name: updated?.driverAssignment?.driverName || "driver" }, safeShopId);
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

  const codCollected = Boolean(parsed.data.codCollected);
  const codAmount = codCollected ? resolveCodAmount(order, parsed.data) : 0;

  order.driverAssignment = {
    ...order.driverAssignment,
    deliveredAt:  now.toISOString(),
    codCollected,
    codAmount,
    note:         parsed.data.note || "",
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
  // Accrue referral commissions — same trigger as the regular Delivered transition.
  await accrueDeliveredOrderCommissions(order);
  await notifyDeliveryCompleted(order, { name: order?.driverAssignment?.driverName || "driver" }, safeShopId);
  return order;
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
