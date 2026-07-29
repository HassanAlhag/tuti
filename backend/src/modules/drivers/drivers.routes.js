import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  assignDriverToOrder,
  confirmDriverPickup,
  createDriver,
  createDriverSchema,
  acceptDriverOffer,
  driverDeliverySchema,
  getDriver,
  getDriverDelivery,
  getDriverProfile,
  listDriverDeliveries,
  listDriverHistory,
  listDriverOffers,
  listDrivers,
  reassignDeliverySchema,
  reassignFailedDelivery,
  recordDriverDelivery,
  remitDriverCod,
  reportDeliveryFailure,
  reportDeliveryFailureSchema,
  retryFailedDelivery,
  returnFailedDeliveryToSeller,
  updateDriver,
  updateDriverSchema,
  listPendingDriverShopAccessRequests,
  approveDriverShopAccess,
  rejectDriverShopAccess,
  reactivateDriverShopAccess,
  adminSuspendDriverShopAccess,
  adminRevokeDriverShopAccess,
  adminAssignDriverToShops,
  adminAssignDriverToShopsSchema,
  approveDriverShopAccessSchema,
  rejectDriverShopAccessSchema,
  listShopsConnectedToDriver,
  listDriversConnectedToShop,
  getDriverCodSummaryAcrossShops,
} from "./drivers.service.js";

export const driversRouter = Router();
export const driverRouter = Router();

function requireDriverRouteOwnership(req, res, next) {
  if (req.user?.role !== "driver") return next();
  if (!req.user.driverId || req.user.driverId !== req.params.driverId) {
    return res.status(403).json({ error: "Driver is not authorized for this delivery." });
  }
  next();
}

// List drivers — admin only
driversRouter.get("/", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    const { status, zone, page, limit } = req.query;
    res.json({ data: await listDrivers({ status, zone, page: Number(page) || 1, limit: Number(limit) || 50 }) });
  } catch (err) { next(err); }
});

// Get single driver
driversRouter.get("/:id", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    res.json({ data: await getDriver(req.params.id) });
  } catch (err) { next(err); }
});

// Create driver — admin only
driversRouter.post(
  "/",
  authenticate,
  requireRole("admin"),
  validate(createDriverSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await createDriver(req.body) });
    } catch (err) { next(err); }
  }
);

// Update driver — admin only
driversRouter.patch(
  "/:id",
  authenticate,
  requireRole("admin"),
  validate(updateDriverSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateDriver(req.params.id, req.body) });
    } catch (err) { next(err); }
  }
);

// ── Driver-shop access (Task 4: admin approval workflow) ────────────────

driversRouter.get("/access/pending", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await listPendingDriverShopAccessRequests() });
  } catch (err) { next(err); }
});

driversRouter.get("/:driverId/shops", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    res.json({ data: await listShopsConnectedToDriver(req.params.driverId) });
  } catch (err) { next(err); }
});

driversRouter.get("/:driverId/cod-summary", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    res.json({ data: await getDriverCodSummaryAcrossShops(req.params.driverId) });
  } catch (err) { next(err); }
});

driversRouter.get("/shops/:shopId/drivers", authenticate, requireRole("admin", "support"), async (req, res, next) => {
  try {
    res.json({ data: await listDriversConnectedToShop(req.params.shopId) });
  } catch (err) { next(err); }
});

driversRouter.post(
  "/access/:accessId/approve",
  authenticate,
  requireRole("admin"),
  validate(approveDriverShopAccessSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await approveDriverShopAccess(req.params.accessId, req.user.sub, req.body) });
    } catch (err) { next(err); }
  }
);

driversRouter.post(
  "/access/:accessId/reject",
  authenticate,
  requireRole("admin"),
  validate(rejectDriverShopAccessSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await rejectDriverShopAccess(req.params.accessId, req.user.sub, req.body.reason) });
    } catch (err) { next(err); }
  }
);

driversRouter.post("/access/:accessId/reactivate", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await reactivateDriverShopAccess(req.params.accessId, req.user.sub) });
  } catch (err) { next(err); }
});

driversRouter.post("/access/:accessId/suspend", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await adminSuspendDriverShopAccess(req.params.accessId, req.user.sub, { actorRole: "admin" }) });
  } catch (err) { next(err); }
});

driversRouter.post("/access/:accessId/revoke", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    res.json({ data: await adminRevokeDriverShopAccess(req.params.accessId, req.user.sub, { actorRole: "admin" }) });
  } catch (err) { next(err); }
});

