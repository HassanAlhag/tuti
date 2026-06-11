import cors from "cors";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { authenticate, requireRole } from "./middleware/auth.js";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = env.uploadDir
  ? path.resolve(env.uploadDir)
  : path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPEG, PNG, and WebP images are accepted."));
  },
});

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

export function createApp() {
  const app = express();
  const isDev = env.nodeEnv === "development";

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
  }));
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

  app.get("/api/health", (_req, res) => {
    res.json({
      data: {
        ok: true,
        env: env.nodeEnv,
        database: env.mongoUri ? "mongodb-configured" : "seed-memory",
      },
    });
  });

  // Image upload endpoint — seller/admin only
  app.post(
    "/api/upload",
    authenticate,
    requireRole("seller", "admin"),
    (req, res) => {
      upload.single("image")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "File too large. Maximum size is 5 MB." });
          }
          return res.status(400).json({ error: err.message || "Invalid file." });
        }
        if (!req.file) return res.status(400).json({ error: "No image provided." });
        res.json({ data: { url: `/uploads/${req.file.filename}`, filename: req.file.filename } });
      });
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
  app.use("/api/marketplace", marketplaceRouter);
  app.use("/api/seller-applications", sellerApplicationsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/sr", srRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  });

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    const message = status < 500 ? error.message : "Unexpected server error.";
    if (status >= 500) console.error("[error]", error);
    res.status(status).json({ error: message });
  });

  return app;
}
