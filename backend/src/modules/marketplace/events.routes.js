import { Router } from "express";
import { optionalAuth } from "../../middleware/auth.js";
import { trackMarketplaceEvents } from "./events.service.js";

export const eventsRouter = Router();

eventsRouter.post("/marketplace", optionalAuth, async (req, res, next) => {
  try {
    const summary = await trackMarketplaceEvents(req.body, req.user || null);
    res.json({ data: summary });
  } catch (err) {
    if (err?.status === 400 && Array.isArray(err.details)) {
      return res.status(400).json({ error: "Validation failed.", details: err.details });
    }
    next(err);
  }
});
