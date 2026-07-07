import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryShortcutRoutes,
  customerRoutes,
  footerRouteGroups,
  headerNavRoutes,
  mobileDrawerRoutes,
  routePaths,
} from "./customerRoutes.js";

test("customer route registry covers required public routes", () => {
  const required = [
    "home",
    "shop",
    "perfumes",
    "cakes",
    "giftBoxes",
    "product",
    "cart",
    "buildBox",
    "collections",
    "collection",
    "shops",
    "seller",
    "gifting",
    "fragranceFinder",
    "offers",
    "journal",
    "support",
    "customerService",
    "contact",
    "storeLocator",
    "legal",
    "account",
    "login",
    "sell",
    "about",
    "order",
  ];

  for (const key of required) {
    assert.ok(customerRoutes[key], `missing route: ${key}`);
    assert.ok(customerRoutes[key].path, `missing path for route: ${key}`);
  }
});

test("customer dynamic route helpers encode path params", () => {
  assert.equal(routePaths.product("prf-001"), "/products/prf-001");
  assert.equal(routePaths.collection("signature gift edit"), "/collections/signature%20gift%20edit");
  assert.equal(routePaths.seller("oud lane"), "/sellers/oud%20lane");
  assert.equal(routePaths.order("ord-123"), "/orders/ord-123");
});

test("header, drawer, footer, and shortcut nav are generated from registry", () => {
  assert.deepEqual(
    headerNavRoutes.map((route) => route.label),
    ["Home", "Shop", "Perfumes", "Cakes & Desserts", "Gift Boxes", "Build a Gift", "Sellers", "Find a Scent ✦"]
  );

  const drawerLabels = mobileDrawerRoutes.flatMap((group) => group.items.map((item) => item.label));
  for (const label of ["Home", "Shop", "Perfumes", "Cakes & Desserts", "Gift Boxes", "Build a Gift", "Sellers", "Collections", "Find a Scent", "Offers", "Gifting", "Journal", "Our Story", "Support", "Account", "Orders", "Legal", "Sell on Tuti"]) {
    assert.ok(drawerLabels.includes(label), `drawer missing ${label}`);
  }

  const footerLabels = footerRouteGroups.flatMap((group) => group.links.map((link) => link.label));
  for (const label of ["Perfumes", "Cakes & Desserts", "Gift Boxes", "Collections", "Offers", "Build a Gift", "Find a Scent", "Gifting", "Journal", "Our Story", "Sell on Tuti", "Help Centre", "Contact", "Account", "Orders", "Legal"]) {
    assert.ok(footerLabels.includes(label), `footer missing ${label}`);
  }

  assert.deepEqual(
    categoryShortcutRoutes.map((route) => route.label),
    ["Perfumes", "Cakes & Desserts", "Gift Boxes", "Build a Gift", "Find a Scent", "Sellers"]
  );
});
