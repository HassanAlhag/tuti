import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  assignDriverToOrder,
  createDriver,
  createDriverSchema,
  acceptDriverOffer,
  driverDeliverySchema,
  getDriver,
  getDriverDelivery,
  getDriverProfile,
  listDriverDeliveries,
  listDriverOffers,
  listDrivers,
  recordDriverDelivery,
  remitDriverCod,
  updateDriver,
  updateDriverSchema,
} from "./drivers.service.js";

export const driversRouter = Router();
export const driverRouter = Router();

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
  validate(driverDeliverySchema),
  async (req, res, next) => {
    try {
      res.json({ data: await recordDriverDelivery(req.params.driverId, req.params.orderId, req.body, req.user) });
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
    res.json({ data: await getDriverProfile(req.user.driverId, req.user.shopId) });
  } catch (err) { next(err); }
});

driverRouter.get("/deliveries", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await listDriverDeliveries(req.user.driverId, req.user.shopId) });
  } catch (err) { next(err); }
});

driverRouter.get("/deliveries/:orderId", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await getDriverDelivery(req.user.driverId, req.user.shopId, req.params.orderId) });
  } catch (err) { next(err); }
});

driverRouter.get("/offers", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await listDriverOffers(req.user.driverId, req.user.shopId) });
  } catch (err) { next(err); }
});

driverRouter.post("/offers/:offerId/accept", authenticate, requireRole("driver"), async (req, res, next) => {
  try {
    if (!req.user?.driverId) return res.status(403).json({ error: "Driver profile is not linked." });
    res.json({ data: await acceptDriverOffer(req.params.offerId, req.user.driverId, req.user.shopId, req.user) });
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
      const task = await getDriverDelivery(req.user.driverId, req.user.shopId, req.params.orderId);
      if (task.status === "Delivered") {
        return res.status(409).json({ error: "Order is already delivered." });
      }
      res.json({ data: await recordDriverDelivery(req.user.driverId, req.params.orderId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);
