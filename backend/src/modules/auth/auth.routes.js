import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getMe, login, loginSchema, refresh, register, registerSchema } from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    res.status(201).json({ data: await register(req.body) });
  } catch (err) { next(err); }
});

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    res.json({ data: await login(req.body) });
  } catch (err) { next(err); }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.body?.refreshToken;
    if (!token) return res.status(400).json({ error: "refreshToken is required." });
    res.json({ data: await refresh(token) });
  } catch (err) { next(err); }
});

authRouter.post("/logout", authenticate, async (req, res) => {
  res.json({ data: { ok: true } });
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    res.json({ data: await getMe(req.user.sub) });
  } catch (err) { next(err); }
});
