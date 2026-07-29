/**
 * Centralized policy for the driver-shop access model. Every relationship
 * status, action-permission rule, and numeric limit here lives in one
 * place -- services/routes import from this file rather than
 * re-declaring the enum or hardcoding a limit inline.
 */

export const DRIVER_SHOP_ACCESS_STATUSES = Object.freeze([
  "pending_admin_approval",
  "active",
  "suspended",
  "rejected",
  "revoked",
]);

export function isKnownDriverShopAccessStatus(status) {
  return DRIVER_SHOP_ACCESS_STATUSES.includes(status);
}

// Statuses a seller/admin can move an *existing* relationship into, keyed
// by the actor role -- kept here so route handlers never need their own
// copy of "who can do what to which status."
export const SELLER_ALLOWED_TRANSITIONS = Object.freeze({
  pending_admin_approval: ["revoked"], // seller cancels their own pending request
  active: ["suspended", "revoked"],     // seller can pause/remove from their own shop only
});

export const ADMIN_ALLOWED_TRANSITIONS = Object.freeze({
  pending_admin_approval: ["active", "rejected"],
  active: ["suspended", "revoked"],
  suspended: ["active", "revoked"],
  rejected: ["active"],
  revoked: [],
});

// Task 12: capacity policy. A driver's day has finite hours regardless of
// how many shops they're connected to, so this is a single, global cap on
// concurrently open assignments -- not per-shop. Centralized here so it
// can be tuned without touching the eligibility helper or any controller.
export const MAX_ACTIVE_ASSIGNMENTS_PER_DRIVER = 3;

// Assignment statuses that still occupy a capacity slot -- a
// delivery_failed/rescheduled assignment hasn't been freed yet (the
// driver still "owns" it until retry/reassignment/return-to-seller), so
// it counts against capacity just like an in-progress one.
export const CAPACITY_HOLDING_ASSIGNMENT_STATUSES = Object.freeze([
  "accepted",
  "picked_up",
  "out_for_delivery",
  "delivery_failed",
  "rescheduled",
]);
