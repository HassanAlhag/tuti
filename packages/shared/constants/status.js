export const PRODUCT_STATUSES = ["Live", "Needs approval", "Rejected", "Draft"];

export const SHOP_STATUSES = ["Approved", "Pending review", "Suspended"];

export const ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Ready for Delivery", "Shipped", "Delivered", "Customer Accepted", "Cancelled", "Refunded", "Disputed"];

export const SELLER_ORDER_ACTION_STATUSES = ["Confirmed", "Processing", "Ready for Delivery", "Shipped", "Delivered"];

export const ADMIN_ORDER_ACTION_STATUSES = ["Confirmed", "Processing", "Ready for Delivery", "Shipped", "Delivered", "Customer Accepted", "Disputed", "Cancelled"];

export const PAYMENT_STATUSES = [
  "Authorization",
  "Captured",
  "Escrow",
  "Payout hold",
  "Ready for payout",
  "Dispute hold",
  "Released",
  "Refunded",
  "COD pending",
  "COD collected",
];

export const PAYOUT_STATUSES = ["Ready", "Approved", "On hold"];

export const STATUS_BADGE_CLASS = {
  "Live": "live",
  "Approved": "approved",
  "Ready": "ready",
  "Ready for payout": "ready",
  "Delivered": "live",
  "Needs approval": "needs-approval",
  "Authorization": "authorization",
  "Scheduled": "scheduled",
  "Pending": "needs-approval",
  "Confirmed": "scheduled",
  "Processing": "scheduled",
  "Shipped": "authorization",
  "Ready for Delivery": "scheduled",
  "Customer Accepted": "live",
  "Disputed": "dispute-hold",
  "Dispute hold": "dispute-hold",
  "On hold": "on-hold",
  "Rejected": "rejected",
  "Cancelled": "rejected",
  "Escrow": "escrow",
  "Payout hold": "payout-hold",
  "Pending review": "needs-approval",
  "COD pending": "authorization",
  "Refunded": "on-hold",
};
