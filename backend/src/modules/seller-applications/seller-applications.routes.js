import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate, optionalAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  addNote,
  addNoteSchema,
  convertToSeller,
  createApplication,
  createApplicationSchema,
  deleteNote,
  getApplication,
  listApplications,
  updateApplication,
  updateApplicationSchema,
  updateChecklist,
  updateChecklistSchema,
} from "./seller-applications.service.js";

export const sellerApplicationsRouter = Router();

// Tighter rate limit on the public submit endpoint to discourage spam
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many application submissions. Please try again later." },
  keyGenerator: (req) => req.ip || "unknown",
});

// ── Public: submit a seller application ──────────────────────────────
sellerApplicationsRouter.post(
  "/",
  submitLimiter,
  optionalAuth,
  validate(createApplicationSchema),
  async (req, res, next) => {
    try {
      const app = await createApplication(req.body);
      res.status(201).json({ data: app });
    } catch (err) { next(err); }
  }
);

// ── Admin / support: list applications ───────────────────────────────
sellerApplicationsRouter.get(
  "/",
  authenticate,
  requireRole("admin", "support"),
  async (req, res, next) => {
    try {
      const { q, stage, risk, category, page, limit } = req.query;
      res.json({
        data: await listApplications({
          q,
          stage,
          risk,
          category,
          page:  page  ? Number(page)  : 1,
          limit: limit ? Math.min(Number(limit), 100) : 20,
        }),
      });
    } catch (err) { next(err); }
  }
);

// ── Admin / support: get single application ───────────────────────────
sellerApplicationsRouter.get(
  "/:id",
  authenticate,
  requireRole("admin", "support"),
  async (req, res, next) => {
    try {
      res.json({ data: await getApplication(req.params.id) });
    } catch (err) { next(err); }
  }
);

// ── Admin / support: update application fields ────────────────────────
sellerApplicationsRouter.patch(
  "/:id",
  authenticate,
  requireRole("admin", "support"),
  validate(updateApplicationSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateApplication(req.params.id, req.body) });
    } catch (err) { next(err); }
  }
);

// ── Admin / support: add note ─────────────────────────────────────────
sellerApplicationsRouter.post(
  "/:id/notes",
  authenticate,
  requireRole("admin", "support"),
  validate(addNoteSchema),
  async (req, res, next) => {
    try {
      res.status(201).json({ data: await addNote(req.params.id, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

// ── Admin only: delete note ───────────────────────────────────────────
sellerApplicationsRouter.delete(
  "/:id/notes/:noteId",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({ data: await deleteNote(req.params.id, req.params.noteId) });
    } catch (err) { next(err); }
  }
);

// ── Admin / support: update a checklist item ─────────────────────────
sellerApplicationsRouter.patch(
  "/:id/checklist",
  authenticate,
  requireRole("admin", "support"),
  validate(updateChecklistSchema),
  async (req, res, next) => {
    try {
      res.json({ data: await updateChecklist(req.params.id, req.body, req.user) });
    } catch (err) { next(err); }
  }
);

// ── Admin only: convert application to seller ─────────────────────────
sellerApplicationsRouter.post(
  "/:id/convert-to-seller",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const result = await convertToSeller(req.params.id, req.user);
      res.status(201).json({ data: result });
    } catch (err) { next(err); }
  }
);
