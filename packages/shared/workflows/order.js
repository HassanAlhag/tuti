import { ORDER_STATUSES } from "../constants/status.js";
import { USER_ROLES } from "../constants/user.js";

const ORDER_TRANSITIONS = {
  seller: {
    Pending:              ["Confirmed"],
    Confirmed:            ["Processing"],
    Processing:           ["Ready for Delivery"],
  },
  admin: {
    Pending:              ["Confirmed", "Cancelled"],
    Confirmed:            ["Processing", "Cancelled"],
    Processing:           ["Ready for Delivery", "Shipped", "Cancelled"],
    "Ready for Delivery": ["Shipped", "Cancelled"],
    Shipped:              ["Delivered"],
    Delivered:            ["Refunded", "Customer Accepted", "Disputed"],
  },
  support: {
    Pending:   ["Cancelled"],
    Confirmed: ["Cancelled"],
    Processing: ["Cancelled"],
  },
};

function isKnownOrderStatus(status) {
  return ORDER_STATUSES.includes(status);
}

function isKnownRole(role) {
  return USER_ROLES.includes(role);
}

export function getAllowedOrderActions(currentStatus, role) {
  if (!isKnownOrderStatus(currentStatus) || !isKnownRole(role)) return [];
  return [...(ORDER_TRANSITIONS[role]?.[currentStatus] || [])];
}

export function canTransitionOrderStatus(fromStatus, toStatus, role) {
  if (!isKnownOrderStatus(toStatus)) return false;
  return getAllowedOrderActions(fromStatus, role).includes(toStatus);
}
