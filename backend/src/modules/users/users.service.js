import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Shop } from "../../models/Shop.js";
import { User } from "../../models/User.js";
import { PERMISSIONS, USER_ROLES, normalizePermissions, permissionsForRole, roleDefinitions } from "./user.roles.js";

const SHOP_CATEGORIES = ["perfume", "cake", "dessert", "gift_box", "mixed"];
const permissionIds = PERMISSIONS.map((permission) => permission.id);

const permissionSchema = z.string().refine((value) => permissionIds.includes(value), {
  message: "Unknown permission.",
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  role: z.enum(USER_ROLES).default("customer"),
  isActive: z.coerce.boolean().optional().default(true),
  permissions: z.array(permissionSchema).optional(),
  shopName: z.string().max(100).optional(),
  shopCity: z.string().max(80).optional(),
  shopStory: z.string().max(300).optional(),
  shopCategories: z.array(z.enum(SHOP_CATEGORIES)).min(1).max(5).optional(),
  deliveryModel: z.enum(["seller_delivery", "pickup", "platform_later"]).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(80).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.coerce.boolean().optional(),
  permissions: z.array(permissionSchema).optional(),
  shopName: z.string().max(100).optional(),
  shopCity: z.string().max(80).optional(),
  shopStory: z.string().max(300).optional(),
  shopCategories: z.array(z.enum(SHOP_CATEGORIES)).min(1).max(5).optional(),
  deliveryModel: z.enum(["seller_delivery", "pickup", "platform_later"]).optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function normalizeShopCategories(payload) {
  const selected = Array.isArray(payload.shopCategories) && payload.shopCategories.length
    ? payload.shopCategories
    : ["mixed"];
  return [...new Set(selected)];
}

function primaryShopCategory(categories) {
  if (!categories?.length) return "mixed";
  if (categories.includes("mixed") || categories.length > 1) return "mixed";
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

function makeSellerShop(payload, ownerId, shopId) {
  const shopName = payload.shopName?.trim() || `${payload.name}'s Tuti Shop`;
  const categories = normalizeShopCategories(payload);
  const category = primaryShopCategory(categories);

  return {
    id: shopId || makeShopId(shopName),
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
    onboardingStep: "Admin created account",
  };
}

function toUserSummary(user, shopMap = new Map()) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.refreshToken;

  const permissions = normalizePermissions(obj.role, obj.permissions);
  const shop = obj.shopId ? shopMap.get(obj.shopId) : null;
  return {
    ...obj,
    id: obj._id?.toString(),
    permissions,
    status: obj.isActive === false ? "Suspended" : "Active",
    shop,
  };
}

async function createSellerShopIfNeeded(user, payload) {
  if (user.role !== "seller") return null;
  if (user.shopId) {
    const existing = await Shop.findOne({ id: user.shopId });
    if (existing) return existing;
  }

  const shop = makeSellerShop(payload, user._id, user.shopId || makeShopId(payload.shopName || user.name));
  user.shopId = shop.id;
  user.shopCategory = shop.category;
  user.shopCategories = shop.categories;
  await user.save();
  return Shop.create(shop);
}

export async function listUsers({ q = "", role = "", status = "", page = 1, limit = 20 }) {
  const filter = {};
  const query = String(q || "").trim();
  if (query) {
    const pattern = new RegExp(escapeRegex(query), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { shopId: pattern }];
  }
  if (role && USER_ROLES.includes(role)) filter.role = role;
  if (status === "active") filter.isActive = true;
  if (status === "suspended") filter.isActive = false;

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [users, total, shops, allUsers] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    User.countDocuments(filter),
    Shop.find({}).lean(),
    User.find({}).select("role isActive").lean(),
  ]);

  const shopMap = new Map(shops.map((shop) => [shop.id, shop]));
  const roleCounts = USER_ROLES.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  let activeCount = 0;
  for (const user of allUsers) {
    roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
    if (user.isActive !== false) activeCount += 1;
  }

  return {
    users: users.map((user) => toUserSummary(user, shopMap)),
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
    limit: safeLimit,
    metrics: {
      total: allUsers.length,
      active: activeCount,
      suspended: allUsers.length - activeCount,
      roles: roleCounts,
    },
  };
}

export async function createUser(payload) {
  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    const error = new Error("Email already registered.");
    error.status = 409;
    throw error;
  }

  const categories = payload.role === "seller" ? normalizeShopCategories(payload) : [];
  const shopId = payload.role === "seller" ? makeShopId(payload.shopName || payload.name) : null;
  const user = await User.create({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    isActive: payload.isActive,
    permissions: normalizePermissions(payload.role, payload.permissions),
    shopId,
    shopCategory: payload.role === "seller" ? primaryShopCategory(categories) : null,
    shopCategories: categories,
  });

  const shop = await createSellerShopIfNeeded(user, { ...payload, shopCategories: categories, shopId });
  return toUserSummary(user, shop ? new Map([[shop.id, shop.toObject ? shop.toObject() : shop]]) : new Map());
}

export async function updateUser(userId, payload, actorId) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }

  if (String(user._id) === String(actorId) && (payload.role && payload.role !== "admin" || payload.isActive === false)) {
    const error = new Error("You cannot remove your own admin access.");
    error.status = 400;
    throw error;
  }

  const nextRole = payload.role || user.role;
  const roleChanged = payload.role && payload.role !== user.role;
  if (payload.email && payload.email !== user.email) {
    const duplicate = await User.findOne({ email: payload.email, _id: { $ne: user._id } });
    if (duplicate) {
      const error = new Error("Email already registered.");
      error.status = 409;
      throw error;
    }
    user.email = payload.email;
  }

  if (payload.name) user.name = payload.name;
  if (payload.role) user.role = payload.role;
  if (typeof payload.isActive === "boolean") user.isActive = payload.isActive;
  if (payload.permissions || roleChanged) {
    user.permissions = payload.permissions ? normalizePermissions(nextRole, payload.permissions) : permissionsForRole(nextRole);
  }

  if (nextRole === "seller") {
    const categories = payload.shopCategories ? normalizeShopCategories(payload) : user.shopCategories;
    user.shopCategories = categories?.length ? categories : ["mixed"];
    user.shopCategory = primaryShopCategory(user.shopCategories);
    await createSellerShopIfNeeded(user, { ...payload, name: user.name, shopCategories: user.shopCategories });
  } else if (roleChanged) {
    user.shopId = null;
    user.shopCategory = null;
    user.shopCategories = [];
  }

  await user.save();
  const shops = await Shop.find({}).lean();
  return toUserSummary(user, new Map(shops.map((shop) => [shop.id, shop])));
}

export async function resetUserPassword(userId, password) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }
  user.password = password;
  await user.save();
  return { ok: true };
}

export function getRoleDefinitions() {
  return {
    roles: roleDefinitions(),
    permissions: PERMISSIONS,
    defaults: USER_ROLES.reduce((acc, role) => ({ ...acc, [role]: permissionsForRole(role) }), {}),
  };
}
