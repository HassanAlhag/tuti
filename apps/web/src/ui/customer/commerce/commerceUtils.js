export function toNumber(value) {
  if (value == null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function formatTutiPrice(value, currency = "AED") {
  const amount = toNumber(value);
  if (amount == null) return "";

  try {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: currency || "AED",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "AED"} ${Math.round(amount)}`;
  }
}

export function getProductId(product = {}) {
  return product.id || product._id || product.productId || product.slug || "";
}

export function normalizeCustomerProductName(value) {
  const raw = String(value || "").trim();
  if (/^(build your box|build a box|build-your-box)$/i.test(raw)) return "Build a Gift";
  return raw;
}

export function getProductName(product = {}) {
  return normalizeCustomerProductName(product.name || product.title || product.productName || "Untitled product");
}

export function getProductCategory(product = {}) {
  const category = String(product.category || product.type || "").toLowerCase();
  if (category === "dessert") return "cake";
  if (category === "bundle") return "gift_box";
  if (["perfume", "cake", "gift_box"].includes(category)) return category;
  return "default";
}

export function getProductImage(product = {}) {
  if (product.imagePath || product.imageUrl) return product.imagePath || product.imageUrl;
  if (Array.isArray(product.images) && product.images.length) {
    const first = product.images[0];
    return typeof first === "string" ? first : first?.url || first?.src || "";
  }
  return "";
}

export function getProductPrice(product = {}) {
  return toNumber(product.price ?? product.priceFrom ?? product.unitPrice);
}

export function getProductCompareAtPrice(product = {}) {
  return toNumber(product.compareAtPrice ?? product.originalPrice ?? product.wasPrice);
}

export function getShopName(product = {}, shop) {
  return shop?.name || shop?.displayName || product.shopName || product.sellerName || "Marketplace seller";
}

export function getShopId(product = {}) {
  return product.shopId || product.sellerId || product.sellerShopId || "";
}

export function getProductTypeLabel(product = {}) {
  if (product.cakeType) return product.cakeType;
  if (product.family) return product.family;
  if (product.collection) return product.collection;

  const category = getProductCategory(product);
  if (category === "gift_box") return "Gift Box";
  if (category === "cake") return "Cake";
  if (category === "perfume") return "Perfume";
  return "Tuti pick";
}

export function getProductTags(product = {}, limit = 3) {
  const source = [
    product.releaseType,
    product.family,
    product.gender,
    product.size,
    product.cakeType,
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(product.notes) ? product.notes : []),
    ...(Array.isArray(product.flavors) ? product.flavors : []),
    ...(Array.isArray(product.includes) ? product.includes : []),
    ...(Array.isArray(product.occasionTags) ? product.occasionTags : []),
  ];

  return [...new Set(source.map((tag) => String(tag || "").trim()).filter(Boolean))].slice(0, limit);
}

export function getProductSummary(product = {}) {
  if (product.description) return product.description;
  if (Array.isArray(product.flavors) && product.flavors.length) return product.flavors.slice(0, 2).join(" · ");
  if (Array.isArray(product.notes) && product.notes.length) return product.notes.slice(0, 3).join(" · ");
  if (Array.isArray(product.includes) && product.includes.length) return product.includes.slice(0, 2).join(" · ");
  return "";
}

export function resolveShop(product = {}, shopsById, getShop) {
  if (typeof getShop === "function") return getShop(getShopId(product), product);
  if (shopsById && getShopId(product)) return shopsById[getShopId(product)] || null;
  return null;
}