// Admin: directly attach an existing driver to one or more shops --
// always creates an explicit, already-approved DriverShopAccess row per
// shop (never an implicit/hidden grant).
driversRouter.post(
  "/access/direct",
  authenticate,
  requireRole("admin"),
  validate(adminAssignDriverToShopsSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({
        data: await adminAssignDriverToShops(req.body.driverId, req.body.shopIds, req.user.sub, {
          serviceZoneIds: req.body.serviceZoneIds,
          canReceiveBroadcasts: req.body.canReceiveBroadcasts,
          canBeDirectlyAssigned: req.body.canBeDirectlyAssigned,
        }),
      });
    } catch (err) { next(err); }
  }
);

// Assign driver to an order — admin only
driversRouter.post(
  "/:driverId/assign/:orderId",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await assignDriverToOrder(req.params.driverId, req.params.orderId, req.user) });
    } catch (err) { next(err); }
  }
);

// Driver records delivery + COD — admin or driver
driversRouter.patch(
  "/:driverId/orders/:orderId/delivery",
  authenticate,
  requireRole("admin", "driver"),
  requireDriverRouteOwnership,
  validate(driverDeliverySchema),
  async (req, res, next) => {
    try {
      res.json({ data: await recordDriverDelivery(req.params.driverId, req.params.orderId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

// Admin: retry a failed/rescheduled delivery with the same driver
driversRouter.post(
  "/orders/:orderId/delivery/retry",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await retryFailedDelivery(null, req.params.orderId, req.user) });
    } catch (err) { next(err); }
  }
);

// Admin: reassign a failed delivery to a different driver
driversRouter.post(
  "/orders/:orderId/delivery/reassign",
  authenticate,
  requireRole("admin"),
  validate(reassignDeliverySchema),
  async (req, res, next) => {
    try {
      res.json({ data: await reassignFailedDelivery(null, req.params.orderId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

// Admin: end the failed delivery attempt and return the order to the seller
driversRouter.post(
  "/orders/:orderId/delivery/return-to-seller",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await returnFailedDeliveryToSeller(null, req.params.orderId, req.user) });
    } catch (err) { next(err); }
  }
);

// Admin records COD remittance from driver
driversRouter.patch(
  "/:driverId/cod-remit",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const amount = Number(req.body?.amount) || undefined;
      res.json({ data: await remitDriverCod(req.params.driverId, amount, req.user) });
    } catch (err) { next(err); }
  }
);

driverRouter.get("/me", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await getDriverProfile(req.user.driverId) });
  } catch (err) { next(err); }
});

driverRouter.get("/deliveries", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await listDriverDeliveries(req.user.driverId) });
  } catch (err) { next(err); }
});

driverRouter.get("/deliveries/:orderId", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await getDriverDelivery(req.user.driverId, req.params.orderId) });
  } catch (err) { next(err); }
});

driverRouter.get("/offers", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await listDriverOffers(req.user.driverId) });
  } catch (err) { next(err); }
});

driverRouter.post("/offers/:offerId/accept", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await acceptDriverOffer(req.params.offerId, req.user.driverId, req.user) });
  } catch (err) { next(err); }
});

driverRouter.patch(
  "/deliveries/:orderId/delivery",
  authenticate,
  requireRole("driver"),
  validate(driverDeliverySchema),
  async (req, res, next) => {
    try {
      if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
      const task = await getDriverDelivery(req.user.driverId, req.params.orderId);
      if (task.status === "Delivered") {
        return res.status(409).json({ error: "Order is already delivered." });
      }
      res.json({ data: await recordDriverDelivery(req.user.driverId, req.params.orderId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

driverRouter.patch("/deliveries/:orderId/pickup", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await confirmDriverPickup(req.user.driverId, req.params.orderId, req.user) });
  } catch (err) { next(err); }
});

// Driver: report a failed delivery attempt (see shared/deliveryFailurePolicy.js
// and shared/workflows/deliveryAssignmentWorkflow.js) -- a dedicated command,
// never a generic status patch.
driverRouter.post(
  "/deliveries/:orderId/fail",
  authenticate,
  requireRole("driver"),
  validate(reportDeliveryFailureSchema),
  async (req, res, next) => {
    try {
      if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
      res.json({ data: await reportDeliveryFailure(req.user.driverId, req.params.orderId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

driverRouter.get("/history", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    const { from, to, limit, page } = req.query;
    res.json({ data: await listDriverHistory(req.user.driverId, { from, to, limit, page }) });
  } catch (err) { next(err); }
});
