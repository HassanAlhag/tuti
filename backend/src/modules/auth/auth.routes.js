import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  addAddress,
  deleteAddress,
  getMe,
  login,
  loginSchema,
  refresh,
  register,
  registerSchema,
  updateAddress,
  updateMe,
  updateMeSchema,
} from "./auth.service.js";

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

authRouter.patch("/me", authenticate, validate(updateMeSchema), async (req, res, next) => {
  try {
    res.json({ data: await updateMe(req.user.sub, req.body) });
  } catch (err) { next(err); }
});

// Address book
authRouter.post("/me/addresses", authenticate, async (req, res, next) => {
  try {
    res.status(201).json({ data: await addAddress(req.user.sub, req.body) });
  } catch (err) { next(err); }
});

authRouter.patch("/me/addresses/:addressId", authenticate, async (req, res, next) => {
  try {
    res.json({ data: await updateAddress(req.user.sub, req.params.addressId, req.body) });
  } catch (err) { next(err); }
});

authRouter.delete("/me/addresses/:addressId", authenticate, async (req, res, next) => {
  try {
    res.json({ data: await deleteAddress(req.user.sub, req.params.addressId) });
  } catch (err) { next(err); }
});
