import * as Sentry from "@sentry/node";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import fs from "node:fs";
import { env } from "./config/env.js";
import { logger } from "./shared/logger.js";

if (env.sentryDsn) {
  Sentry.init({ dsn: env.sentryDsn, environment: env.nodeEnv, tracesSampleRate: 0.1 });
}
import { createUploadMulter } from "./shared/mediaStorage.js";
import { uploadsDir } from "./shared/uploadsDir.js";
import { authenticate, requireOwnedShop, requireRole } from "./middleware/auth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { crmRouter } from "./modules/crm/crm.routes.js";
import { driverRouter, driversRouter } from "./modules/drivers/drivers.routes.js";
import { adminFeaturedProductsRouter, publicFeaturedProductsRouter } from "./modules/marketplace/featured-products.routes.js";
import { adminFeaturedSellersRouter, publicFeaturedSellersRouter } from "./modules/marketplace/featured-sellers.routes.js";
import { adminCollectionsRouter, publicCollectionsRouter } from "./modules/marketplace/collections.routes.js";
import { eventsRouter } from "./modules/marketplace/events.routes.js";
import { marketplaceRouter, publicMarketplaceRouter, sellerBrandRouter } from "./modules/marketplace/marketplace.routes.js";
import { sellerPerformanceRouter } from "./modules/marketplace/seller-performance.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { adminSupportRouter, supportRouter } from "./modules/support/support.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { sellerApplicationsRouter } from "./modules/seller-applications/seller-applications.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { srRouter } from "./modules/sr/sr.routes.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { adminMediaRouter, sellerMediaRouter } from "./modules/media/media.routes.js";
import { createMediaAsset } from "./modules/media/media.service.js";

// Local disk is a dev/test-only fallback (see shared/s3Storage.js) --
// still created so /uploads static serving and that fallback path work,
// but production always requires real AWS S3 config (validateEnv()).
fs.mkdirSync(uploadsDir, { recursive: true });

// multer buffers the upload in memory; the route validates + optimizes it
// (Sharp: real decode, EXIF auto-rotate, thumbnail/card/detail WebP
// variants) and persists each variant itself via
// mediaStorage.optimizeAndPersistImage -- see shared/mediaStorage.js.
const uploadMulter = createUploadMulter();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please wait." },
});

export function redactSensitiveRequestUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.includes("?")) return rawUrl;

  try {
    const url = new URL(rawUrl, "http://tuti.local");
    if (!url.searchParams.has("token")) return rawUrl;
    url.searchParams.set("token", "REDACTED");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawUrl.replace(/([?&]token=)[^&#]*/gi, "$1REDACTED");
  }
}

export function redactHttpRequestForLogs(req) {
  if (!req || typeof req !== "object") return req;
  return { ...req, url: redactSensitiveRequestUrl(req.url) };
}

export function createApp() {
  const app = express();
  const isDev = env.nodeEnv === "development";

  app.use(pinoHttp({
    logger,
    serializers: { req: redactHttpRequestForLogs },
    autoLogging: { ignore: (req) => req.url === "/api/health" },
  }));
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: env.nodeEnv === "production" ? undefined : false,
  }));
  app.use(mongoSanitize());
  app.use(hpp());
  app.use(cors({
    origin(origin, callback) {
      if (isDev && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "")) {
        return callback(null, true);
      }
      if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(globalLimiter);

  // Serve uploaded images
  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", async (_req, res) => {
    const { connection } = await import("mongoose").catch(() => ({ connection: null }));
    const dbState = env.mongoUri
      ? (connection?.readyState === 1 ? "connected" : "disconnected")
      : "seed-memory";
    res.json({
      data: {
        ok: true,
        env: env.nodeEnv,
        database: dbState,
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || "0.2.0",
      },
    });
  });

  // Image upload endpoint — seller (own shop, database-verified), admin,
  // or driver (proof-of-delivery). Every upload is recorded as a
  // MediaAsset with server-resolved ownership; requireOwnedShop runs for
  // sellers specifically so a forged shopId claim can never attach a file
  // under someone else's shop namespace (see modules/media/media.service.js).
  app.post(
    "/api/upload",
    authenticate,
    requireRole("seller", "admin", "driver"),
    requireOwnedShop,
    (req, res, next) => {
      uploadMulter.single("image")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "File too large. Maximum size is 8 MB." });
          }
          return res.status(400).json({ error: err.message || "Invalid file." });
        }
        next();
      });
    },
    async (req, res, next) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No image provided." });

        const role = req.user.role;
        const ownerType = role === "seller" ? "shop" : role === "driver" ? "driver" : "admin";
        const ownerId = role === "seller" ? req.ownedShopId
          : role === "driver" ? (req.user.driverId || req.user.sub)
          : "admin";
        const shopId = role === "seller" ? req.ownedShopId : null;

        const { asset, dimensionWarning } = await createMediaAsset({
          ownerType,
          ownerId,
          shopId,
          uploadedByUserId: req.user.sub,
          uploadedByRole: role,
          buffer: req.file.buffer,
          originalFilename: req.file.originalname,
        });

        // `url`/`filename` kept for every existing caller (seller product
        // forms, driver proof-of-delivery) that only reads those two
        // fields; mediaAssetId/width/height/urls are additive. `url` now
        // resolves to the optimized card-size WebP variant (never the raw
        // upload -- the original buffer is never persisted).
        res.json({
          data: {
            url: asset.publicUrl,
            urls: asset.urls,
            filename: asset.originalFilename,
            mediaAssetId: asset.id,
            width: asset.width,
            height: asset.height,
            dimensionWarning,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/crm", crmRouter);
  app.use("/api/driver", driverRouter);
  app.use("/api/drivers", driversRouter);
  app.use("/api/support", supportRouter);
  app.use("/api/admin/support", adminSupportRouter);
  app.use("/api/public", publicMarketplaceRouter);
  app.use("/api/public", publicFeaturedSellersRouter);
  app.use("/api/public", publicFeaturedProductsRouter);
  app.use("/api/public", publicCollectionsRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/admin/merchandising", adminFeaturedSellersRouter);
  app.use("/api/admin/merchandising", adminFeaturedProductsRouter);
  app.use("/api/admin/merchandising", adminCollectionsRouter);
  app.use("/api/seller", sellerBrandRouter);
  app.use("/api/seller", sellerPerformanceRouter);
  app.use("/api/seller", sellerMediaRouter);
  app.use("/api/admin", adminMediaRouter);
  app.use("/api/marketplace", marketplaceRouter);
  app.use("/api/seller-applications", sellerApplicationsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/sr", srRouter);
  app.use("/api/admin/audit", auditRouter);
  app.use("/api/admin/reports", reportsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  });

  app.use((error, req, res, _next) => {
    const status = error.status || 500;
    const message = status < 500 ? error.message : "Unexpected server error.";
    if (status >= 500) {
      (req.log || logger).error({ err: error }, "Unhandled server error");
      if (env.sentryDsn) Sentry.captureException(error);
    }
    res.status(status).json({ error: message });
  });

  return app;
}
