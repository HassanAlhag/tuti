import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import { assertProductionSeedModeDisabled, env } from "../../config/env.js";
import { sendPasswordReset } from "../../shared/email.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { Shop } from "../../models/Shop.js";
import { User } from "../../models/User.js";
import { SalesRep } from "../../models/SalesRep.js";
import { SellerReferral } from "../../models/SellerReferral.js";
import { normalizePermissions } from "../users/user.roles.js";
import { DEMO_SELLER_USER_ID } from "../../seed/marketplace.seed.js";
import {
  categoryCover,
  derivePrimaryShopCategory,
  normalizeShopCategories,
  SHOP_CATEGORY_VALUES,
} from "../../shared/shopEntitlements.js";

// The demo seller session (seed/dev mode only) always resolves to this
// exact shop, whose seed record's ownerId is DEMO_SELLER_USER_ID -- see
// marketplace.seed.js for why the two must stay in lockstep.
const DEMO_SELLER_SHOP_ID = "shop-oud-lane";

export const registerSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  role: z.enum(["customer", "seller"]).default("customer"),
  // shopId is deliberately NOT accepted here. It is always generated
  // server-side in register() -- a client-supplied shopId previously let
  // an attacker register as a seller against an existing shop's id and
  // receive a JWT carrying that shopId, passing every downstream
  // `product.shopId === req.user.shopId` ownership check as if they were
  // the real owner. Zod strips unknown keys by default, so any shopId a
  // client sends here is silently discarded before register() ever sees it.
  shopName: z.string().max(100).optional(),
  shopCategory: z.enum(SHOP_CATEGORY_VALUES).optional(),
  shopCategories: z.array(z.enum(SHOP_CATEGORY_VALUES)).min(1).max(5).optional(),
  shopCity: z.string().max(80).optional(),
  shopStory: z.string().max(300).optional(),
  deliveryModel: z.enum(["seller_delivery", "pickup", "platform_later"]).optional(),
  repCode: z.string().max(40).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

function signAccess(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function signRefresh(payload) {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn });
}

function tokenPair(user) {
  const base = {
    sub: user._id.toString(),
    role: user.role,
    shopId: user.shopId,
    driverId: user.driverId ?? null,
    permissions: normalizePermissions(user.role, user.permissions),
  };
  return { accessToken: signAccess(base), refreshToken: signRefresh(base) };
}

function safeUser(user) {
  const obj = user.toSafeObject ? user.toSafeObject() : { ...user };
  return {
    ...obj,
    permissions: normalizePermissions(obj.role, obj.permissions),
    status: obj.isActive === false ? "Suspended" : "Active",
  };
}

function makeShopId(name) {
  const slug = String(name || "seller-shop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "seller-shop";
  return `shop-${slug}-${randomUUID().slice(0, 5)}`;
}

// Generates a fresh, server-side shopId and confirms it isn't already
// taken before handing it back. Collisions are astronomically unlikely
// (makeShopId suffixes a random UUID slice) but this keeps the guarantee
// explicit rather than assumed, and gives register() a clean, typed error
// instead of a raw duplicate-key exception if one ever occurred.
async function allocateShopId(name, { session } = {}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = makeShopId(name);
    let taken;
    if (env.mongoUri) {
      const query = Shop.exists({ id: candidate });
      taken = Boolean(session ? await query.session(session) : await query);
    } else {
      taken = Boolean(seedRepository.getShop(candidate));
    }
    if (!taken) return candidate;
  }
  const err = new Error("Could not allocate a shop identifier. Please try again.");
  err.status = 500;
  throw err;
}

function initialsFrom(name) {
  return String(name || "TS")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TS";
}

function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

function makeSellerShop(payload, ownerId, shopId) {
  const shopName = payload.shopName?.trim() || `${payload.name}'s Tuti Shop`;
  const categories = normalizeShopCategories(payload);
  const category = derivePrimaryShopCategory(categories);
  return {
    id: shopId,
    name: shopName,
    owner: payload.name,
    ownerId,
    city: payload.shopCity?.trim() || "UAE",
    status: "Pending review",
    fulfillmentRate: 0,
    disputeRate: 0,
    serviceRating: 0,
    payoutHoldDays: 7,
    commissionRate: 14,
    pendingBalance: 0,
    avatar: initialsFrom(shopName),
    story: payload.shopStory?.trim() || "New Tuti seller preparing products for marketplace approval.",
    cover: categoryCover(categories),
    category,
    categories,
    deliveryModel: payload.deliveryModel || "seller_delivery",
    onboardingStep: "Admin review",
    repCode: payload.acquisitionSource === "sales_rep" ? (payload.repCode || "") : "",
    repId: payload.acquisitionSource === "sales_rep" ? (payload.repId || null) : null,
    acquisitionSource: payload.acquisitionSource === "sales_rep" ? "sales_rep" : "organic",
  };
}

