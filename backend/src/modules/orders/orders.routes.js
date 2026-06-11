import { Router } from "express";
import { authenticate, optionalAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createOrder,
  createOrderSchema,
  customerAction,
  customerActionSchema,
  finalizeResolutionDecision,
  finalizeResolutionDecisionSchema,
  getOrder,
  listOrders,
  updateSupportCase,
  updateSupportCaseSchema,
  updateResolutionDecision,
  updateResolutionDecisionSchema,
  updateOrderStatus,
  updateOrderStatusSchema,
} from "./orders.service.js";

export const ordersRouter = Router();

// Create order — optionally authenticated (guest checkout supported)
ordersRouter.post("/", optionalAuth, validate(createOrderSchema), async (req, res, next) => {
  try {
    const rawKey = req.headers["idempotency-key"] || null;
    // Validate key: UUID-like hex string, 8–128 chars
    const idempotencyKey = rawKey && /^[0-9a-f-]{8,128}$/i.test(rawKey) ? rawKey : null;
    const order = await createOrder(req.body, req.user?.sub, idempotencyKey);
    res.status(201).json({ data: order });
  } catch (err) { next(err); }
});

// List orders — customer sees own, seller sees shop, admin sees all
ordersRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await listOrders({
      userId: req.user.sub,
      role: req.user.role,
      shopId: req.user.shopId,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

// Get single order — optionalAuth so guests can use a confirmation token
ordersRouter.get("/:orderId", optionalAuth, async (req, res, next) => {
  try {
    const guestToken = typeof req.query.token === "string" ? req.query.token : null;
    res.json({ data: await getOrder(req.params.orderId, req.user, guestToken) });
  } catch (err) { next(err); }
});

// Update order status — seller + admin only
ordersRouter.patch(
  "/:orderId/status",
  authenticate,
  requireRole("seller", "admin", "support"),
  validate(updateOrderStatusSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateOrderStatus(req.params.orderId, req.body.status, req.user, req.body.note, req.body.courierRef) });
    } catch (err) { next(err); }
  }
);

// Customer delivery response — accept or dispute a delivered order
ordersRouter.patch(
  "/:orderId/customer-action",
  authenticate,
  requireRole("customer"),
  validate(customerActionSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await customerAction(req.params.orderId, req.body.action, req.body.note, req.user) });
    } catch (err) { next(err); }
  }
);

ordersRouter.patch(
  "/:orderId/support-case",
  authenticate,
  requireRole("admin", "support", "seller"),
  validate(updateSupportCaseSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateSupportCase(req.params.orderId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

ordersRouter.patch(
  "/:orderId/resolution-decision",
  authenticate,
  requireRole("admin", "support"),
  validate(updateResolutionDecisionSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateResolutionDecision(req.params.orderId, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

ordersRouter.post(
  "/:orderId/resolution-decision/finalize",
  authenticate,
  requireRole("admin"),
  validate(finalizeResolutionDecisionSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await finalizeResolutionDecision(req.params.orderId, req.user) });
    } catch (err) { next(err); }
  }
);
