import { Router } from "express";
import { authenticate, requireOwnedShop, requireRole } from "../../middleware/auth.js";
import { getSellerPerformanceSummary } from "./seller-performance.service.js";

export const sellerPerformanceRouter = Router();

sellerPerformanceRouter.get("/performance-summary", authenticate, requireRole("seller"), requireOwnedShop, async (req, res, next) => {
  try {
    const range = req.query.range;
    res.json({ data: await getSellerPerformanceSummary(req.ownedShopId, range) });
  } catch (err) {
    next(err);
  }
});
