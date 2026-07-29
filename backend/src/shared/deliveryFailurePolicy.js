/**
 * Centralized policy for the driver "delivery failed" workflow. Every
 * reason-specific rule (note/evidence requirements, retry/reassignment
 * eligibility, whether admin review is required) and every numeric limit
 * (max attempts) lives here — nothing about this policy should be
 * hardcoded anywhere else in the codebase (routes/services/UI all import
 * from this one file), so a policy change is a one-file change.
 */

export const DELIVERY_FAILURE_REASONS = Object.freeze({
  CUSTOMER_UNREACHABLE: {
    noteRequired: false,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "RETRY_SAME_DRIVER",
  },
  CUSTOMER_NOT_AVAILABLE: {
    noteRequired: false,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "RETRY_SAME_DRIVER",
  },
  CUSTOMER_REFUSED: {
    noteRequired: true,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: false,
    reassignAllowed: false,
    mustReturnToSeller: true,
    adminReviewRequired: true,
    defaultNextAction: "ADMIN_REVIEW",
  },
  WRONG_ADDRESS: {
    noteRequired: true,
    evidenceRequired: false,
    customerConfirmationRequired: true,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "CUSTOMER_CONFIRMATION_REQUIRED",
  },
  INCOMPLETE_ADDRESS: {
    noteRequired: true,
    evidenceRequired: false,
    customerConfirmationRequired: true,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "CUSTOMER_CONFIRMATION_REQUIRED",
  },
  CUSTOMER_REQUESTED_RESCHEDULE: {
    noteRequired: false,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    requestedRetryAtRequired: true,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "RESCHEDULE",
  },
  PAYMENT_NOT_AVAILABLE: {
    noteRequired: false,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "RETRY_SAME_DRIVER",
  },
  ORDER_DAMAGED: {
    noteRequired: true,
    evidenceRequired: true,
    customerConfirmationRequired: false,
    autoRetryAllowed: false,
    reassignAllowed: false,
    mustReturnToSeller: true,
    adminReviewRequired: true,
    defaultNextAction: "RETURN_TO_SELLER",
  },
  VEHICLE_BREAKDOWN: {
    noteRequired: false,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "REASSIGN_DRIVER",
  },
  DRIVER_EMERGENCY: {
    noteRequired: false,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "REASSIGN_DRIVER",
  },
  UNSAFE_LOCATION: {
    noteRequired: true,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: false,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: true,
    defaultNextAction: "ADMIN_REVIEW",
  },
  ACCESS_RESTRICTED: {
    noteRequired: false,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "RETRY_SAME_DRIVER",
  },
  WEATHER_OR_ROAD_ISSUE: {
    noteRequired: false,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: true,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: false,
    defaultNextAction: "RETRY_SAME_DRIVER",
  },
  SELLER_PACKAGING_ISSUE: {
    noteRequired: true,
    evidenceRequired: true,
    customerConfirmationRequired: false,
    autoRetryAllowed: false,
    reassignAllowed: false,
    mustReturnToSeller: true,
    adminReviewRequired: true,
    defaultNextAction: "RETURN_TO_SELLER",
  },
  OTHER: {
    noteRequired: true,
    evidenceRequired: false,
    customerConfirmationRequired: false,
    autoRetryAllowed: false,
    reassignAllowed: true,
    mustReturnToSeller: false,
    adminReviewRequired: true,
    defaultNextAction: "ADMIN_REVIEW",
  },
});

export const DELIVERY_FAILURE_REASON_CODES = Object.freeze(Object.keys(DELIVERY_FAILURE_REASONS));

export function getDeliveryFailureReasonPolicy(reasonCode) {
  return DELIVERY_FAILURE_REASONS[reasonCode] || null;
}

export function isKnownDeliveryFailureReason(reasonCode) {
  return Object.prototype.hasOwnProperty.call(DELIVERY_FAILURE_REASONS, reasonCode);
}

// ── Attempt limits ──────────────────────────────────────────────────────
export const MAX_DELIVERY_ATTEMPTS = 3;
export const CUSTOMER_UNREACHABLE_RETRY_DELAY_HOURS = 2;

/**
 * Resolves the nextAction for a given reason + attempt count. Once the
 * order has reached the configured attempt ceiling, every reason
 * defers to admin review/return-to-seller regardless of its own default
 * next action — a reason's normal retry-friendliness never overrides the
 * attempt cap.
 */
export function resolveNextAction(reasonCode, attemptNumber) {
  const policy = getDeliveryFailureReasonPolicy(reasonCode);
  if (!policy) return "ADMIN_REVIEW";
  if (attemptNumber >= MAX_DELIVERY_ATTEMPTS) {
    return policy.mustReturnToSeller ? "RETURN_TO_SELLER" : "ADMIN_REVIEW";
  }
  return policy.defaultNextAction;
}

export const VALID_NEXT_ACTIONS = Object.freeze([
  "RETRY_SAME_DRIVER",
  "REASSIGN_DRIVER",
  "RESCHEDULE",
  "RETURN_TO_SELLER",
  "ADMIN_REVIEW",
  "SUPPORT_REVIEW",
  "CUSTOMER_CONFIRMATION_REQUIRED",
]);

// ── Customer-safe copy (Phase J) ────────────────────────────────────────
// Deliberately generic: never mentions the driver's name, internal risk
// labels, admin/review states, or reassignment discussion -- only what the
// customer needs to know and (where relevant) what they can do about it.
const CUSTOMER_SAFE_FAILURE_MESSAGES = Object.freeze({
  CUSTOMER_UNREACHABLE: "We tried to reach you for your delivery but couldn't connect. We'll try again soon.",
  CUSTOMER_NOT_AVAILABLE: "Our driver arrived but no one was available to receive the order. We'll try again soon.",
  CUSTOMER_REFUSED: "Your delivery could not be completed. Our support team will contact you shortly.",
  WRONG_ADDRESS: "We couldn't find the delivery address. Please confirm your address so we can try again.",
  INCOMPLETE_ADDRESS: "Your delivery address looks incomplete. Please confirm your address so we can try again.",
  CUSTOMER_REQUESTED_RESCHEDULE: "Your delivery has been rescheduled to the requested time.",
  PAYMENT_NOT_AVAILABLE: "Payment could not be completed on delivery. We'll try again soon.",
  ORDER_DAMAGED: "Your order could not be delivered due to a quality issue. Our team is reviewing this and will reach out.",
  VEHICLE_BREAKDOWN: "Your delivery is delayed. A new driver will be assigned shortly.",
  DRIVER_EMERGENCY: "Your delivery is delayed. A new driver will be assigned shortly.",
  UNSAFE_LOCATION: "Our driver was unable to safely complete this delivery. Our support team will contact you.",
  ACCESS_RESTRICTED: "Our driver could not access the delivery location. We'll try again soon.",
  WEATHER_OR_ROAD_ISSUE: "Your delivery is delayed due to road/weather conditions. We'll try again soon.",
  SELLER_PACKAGING_ISSUE: "Your order is being returned to the seller for a packaging issue. Our team will follow up.",
  OTHER: "Your delivery could not be completed. Our support team will contact you shortly.",
});

export function getCustomerSafeFailureMessage(reasonCode) {
  return CUSTOMER_SAFE_FAILURE_MESSAGES[reasonCode] || CUSTOMER_SAFE_FAILURE_MESSAGES.OTHER;
}
