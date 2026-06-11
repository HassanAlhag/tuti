export const shopCategories = [
  {
    id: "all",
    slug: "",
    path: "/shop",
    label: "All",
    title: "All products",
    description: "Browse every live product from Tuti shops — perfumes, cakes, desserts, and gift sets.",
  },
  {
    id: "cake",
    slug: "cake",
    path: "/shop?c=cake",
    label: "Cakes & Desserts",
    title: "Cakes & desserts",
    description: "Artisan cakes, celebration desserts, Arabic sweets, and chocolate boxes from Tuti's pastry partners.",
  },
  {
    id: "women",
    slug: "women",
    path: "/shop/women",
    label: "Women",
    title: "Women's perfumes",
    description: "Soft florals, fresh musks, rose blends, and elegant daily scents.",
  },
  {
    id: "men",
    slug: "men",
    path: "/shop/men",
    label: "Men",
    title: "Men's perfumes",
    description: "Fresh woods, citrus, oud, amber, and polished office-to-evening scents.",
  },
  {
    id: "unisex",
    slug: "unisex",
    path: "/shop/unisex",
    label: "Unisex",
    title: "Unisex perfumes",
    description: "Modern shared scents across oud, musk, amber, fresh, and oriental families.",
  },
  {
    id: "new-arrivals",
    slug: "new-arrivals",
    path: "/shop/new-arrivals",
    label: "New Arrivals",
    title: "New arrivals",
    description: "Freshly released perfumes and newly approved drops from emerging shops.",
  },
  {
    id: "best-sellers",
    slug: "best-sellers",
    path: "/shop/best-sellers",
    label: "Best Sellers",
    title: "Best sellers",
    description: "Top performing perfumes ranked by rating confidence, verified reviews, and orders.",
  },
  {
    id: "gift-sets",
    slug: "gift-sets",
    path: "/shop/gift-sets",
    label: "Gift Sets",
    title: "Gift sets",
    description: "Gift-ready perfumes, curated sets, and polished scents for special moments.",
  },
  {
    id: "travel-size",
    slug: "travel-size",
    path: "/shop/travel-size",
    label: "Travel Size",
    title: "Travel size and mini perfumes",
    description: "Mini bottles and lighter sizes for bags, discovery, and travel.",
  },
  {
    id: "limited-edition",
    slug: "limited-edition",
    path: "/shop/limited-edition",
    label: "Limited Edition",
    title: "Limited edition",
    description: "Small-batch launches, low-stock perfumes, and seasonal releases.",
  },
];

export const collectionCategories = [
  { id: "signature", title: "Signature Collection", description: "Hero scents that define Tuti's premium marketplace style.", productIds: ["prf-001", "prf-002", "prf-006"] },
  { id: "luxury", title: "Luxury Collection", description: "Richer blends, elevated projection, and high-confidence review scores.", productIds: ["prf-001", "prf-005", "prf-004"] },
  { id: "oud", title: "Oud Collection", description: "Deep oud, smoke, saffron, leather, and amber-led perfumes.", productIds: ["prf-001", "prf-005"] },
  { id: "oriental", title: "Oriental Collection", description: "Warm resins, spices, amber, musk, and evening-ready depth.", productIds: ["prf-005", "prf-001", "prf-004"] },
  { id: "fresh", title: "Fresh Collection", description: "Citrus, tea, neroli, mint, and clean woods for daily wear.", productIds: ["prf-003", "prf-006"] },
  { id: "floral", title: "Floral Collection", description: "Rose, iris, soft petals, and polished feminine blends.", productIds: ["prf-002", "prf-006"] },
  { id: "musk", title: "Musk Collection", description: "Skin scents, white musk, tonka, iris, and quiet luxury.", productIds: ["prf-004", "prf-002"] },
  { id: "seasonal", title: "Seasonal Collection", description: "Limited drops, gifting edits, and occasion-based perfume stories.", productIds: ["prf-004", "prf-005", "prf-002"] },
];

export const giftCategories = [
  { title: "Gift Sets", path: "/shop/gift-sets", text: "Ready-to-wrap sets and curated discovery pairings." },
  { title: "Gifts for Her", path: "/shop/women", text: "Rose, musk, floral, and elegant daily perfumes." },
  { title: "Gifts for Him", path: "/shop/men", text: "Fresh woods, oud, citrus, and confident evening scents." },
  { title: "Luxury Gifts", path: "/collections", text: "Premium edits with stronger projection and richer notes." },
  { title: "Gift Card", path: "/gifting/gift-card", text: "A flexible perfume gift for clients who love choosing." },
  { title: "Corporate Gifts", path: "/gifting/corporate", text: "Bulk gifting, curated boxes, and branded client sets." },
];

export const offerSections = [
  { title: "Current Offers", text: "Limited-time discounts on selected boutique perfumes." },
  { title: "Bundles", text: "Pair oud, fresh, musk, and rose scents for better value." },
  { title: "Seasonal Sale", text: "Occasion-led edits for Eid, weddings, travel, and gifting seasons." },
  { title: "Promo Codes", text: "A controlled place for campaign codes and partner promotions." },
];

