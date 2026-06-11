import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  listNotifications,
  getUnreadCount,
  markAllRead,
  markNotificationRead,
} from "./notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "true";
    const notifications = await listNotifications(req.user, { unreadOnly });
    res.json({ data: notifications });
  } catch (err) { next(err); }
});

notificationsRouter.get("/count", async (req, res, next) => {
  try {
    const count = await getUnreadCount(req.user);
    res.json({ data: { count } });
  } catch (err) { next(err); }
});

notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    res.json({ data: await markNotificationRead(req.params.id, req.user) });
  } catch (err) { next(err); }
});

notificationsRouter.patch("/read-all", async (req, res, next) => {
  try {
    res.json({ data: await markAllRead(req.user) });
  } catch (err) { next(err); }
});