async function resolveRepAttribution(repCode) {
  const normalized = String(repCode || "").trim().toUpperCase();
  if (!normalized) {
    return { repCode: "", repId: null, acquisitionSource: "organic" };
  }
  if (env.mongoUri) {
    const rep = await SalesRep.findOne({ code: normalized }).lean();
    if (!rep) return { repCode: "", repId: null, acquisitionSource: "organic" };
    return { repCode: normalized, repId: rep._id, acquisitionSource: "sales_rep" };
  }
  const rep = (seedRepository.getState().salesReps || []).find((item) => String(item.code || "").toUpperCase() === normalized);
  if (!rep) return { repCode: "", repId: null, acquisitionSource: "organic" };
  return { repCode: normalized, repId: rep.id, acquisitionSource: "sales_rep" };
}

// In-memory user store for seed (no MongoDB) mode
const seedUsers = new Map();

function assertSeedAuthModeAllowed() {
  assertProductionSeedModeDisabled(env, "Seed/demo auth mode");
}

export async function createDriverLoginAccount({ name, loginEmail, shopId, driverId }) {
  const normalizedEmail = String(loginEmail || "").trim().toLowerCase();
  if (!normalizedEmail) {
    const err = new Error("Login email is required.");
    err.status = 422;
    throw err;
  }

  const tempPassword = generateTempPassword();

  if (env.mongoUri) {
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      const err = new Error("Email already registered.");
      err.status = 409;
      throw err;
    }

    const user = await User.create({
      name: name || normalizedEmail,
      email: normalizedEmail,
      password: tempPassword,
      role: "driver",
      shopId: shopId || null,
      driverId: driverId || null,
      permissions: normalizePermissions("driver"),
    });

    return {
      userId: user._id.toString(),
      user: safeUser(user),
      tempPassword,
      loginEmail: normalizedEmail,
    };
  }

  assertSeedAuthModeAllowed();

  for (const existing of seedUsers.values()) {
    if (String(existing.email || "").toLowerCase() === normalizedEmail) {
      const err = new Error("Email already registered.");
      err.status = 409;
      throw err;
    }
  }

  const id = randomUUID();
  const user = {
    _id: id,
    id,
    name: name || normalizedEmail,
    email: normalizedEmail,
    role: "driver",
    shopId: shopId || null,
    driverId: driverId || null,
    permissions: normalizePermissions("driver"),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  seedUsers.set(id, user);

  return {
    userId: id,
    user: safeUser(user),
    tempPassword,
    loginEmail: normalizedEmail,
  };
}

export async function deleteDriverLoginAccount(userId) {
  if (!userId) return;
  if (env.mongoUri) {
    await User.findByIdAndDelete(userId);
    return;
  }
  assertSeedAuthModeAllowed();
  seedUsers.delete(userId);
}

