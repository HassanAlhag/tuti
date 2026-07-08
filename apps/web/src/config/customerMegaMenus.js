export const customerMegaMenus = {
  shop: {
    key: "shop",
    layout: "shop",
    eyebrow: "AI-assisted shopping",
    title: "Shop Tuti",
    body: "Find the right gift for the moment.",
    description: "Boutique perfumes, artisan cakes and desserts, and curated gift boxes from sellers across the UAE.",
    primaryCta:   { label: "Browse gifts",  routeId: "shop" },
    secondaryCta: { label: "Find a scent ✦", routeId: "fragrance-finder" },
    cards: [
      { key: "perfume",  icon: "✦", label: "Perfumes",        desc: "Boutique fragrances",      routeId: "shop",        category: "perfume"  },
      { key: "cake",     icon: "◆", label: "Cakes & Desserts", desc: "Artisan celebration treats", routeId: "shop",        category: "cake"     },
      { key: "gift_box", icon: "◈", label: "Gift Boxes",       desc: "Ready-made occasion gifts",  routeId: "shop",        category: "gift_box" },
      { key: "build",    icon: "◉", label: "Build a Gift",     desc: "Only at Tuti · one boutique", routeId: "build-a-box", category: null       },
    ],
  },

  perfumes: {
    key: "perfumes",
    layout: "category",
    featureEyebrow: "Perfume boutiques",
    featureTitle: "Find your signature scent.",
    featureBody: "Browse perfumes from verified boutiques across the UAE.",
    primaryCta:   { label: "Shop all perfumes", routeId: "shop", category: "perfume" },
    secondaryCta: { label: "Find a scent ✦",    routeId: "fragrance-finder" },
    subcategoriesHeading: "Browse by",
    subcategories: [
      { label: "For Her",      routeId: "shop", category: "perfume" },
      { label: "For Him",      routeId: "shop", category: "perfume" },
      { label: "Oud",          routeId: "shop", category: "perfume" },
      { label: "Musk",         routeId: "shop", category: "perfume" },
      { label: "Floral",       routeId: "shop", category: "perfume" },
      { label: "Amber",        routeId: "shop", category: "perfume" },
      { label: "Fresh",        routeId: "shop", category: "perfume" },
      { label: "Luxury Gifts", routeId: "shop", category: "perfume" },
    ],
    panelEyebrow: "Only at Tuti",
    panelTitle:   "Build a Gift",
    panelBody:    "Select items from one boutique and create a personalised gift with a message and packaging.",
    panelCta:     { label: "Build a gift", routeId: "build-a-box" },
  },

  cakes: {
    key: "cakes",
    layout: "category",
    featureEyebrow: "Cake & dessert boutiques",
    featureTitle: "Made for celebrations.",
    featureBody: "Choose cakes, dessert boxes, and sweet treats from cake boutiques.",
    primaryCta: { label: "Shop all cakes & desserts", routeId: "shop", category: "cake" },
    subcategoriesHeading: "Browse by",
    subcategories: [
      { label: "Birthday Cakes",   routeId: "shop", category: "cake" },
      { label: "Chocolate Cakes",  routeId: "shop", category: "cake" },
      { label: "Mini Cakes",       routeId: "shop", category: "cake" },
      { label: "Dessert Boxes",    routeId: "shop", category: "cake" },
      { label: "Cupcakes",         routeId: "shop", category: "cake" },
      { label: "Cheesecakes",      routeId: "shop", category: "cake" },
      { label: "Celebration Sets", routeId: "shop", category: "cake" },
      { label: "Same-Day Treats",  routeId: "shop", category: "cake" },
    ],
    panelEyebrow: "Only at Tuti",
    panelTitle:   "Build a Gift",
    panelBody:    "Select a cake or dessert from one boutique and create a personalised gift with a custom message.",
    panelCta:     { label: "Build a gift", routeId: "build-a-box" },
  },

  giftBoxes: {
    key: "giftBoxes",
    layout: "category",
    featureEyebrow: "Gift boutiques",
    featureTitle: "Ready gifts, beautifully prepared.",
    featureBody: "Browse graduation gifts, occasion boxes, and curated boutique packages.",
    primaryCta: { label: "Shop all gift boxes", routeId: "shop", category: "gift_box" },
    subcategoriesHeading: "Browse by occasion",
    subcategories: [
      { label: "Graduation",        routeId: "shop", category: "gift_box" },
      { label: "Birthday",          routeId: "shop", category: "gift_box" },
      { label: "Anniversary",       routeId: "shop", category: "gift_box" },
      { label: "Thank You",         routeId: "shop", category: "gift_box" },
      { label: "Corporate",         routeId: "shop", category: "gift_box" },
      { label: "New Baby",          routeId: "shop", category: "gift_box" },
      { label: "Eid / Ramadan",     routeId: "shop", category: "gift_box" },
      { label: "Apology / Flowers", routeId: "shop", category: "gift_box" },
    ],
    panelEyebrow: "Only at Tuti",
    panelTitle:   "Build a Gift",
    panelBody:    "Build a personalised gift from one boutique. Select your products, add a message, and send.",
    panelCta:     { label: "Build a gift", routeId: "build-a-box" },
  },
};

// Maps headerNavRoutes routeKey → customerMegaMenus key
export const MEGA_ROUTE_MAP = {
  shop:      "shop",
  perfumes:  "perfumes",
  cakes:     "cakes",
  giftBoxes: "giftBoxes",
};

// Subcategories shown in the mobile drawer expansion
export const mobileDrawerSubcategories = {
  perfumes: [
    { label: "For Her",      routeId: "shop", category: "perfume" },
    { label: "For Him",      routeId: "shop", category: "perfume" },
    { label: "Oud",          routeId: "shop", category: "perfume" },
    { label: "Musk",         routeId: "shop", category: "perfume" },
    { label: "Floral",       routeId: "shop", category: "perfume" },
    { label: "Fresh",        routeId: "shop", category: "perfume" },
  ],
  cakes: [
    { label: "Birthday Cakes",  routeId: "shop", category: "cake" },
    { label: "Chocolate Cakes", routeId: "shop", category: "cake" },
    { label: "Dessert Boxes",   routeId: "shop", category: "cake" },
    { label: "Cupcakes",        routeId: "shop", category: "cake" },
  ],
  giftBoxes: [
    { label: "Graduation",    routeId: "shop", category: "gift_box" },
    { label: "Birthday",      routeId: "shop", category: "gift_box" },
    { label: "Corporate",     routeId: "shop", category: "gift_box" },
    { label: "Eid / Ramadan", routeId: "shop", category: "gift_box" },
  ],
};

// Maps category value → mobileDrawerSubcategories key
export const CATEGORY_MOBILE_KEY = {
  perfume:  "perfumes",
  cake:     "cakes",
  gift_box: "giftBoxes",
};
