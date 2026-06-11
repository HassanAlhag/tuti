import { Router } from "express";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createUser,
  createUserSchema,
  getRoleDefinitions,
  listUsers,
  resetPasswordSchema,
  resetUserPassword,
  updateUser,
  updateUserSchema,
} from "./users.service.js";

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get("/roles", requirePermission("users.read"), (_req, res) => {
  res.json({ data: getRoleDefinitions() });
});

usersRouter.get("/", requirePermission("users.read"), async (req, res, next) => {
  try {
    const { q, role, status, page, limit } = req.query;
    res.json({
      data: await listUsers({
        q,
        role,
        status,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      }),
    });
  } catch (err) { next(err); }
});

usersRouter.post("/", requirePermission("users.manage"), validate(createUserSchema), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createUser(req.body) });
  } catch (err) { next(err); }
});

usersRouter.patch("/:userId", requirePermission("users.manage"), validate(updateUserSchema), async (req, res, next) => {
  try {
    res.json({ data: await updateUser(req.params.userId, req.body, req.user.sub) });
  } catch (err) { next(err); }
});

usersRouter.patch("/:userId/password", requirePermission("users.manage"), validate(resetPasswordSchema), async (req, res, next) => {
  try {
    res.json({ data: await resetUserPassword(req.params.userId, req.body.password) });
  } catch (err) { next(err); }
});
