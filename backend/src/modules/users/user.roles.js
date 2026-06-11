export const USER_ROLES = ["customer", "seller", "support", "admin", "driver", "sales_rep"];

export const PERMISSIONS = [
  { id: "catalog.browse", label: "Browse catalog", group: "Storefront" },
  { id: "orders.create", label: "Place orders", group: "Orders" },
  { id: "orders.own.read", label: "View own orders", group: "Orders" },
  { id: "reviews.create", label: "Create reviews", group: "Reviews" },
  { id: "seller.dashboard", label: "Open seller dashboard", group: "Seller" },
  { id: "products.create", label: "Upload products", group: "Seller" },
  { id: "products.own.read", label: "View own products", group: "Seller" },
  { id: "orders.shop.read", label: "View shop orders", group: "Seller" },
  { id: "orders.shop.update", label: "Update shop orders", group: "Seller" },
  { id: "payouts.own.read", label: "View own payouts", group: "Seller" },
  { id: "customers.read", label: "View customers", group: "Support" },
  { id: "orders.read", label: "View all orders", group: "Support" },
  { id: "reviews.moderate", label: "Moderate reviews", group: "Support" },
  { id: "disputes.manage", label: "Manage disputes", group: "Support" },
  { id: "users.read", label: "View users", group: "Admin" },
  { id: "users.manage", label: "Manage users", group: "Admin" },
  { id: "shops.approve", label: "Approve shops", group: "Admin" },
  { id: "products.approve", label: "Approve products", group: "Admin" },
  { id: "payments.manage", label: "Manage payments", group: "Admin" },
  { id: "payouts.release", label: "Release payouts", group: "Admin" },
  { id: "policies.manage", label: "Manage policies", group: "Admin" },
  { id: "audit.read", label: "View audit log", group: "Admin" },
];

const DEFAULT_PERMISSIONS = {
  customer: ["catalog.browse", "orders.create", "orders.own.read", "reviews.create"],
  seller: [
    "catalog.browse",
    "seller.dashboard",
    "products.create",
    "products.own.read",
    "orders.shop.read",
    "orders.shop.update",
    "payouts.own.read",
  ],
  support: [
    "catalog.browse",
    "customers.read",
    "orders.read",
    "reviews.moderate",
    "disputes.manage",
    "users.read",
    "audit.read",
  ],
  driver: [
    "catalog.browse",
    "orders.read",
    "orders.shop.update",
  ],
  sales_rep: [
    "catalog.browse",
  ],
  admin: PERMISSIONS.map((permission) => permission.id),
};

export function permissionsForRole(role) {
  return [...(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.customer)];
}

export function normalizePermissions(role, permissions = []) {
  const allowed = new Set(PERMISSIONS.map((permission) => permission.id));
  const source = Array.isArray(permissions) && permissions.length ? permissions : permissionsForRole(role);
  return [...new Set(source.filter((permission) => allowed.has(permission)))];
}

export function roleDefinitions() {
  return USER_ROLES.map((role) => ({
    id: role,
    name: role[0].toUpperCase() + role.slice(1),
    permissions: permissionsForRole(role),
  }));
}
