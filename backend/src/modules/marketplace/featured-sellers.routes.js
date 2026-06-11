import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createFeaturedSellerPlacement,
  deleteFeaturedSellerPlacement,
  featuredSellerPlacementCreateSchema,
  featuredSellerPlacementUpdateSchema,
  listAdminFeaturedSellerPlacements,
  listPublicFeaturedSellerPlacements,
  updateFeaturedSellerPlacement,
} from "./featured-sellers.service.js";
import { listAdminSellerBrandProfiles } from "./brandProfile.service.js";

export const adminFeaturedSellersRouter = Router();
export const publicFeaturedSellersRouter = Router();

adminFeaturedSellersRouter.get("/seller-brand-profiles", authenticate, requireRole("admin", "support"), async (_req, res, next) => {
  try {
    res.json({ data: await listAdminSellerBrandProfiles() });
  } catch (err) {
    next(err);
  }
});

adminFeaturedSellersRouter.get("/featured-sellers", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    const { placementKey, shopId, active } = req.query;
    res.json({
      data: await listAdminFeaturedSellerPlacements({
        placementKey,
        shopId,
        active: active == null ? undefined : String(active).toLowerCase() === "true",
      }),
    });
  } catch (err) {
    next(err);
  }
});

adminFeaturedSellersRouter.post(
  "/featured-sellers",
  authenticate,
  requireRole("admin"),
  validate(featuredSellerPlacementCreateSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await createFeaturedSellerPlacement(req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminFeaturedSellersRouter.patch(
  "/featured-sellers/:id",
  authenticate,
  requireRole("admin"),
  validate(featuredSellerPlacementUpdateSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateFeaturedSellerPlacement(req.params.id, req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminFeaturedSellersRouter.delete("/featured-sellers/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await deleteFeaturedSellerPlacement(req.params.id, req.user) });
  } catch (err) {
    next(err);
  }
});

publicFeaturedSellersRouter.get("/merchandising/featured-sellers", async (req, res, next) => {
  try {
    const placementKey = req.query.placementKey || "homepage_featured_sellers";
    res.json({ data: await listPublicFeaturedSellerPlacements(String(placementKey)) });
  } catch (err) {
    next(err);
  }
});
