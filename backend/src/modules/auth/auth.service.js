import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { Shop } from "../../models/Shop.js";
import { User } from "../../models/User.js";
import { SalesRep } from "../../models/SalesRep.js";
import { SellerReferral } from "../../models/SellerReferral.js";
import { normalizePermissions } from "../users/user.roles.js";

export const registerSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  role: z.enum(["customer", "seller"]).default("customer"),
  shopId: z.string().optional(),
  shopName: z.string().max(100).optional(),
  shopCategory: z.enum(["perfume", "cake", "dessert", "gift_box", "mixed"]).optional(),
  shopCategories: z.array(z.enum(["perfume", "cake", "dessert", "gift_box", "mixed"])).min(1).max(5).optional(),
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

function normalizeShopCategories(payload) {
  const categories = Array.isArray(payload.shopCategories) && payload.shopCategories.length
    ? payload.shopCategories
    : [payload.shopCategory || "mixed"];
  return [...new Set(categories)];
}

function primaryShopCategory(categories) {
  if (!categories?.length) return "mixed";
  if (categories.includes("mixed")) return "mixed";
  if (categories.length > 1) return "mixed";
  return categories[0];
}

function categoryCover(categories) {
  const selected = normalizeShopCategories({ shopCategories: categories });
  if (selected.includes("mixed") || selected.length > 1) return "Multi-category boutique";
  return {
    perfume: "Perfume boutique",
    cake: "Cake studio",
    dessert: "Dessert and sweets shop",
    gift_box: "Luxury gift boxes",
    mixed: "Perfume, cakes, and gifts",
  }[selected[0]] || "Tuti seller";
}

function makeSellerShop(payload, ownerId) {
  const shopName = payload.shopName?.trim() || `${payload.name}'s Tuti Shop`;
  const categories = normalizeShopCategories(payload);
  const category = primaryShopCategory(categories);
  return {
    id: payload.shopId || makeShopId(shopName),
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
  seedUsers.delete(userId);
}

export async function register(payload) {
  if (env.mongoUri) {
    const existing = await User.findOne({ email: payload.email });
    if (existing) {
      const err = new Error("Email already registered."); err.status = 409; throw err;
    }
    const repAttribution = payload.role === "seller"
      ? await resolveRepAttribution(payload.repCode)
      : { repCode: "", repId: null, acquisitionSource: "organic" };
    const userPayload = {
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      shopId: payload.role === "seller" ? payload.shopId || makeShopId(payload.shopName || payload.name) : payload.shopId,
      shopCategory: payload.role === "seller" ? primaryShopCategory(normalizeShopCategories(payload)) : payload.shopCategory,
      shopCategories: payload.role === "seller" ? normalizeShopCategories(payload) : [],
      permissions: normalizePermissions(payload.role),
    };
    const user = await User.create(userPayload);
    if (payload.role === "seller") {
      const shopPayload = makeSellerShop({ ...payload, ...repAttribution, shopId: user.shopId }, user._id);
      const shop = await Shop.create(shopPayload);
      if (repAttribution.repId) {
        // Guard: one referral per shop. Handles retried registrations where the user
        // was already created but the referral wasn't (e.g. partial failure).
        const existingReferral = await SellerReferral.findOne({ shopId: shop.id });
        if (!existingReferral) {
          await SellerReferral.create({
            id: `ref-${randomUUID()}`,
            repId: repAttribution.repId,
            repCode: repAttribution.repCode,
            shopId: shop.id,
            shopName: shop.name,
            sellerUserId: user._id,
            status: "pending_approval",
            approvedAt: null,
          });
        }
      }
    }
    const tokens = tokenPair(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();
    return { user: safeUser(user), ...tokens };
  }

  // Seed mode
  for (const u of seedUsers.values()) {
    if (u.email === payload.email) {
      const err = new Error("Email already registered."); err.status = 409; throw err;
    }
  }
  const id = randomUUID();
  const repAttribution = payload.role === "seller"
    ? await resolveRepAttribution(payload.repCode)
    : { repCode: "", repId: null, acquisitionSource: "organic" };
  const shop = payload.role === "seller" ? makeSellerShop({ ...payload, ...repAttribution }, id) : null;
  if (shop) seedRepository.addShop(shop);
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
    shopId: shop?.id || payload.shopId || null,
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
  const demoId = randomUUID();
  const role = email.includes("admin") ? "admin" : email.includes("seller") ? "seller" : "customer";
  const shopId = role === "seller" ? "shop-oud-lane" : null;
  const demoUser = { _id: demoId, id: demoId, name: email.split("@")[0], email, role, shopId };
  seedUsers.set(demoId, demoUser);
  const base = { sub: demoId, role, shopId };
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
    // In production: send email with reset link here
    // For now: log token to console so dev can use it
    console.info(`[password-reset] token for ${email}: ${rawToken}`);
    return { ok: true };
  }

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
