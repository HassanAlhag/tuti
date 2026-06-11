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

function parseOrigins() {
  const configured = process.env.CORS_ORIGINS
    || process.env.CORS_ORIGIN
    || process.env.CLIENT_ORIGINS
    || process.env.CLIENT_ORIGIN
    || "";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if ((process.env.NODE_ENV || "development") === "development") {
    return [...new Set([...defaultOrigins, ...origins])];
  }

  return origins.length ? origins : defaultOrigins;
}

export const env = {
  port: Number(process.env.PORT || 5055),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  clientOrigins: parseOrigins(),
  mongoUri: process.env.MONGO_URI || "",
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  nodeEnv: process.env.NODE_ENV || "development",
  uploadDir: process.env.UPLOAD_DIR || "",
};

export function validateEnv() {
  const isProd = env.nodeEnv === "production";
  const errors = [];

  if (!Number.isFinite(env.port) || env.port <= 0) {
    errors.push("PORT must be a valid positive number.");
  }

  if (isProd) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-jwt-secret-change-in-production") {
      errors.push("JWT_SECRET is required in production.");
    }
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === "dev-refresh-secret-change-in-production") {
      errors.push("JWT_REFRESH_SECRET is required in production.");
    }
    if (!env.clientOrigins.length) {
      errors.push("CORS_ORIGINS (or CLIENT_ORIGINS) is required in production.");
    }
  } else {
    if (!process.env.JWT_SECRET || env.jwtSecret === "dev-jwt-secret-change-in-production") {
      console.warn("[env] Using development JWT_SECRET fallback. Set JWT_SECRET for safer local/dev usage.");
    }
    if (!process.env.JWT_REFRESH_SECRET || env.jwtRefreshSecret === "dev-refresh-secret-change-in-production") {
      console.warn("[env] Using development JWT_REFRESH_SECRET fallback. Set JWT_REFRESH_SECRET for safer local/dev usage.");
    }
  }

  if (errors.length) {
    const error = new Error(`Environment validation failed: ${errors.join(" ")}`);
    error.status = 500;
    throw error;
  }
}
