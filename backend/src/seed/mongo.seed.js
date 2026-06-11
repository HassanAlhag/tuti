import {
  customerReviews,
  orderHistory,
  products,
  shops,
} from "./marketplace.seed.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";
import { Shop } from "../models/Shop.js";
import { User } from "../models/User.js";
import { permissionsForRole } from "../modules/users/user.roles.js";

const demoPassword = "password123";

const demoUsers = [
  {
    name: "Tuti Admin",
    email: "admin@tuti.dev",
    password: demoPassword,
    role: "admin",
    permissions: permissionsForRole("admin"),
  },
  {
    name: "Oud Lane Seller",
    email: "seller@tuti.dev",
    password: demoPassword,
    role: "seller",
    shopId: "shop-oud-lane",
    shopCategory: "perfume",
    shopCategories: ["perfume"],
    permissions: permissionsForRole("seller"),
  },
  {
    name: "Demo Customer",
    email: "customer@tuti.dev",
    password: demoPassword,
    role: "customer",
    permissions: permissionsForRole("customer"),
  },
];

function normalizedShopCategory(category) {
  if (category === "cakes") return "cake";
  if (["perfume", "cake", "dessert", "gift_box", "mixed"].includes(category)) return category;
  return "perfume";
}

function normalizeShop(shop) {
  const category = normalizedShopCategory(shop.category);
  return {
    ...shop,
    category,
    categories: shop.categories?.length ? shop.categories : [category],
  };
}

function normalizeProduct(product) {
  return {
    ...product,
    category: product.category || "perfume",
    notePyramid: product.notePyramid || { top: [], heart: [], base: [] },
    occasion: product.occasion || product.occasionTags || [],
    ingredients: product.ingredients || [],
    notes: product.notes || [],
    flavors: product.flavors || [],
    allergens: product.allergens || [],
    includes: product.includes || [],
    bundledProductIds: product.bundledProductIds || [],
  };
}

async function seedCollection(Model, countFilter, docs, label) {
  const existing = await Model.countDocuments(countFilter);
  if (existing > 0) return { label, inserted: 0, skipped: existing };
  await Model.insertMany(docs);
  return { label, inserted: docs.length, skipped: 0 };
}

async function seedDemoUsers() {
  let inserted = 0;
  for (const user of demoUsers) {
    const exists = await User.exists({ email: user.email });
    if (exists) {
      await User.updateOne({ email: user.email, $or: [{ permissions: { $size: 0 } }, { permissions: { $exists: false } }] }, { permissions: user.permissions });
      continue;
    }
    try {
      await User.create(user);
      inserted += 1;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  return { label: "users", inserted, skipped: demoUsers.length - inserted };
}

export async function seedMongoIfNeeded() {
  const results = await Promise.all([
    seedCollection(Shop, {}, shops.map(normalizeShop), "shops"),
    seedCollection(Product, {}, products.map(normalizeProduct), "products"),
    seedCollection(Review, {}, customerReviews, "reviews"),
    seedCollection(Order, {}, orderHistory, "orders"),
    seedDemoUsers(),
  ]);

  const inserted = results.reduce((sum, item) => sum + item.inserted, 0);
  if (inserted > 0) {
    const summary = results
      .filter((item) => item.inserted > 0)
      .map((item) => `${item.inserted} ${item.label}`)
      .join(", ");
    console.log(`[db] Seeded MongoDB with ${summary}.`);
  }
}
