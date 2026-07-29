export function formatDriverStatus(status) {
  if (status === "pending_admin_approval") return "Pending approval";
  if (status === "suspended") return "Suspended";
  if (status === "rejected") return "Rejected";
  if (status === "revoked") return "Revoked";
  if (status === "on_delivery") return "On delivery";
  if (status === "inactive") return "Inactive";
  return "Active";
}

export function isSellerDriverActive(driver) {
  const accessStatus = driver?.accessStatus || driver?.status;
  const driverStatus = driver?.driverStatus || driver?.driverGlobalStatus || "active";
  return Boolean(driver) && accessStatus === "active" && driver.isActive !== false && driverStatus !== "inactive";
}

export function driverStatusTone(driver) {
  const accessStatus = driver?.accessStatus || driver?.status;
  const driverStatus = driver?.driverStatus || driver?.driverGlobalStatus || "active";
  if (accessStatus === "pending_admin_approval") return "amber";
  if (accessStatus === "suspended") return "amber";
  if (accessStatus === "rejected" || accessStatus === "revoked") return "danger";
  if (driverStatus === "on_delivery") return "amber";
  if (driverStatus === "inactive" || driver?.isActive === false) return "danger";
  return "success";
}
