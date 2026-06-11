import { PRODUCT_STATUSES } from "../constants/status.js";
import { USER_ROLES } from "../constants/user.js";

const PRODUCT_TRANSITIONS = {
  seller: {
    Draft:            ["Needs approval"],
    Rejected:         ["Draft"],
    "Needs approval": ["Draft"],   // seller can pull back before admin reviews
    Live:             ["Draft"],   // seller can temporarily hide a live product
  },
  admin: {
    "Needs approval": ["Live", "Rejected"],
    Live: ["Draft"],
    Rejected: ["Draft"],
  },
};

function isKnownProductStatus(status) {
  return PRODUCT_STATUSES.includes(status);
}

function isKnownRole(role) {
  return USER_ROLES.includes(role);
}

export function getAllowedProductActions(currentStatus, role) {
  if (!isKnownProductStatus(currentStatus) || !isKnownRole(role)) return [];
  return [...(PRODUCT_TRANSITIONS[role]?.[currentStatus] || [])];
}

export function canTransitionProductStatus(fromStatus, toStatus, role) {
  if (!isKnownProductStatus(toStatus)) return false;
  return getAllowedProductActions(fromStatus, role).includes(toStatus);
}