export async function register(payload) {
  if (env.mongoUri) {
    const existing = await User.findOne({ email: payload.email });
    if (existing) {
      const err = new Error("Email already registered."); err.status = 409; throw err;
    }

    if (payload.role !== "seller") {
      // Non-sellers never carry a shopId (schema no longer accepts one as
      // client input; nothing in this branch reads payload.shopId either).
      const user = await User.create({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role,
        permissions: normalizePermissions(payload.role),
      });
      const tokens = tokenPair(user);
      user.refreshToken = tokens.refreshToken;
      await user.save();
      return { user: safeUser(user), ...tokens };
    }

    // Seller registration creates a User and a Shop together. The shopId is
    // always generated here, server-side (see allocateShopId) -- never
    // accepted from the client -- and both documents (plus an optional
    // referral record) are created inside one transaction, so a failure
    // creating the Shop can never leave an orphaned seller User behind.
    const repAttribution = await resolveRepAttribution(payload.repCode);
    const categories = normalizeShopCategories(payload);
    const category = derivePrimaryShopCategory(categories);

    const session = await mongoose.startSession();
    let user;
    try {
      await session.withTransaction(async () => {
        const shopId = await allocateShopId(payload.shopName || payload.name, { session });

        const [createdUser] = await User.create([{
          name: payload.name,
          email: payload.email,
          password: payload.password,
          role: "seller",
          shopId,
          shopCategory: category,
          shopCategories: categories,
          permissions: normalizePermissions("seller"),
        }], { session });
        user = createdUser;

        const shopPayload = makeSellerShop({ ...payload, ...repAttribution }, user._id, shopId);
        const [shop] = await Shop.create([shopPayload], { session });

        if (repAttribution.repId) {
          // Guard: one referral per shop. Handles retried registrations where the user
          // was already created but the referral wasn't (e.g. partial failure).
          const existingReferral = await SellerReferral.findOne({ shopId: shop.id }).session(session);
          if (!existingReferral) {
            await SellerReferral.create([{
              id: `ref-${randomUUID()}`,
              repId: repAttribution.repId,
              repCode: repAttribution.repCode,
              shopId: shop.id,
              shopName: shop.name,
              sellerUserId: user._id,
              status: "pending_approval",
              approvedAt: null,
            }], { session });
          }
        }
      });
    } finally {
      await session.endSession();
    }

    const tokens = tokenPair(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();
    return { user: safeUser(user), ...tokens };
  }

  assertSeedAuthModeAllowed();

  // Seed mode — mirrors the Mongo branch's guarantees as closely as the
  // in-memory store allows: shopId is always server-generated (never taken
  // from payload.shopId, which no longer exists on the parsed payload
  // anyway), and allocateShopId refuses to hand back an id that already
  // exists in the seed shop list.
  for (const u of seedUsers.values()) {
    if (u.email === payload.email) {
      const err = new Error("Email already registered."); err.status = 409; throw err;
    }
  }
  const id = randomUUID();
  const repAttribution = payload.role === "seller"
    ? await resolveRepAttribution(payload.repCode)
    : { repCode: "", repId: null, acquisitionSource: "organic" };
  let shop = null;
  if (payload.role === "seller") {
    const shopId = await allocateShopId(payload.shopName || payload.name);
    shop = makeSellerShop({ ...payload, ...repAttribution }, id, shopId);
    seedRepository.addShop(shop);
  }
  if (shop && repAttribution.acquisitionSource === "sales_rep") {
    const state = seedRepository.getState();
    state.sellerReferrals = state.sellerReferrals || [];
    // Guard: one referral per shop in seed mode too.
    if (!state.sellerReferrals.some((item) => item.shopId === shop.id)) {
      state.sellerReferrals.unshift({
        id: `ref-${randomUUID()}`,
        repId: repAttribution.repId,
        repCode: repAttribution.repCode,
        shopId: shop.id,
        shopName: shop.name,
        status: "pending_approval",
        approvedAt: null,
        createdAt: new Date().toISOString(),
        gmv: 0,
        firstSaleDate: null,
      });
    }
  }
  const user = {
    _id: id,
    id,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    shopId: shop?.id || null,
    shopCategory: shop?.category || null,
    shopCategories: shop?.categories || [],
    createdAt: new Date().toISOString(),
  };
  seedUsers.set(id, user);
  const base = { sub: id, role: payload.role, shopId: user.shopId };
  return { user, accessToken: signAccess(base), refreshToken: signRefresh(base) };
}

export async function login({ email, password }) {
  if (env.mongoUri) {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      const err = new Error("Invalid email or password."); err.status = 401; throw err;
    }
    if (user.isActive === false) {
      const err = new Error("This account is suspended."); err.status = 403; throw err;
    }
    const tokens = tokenPair(user);
    user.refreshToken = tokens.refreshToken;
    user.lastLoginAt = new Date();
    await user.save();
    return { user: safeUser(user), ...tokens };
  }

  assertSeedAuthModeAllowed();

  // Seed mode — accept any registered user or create a demo session
  for (const u of seedUsers.values()) {
    if (u.email === email) {
      const base = {
        sub: u.id,
        role: u.role,
        shopId: u.shopId || null,
        driverId: u.driverId || null,
        permissions: normalizePermissions(u.role, u.permissions),
      };
      return { user: u, accessToken: signAccess(base), refreshToken: signRefresh(base) };
    }
  }

  // Auto-create demo session
  const role = email.includes("admin") ? "admin" : email.includes("seller") ? "seller" : "customer";

  if (role === "seller") {
    // Stable demo seller identity, deliberately reused across every
    // "...seller...@..." demo login instead of a fresh random id each
    // time. A fresh id would never match shop-oud-lane's recorded
    // ownerId and would always be rejected by requireOwnedShop.
    let demoUser = seedUsers.get(DEMO_SELLER_USER_ID);
    if (demoUser) {
      demoUser.email = email;
      demoUser.name = email.split("@")[0];
    } else {
      demoUser = {
        _id: DEMO_SELLER_USER_ID,
        id: DEMO_SELLER_USER_ID,
        name: email.split("@")[0],
        email,
        role: "seller",
        shopId: DEMO_SELLER_SHOP_ID,
      };
      seedUsers.set(DEMO_SELLER_USER_ID, demoUser);
    }
    const base = { sub: DEMO_SELLER_USER_ID, role: "seller", shopId: DEMO_SELLER_SHOP_ID };
    return { user: demoUser, accessToken: signAccess(base), refreshToken: signRefresh(base) };
  }

  const demoId = randomUUID();
  const demoUser = { _id: demoId, id: demoId, name: email.split("@")[0], email, role, shopId: null };
  seedUsers.set(demoId, demoUser);
  const base = { sub: demoId, role, shopId: null };
  return { user: demoUser, accessToken: signAccess(base), refreshToken: signRefresh(base) };
}

