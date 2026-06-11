const PRODUCT_STATUSES = ["Live", "Needs approval", "Rejected", "Draft"];
const USER_ROLES = ["customer", "seller", "support", "admin"];

const PRODUCT_TRANSITIONS = {
  seller: {
    Draft: ["Needs approval"],
    Rejected: ["Draft"],
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
