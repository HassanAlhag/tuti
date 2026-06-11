/**
 * Portal URL resolution for the public web app.
 *
 * Rules:
 *  - If the env var is set, use it in all environments.
 *  - If the env var is missing and we are in Vite DEV mode, use the
 *    localhost fallback so local development works without configuration.
 *  - If the env var is missing in production, return null.
 *    Callers must hide or disable any link whose URL is null —
 *    never send a customer to localhost from a production build.
 *
 * import.meta.env.DEV is a Vite build-time constant (true in dev,
 * false in production builds), so the localhost branch is tree-shaken
 * out of production bundles entirely.
 */

const DEV_FALLBACKS = {
  VITE_SELLER_URL: "http://localhost:5174",
  VITE_ADMIN_URL:  "http://localhost:5175",
  VITE_DRIVER_URL: "http://localhost:5176",
  VITE_SR_URL:     "http://localhost:5177",
};

/**
 * @param {string} envKey  e.g. "VITE_SELLER_URL"
 * @returns {string|null}  URL to use, or null if not configured in production
 */
export function getPortalUrl(envKey) {
  const configured = import.meta.env[envKey];
  if (configured) return configured;
  // eslint-disable-next-line no-undef
  if (import.meta.env.DEV) return DEV_FALLBACKS[envKey] ?? null;
  return null;
}