export async function refresh(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtRefreshSecret);
  } catch {
    const err = new Error("Invalid or expired refresh token."); err.status = 401; throw err;
  }

  if (env.mongoUri) {
    const user = await User.findById(payload.sub).select("+refreshToken");
    if (!user || user.refreshToken !== token || user.isActive === false) {
      const err = new Error("Refresh token revoked."); err.status = 401; throw err;
    }
    const tokens = tokenPair(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();
    return tokens;
  }

  assertSeedAuthModeAllowed();

  const base = {
    sub: payload.sub,
    role: payload.role,
    shopId: payload.shopId,
    driverId: payload.driverId || null,
    permissions: normalizePermissions(payload.role, payload.permissions),
  };
  return { accessToken: signAccess(base), refreshToken: signRefresh(base) };
}

export async function getMe(userId) {
  if (env.mongoUri) {
    const user = await User.findById(userId);
    if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
    return safeUser(user);
  }
  assertSeedAuthModeAllowed();
  return seedUsers.get(userId) || null;
}

export const updateMeSchema = z.object({
  name:  z.string().min(2).max(80).trim().optional(),
  phone: z.string().max(30).trim().optional().or(z.literal("")),
});

export async function updateMe(userId, payload) {
  const parsed = updateMeSchema.parse(payload);
  if (env.mongoUri) {
    const user = await User.findByIdAndUpdate(userId, { $set: parsed }, { new: true, runValidators: true });
    if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
    return safeUser(user);
  }
  assertSeedAuthModeAllowed();
  const user = seedUsers.get(userId);
  if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
  if (parsed.name !== undefined) user.name = parsed.name;
  if (parsed.phone !== undefined) user.phone = parsed.phone;
  return { ...user };
}

