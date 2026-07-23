import { Router } from "express";
import { z } from "zod";
import { authenticate, requireOwnedShop, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  deleteAdminMedia,
  deleteSellerMedia,
  getAdminMediaById,
  getSellerMediaById,
  listAdminMedia,
  listSellerMedia,
  updateMediaModeration,
  updateSellerMedia,
} from "./media.service.js";

export const sellerMediaRouter = Router();
export const adminMediaRouter = Router();

const updateMediaSchema = z.object({
  altText: z.string().max(200).optional(),
  caption: z.string().max(400).optional(),
});

const moderationSchema = z.object({
  action: z.enum(["approve", "reject", "quarantine"]),
});

// ── Seller: /api/seller/media* ────────────────────────────────────────────
// requireOwnedShop resolves req.ownedShopId from the database; every
// handler below scopes strictly to that value -- never to req.user.shopId,
// req.query.shopId, or req.body.shopId, all of which are unverified client
// input (a forged shopId anywhere in the request is simply ignored).

sellerMediaRouter.get("/media", authenticate, requireRole("seller"), requireOwnedShop, async (req, res, next) => {
  try {
    const { page, limit, q, productId } = req.query;
    res.json({ data: await listSellerMedia(req.ownedShopId, { page, limit, q, productId }) });
  } catch (err) { next(err); }
});

sellerMediaRouter.get("/media/:id", authenticate, requireRole("seller"), requireOwnedShop, async (req, res, next) => {
  try {
    res.json({ data: await getSellerMediaById(req.ownedShopId, req.params.id) });
  } catch (err) { next(err); }
});

sellerMediaRouter.patch(
  "/media/:id",
  authenticate,
  requireRole("seller"),
  requireOwnedShop,
  validate(updateMediaSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateSellerMedia(req.ownedShopId, req.params.id, req.body) });
    } catch (err) { next(err); }
  }
);

sellerMediaRouter.delete("/media/:id", authenticate, requireRole("seller"), requireOwnedShop, async (req, res, next) => {
  try {
    res.json({ data: await deleteSellerMedia(req.ownedShopId, req.params.id) });
  } catch (err) { next(err); }
});

// ── Admin: /api/admin/media* ───────────────────────────────────────────────

adminMediaRouter.get("/media", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { page, limit, q, shopId, ownerType, mimeType, moderationStatus, orphanedOnly, dateFrom, dateTo } = req.query;
    res.json({
      data: await listAdminMedia({
        page, limit, q, shopId, ownerType, mimeType, moderationStatus,
        orphanedOnly: orphanedOnly === "true" || orphanedOnly === "1",
        dateFrom, dateTo,
      }),
    });
  } catch (err) { next(err); }
});

adminMediaRouter.get("/media/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await getAdminMediaById(req.params.id) });
  } catch (err) { next(err); }
});

adminMediaRouter.patch(
  "/media/:id/moderation",
  authenticate,
  requireRole("admin"),
  validate(moderationSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateMediaModeration(req.params.id, req.body.action) });
    } catch (err) { next(err); }
  }
);

adminMediaRouter.delete("/media/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await deleteAdminMedia(req.params.id) });
  } catch (err) { next(err); }
});
