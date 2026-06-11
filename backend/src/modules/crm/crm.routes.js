import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  addCrmNote,
  addCrmNoteSchema,
  deleteCrmNote,
  getCrmCustomer,
  listCrmCustomers,
  updateCrmCustomer,
  updateCustomerSchema,
} from "./crm.service.js";

export const crmRouter = Router();

// All CRM routes require admin or support
crmRouter.use(authenticate, requireRole("admin", "support"));

// List / search customers
crmRouter.get("/customers", async (req, res, next) => {
  try {
    const { q, segment, risk, status, page, limit } = req.query;
    res.json({
      data: await listCrmCustomers({
        q,
        segment,
        risk,
        status,
        page:  page  ? Number(page)  : 1,
        limit: limit ? Math.min(Number(limit), 100) : 20,
      }),
    });
  } catch (err) { next(err); }
});

// Get single customer
crmRouter.get("/customers/:id", async (req, res, next) => {
  try {
    res.json({ data: await getCrmCustomer(req.params.id) });
  } catch (err) { next(err); }
});

// Update customer CRM fields (admin only)
crmRouter.patch(
  "/customers/:id",
  requireRole("admin"),
  validate(updateCustomerSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateCrmCustomer(req.params.id, req.body) });
    } catch (err) { next(err); }
  }
);

// Add CRM note
crmRouter.post(
  "/customers/:id/notes",
  validate(addCrmNoteSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await addCrmNote(req.params.id, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

// Delete CRM note (admin only)
crmRouter.delete(
  "/customers/:id/notes/:noteId",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await deleteCrmNote(req.params.id, req.params.noteId) });
    } catch (err) { next(err); }
  }
);
