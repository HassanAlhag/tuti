import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  addAddress,
  confirmPasswordReset,
  deleteAddress,
  getMe,
  login,
  loginSchema,
  refresh,
  register,
  registerSchema,
  requestPasswordReset,
  toggleWishlist,
  updateAddress,
  updateMe,
  updateMeSchema,
  updateSettings,
  updateSettingsSchema,
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

// Wishlist
authRouter.post("/me/wishlist/:productId", authenticate, async (req, res, next) => {
  try {
    const { productName = "" } = req.body;
    res.json({ data: await toggleWishlist(req.user.sub, req.params.productId, productName) });
  } catch (err) { next(err); }
});

// Account settings
authRouter.patch("/me/settings", authenticate, validate(updateSettingsSchema), async (req, res, next) => {
  try {
    res.json({ data: await updateSettings(req.user.sub, req.body) });
  } catch (err) { next(err); }
});

// Password reset (public — no auth required)
authRouter.post("/password-reset/request", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });
    res.json({ data: await requestPasswordReset(email) });
  } catch (err) { next(err); }
});

authRouter.post("/password-reset/confirm", async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "token and password are required." });
    res.json({ data: await confirmPasswordReset(token, password) });
  } catch (err) { next(err); }
});
