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

export const journalCategories = [
  { id: "all",      label: "All" },
  { id: "guide",    label: "Guides" },
  { id: "oud",      label: "Oud & Oriental" },
  { id: "gifting",  label: "Gifting" },
  { id: "news",     label: "News" },
];

export const journalArticles = [
  {
    slug: "how-to-choose-a-perfume",
    category: "guide",
    title: "How to Choose the Right Perfume",
    summary: "Fragrance families, skin chemistry, and testing strategies — a complete beginner's guide to finding your signature scent.",
    readMins: 6,
    date: "2026-05-01",
    path: "/journal/how-to-choose-a-perfume",
  },
  {
    slug: "perfume-tips",
    category: "guide",
    title: "10 Tips for Wearing and Storing Perfume",
    summary: "From pulse points and layering to UV storage and sample testing — practical tips that make your fragrance last longer.",
    readMins: 4,
    date: "2026-05-10",
    path: "/journal/perfume-tips",
  },
  {
    slug: "fragrance-notes-guide",
    category: "guide",
    title: "Fragrance Notes Explained: Top, Heart, and Base",
    summary: "What perfumers call top notes, heart notes, and base notes — and how to read a note pyramid when shopping.",
    readMins: 5,
    date: "2026-05-18",
    path: "/journal/fragrance-notes-guide",
  },
  {
    slug: "oud-oriental-perfumes",
    category: "oud",
    title: "Oud & Oriental Perfumes: A Guide to the Gulf Fragrance Tradition",
    summary: "The story of oud wood, amber, saffron, and musk — and how Gulf perfumers blend ancient materials with modern sensibilities.",
    readMins: 7,
    date: "2026-05-25",
    path: "/journal/oud-oriental-perfumes",
  },
  {
    slug: "gift-guides",
    category: "gifting",
    title: "Perfume Gift Guides: Birthday, Anniversary, Eid & Corporate",
    summary: "Curated perfume gift recommendations for every occasion — from personal birthday gifts to large corporate gifting orders.",
    readMins: 5,
    date: "2026-06-01",
    path: "/journal/gift-guides",
  },
  {
    slug: "build-a-box-guide",
    category: "gifting",
    title: "How to Build the Perfect Gift Box on Tuti",
    summary: "A step-by-step guide to using Build Your Box — choosing a perfume, pairing a cake or dessert, and adding a gift message.",
    readMins: 3,
    date: "2026-06-08",
    path: "/journal/build-a-box-guide",
  },
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
  { title: "Privacy Policy",    slug: "privacy-policy",    path: "/legal/privacy-policy" },
  { title: "Terms & Conditions", slug: "terms-conditions", path: "/legal/terms-conditions" },
  { title: "Cookie Policy",     slug: "cookie-policy",     path: "/legal/cookie-policy" },
  { title: "Refund Policy",     slug: "refund-policy",     path: "/legal/refund-policy" },
  { title: "Shipping Policy",   slug: "shipping-policy",   path: "/legal/shipping-policy" },
];