const addressSchema = z.object({
  label: z.string().min(1).max(40).trim().optional().default("Home"),
  line1: z.string().min(1).max(150).trim(),
  line2: z.string().max(100).trim().optional().default(""),
  city:  z.string().max(60).trim().optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

export async function addAddress(userId, payload) {
  const parsed = addressSchema.parse(payload);
  const id = randomUUID();
  const address = { id, ...parsed };
  if (env.mongoUri) {
    const user = await User.findById(userId);
    if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
    if (address.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
    user.addresses.push(address);
    await user.save();
    return safeUser(user).addresses;
  }
  assertSeedAuthModeAllowed();
  const user = seedUsers.get(userId);
  if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
  if (!user.addresses) user.addresses = [];
  if (address.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  user.addresses.push(address);
  return [...user.addresses];
}

export async function updateAddress(userId, addressId, payload) {
  const parsed = addressSchema.partial().parse(payload);
  if (env.mongoUri) {
    const user = await User.findById(userId);
    if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
    const idx = user.addresses.findIndex((a) => a.id === addressId);
    if (idx === -1) { const err = new Error("Address not found."); err.status = 404; throw err; }
    if (parsed.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
    Object.assign(user.addresses[idx], parsed);
    await user.save();
    return safeUser(user).addresses;
  }
  assertSeedAuthModeAllowed();
  const user = seedUsers.get(userId);
  if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
  const address = (user.addresses || []).find((a) => a.id === addressId);
  if (!address) { const err = new Error("Address not found."); err.status = 404; throw err; }
  if (parsed.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  Object.assign(address, parsed);
  return [...user.addresses];
}

export async function deleteAddress(userId, addressId) {
  if (env.mongoUri) {
    const user = await User.findById(userId);
    if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
    user.addresses = user.addresses.filter((a) => a.id !== addressId);
    await user.save();
    return safeUser(user).addresses;
  }
  assertSeedAuthModeAllowed();
  const user = seedUsers.get(userId);
  if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
  user.addresses = (user.addresses || []).filter((a) => a.id !== addressId);
  return [...user.addresses];
}

// ── Wishlist ─────────────────────────────────────────────────────────────────

export async function toggleWishlist(userId, productId, productName = "") {
  if (env.mongoUri) {
    const user = await User.findById(userId);
    if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
    const idx = user.wishlist.findIndex((w) => w.productId === productId);
    if (idx === -1) {
      user.wishlist.push({ productId, productName, addedAt: new Date() });
    } else {
      user.wishlist.splice(idx, 1);
    }
    await user.save();
    return { wishlist: safeUser(user).wishlist, saved: idx === -1 };
  }
  assertSeedAuthModeAllowed();
  const user = seedUsers.get(userId);
  if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
  if (!user.wishlist) user.wishlist = [];
  const idx = user.wishlist.findIndex((w) => w.productId === productId);
  if (idx === -1) {
    user.wishlist.push({ productId, productName, addedAt: new Date().toISOString() });
  } else {
    user.wishlist.splice(idx, 1);
  }
  return { wishlist: [...user.wishlist], saved: idx === -1 };
}

// ── Account settings ─────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  emailNotifications:    z.boolean().optional(),
  whatsappNotifications: z.boolean().optional(),
  marketingEmails:       z.boolean().optional(),
});

export async function updateSettings(userId, payload) {
  const parsed = updateSettingsSchema.parse(payload);
  if (env.mongoUri) {
    const update = Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [`settings.${k}`, v])
    );
    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
    if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
    return safeUser(user).settings;
  }
  assertSeedAuthModeAllowed();
  const user = seedUsers.get(userId);
  if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
  if (!user.settings) user.settings = { emailNotifications: true, whatsappNotifications: false, marketingEmails: true };
  Object.assign(user.settings, parsed);
  return { ...user.settings };
}

// ── Password reset ────────────────────────────────────────────────────────────

const resetTokens = new Map(); // seed mode: token hash → { userId, expiresAt }

function hashToken(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function requestPasswordReset(email) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  if (env.mongoUri) {
    // Silently succeed even if email not found (prevent enumeration)
    await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: { passwordResetToken: tokenHash, passwordResetExpiresAt: expiresAt } }
    );
    sendPasswordReset(email, rawToken).catch(() => {}); // fire-and-forget
    return { ok: true };
  }

  assertSeedAuthModeAllowed();

  // Seed mode: find user by email
  for (const u of seedUsers.values()) {
    if (u.email === email.toLowerCase().trim()) {
      resetTokens.set(tokenHash, { userId: u._id || u.id, expiresAt });
      // Return token directly in dev/seed mode so UI can use it
      return { ok: true, devToken: rawToken };
    }
  }
  return { ok: true }; // silent no-op for unknown email
}

export async function confirmPasswordReset(rawToken, newPassword) {
  if (!rawToken || !newPassword || newPassword.length < 8) {
    const err = new Error("Invalid reset request."); err.status = 400; throw err;
  }
  const tokenHash = hashToken(rawToken);

  if (env.mongoUri) {
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpiresAt +password");
    if (!user) {
      const err = new Error("Reset link is invalid or has expired."); err.status = 400; throw err;
    }
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    return { ok: true };
  }

  assertSeedAuthModeAllowed();

  const entry = resetTokens.get(tokenHash);
  if (!entry || new Date() > entry.expiresAt) {
    const err = new Error("Reset link is invalid or has expired."); err.status = 400; throw err;
  }
  const user = seedUsers.get(entry.userId);
  if (!user) { const err = new Error("User not found."); err.status = 404; throw err; }
  // In seed mode passwords are not bcrypt-hashed, store plain (seed-only)
  user.password = newPassword;
  resetTokens.delete(tokenHash);
  return { ok: true };
}
