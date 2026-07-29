import { env } from "../../config/env.js";
import { Driver } from "../../models/Driver.js";
import { normalizePhone, normalizeEmail } from "../../shared/normalizeContact.js";

/**
 * Global driver directory helpers shared by the seller "add/invite
 * driver" flow and the migration tool -- exact-match lookups against
 * Driver.normalizedPhone/normalizedEmail, never a fuzzy scan. Kept
 * separate from drivers.service.js so the dedup logic has exactly one
 * home regardless of which caller needs it.
 */

function normalizeDriverRecord(driver) {
  if (!driver) return null;
  const raw = typeof driver.toObject === "function" ? driver.toObject() : driver;
  return {
    ...raw,
    shopId: raw.shopId ?? null,
    shopName: raw.shopName ?? "",
    createdBySellerUserId: raw.createdBySellerUserId ?? null,
    userId: raw.userId ?? null,
    loginEnabled: raw.loginEnabled ?? false,
    loginEmail: raw.loginEmail ?? "",
  };
}

// Seed-mode drivers live inside drivers.service.js's module-level Map,
// which this file has no access to by design (no back-import) -- callers
// in seed mode pass their own driver list in.
export function findDriverByContactInList(drivers, { phone, email }) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedPhone && !normalizedEmail) return null;
  const phoneMatch = normalizedPhone
    ? drivers.find((d) => normalizePhone(d.normalizedPhone || d.phone) === normalizedPhone)
    : null;
  const emailMatch = normalizedEmail
    ? drivers.find((d) => normalizeEmail(d.normalizedEmail || d.email) === normalizedEmail || normalizeEmail(d.loginEmail) === normalizedEmail)
    : null;
  if (phoneMatch && emailMatch && phoneMatch.id !== emailMatch.id) {
    const e = new Error("Phone and email match different driver records; admin review is required.");
    e.status = 409;
    throw e;
  }
  return phoneMatch || emailMatch || null;
}

export async function findDriverByContactMongo({ phone, email }) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedPhone && !normalizedEmail) return null;

  const [phoneDriver, emailDriver] = await Promise.all([
    normalizedPhone ? Driver.findOne({ normalizedPhone }).lean() : null,
    normalizedEmail ? Driver.findOne({ $or: [{ normalizedEmail }, { loginEmail: normalizedEmail }] }).lean() : null,
  ]);
  if (phoneDriver && emailDriver && phoneDriver.id !== emailDriver.id) {
    const e = new Error("Phone and email match different driver records; admin review is required.");
    e.status = 409;
    throw e;
  }
  return normalizeDriverRecord(phoneDriver || emailDriver);
}

export function computeNormalizedContactFields({ phone, email, loginEmail }) {
  return {
    normalizedPhone: normalizePhone(phone),
    normalizedEmail: normalizeEmail(email) || normalizeEmail(loginEmail),
  };
}
