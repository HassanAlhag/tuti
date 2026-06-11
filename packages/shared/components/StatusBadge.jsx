import { STATUS_BADGE_CLASS } from "../constants/status.js";

export function StatusBadge({ status }) {
  const cls = STATUS_BADGE_CLASS[status] || "needs-approval";
  return <span className={`status-badge ${cls}`}>{status}</span>;
}
