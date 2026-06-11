import { Router } from "express";
import { authenticate, optionalAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  addShopAdminNotice,
  capturePayment,
  createSalesRep,
  createProductSchema,
  createReview,
  createReviewSchema,
  createSellerProduct,
  getCommissionPlans,
  getAdminData,
  getAdminAnalyticsSummary,
  getSellerData,
  getStorefrontData,
  listCommissionEntries,
  listAdminCustomers,
  listSalesReps,
  listSellerReferrals,
  searchProducts,
  submitSellerActionPlan,
  updatePayoutStatus,
  updateProductStatus,
  updateSellerProduct,
  updateSellerProductSchema,
  updateSellerStock,
  updateSellerStockSchema,
  updateShopContractStatus,
  updateShopPaymentRules,
  updateStatusSchema,
} from "./marketplace.service.js";
import {
  getPublicPublishedBrandProfileBySlug,
  getPublicSellerProductsBySlug,
  getSellerBrandProfile,
  previewSellerBrandProfile,
  updateSellerBrandProfile,
} from "./brandProfile.service.js";
import { getAdminOperationsSummary } from "./adminOperationsSummary.js";
import {
  listDriverCodSettlementCandidates,
  settleDriverCodOrders,
} from "../finance/codSettlement.js";
import {
  createPayout,
  getPayoutById,
  getPayoutPreview,
  getReleasePreview,
  getSellerBalance,
  getSellerPayouts,
  getSellerTransactions,
  listPayouts,
  releaseEarnings,
  updatePayoutStatus as updatePayoutRecordStatus,
} from "../finance/payoutService.js";
import {
  assignSellerDriverToOrder,
  cancelSellerDeliveryOffer,
  createDeliveryOfferSchema,
  createSellerDeliveryOffer,
  createDriverSchema,
  createSellerDriverLogin,
  createSellerDriver,
  driverDeliverySchema,
  getSellerDriverCodSummary,
  getSellerDeliveryOffer,
  listAdminDeliveryOffers,
  listSellerDeliveryOffers,
  listSellerDrivers,
  recordSellerDriverDelivery,
  sellerDriverAssignSchema,
  updateDriverSchema,
  updateSellerDriver,
} from "../drivers/drivers.service.js";

export const marketplaceRouter = Router();
export const sellerBrandRouter = Router();
export const publicMarketplaceRouter = Router();

sellerBrandRouter.get("/brand-profile", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    if (!req.user?.shopId) return res.status(403).json({ error: "Seller profile is not linked." });
    res.json({ data: await getSellerBrandProfile(req.user.shopId) });
  } catch (err) { next(err); }
});

sellerBrandRouter.patch("/brand-profile", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    if (!req.user?.shopId) return res.status(403).json({ error: "Seller profile is not linked." });
    res.json({ data: await updateSellerBrandProfile(req.user.shopId, req.body, req.user) });
  } catch (err) { next(err); }
});

sellerBrandRouter.get("/brand-profile/preview", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    if (!req.user?.shopId) return res.status(403).json({ error: "Seller profile is not linked." });
    res.json({ data: await previewSellerBrandProfile(req.user.shopId) });
  } catch (err) { next(err); }
});

publicMarketplaceRouter.get("/sellers/:slug", async (req, res, next) => {
  try {
    res.json({ data: await getPublicPublishedBrandProfileBySlug(req.params.slug) });
  } catch (err) { next(err); }
});

publicMarketplaceRouter.get("/sellers/:slug/products", async (req, res, next) => {
  try {
    res.json({ data: await getPublicSellerProductsBySlug(req.params.slug) });
  } catch (err) { next(err); }
});

// Public storefront
marketplaceRouter.get("/storefront", optionalAuth, async (_req, res, next) => {
  try {
    res.json({ data: await getStorefrontData() });
  } catch (err) { next(err); }
});

