import { Router } from "express";
import { authenticate, requireOwnedShop } from "../../middleware/auth.js";
import {
  listNotifications,
  getUnreadCount,
  markAllRead,
  markNotificationRead,
} from "./notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);
notificationsRouter.use(requireOwnedShop);

function verifiedUser(req) {
  if (req.user?.role !== "seller") return req.user;
  return { ...req.user, shopId: req.ownedShopId };
}

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "true";
    const notifications = await listNotifications(verifiedUser(req), { unreadOnly });
    res.json({ data: notifications });
  } catch (err) { next(err); }
});

notificationsRouter.get("/count", async (req, res, next) => {
  try {
    const count = await getUnreadCount(verifiedUser(req));
    res.json({ data: { count } });
  } catch (err) { next(err); }
});

notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    res.json({ data: await markNotificationRead(req.params.id, verifiedUser(req)) });
  } catch (err) { next(err); }
});

notificationsRouter.patch("/read-all", async (req, res, next) => {
  try {
    res.json({ data: await markAllRead(verifiedUser(req)) });
  } catch (err) { next(err); }
});
