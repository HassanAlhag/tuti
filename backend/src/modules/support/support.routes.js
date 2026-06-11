import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  addSupportInternalNote,
  addSupportInternalNoteSchema,
  convertSupportTicketToDispute,
  convertSupportTicketToDisputeSchema,
  assignSupportTicket,
  assignSupportTicketSchema,
  createSupportTicket,
  createSupportTicketSchema,
  getSupportTicket,
  listSupportTickets,
  replySupportTicket,
  replySupportTicketSchema,
  updateSupportTicketStatus,
  updateSupportTicketStatusSchema,
} from "./support.service.js";

export const supportRouter = Router();
export const adminSupportRouter = Router();

supportRouter.use(authenticate);
adminSupportRouter.use(authenticate, requireRole("admin", "support"));

function registerReadWriteRoutes(router) {
  router.post("/tickets", validate(createSupportTicketSchema), async (req, res, next) => {
    try {
      res.status(201).json({ data: await createSupportTicket(req.body, req.user) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/tickets", async (req, res, next) => {
    try {
      const { q, status, priority, category, orderId, page, limit } = req.query;
      res.json({
        data: await listSupportTickets(req.user, { q, status, priority, category, orderId, page, limit }),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/tickets/:ticketId", async (req, res, next) => {
    try {
      res.json({ data: await getSupportTicket(req.params.ticketId, req.user) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/tickets/:ticketId/replies", validate(replySupportTicketSchema), async (req, res, next) => {
    try {
      res.status(201).json({ data: await replySupportTicket(req.params.ticketId, req.body, req.user) });
    } catch (err) {
      next(err);
    }
  });
}

registerReadWriteRoutes(supportRouter);
registerReadWriteRoutes(adminSupportRouter);

adminSupportRouter.patch(
  "/tickets/:ticketId/status",
  validate(updateSupportTicketStatusSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateSupportTicketStatus(req.params.ticketId, req.body.status, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminSupportRouter.patch(
  "/tickets/:ticketId/assign",
  validate(assignSupportTicketSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await assignSupportTicket(req.params.ticketId, req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminSupportRouter.post(
  "/tickets/:ticketId/internal-notes",
  validate(addSupportInternalNoteSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await addSupportInternalNote(req.params.ticketId, req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

adminSupportRouter.post(
  "/tickets/:ticketId/convert-dispute",
  validate(convertSupportTicketToDisputeSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await convertSupportTicketToDispute(req.params.ticketId, req.body, req.user) });
    } catch (err) {
      next(err);
    }
  }
);
