import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { listAuditEvents } from "./audit.service.js";

export const auditRouter = Router();

auditRouter.get("/", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { action, entityType, entityId, actorId, from, to, page, limit } = req.query;
    res.json({ data: await listAuditEvents({ action, entityType, entityId, actorId, from, to, page, limit }) });
  } catch (err) { next(err); }
});

auditRouter.get("/export.csv", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { action, entityType, from, to } = req.query;
    const { events } = await listAuditEvents({ action, entityType, from, to, limit: 5000 });

    const header = "id,action,actor,role,entityType,entityId,summary,createdAt";
    const csvEscape = (v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = events.map((e) =>
      [e.id, e.action, e.actorName, e.actorRole, e.entityType, e.entityId, e.summary, e.createdAt?.toISOString?.() ?? e.createdAt]
        .map(csvEscape).join(",")
    );

    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="audit-log-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});