// Public search
marketplaceRouter.get("/search", async (req, res, next) => {
  try {
    const { q, category, family, gender, occasion, minPrice, maxPrice, inStock, page, limit } = req.query;
    res.json({
      data: await searchProducts({
        q,
        category,
        family,
        gender,
        occasion,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock,
        page: page ? Number(page) : 1,
        limit: limit ? Math.min(Number(limit), 100) : 20,
      }),
    });
  } catch (err) { next(err); }
});

// Seller — own shop only
marketplaceRouter.get("/seller", authenticate, requireRole("seller", "admin"), async (req, res, next) => {
  try {
    const shopId = req.user.role === "admin" ? req.query.shopId : req.user.shopId;
    res.json({ data: await getSellerData(shopId) });
  } catch (err) { next(err); }
});

marketplaceRouter.post(
  "/seller/products",
  authenticate,
  requireRole("seller", "admin"),
  validate(createProductSchema),
  async (req, res, next) => {
    try {
      const shopId = req.user.role === "admin" ? req.body.shopId : req.user.shopId;
      res.status(201).json({ data: await createSellerProduct({ ...req.body, shopId }) });
    } catch (err) { next(err); }
  }
);

/* ── Seller: edit product details ──────────────────────────────────
   Sensitive-field changes (name, price, description, …) automatically
   move the product back to "Needs approval".  Stock-only updates keep
   the current status.  Sellers may also explicitly set status to "Draft"
   (hide) or "Needs approval" (re-submit from Draft).
   ─────────────────────────────────────────────────────────────────── */
marketplaceRouter.patch(
  "/seller/products/:productId",
  authenticate,
  requireRole("seller", "admin"),
  validate(updateSellerProductSchema),
  async (req, res, next) => {
    try {
      const shopId = req.user.role === "admin"
        ? (req.body.shopId || req.user.shopId)
        : req.user.shopId;
      res.json({ data: await updateSellerProduct(req.params.productId, shopId, req.body) });
    } catch (err) { next(err); }
  }
);

/* ── Seller: quick stock update ────────────────────────────────────
   Accepts { delta: N } (relative) or { stock: N } (absolute).
   Never triggers admin re-approval.
   ─────────────────────────────────────────────────────────────────── */