export const legalContent = {
  "privacy-policy": {
    title: "Privacy Policy",
    updated: "1 June 2026",
    sections: [
      {
        heading: "What we collect",
        body: "When you create an account or place an order we collect your name, email address, phone number, delivery address, and order details. If you browse without an account we collect anonymised page view and product interaction data to improve the marketplace.",
      },
      {
        heading: "How we use your information",
        body: "We use your data to process orders, send order status updates, handle support requests, and improve our platform. We do not sell your personal data to third parties.",
      },
      {
        heading: "Data retention",
        body: "Account data is retained for as long as your account is active. Order records are retained for seven years for accounting and compliance purposes. You may request deletion of your account at any time by contacting support.",
      },
      {
        heading: "Cookies",
        body: "We use essential cookies to keep you signed in and remember your cart. Analytics cookies are optional and can be declined. See our Cookie Policy for full details.",
      },
      {
        heading: "Your rights",
        body: "You have the right to access, correct, or delete the personal information we hold about you. Contact us at privacy@tuti.ae to exercise these rights.",
      },
      {
        heading: "Contact",
        body: "Privacy questions: privacy@tuti.ae. Tuti Marketplace, UAE.",
      },
    ],
  },
  "terms-conditions": {
    title: "Terms & Conditions",
    updated: "1 June 2026",
    sections: [
      {
        heading: "Acceptance",
        body: "By using Tuti you agree to these terms. If you do not agree, please do not use the platform.",
      },
      {
        heading: "Marketplace relationship",
        body: "Tuti is a marketplace connecting buyers and independent sellers. Tuti is not the seller of record for products listed by third-party sellers. Each seller is responsible for product quality, accuracy of listings, and fulfilment.",
      },
      {
        heading: "Orders and payment",
        body: "Orders placed through the platform constitute an offer to purchase. Sellers may accept or decline orders. Cash on delivery is the primary payment method. Card payment is available where indicated.",
      },
      {
        heading: "Returns and refunds",
        body: "Return and refund eligibility is governed by the Refund Policy. Perishable items (cakes, desserts) are non-returnable unless delivered damaged or incorrect.",
      },
      {
        heading: "Prohibited use",
        body: "You may not use Tuti to list counterfeit goods, engage in fraudulent transactions, harass other users, or violate applicable UAE law.",
      },
      {
        heading: "Limitation of liability",
        body: "Tuti's liability is limited to the value of the order in dispute. We are not liable for indirect or consequential losses.",
      },
      {
        heading: "Governing law",
        body: "These terms are governed by the laws of the United Arab Emirates.",
      },
    ],
  },
  "cookie-policy": {
    title: "Cookie Policy",
    updated: "1 June 2026",
    sections: [
      {
        heading: "What are cookies",
        body: "Cookies are small text files stored on your device when you visit a website. They help us keep you signed in, remember your preferences, and understand how people use our platform.",
      },
      {
        heading: "Essential cookies",
        body: "These cookies are required for the platform to function. They include authentication tokens, cart state, and CSRF protection. You cannot opt out of essential cookies without stopping use of the platform.",
      },
      {
        heading: "Analytics cookies",
        body: "We use anonymised analytics to understand which pages are visited and how customers navigate the site. These cookies do not identify you personally. You may opt out at any time.",
      },
      {
        heading: "Managing cookies",
        body: "You can control cookies through your browser settings. Disabling essential cookies will prevent you from signing in or completing a purchase.",
      },
    ],
  },
  "refund-policy": {
    title: "Refund Policy",
    updated: "1 June 2026",
    sections: [
      {
        heading: "Eligibility",
        body: "Products may be returned within 14 days of delivery if they are unused, undamaged, and in original packaging. Perishable items (cakes, desserts) are not eligible for return unless delivered damaged or incorrect.",
      },
      {
        heading: "How to request a refund",
        body: "Open a support ticket from your account page, attach photos of the item, and describe the issue. Our team aims to respond within 24 hours.",
      },
      {
        heading: "Refund timeline",
        body: "Approved refunds for card payments are processed within 5–10 business days. COD order credits are applied to your Tuti account or settled directly by the seller.",
      },
      {
        heading: "Non-returnable items",
        body: "Personalised items (custom cake messages, engraved gifts), opened perfume bottles, and digital items are non-returnable.",
      },
    ],
  },
  "shipping-policy": {
    title: "Shipping Policy",
    updated: "1 June 2026",
    sections: [
      {
        heading: "Delivery areas",
        body: "Tuti currently delivers within the UAE. Delivery is managed by seller-assigned drivers or platform-contracted delivery partners.",
      },
      {
        heading: "Delivery times",
        body: "Standard delivery is 1–3 business days. Same-day delivery is available from select sellers in Dubai and Abu Dhabi. Estimated delivery dates are shown at checkout.",
      },
      {
        heading: "Delivery fees",
        body: "Delivery fees are set per seller and shown at checkout. Some sellers offer free delivery on orders above a minimum basket value.",
      },
      {
        heading: "Cash on delivery",
        body: "COD is available on all orders. Payment is collected by the driver at the time of delivery. Exact change is appreciated.",
      },
      {
        heading: "Failed deliveries",
        body: "If a delivery attempt fails, the driver will contact you to reschedule. Three failed attempts may result in order cancellation.",
      },
    ],
  },
};

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
