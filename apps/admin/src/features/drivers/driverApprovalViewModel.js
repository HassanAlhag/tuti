export function getPendingApprovalKey(request) {
  return request?.accessId || request?.id || "";
}

export function getPendingApprovalAccessStatus(request) {
  return request?.accessStatus || request?.status || "";
}

export function isPendingDriverApproval(request) {
  return getPendingApprovalAccessStatus(request) === "pending_admin_approval";
}

export function getPendingApprovalCount(requests) {
  return Array.isArray(requests) ? requests.filter(isPendingDriverApproval).length : 0;
}

export function formatAccessStatus(status) {
  if (status === "pending_admin_approval") return "Pending approval";
  if (status === "active") return "Active";
  if (status === "rejected") return "Rejected";
  if (status === "suspended") return "Suspended";
  if (status === "revoked") return "Revoked";
  return status || "Unknown";
}

export function formatDriverAccountStatus(status) {
  if (status === "on_delivery") return "On delivery";
  if (status === "inactive") return "Inactive";
  return "Active";
}
