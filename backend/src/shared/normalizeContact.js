// Controlled identifiers for duplicate-driver detection. Deliberately
// simple/deterministic (no libphonenumber dependency) -- strips everything
// but digits and a single leading "+", and lowercases/trims email. Used
// wherever a driver might already exist under a different shop's request
// (drivers.service.js createSellerDriver/inviteDriver, and the
// migration tool) so two sellers describing the same real person resolve
// to the same Driver record instead of creating a duplicate.
export function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  let digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("971")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+971${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `+971${digits}`;
  return raw.startsWith("+") ? `+${digits}` : digits;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
