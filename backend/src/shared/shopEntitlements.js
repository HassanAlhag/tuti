export const SHOP_CATEGORY_VALUES = ["perfume", "cake", "dessert", "gift_box", "mixed"];
export const SELLER_PRODUCT_CATEGORY_VALUES = ["perfume", "cake", "dessert", "gift_box"];

const CATEGORY_ALIASES = new Map([
  ["cakes", "cake"],
  ["bakery", "cake"],
  ["sweets", "dessert"],
  ["sweet", "dessert"],
  ["desserts", "dessert"],
  ["gift", "gift_box"],
  ["gifts", "gift_box"],
  ["giftbox", "gift_box"],
  ["giftboxes", "gift_box"],
  ["gift-box", "gift_box"],
  ["gift_boxes", "gift_box"],
  ["gift sets", "gift_box"],
  ["gift_sets", "gift_box"],
  ["gift-set", "gift_box"],
]);

function normalizeRawCategory(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, "_");
  return CATEGORY_ALIASES.get(normalized) || normalized;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeShopCategories(input) {
  const raw = Array.isArray(input)
    ? input
    : Array.isArray(input?.shopCategories)
      ? input.shopCategories
      : Array.isArray(input?.categories)
        ? input.categories
        : [input?.shopCategory || input?.category || input].filter(Boolean);

  const selected = unique(raw.map(normalizeRawCategory).filter((category) => SHOP_CATEGORY_VALUES.includes(category)));
  if (selected.includes("mixed")) {
    return ["perfume", "cake", "dessert"];
  }
  return selected.length ? selected : ["mixed"];
}

export function normalizeProductCategory(value) {
  const normalized = normalizeRawCategory(value);
  return SELLER_PRODUCT_CATEGORY_VALUES.includes(normalized) ? normalized : normalized;
}

export function derivePrimaryShopCategory(categories) {
  const selected = normalizeShopCategories(categories);
  const hasPerfume = selected.includes("perfume");
  const hasFood = selected.includes("cake") || selected.includes("dessert");
  if (hasPerfume && hasFood) return "mixed";
  if (hasPerfume) return "perfume";
  if (selected.includes("cake")) return "cake";
  if (selected.includes("dessert")) return "dessert";
  if (selected.includes("gift_box")) return "gift_box";
  return "mixed";
}

export function getAllowedProductCategories(shopOrCategories) {
  const categories = normalizeShopCategories(shopOrCategories);
  const allowed = new Set();
  const hasPerfume = categories.includes("perfume");
  const hasCake = categories.includes("cake");
  const hasDessert = categories.includes("dessert");
  const hasGiftBox = categories.includes("gift_box");

  if (hasPerfume) allowed.add("perfume");
  if (hasCake || hasDessert) {
    allowed.add("cake");
    allowed.add("dessert");
  }
  if (hasGiftBox || hasPerfume || hasCake || hasDessert) allowed.add("gift_box");

  return [...allowed];
}

export function canShopCreateProductCategory(shopOrCategories, productCategory) {
  const category = normalizeProductCategory(productCategory);
  if (category === "bundle" || category === "mixed") return false;
  return getAllowedProductCategories(shopOrCategories).includes(category);
}

export function productCategoryLabel(productCategory) {
  const category = normalizeProductCategory(productCategory);
  if (category === "perfume") return "Perfumes";
  if (category === "cake" || category === "dessert") return "Cakes & Desserts";
  if (category === "gift_box") return "Gift Boxes";
  return "this category";
}

export function assertShopCanUseProductCategory(shopOrCategories, productCategory) {
  const category = normalizeProductCategory(productCategory);
  if (category === "bundle") {
    const error = new Error("Legacy bundle products cannot be created by sellers. Use Gift Box instead.");
    error.status = 422;
    throw error;
  }
  if (!SELLER_PRODUCT_CATEGORY_VALUES.includes(category) || !canShopCreateProductCategory(shopOrCategories, category)) {
    const error = new Error(`This boutique is not approved to create products in the ${productCategoryLabel(category)} category.`);
    error.status = 403;
    throw error;
  }
  return category;
}

export function syncShopCategoryFields(target, categoriesInput) {
  const categories = normalizeShopCategories(categoriesInput);
  target.categories = categories;
  target.category = derivePrimaryShopCategory(categories);
  return target;
}

export function categoryCover(categoriesInput) {
  const categories = normalizeShopCategories(categoriesInput);
  const primary = derivePrimaryShopCategory(categories);
  if (primary === "mixed") return "Multi-category boutique";
  return {
    perfume: "Perfume boutique",
    cake: "Cake studio",
    dessert: "Dessert and sweets shop",
    gift_box: "Luxury gift boxes",
    mixed: "Perfume, cakes, and gifts",
  }[primary] || "Tuti seller";
}
