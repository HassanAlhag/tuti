export const shopCategories = [
  {
    id: "all",
    slug: "",
    path: "/shop",
    label: "All",
    title: "All products",
    description: "Browse every live product from Tuti shops — perfumes, cakes, desserts, and gift boxes.",
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
    label: "Gift Boxes",
    title: "Gift boxes",
    description: "Gift-ready perfumes, curated gift boxes, and polished scents for special moments.",
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
  { title: "Gift Boxes", path: "/shop?c=gift_box", text: "Ready-made gift boxes and curated occasion packages from boutiques." },
  { title: "Gifts for Her", path: "/shop/women", text: "Rose, musk, floral, and elegant daily perfumes." },
  { title: "Gifts for Him", path: "/shop/men", text: "Fresh woods, oud, citrus, and confident evening scents." },
  { title: "Luxury Gifts", path: "/collections", text: "Premium edits with stronger projection and richer notes." },
  { title: "Gift Card", path: "/gifting/gift-card", text: "A flexible perfume gift for clients who love choosing." },
  { title: "Corporate Gifts", path: "/gifting/corporate", text: "Bulk gifting, curated boxes, and branded client sets." },
];

export const offerSections = [
  { title: "Current Offers", text: "Limited-time discounts on selected boutique perfumes." },
  { title: "Value Combinations", text: "Pair oud, fresh, musk, and rose scents for better value." },
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
    summary: "A step-by-step guide to using Build a Gift — selecting your products from one boutique and adding a personal message.",
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
  { title: "Privacy Policy",       slug: "privacy-policy",    path: "/legal/privacy-policy",    desc: "How we collect, use, and protect your information." },
  { title: "Terms & Conditions",   slug: "terms-conditions",  path: "/legal/terms-conditions",  desc: "Marketplace rules, ordering, and your rights as a customer." },
  { title: "Refund & Cancellation", slug: "refund-policy",   path: "/legal/refund-policy",     desc: "Eligibility, timelines, and how to request a refund." },
  { title: "Delivery Policy",      slug: "shipping-policy",   path: "/legal/shipping-policy",   desc: "Delivery areas, timelines, fees, and boutique preparation." },
  { title: "Build a Gift Terms",   slug: "build-gift-terms",  path: "/legal/build-gift-terms",  desc: "Customization rules, pricing, and boutique preparation for gift orders." },
  { title: "Cookie Policy",        slug: "cookie-policy",     path: "/legal/cookie-policy",     desc: "Essential and optional cookies used on this platform." },
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
    updated: "1 July 2026",
    sections: [
      {
        heading: "Acceptance",
        body: "By using Tuti you agree to these terms. If you do not agree, please do not use the platform.",
      },
      {
        heading: "Marketplace relationship",
        body: "Tuti is a marketplace connecting buyers and independent boutique sellers. Tuti facilitates the transaction but is not the seller of record for products listed by third-party boutiques. Each boutique is responsible for product quality, accuracy of listings, preparation, packaging, and fulfilment of their own items.",
      },
      {
        heading: "Boutique preparation",
        body: "Each boutique on Tuti prepares its own products and gift packaging independently. When a cart contains items from multiple boutiques, each boutique prepares its own portion of the order separately. Tuti does not combine, assemble, or repackage products from different boutiques into a single parcel.",
      },
      {
        heading: "Orders and payment",
        body: "Orders placed through the platform constitute an offer to purchase. Boutiques may accept or decline orders. Cash on delivery is the primary payment method. Card payment is available where indicated. VAT and applicable fees are shown at checkout before you confirm.",
      },
      {
        heading: "Returns and refunds",
        body: "Return and refund eligibility is governed by the Refund & Cancellation Policy. Perishable items (cakes, desserts) are non-returnable unless delivered damaged or incorrect. Build a Gift orders are customized and prepared to order; eligibility may differ.",
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
    title: "Refund & Cancellation Policy",
    updated: "1 July 2026",
    sections: [
      {
        heading: "Eligibility",
        body: "Products may be returned within 14 days of delivery if they are unused, undamaged, and in original packaging. Perishable items (cakes, desserts) are not eligible for return unless delivered damaged or incorrect. Eligibility may also depend on the boutique's own preparation status — for example, a cake that has already been baked and is ready for delivery cannot be cancelled.",
      },
      {
        heading: "Cancellations",
        body: "You may cancel an order before the boutique begins preparation. Once preparation has started (status: Processing or later), cancellation may not be possible, particularly for food items and customized gifts. Contact support as quickly as possible if you need to cancel.",
      },
      {
        heading: "Build a Gift orders",
        body: "Build a Gift orders are customized and prepared to order by the boutique. Cancellation is only possible before the boutique confirms and begins preparation. Gift message and customization details cannot be amended after the order is confirmed.",
      },
      {
        heading: "How to request a refund",
        body: "Open a support ticket from your account or orders page, attach photos of the item if relevant, and describe the issue. Our team aims to respond within 24 hours. For order outcome disputes (wrong item, damaged delivery), use the dispute flow from your order detail.",
      },
      {
        heading: "Refund timeline",
        body: "Approved refunds for card payments are processed within 5–10 business days. COD order credits are applied to your Tuti account or settled directly by the seller.",
      },
      {
        heading: "Non-returnable items",
        body: "Items that cannot be returned include: opened perfume bottles; perishable items (cakes, desserts) unless damaged or incorrect; Build a Gift customized orders once preparation has started; and any item explicitly marked non-returnable at the time of purchase.",
      },
    ],
  },
  "shipping-policy": {
    title: "Delivery Policy",
    updated: "1 July 2026",
    sections: [
      {
        heading: "Delivery areas",
        body: "Tuti currently delivers within the UAE. Delivery is managed by boutique-assigned drivers or platform-contracted delivery partners.",
      },
      {
        heading: "Boutique preparation time",
        body: "Delivery timelines depend on both boutique preparation and physical delivery. Each boutique prepares its own products independently. Food items (cakes, desserts) may have a preparation lead time of 1–2 days. Fragrance and gift box orders are typically ready to dispatch within 24 hours of confirmation. Preparation time is separate from the delivery transit time.",
      },
      {
        heading: "Delivery times",
        body: "Standard delivery is 1–3 business days from the point the boutique is ready. Same-day delivery is available from select boutiques in Dubai and Abu Dhabi. Estimated delivery dates are shown at checkout and in your order details.",
      },
      {
        heading: "Multiple boutiques",
        body: "If your order contains items from more than one boutique, each boutique prepares and dispatches its own items separately. You may receive items at different times. Each boutique's status is shown in your order details.",
      },
      {
        heading: "Allergy and food preparation",
        body: "Allergy notes submitted at checkout are passed to the boutique as instructions. However, allergy notes do not replace direct confirmation with the boutique where needed. For severe allergies, contact us before placing an order.",
      },
      {
        heading: "Delivery fees",
        body: "Delivery fees are set per boutique and shown at checkout. Some boutiques offer free delivery on orders above a minimum basket value.",
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
  "build-gift-terms": {
    title: "Build a Gift — Terms & Customization",
    updated: "1 July 2026",
    sections: [
      {
        heading: "What Build a Gift is",
        body: "Build a Gift is Tuti's guided customization flow. It lets you configure a gift box from products offered by one boutique — choosing an occasion, gift type, wrap style, selected items, and a personalized message. The complete configuration is attached to your cart item and sent to the boutique when you place your order.",
      },
      {
        heading: "One boutique per Build a Gift order",
        body: "Each Build a Gift is prepared entirely by a single boutique. Tuti does not combine products from multiple boutiques into one gift box. If you would like gifts from different boutiques, you can add separate products to your cart alongside your Build a Gift item.",
      },
      {
        heading: "Pricing and VAT",
        body: "The price for your Build a Gift configuration is shown in your cart before checkout. VAT is applied at checkout. The final price includes all customization options you have selected. No additional charges are added after checkout.",
      },
      {
        heading: "Gift message",
        body: "A personalized gift message can be added during the Build a Gift flow. The message is shared with the boutique and included with your gift. The message cannot be amended after the order is confirmed.",
      },
      {
        heading: "Preparation and delivery",
        body: "Build a Gift orders are prepared to order by the boutique. Preparation may take longer than standard products, especially for food elements. Estimated delivery is shown at checkout. The boutique's preparation status is visible in your order details.",
      },
      {
        heading: "Cancellation and returns",
        body: "Build a Gift orders can only be cancelled before the boutique begins preparation. Once preparation starts, the order cannot be cancelled or amended. Food items included in a gift build are non-returnable unless delivered damaged or incorrect. See the Refund & Cancellation Policy for full details.",
      },
      {
        heading: "Customization data",
        body: "Your customization choices (occasion, items, message, wrap) are stored as part of your order and visible in your account. Tuti retains this data as part of your order record in accordance with the Privacy Policy.",
      },
    ],
  },
};

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