marketplaceRouter.patch(
  "/seller/products/:productId/stock",
  authenticate,
  requireRole("seller", "admin"),
  validate(updateSellerStockSchema),
  async (req, res, next) => {
    try {
      const shopId = req.user.role === "admin"
        ? (req.body.shopId || req.user.shopId)
        : req.user.shopId;
      res.json({ data: await updateSellerStock(req.params.productId, shopId, req.body) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.patch(
  "/seller/notices/:noticeId/action-plan",
  authenticate,
  requireRole("seller"),
  async (req, res, next) => {
    try {
      res.json({ data: await submitSellerActionPlan(req.params.noticeId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.get("/seller/drivers", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    res.json({ data: await listSellerDrivers(req.user.shopId) });
  } catch (err) { next(err); }
});

marketplaceRouter.get("/seller/drivers/cod-summary", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    res.json({ data: await getSellerDriverCodSummary(req.user.shopId) });
  } catch (err) { next(err); }
});

marketplaceRouter.post(
  "/seller/drivers",
  authenticate,
  requireRole("seller"),
  validate(createDriverSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await createSellerDriver(req.user.shopId, req.user.shopName || "", req.user.sub, req.body) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.patch(
  "/seller/drivers/:driverId",
  authenticate,
  requireRole("seller"),
  validate(updateDriverSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateSellerDriver(req.params.driverId, req.user.shopId, req.body) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.post(
  "/seller/drivers/:driverId/login",
  authenticate,
  requireRole("seller"),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await createSellerDriverLogin(req.params.driverId, req.user.shopId, req.user.sub, req.body) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.post(
  "/seller/drivers/:driverId/assign/:orderId",
  authenticate,
  requireRole("seller"),
  validate(sellerDriverAssignSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await assignSellerDriverToOrder(req.params.driverId, req.params.orderId, req.user.shopId, req.user, req.body) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.patch(
  "/seller/drivers/:driverId/orders/:orderId/delivery",
  authenticate,
  requireRole("seller"),
  validate(driverDeliverySchema),
  async (req, res, next) => {
    try {
      res.json({ data: await recordSellerDriverDelivery(req.params.driverId, req.params.orderId, req.user.shopId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.post(
  "/seller/delivery-offers",
  authenticate,
  requireRole("seller"),
  validate(createDeliveryOfferSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await createSellerDeliveryOffer(req.user.shopId, req.user.shopName || "", req.user.sub, req.body) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.get("/seller/delivery-offers", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    res.json({ data: await listSellerDeliveryOffers(req.user.shopId) });
  } catch (err) { next(err); }
});

marketplaceRouter.get("/seller/delivery-offers/:offerId", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    res.json({ data: await getSellerDeliveryOffer(req.params.offerId, req.user.shopId) });
  } catch (err) { next(err); }
});

marketplaceRouter.patch("/seller/delivery-offers/:offerId/cancel", authenticate, requireRole("seller"), async (req, res, next) => {
  try {
    res.json({ data: await cancelSellerDeliveryOffer(req.params.offerId, req.user.shopId, req.user) });
  } catch (err) { next(err); }
});

// Reviews — authenticated customers
marketplaceRouter.post("/reviews", optionalAuth, validate(createReviewSchema), async (req, res, next) => {
  try {
    const customer = req.user ? req.user.name || req.user.sub : req.body.customer || "Guest";
    res.status(201).json({ data: await createReview({ ...req.body, customer }) });
  } catch (err) { next(err); }
});

// Admin — admin + support
marketplaceRouter.get("/admin", authenticate, requireRole("admin", "support"), async (_req, res, next) => {
  try {
    res.json({ data: await getAdminData() });
  } catch (err) { next(err); }
});

marketplaceRouter.get("/admin/analytics/summary", authenticate, requireRole("admin", "support"), async (_req, res, next) => {
  try {
    res.json({ data: await getAdminAnalyticsSummary() });
  } catch (err) { next(err); }
});

marketplaceRouter.get("/admin/operations/summary", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    const queueLimit = req.query.queueLimit ? Number(req.query.queueLimit) : 5;
    res.json({ data: await getAdminOperationsSummary({ queueLimit }) });
  } catch (err) { next(err); }
});

marketplaceRouter.get("/admin/customers", authenticate, requireRole("admin", "support"), (req, res) => {
  const { q, segment, risk, page, limit } = req.query;
  res.json({
    data: listAdminCustomers({
      q,
      segment,
      risk,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    }),
  });
});

marketplaceRouter.get("/admin/sales-reps", authenticate, requireRole("admin"), async (_req, res, next) => {
  try {
    res.json({ data: await listSalesReps() });
  } catch (err) { next(err); }
});

marketplaceRouter.post("/admin/sales-reps", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createSalesRep(req.body) });
  } catch (err) { next(err); }
});

marketplaceRouter.get("/admin/referrals", authenticate, requireRole("admin"), async (_req, res, next) => {
  try {
    res.json({ data: await listSellerReferrals() });
  } catch (err) { next(err); }
});

marketplaceRouter.get("/admin/commission-entries", authenticate, requireRole("admin"), async (_req, res, next) => {
  try {
    res.json({ data: await listCommissionEntries() });
  } catch (err) { next(err); }
});

marketplaceRouter.get("/admin/commission-plans", authenticate, requireRole("admin"), (_req, res) => {
  res.json({ data: getCommissionPlans() });
});

marketplaceRouter.get("/admin/delivery-offers", authenticate, requireRole("admin"), async (_req, res, next) => {
  try {
    res.json({ data: await listAdminDeliveryOffers() });
  } catch (err) { next(err); }
});

marketplaceRouter.patch(
  "/admin/products/:productId/status",
  authenticate,
  requireRole("admin"),
  validate(updateStatusSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateProductStatus(req.params.productId, req.body.status, req.user) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.patch(
  "/admin/payouts/:payoutId/status",
  authenticate,
  requireRole("admin"),
  validate(updateStatusSchema),
  (req, res) => {
    res.json({ data: updatePayoutStatus(req.params.payoutId, req.body.status) });
  }
);

marketplaceRouter.patch(
  "/admin/payments/:paymentId/capture",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    res.json({ data: capturePayment(req.params.paymentId) });
  }
);

// ── Admin: COD settlement ─────────────────────────────────────────────────────

marketplaceRouter.get(
  "/admin/drivers/:driverId/cod-settlement-candidates",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await listDriverCodSettlementCandidates(req.params.driverId) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.post(
  "/admin/drivers/:driverId/cod-settlements",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { orderIds, notes } = req.body;
      const result = await settleDriverCodOrders({
        driverId: req.params.driverId,
        orderIds,
        adminId:  req.user.sub,
        notes:    notes || "",
      });
      res.status(201).json({ data: result });
    } catch (err) { next(err); }
  }
);

// ── Admin: payout management ──────────────────────────────────────────────────

marketplaceRouter.get(
  "/admin/shops/:shopId/payout-preview",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await getPayoutPreview(req.params.shopId) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.get(
  "/admin/shops/:shopId/release-preview",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await getReleasePreview(req.params.shopId) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.post(
  "/admin/shops/:shopId/release-earnings",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { orderIds, releaseAllEligible, force, notes } = req.body || {};
      const result = await releaseEarnings({
        shopId: req.params.shopId,
        orderIds,
        releaseAllEligible,
        force,
        notes: notes || "",
        adminId: req.user.sub,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.get(
  "/admin/payouts",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { shopId, status } = req.query;
      res.json({ data: await listPayouts({ shopId, status }) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.post(
  "/admin/payouts",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { shopId, orderIds, method, notes } = req.body;
      const payout = await createPayout({ shopId, orderIds, method, notes, adminId: req.user.sub });
      res.status(201).json({ data: payout });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.get(
  "/admin/payouts/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await getPayoutById(req.params.id) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.patch(
  "/admin/payouts/:id/status",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { status, reason } = req.body;
      const payout = await updatePayoutRecordStatus({
        payoutId:  req.params.id,
        newStatus: status,
        adminId:   req.user.sub,
        reason,
      });
      res.json({ data: payout });
    } catch (err) { next(err); }
  }
);

// ── Seller: read-only balance, transactions, payouts ─────────────────────────

marketplaceRouter.get(
  "/seller/balance",
  authenticate,
  requireRole("seller"),
  async (req, res, next) => {
    try {
      res.json({ data: await getSellerBalance(req.user.shopId) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.get(
  "/seller/transactions",
  authenticate,
  requireRole("seller"),
  async (req, res, next) => {
    try {
      const { limit, offset } = req.query;
      res.json({
        data: await getSellerTransactions(req.user.shopId, {
          limit:  limit  ? Math.min(Number(limit), 200) : 50,
          offset: offset ? Number(offset)               : 0,
        }),
      });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.get(
  "/seller/payouts",
  authenticate,
  requireRole("seller"),
  async (req, res, next) => {
    try {
      const { limit, offset } = req.query;
      res.json({
        data: await getSellerPayouts(req.user.shopId, {
          limit:  limit  ? Math.min(Number(limit), 100) : 20,
          offset: offset ? Number(offset)               : 0,
        }),
      });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.patch(
  "/admin/shops/:shopId/payment-rules",
  authenticate,
  requireRole("admin"),
  (req, res, next) => {
    try {
      const rules = req.body;
      res.json({ data: updateShopPaymentRules(req.params.shopId, rules) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.post(
  "/admin/shops/:shopId/notices",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await addShopAdminNotice(req.params.shopId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.patch(
  "/admin/shops/:shopId/contract-status",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await updateShopContractStatus(req.params.shopId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

marketplaceRouter.patch(
  "/admin/shops/:shopId/brand-profile",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await updateSellerBrandProfile(req.params.shopId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);
