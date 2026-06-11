import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createCollection,
  curatedCollectionCreateSchema,
  curatedCollectionUpdateSchema,
  deleteCollection,
  getAdminCollection,
  getPublicCollectionBySlug,
  listAdminCollections,
  listPublicCollections,
  updateCollection,
} from "./collections.service.js";

export const adminCollectionsRouter = Router();
export const publicCollectionsRouter = Router();

adminCollectionsRouter.get("/collections", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    const { placementKey, active, published } = req.query;
    res.json({
      data: await listAdminCollections({
        placementKey,
        active: active == null ? undefined : String(active).toLowerCase() === "true",
        published: published == null ? undefined : String(published).toLowerCase() === "true",
      }),
    });
  } catch (err) {
    next(err);
  }
});

adminCollectionsRouter.get("/collections/:id", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    res.json({ data: await getAdminCollection(req.params.id) });
  } catch (err) {
    next(err);
  }
});

adminCollectionsRouter.post(
  "/collections",
  authenticate,
  requireRole("admin"),
  validate(curatedCollectionCreateSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await createCollection(req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminCollectionsRouter.patch(
  "/collections/:id",
  authenticate,
  requireRole("admin"),
  validate(curatedCollectionUpdateSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateCollection(req.params.id, req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminCollectionsRouter.delete("/collections/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await deleteCollection(req.params.id, req.user) });
  } catch (err) {
    next(err);
  }
});

publicCollectionsRouter.get("/collections", async (_req, res, next) => {
  try {
    res.json({ data: await listPublicCollections() });
  } catch (err) {
    next(err);
  }
});

publicCollectionsRouter.get("/collections/:slug", async (req, res, next) => {
  try {
    res.json({ data: await getPublicCollectionBySlug(req.params.slug) });
  } catch (err) {
    next(err);
  }
});
