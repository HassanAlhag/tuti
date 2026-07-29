/**
 * Centralized state machine for `order.driverAssignment.status` — the
 * per-assignment delivery lifecycle, deliberately kept separate from
 * `Order.status` (the commercial/fulfilment lifecycle, see orderWorkflow.js).
 * A failed delivery attempt is an assignment-level event, not a commercial
 * one: the order stays "Ready for Delivery"/"Shipped" while the assignment
 * records what happened and what should happen next.
 *
 * Every transition this workflow allows/forbids is defined ONCE here —
 * services must call assertAssignmentTransition() rather than scattering
 * their own if/else transition checks.
 */

const ASSIGNMENT_STATUSES = [
  "accepted",
  "picked_up",
  "out_for_delivery",
  "delivery_failed",
  "rescheduled",
  "returned_to_seller",
  "completed",
  "cancelled",
];

// Failure can be reported from any of these -- an assignment is "active"
// from the moment it's accepted until it either completes or is
// superseded/returned/cancelled.
const FAILABLE_ASSIGNMENT_STATUSES = ["accepted", "picked_up", "out_for_delivery", "rescheduled"];

const ASSIGNMENT_TRANSITIONS = {
  // returned_to_seller is reachable directly from every active state, not
  // just delivery_failed -- an admin/seller can end the attempt on their
  // own authority (e.g. a support call surfaces a problem before the
  // driver ever files a failure report), without waiting on the driver's
  // app. It is still never reachable from completed/cancelled.
  accepted:            ["picked_up", "out_for_delivery", "delivery_failed", "rescheduled", "returned_to_seller", "completed", "cancelled"],
  picked_up:           ["out_for_delivery", "delivery_failed", "rescheduled", "returned_to_seller", "completed", "cancelled"],
  out_for_delivery:    ["completed", "delivery_failed", "rescheduled", "returned_to_seller", "cancelled"],
  delivery_failed:     ["accepted", "cancelled", "returned_to_seller"],
  rescheduled:         ["out_for_delivery", "accepted", "cancelled", "returned_to_seller"],
  returned_to_seller:  [],
  completed:           [],
  cancelled:           [],
};

export function isKnownAssignmentStatus(status) {
  return ASSIGNMENT_STATUSES.includes(status);
}

export function isFailableAssignmentStatus(status) {
  return FAILABLE_ASSIGNMENT_STATUSES.includes(status);
}

export function getAllowedAssignmentTransitions(currentStatus) {
  return [...(ASSIGNMENT_TRANSITIONS[currentStatus] || [])];
}

export function canTransitionAssignmentStatus(fromStatus, toStatus) {
  if (!isKnownAssignmentStatus(toStatus)) return false;
  return getAllowedAssignmentTransitions(fromStatus).includes(toStatus);
}

export function assertAssignmentTransition(fromStatus, toStatus) {
  if (!canTransitionAssignmentStatus(fromStatus, toStatus)) {
    const error = new Error(`Invalid delivery assignment transition: ${fromStatus || "(none)"} -> ${toStatus}.`);
    error.status = 409;
    throw error;
  }
}
