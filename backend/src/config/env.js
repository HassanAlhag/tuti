import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
dotenv.config({ quiet: true });

const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

const placeholderSecrets = new Set([
  "dev-jwt-secret-change-in-production",
  "dev-refresh-secret-change-in-production",
  "change-me-in-production-minimum-32-chars",
  "change-refresh-secret-in-production",
  "change-me",
  "changeme",
  "secret",
  "jwt-secret",
  "refresh-secret",
  "password",
]);

function configuredOriginValue(rawEnv = process.env) {
  return rawEnv.CORS_ORIGINS
    || rawEnv.CORS_ORIGIN
    || rawEnv.CLIENT_ORIGINS
    || rawEnv.CLIENT_ORIGIN
    || "";
}

function normalizeCorsOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

function parseOrigins(rawEnv = process.env) {
  const configured = configuredOriginValue(rawEnv);
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if ((rawEnv.NODE_ENV || "development") === "development") {
    return [...new Set([...defaultOrigins, ...origins])];
  }

  return [...new Set(origins.map(normalizeCorsOrigin))];
}

export function buildEnv(rawEnv = process.env) {
  return {
    port: Number(rawEnv.PORT || 5055),
    clientOrigin: rawEnv.CLIENT_ORIGIN || "http://localhost:5173",
    clientOrigins: parseOrigins(rawEnv),
    mongoUri: rawEnv.MONGO_URI || "",
    jwtSecret: rawEnv.JWT_SECRET || "dev-jwt-secret-change-in-production",
    jwtRefreshSecret: rawEnv.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production",
    jwtExpiresIn: rawEnv.JWT_EXPIRES_IN || "15m",
    jwtRefreshExpiresIn: rawEnv.JWT_REFRESH_EXPIRES_IN || "7d",
    nodeEnv: rawEnv.NODE_ENV || "development",
    uploadDir: rawEnv.UPLOAD_DIR || "",
    // Email (SMTP) — leave empty to use console logging in dev
    emailHost: rawEnv.EMAIL_HOST || "",
    emailPort: Number(rawEnv.EMAIL_PORT || 587),
    emailUser: rawEnv.EMAIL_USER || "",
    emailPass: rawEnv.EMAIL_PASS || "",
    emailFrom: rawEnv.EMAIL_FROM || "Tuti <noreply@tuti.ae>",
    // SMS / WhatsApp (Twilio) — leave empty to use console logging in dev
    twilioSid:   rawEnv.TWILIO_ACCOUNT_SID  || "",
    twilioToken: rawEnv.TWILIO_AUTH_TOKEN   || "",
    twilioFrom:  rawEnv.TWILIO_FROM_NUMBER  || "",
    // Error monitoring (Sentry)
    sentryDsn: rawEnv.SENTRY_DSN || "",
  };
}

export const env = buildEnv();

function isLocalCorsOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost"
      || hostname.startsWith("127.")
      || hostname === "::1"
      || hostname === "[::1]"
      || hostname === "0.0.0.0"
      || hostname.endsWith(".localhost");
  } catch {
    return true;
  }
}

function isLocalHostname(hostname) {
  return hostname === "localhost"
    || hostname.startsWith("127.")
    || hostname === "::1"
    || hostname === "[::1]"
    || hostname === "0.0.0.0"
    || hostname.endsWith(".localhost");
}

// Mongo connection strings can list multiple hosts (replica sets) and
// mongodb+srv:// has no port, so this parses by hand rather than relying
// on the URL class across every shape. Unlike isLocalCorsOrigin, a parse
// failure here defaults to "not local" -- a missed remote-Mongo warning
// is worse than an extra one.
export function getMongoHosts(uri) {
  const match = String(uri || "").match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i);
  if (!match) return [];
  return match[1].split(",").map((entry) => entry.split(":")[0]).filter(Boolean);
}

export function isLocalMongoUri(uri) {
  const hosts = getMongoHosts(uri);
  return hosts.length > 0 && hosts.every(isLocalHostname);
}

function isPlaceholderSecret(secret) {
  const normalized = String(secret || "").trim().toLowerCase();
  return placeholderSecrets.has(normalized);
}

function isStrongProductionSecret(secret) {
  const value = String(secret || "").trim();
  return value.length >= 32 && !isPlaceholderSecret(value);
}

export function validateEnv(config = env, rawEnv = process.env) {
  const isProd = config.nodeEnv === "production";
  const errors = [];

  if (!Number.isFinite(config.port) || config.port <= 0) {
    errors.push("PORT must be a valid positive number.");
  }

  if (isProd) {
    if (!config.mongoUri) {
      errors.push("MONGO_URI is required in production.");
    }
    if (!isStrongProductionSecret(config.jwtSecret)) {
      errors.push("JWT_SECRET must be a strong production secret of at least 32 characters and not a placeholder.");
    }
    if (!isStrongProductionSecret(config.jwtRefreshSecret)) {
      errors.push("JWT_REFRESH_SECRET must be a strong production secret of at least 32 characters and not a placeholder.");
    }
    if (!configuredOriginValue(rawEnv).trim() || !config.clientOrigins.length) {
      errors.push("CORS_ORIGINS (or CLIENT_ORIGINS) is required in production.");
    }
    const localOrigins = config.clientOrigins.filter(isLocalCorsOrigin);
    if (localOrigins.length) {
      errors.push("CORS_ORIGINS must not include localhost, loopback, or default development origins in production.");
    }
  } else {
    if (!rawEnv.JWT_SECRET || config.jwtSecret === "dev-jwt-secret-change-in-production") {
      console.warn("[env] Using development JWT_SECRET fallback. Set JWT_SECRET for safer local/dev usage.");
    }
    if (!rawEnv.JWT_REFRESH_SECRET || config.jwtRefreshSecret === "dev-refresh-secret-change-in-production") {
      console.warn("[env] Using development JWT_REFRESH_SECRET fallback. Set JWT_REFRESH_SECRET for safer local/dev usage.");
    }
  }

  if (errors.length) {
    const error = new Error(`Environment validation failed: ${errors.join(" ")}`);
    error.status = 500;
    throw error;
  }
}

export function assertProductionSeedModeDisabled(config = env, context = "seed/demo mode") {
  if (config.nodeEnv === "production" && !config.mongoUri) {
    const error = new Error(`${context} is disabled in production. Set MONGO_URI.`);
    error.status = 500;
    throw error;
  }
}
