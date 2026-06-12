// Central portal URL map — used by the unified login page and wrong-role redirects.
// In Vite apps, import.meta.env is available. In non-Vite contexts the env object
// is passed explicitly. Call getPortalUrls() with no args in a Vite app.

export function getPortalUrls(env = (typeof import.meta !== "undefined" ? import.meta.env : {})) {
  return {
    customer: env.VITE_CLIENT_URL    || "http://localhost:5173",
    seller:   env.VITE_SELLER_URL    || "http://localhost:5174",
    admin:    env.VITE_ADMIN_URL     || "http://localhost:5175",
    driver:   env.VITE_DRIVER_URL    || "http://localhost:5176",
    sales_rep: env.VITE_SR_URL       || "http://localhost:5177",
  };
}

export const ROLE_LABELS = {
  customer:  "Customer Store",
  seller:    "Seller Central",
  admin:     "Admin Console",
  driver:    "Driver Portal",
  sales_rep: "Sales Rep Portal",
};
