import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createFeaturedProductPlacement,
  deleteFeaturedProductPlacement,
  featuredProductPlacementCreateSchema,
  featuredProductPlacementUpdateSchema,
  listAdminFeaturedProductPlacements,
  listPublicFeaturedProductPlacements,
  updateFeaturedProductPlacement,
} from "./featured-products.service.js";

export const adminFeaturedProductsRouter = Router();
export const publicFeaturedProductsRouter = Router();

adminFeaturedProductsRouter.get("/featured-products", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    const { placementKey, productId, shopId, active } = req.query;
    res.json({
      data: await listAdminFeaturedProductPlacements({
        placementKey,
        productId,
        shopId,
        active: active == null ? undefined : String(active).toLowerCase() === "true",
      }),
    });
  } catch (err) {
    next(err);
  }
});

adminFeaturedProductsRouter.post(
  "/featured-products",
  authenticate,
  requireRole("admin"),
  validate(featuredProductPlacementCreateSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await createFeaturedProductPlacement(req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminFeaturedProductsRouter.patch(
  "/featured-products/:id",
  authenticate,
  requireRole("admin"),
  validate(featuredProductPlacementUpdateSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateFeaturedProductPlacement(req.params.id, req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminFeaturedProductsRouter.delete("/featured-products/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await deleteFeaturedProductPlacement(req.params.id, req.user) });
  } catch (err) {
    next(err);
  }
});

publicFeaturedProductsRouter.get("/merchandising/featured-products", async (req, res, next) => {
  try {
    const placementKey = req.query.placementKey || "homepage_featured_products";
    res.json({ data: await listPublicFeaturedProductPlacements(String(placementKey)) });
  } catch (err) {
    next(err);
  }
});