export const journalSections = [
  { title: "Perfume Tips", text: "How to apply, layer, store, and choose scents." },
  { title: "How to Choose a Perfume", text: "Guides by personality, weather, occasion, and intensity." },
  { title: "Fragrance Notes Guide", text: "Top, heart, and base note education for shoppers." },
  { title: "Oud & Oriental Perfumes", text: "Stories around oud, amber, musk, saffron, and resins." },
  { title: "Gift Guides", text: "Curated perfume gifts for her, him, teams, and special events." },
  { title: "Brand News", text: "New shops, product launches, and Tuti marketplace updates." },
];

export const supportSections = [
  { title: "Support Tickets", path: "/support", text: "General help, account questions, and operational support cases." },
  { title: "Contact Us", path: "/contact", text: "Customer care for orders, payments, sellers, and reviews." },
  { title: "FAQs", path: "/customer-service/faqs", text: "Fast answers for common shopping questions." },
  { title: "Shipping & Delivery", path: "/customer-service/shipping", text: "Delivery timing, fees, and regional coverage." },
  { title: "Returns & Exchange", path: "/customer-service/returns", text: "Return eligibility, exchange rules, and dispute handling." },
  { title: "Payment Methods", path: "/customer-service/payment-methods", text: "Cards, wallet payments, authorization, COD, payout holds, and reserve logic." },
  { title: "Track Order", path: "/customer-service/track-order", text: "Order status and delivery timeline tracking." },
  { title: "Size Guide", path: "/customer-service/size-guide", text: "30ml, 50ml, 75ml, 100ml, and discovery sizes." },
];

export const accountSections = [
  "Login",
  "Register",
  "My Profile",
  "My Orders",
  "Wishlist",
  "Address Book",
  "Loyalty Points / Rewards",
];

export const checkoutSteps = ["Cart", "Checkout", "Payment", "Order Confirmation"];

export const legalPages = [
  { title: "Privacy Policy", path: "/legal/privacy-policy" },
  { title: "Terms & Conditions", path: "/legal/terms-conditions" },
  { title: "Cookie Policy", path: "/legal/cookie-policy" },
  { title: "Refund Policy", path: "/legal/refund-policy" },
  { title: "Shipping Policy", path: "/legal/shipping-policy" },
];

// nav: args passed to onNavigate(id, category?)
// portal: env var key name for window.location.href fallback
// auth: triggers the shared auth modal
export const footerColumns = [
  {
    title: "Shop",
    links: [
      { label: "Perfumes",         nav: ["shop", "perfume"] },
      { label: "Cakes & Desserts", nav: ["shop", "cake"] },
      { label: "Gift Sets",        nav: ["shop", "gift_box"] },
      { label: "Collections",      nav: ["collections"] },
      { label: "Offers",           nav: ["offers"] },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "Build a Box",  nav: ["build-a-box"] },
      { label: "Find a Scent", nav: ["fragrance-finder"] },
      { label: "Gifting",      nav: ["gifting"] },
      { label: "Journal",      nav: ["journal"] },
      { label: "Our Story",    nav: ["about"] },
    ],
  },
  {
    title: "Partners",
    links: [
      { label: "Sell on Tuti",   nav: ["sell"] },
      { label: "Seller Central",   portal: "VITE_SELLER_URL" },
      { label: "Driver Portal",    portal: "VITE_DRIVER_URL" },
      { label: "Sales Rep Portal", portal: "VITE_SR_URL" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Centre", nav: ["support"] },
      { label: "Contact",     nav: ["contact"] },
      { label: "Account",     nav: ["account"] },
      { label: "Orders",      nav: ["account"] },
      { label: "Legal",       nav: ["legal"] },
    ],
  },
];

export function getShopCategoryBySlug(slug = "") {
  return shopCategories.find((category) => category.slug === slug) || shopCategories[0];
}

export function getShopCategoryById(id = "all") {
  return shopCategories.find((category) => category.id === id) || shopCategories[0];
}

export function productMatchesShopCategory(product, categoryId) {
  const tags = (product.tags || []).join(" ").toLowerCase();
  const releaseType = (product.releaseType || "").toLowerCase();

  switch (categoryId) {
    case "women":
      return product.gender === "Women";
    case "men":
      return product.gender === "Men";
    case "unisex":
      return product.gender === "Unisex";
    case "new-arrivals":
      return releaseType.includes("new");
    case "best-sellers":
      return releaseType.includes("best") || tags.includes("best seller") || product.orders >= 140;
    case "cake":
      return product.category === "cake" || product.category === "dessert";
    case "gift-sets":
      return tags.includes("gift") || tags.includes("set");
    case "travel-size":
      return tags.includes("travel") || (product.sizes || []).some((size) => /30ml|mini/i.test(size));
    case "limited-edition":
      return releaseType.includes("limited") || tags.includes("limited") || tags.includes("low stock");
    default:
      return true;
  }
}
