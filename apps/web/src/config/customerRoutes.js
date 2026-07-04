const portalRoute = (id, label, portalKey, group) => ({
  id,
  label,
  portalKey,
  footerGroup: group,
  mobileDrawerGroup: group,
  external: true,
});

export const customerRoutes = {
  home: {
    id: "home",
    routeId: "home",
    path: "/",
    label: "Home",
    header: true,
    mobileDrawer: true,
    mobileDrawerGroup: "Shop",
  },
  shop: {
    id: "shop",
    routeId: "shop",
    path: "/shop",
    label: "Shop",
    header: true,
    mobileDrawer: true,
    mobileDrawerGroup: "Shop",
  },
  perfumes: {
    id: "perfumes",
    routeId: "shop",
    path: "/shop?c=perfume",
    label: "Perfumes",
    category: "perfume",
    header: true,
    mobileDrawer: true,
    footer: true,
    footerGroup: "Shop",
    mobileDrawerGroup: "Shop",
    contextual: ["categoryShortcut"],
  },
  cakes: {
    id: "cakes",
    routeId: "shop",
    path: "/shop?c=cake",
    label: "Cakes & Desserts",
    category: "cake",
    header: true,
    mobileDrawer: true,
    footer: true,
    footerGroup: "Shop",
    mobileDrawerGroup: "Shop",
    contextual: ["categoryShortcut"],
  },
  giftBoxes: {
    id: "giftBoxes",
    routeId: "shop",
    path: "/shop?c=gift_box",
    label: "Gift Sets",
    shortLabel: "Gift Boxes",
    category: "gift_box",
    header: true,
    mobileDrawer: true,
    footer: true,
    footerGroup: "Shop",
    mobileDrawerGroup: "Shop",
    contextual: ["categoryShortcut"],
  },
  product: {
    id: "product",
    routeId: "product",
    path: "/products/:id",
    label: "Product detail",
    dynamic: true,
  },
  cart: {
    id: "cart",
    routeId: "cart",
    path: "/cart",
    label: "Cart",
    contextual: ["cart"],
  },
  buildBox: {
    id: "buildBox",
    routeId: "build-a-box",
    path: "/build-a-box",
    label: "Build a Box",
    header: true,
    mobileDrawer: true,
    footer: true,
    footerGroup: "Discover",
    mobileDrawerGroup: "Shop",
    contextual: ["homepageCta", "categoryShortcut"],
  },
  collections: {
    id: "collections",
    routeId: "collections",
    path: "/collections",
    label: "Collections",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Shop",
    mobileDrawerGroup: "Shop",
  },
  collection: {
    id: "collection",
    routeId: "collection",
    path: "/collections/:slug",
    label: "Collection detail",
    dynamic: true,
  },
  shops: {
    id: "shops",
    routeId: "shops",
    path: "/shops",
    label: "Sellers",
    header: true,
    mobileDrawer: true,
    mobileDrawerGroup: "Shop",
    contextual: ["categoryShortcut"],
  },
  seller: {
    id: "seller",
    routeId: "seller-brand",
    path: "/sellers/:slug",
    label: "Seller detail",
    dynamic: true,
  },
  gifting: {
    id: "gifting",
    routeId: "gifting",
    path: "/gifting",
    label: "Gifting",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Discover",
    mobileDrawerGroup: "Discover",
  },
  fragranceFinder: {
    id: "fragranceFinder",
    routeId: "fragrance-finder",
    path: "/fragrance-finder",
    label: "Find a Scent",
    headerLabel: "Find a Scent ✦",
    header: true,
    headerFinder: true,
    mobileDrawer: true,
    footer: true,
    footerGroup: "Discover",
    mobileDrawerGroup: "Discover",
    contextual: ["categoryShortcut"],
  },
  offers: {
    id: "offers",
    routeId: "offers",
    path: "/offers",
    label: "Offers",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Shop",
    mobileDrawerGroup: "Discover",
  },
  journal: {
    id: "journal",
    routeId: "journal",
    path: "/journal",
    label: "Journal",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Discover",
    mobileDrawerGroup: "Discover",
  },
  support: {
    id: "support",
    routeId: "support",
    path: "/support",
    label: "Help Centre",
    mobileDrawerLabel: "Support",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Support",
    mobileDrawerGroup: "Help",
  },
  customerService: {
    id: "customerService",
    routeId: "customer-service",
    path: "/customer-service",
    label: "Customer Service",
  },
  contact: {
    id: "contact",
    routeId: "contact",
    path: "/contact",
    label: "Contact",
    footer: true,
    footerGroup: "Support",
  },
  storeLocator: {
    id: "storeLocator",
    routeId: "store-locator",
    path: "/store-locator",
    label: "Store Locator",
  },
  legal: {
    id: "legal",
    routeId: "legal",
    path: "/legal",
    label: "Legal",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Support",
    mobileDrawerGroup: "Help",
  },
  account: {
    id: "account",
    routeId: "account",
    path: "/account",
    label: "Account",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Support",
    mobileDrawerGroup: "Help",
  },
  orders: {
    id: "orders",
    routeId: "account",
    path: "/account",
    label: "Orders",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Support",
    mobileDrawerGroup: "Help",
  },
  login: {
    id: "login",
    routeId: "login",
    path: "/login",
    label: "Login",
  },
  sell: {
    id: "sell",
    routeId: "sell",
    path: "/sell",
    label: "Sell on Tuti",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Partners",
    mobileDrawerGroup: "Partners",
  },
  about: {
    id: "about",
    routeId: "about",
    path: "/about",
    label: "Our Story",
    mobileDrawer: true,
    footer: true,
    footerGroup: "Discover",
    mobileDrawerGroup: "Discover",
  },
  order: {
    id: "order",
    routeId: "order-confirmation",
    path: "/orders/:id",
    label: "Order detail",
    dynamic: true,
  },
  sellerCentral: portalRoute("sellerCentral", "Seller Central", "VITE_SELLER_URL", "Partners"),
  driverPortal: portalRoute("driverPortal", "Driver Portal", "VITE_DRIVER_URL", "Partners"),
  salesRepPortal: portalRoute("salesRepPortal", "Sales Rep Portal", "VITE_SR_URL", "Partners"),
};

