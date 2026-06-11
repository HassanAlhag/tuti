import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { getSellerPerformanceSummary } from "./seller-performance.service.js";

export const sellerPerformanceRouter = Router();

sellerPerformanceRouter.get("/performance-summary", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    const range = req.query.range;
    res.json({ data: await getSellerPerformanceSummary(req.user.shopId, range) });
  } catch (err) {
    next(err);
  }
});