export const customerRouteList = Object.values(customerRoutes);

export const routePaths = {
  product: (id) => `/products/${encodeURIComponent(id)}`,
  collection: (slug) => `/collections/${encodeURIComponent(slug)}`,
  seller: (slug) => `/sellers/${encodeURIComponent(slug)}`,
  order: (id) => `/orders/${encodeURIComponent(id)}`,
};

export function getCustomerRoute(id) {
  return customerRoutes[id] || null;
}

export function getCustomerRouteByRouteId(routeId) {
  return customerRouteList.find((route) => route.routeId === routeId) || null;
}

export function getCustomerPath(id) {
  return getCustomerRoute(id)?.path || "";
}

function toNavigateItem(route, labelKey = "label") {
  return {
    id: route.routeId,
    routeKey: route.id,
    category: route.category,
    label: route[labelKey] || route.label,
    finder: Boolean(route.headerFinder),
  };
}

export const headerNavRoutes = [
  customerRoutes.home,
  customerRoutes.shop,
  customerRoutes.perfumes,
  customerRoutes.cakes,
  customerRoutes.giftBoxes,
  customerRoutes.buildBox,
  customerRoutes.shops,
  customerRoutes.fragranceFinder,
].map((route) => toNavigateItem(route, "headerLabel"));

const drawerGroupOrder = ["Shop", "Discover", "Help", "Partners"];
const footerGroupOrder = ["Shop", "Discover", "Partners", "Support"];

export const mobileDrawerRoutes = drawerGroupOrder.map((group) => ({
  group,
  items: customerRouteList
    .filter((route) => route.mobileDrawer && route.mobileDrawerGroup === group)
    .map((route) => route.external
      ? { label: route.label, portalKey: route.portalKey }
      : { label: route.mobileDrawerLabel || route.label, id: route.routeId, routeKey: route.id, category: route.category }),
}));

export const footerRouteGroups = footerGroupOrder.map((title) => ({
  title,
  links: customerRouteList
    .filter((route) => route.footer && route.footerGroup === title)
    .map((route) => route.external
      ? { label: route.label, portalKey: route.portalKey }
      : { label: route.label, nav: [route.routeId, route.category].filter(Boolean), routeKey: route.id }),
}));

export const categoryShortcutRoutes = [
  customerRoutes.perfumes,
  customerRoutes.cakes,
  customerRoutes.giftBoxes,
  customerRoutes.buildBox,
  customerRoutes.fragranceFinder,
  customerRoutes.shops,
].map((route) => toNavigateItem(route));
