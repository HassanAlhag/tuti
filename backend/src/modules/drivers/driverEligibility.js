import { env } from "../../config/env.js";
import { Order } from "../../models/Order.js";
import { getSeedOrders } from "../orders/orders.service.js";
import { getDriverById } from "./drivers.service.js";
import { findDriverShopAccess } from "./driverShopAccess.service.js";
import {
  MAX_ACTIVE_ASSIGNMENTS_PER_DRIVER,
  CAPACITY_HOLDING_ASSIGNMENT_STATUSES,
} from "../../shared/driverAccessPolicy.js";

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function inferAssignmentStatusForCapacity(assignment) {
  if (!assignment) return null;
  if (assignment.status) return assignment.status;
  if (assignment.deliveredAt) return "completed";
  if (assignment.pickedUpAt) return "picked_up";
  return "accepted";
}

/**
 * Global (all-shops) count of assignments this driver currently holds
 * that haven't been freed yet -- see CAPACITY_HOLDING_ASSIGNMENT_STATUSES.
 * Excludes `excludeOrderId` so an action re-validating the driver's OWN
 * current order (e.g. retrying the same order) doesn't count that order
 * against its own capacity.
 */
async function countHeldAssignments(driverId, { excludeOrderId = null } = {}) {
  if (env.mongoUri) {
    const filter = {
      "driverAssignment.driverId": driverId,
      ...(excludeOrderId ? { orderId: { $ne: excludeOrderId } } : {}),
    };
    const orders = await Order.find(filter).select("orderId driverAssignment").lean();
    return orders.filter((o) => CAPACITY_HOLDING_ASSIGNMENT_STATUSES.includes(inferAssignmentStatusForCapacity(o.driverAssignment))).length;
  }
  return getSeedOrders().filter(
    (o) =>
      o.driverAssignment?.driverId === driverId &&
      o.orderId !== excludeOrderId &&
      CAPACITY_HOLDING_ASSIGNMENT_STATUSES.includes(inferAssignmentStatusForCapacity(o.driverAssignment))
  ).length;
}

const CAPACITY_CHECKED_ACTIONS = new Set(["assign", "reassign", "offer_accept", "broadcast"]);
const BROADCAST_ACTIONS = new Set(["broadcast"]);
const ASSIGNMENT_ACTIONS = new Set(["assign", "reassign"]);
const SUSPENDED_RELATIONSHIP_ALLOWED_ACTIONS = new Set(["access", "complete"]);

/**
 * The single gate every driver-shop interaction must pass through --
 * broadcast targeting, offer acceptance, seller/admin direct assignment,
 * retry, reassignment, failed-delivery resolution, assigned-delivery
 * access, and delivery completion all call this instead of re-deriving
 * their own relationship/zone/capacity logic. Throws an HTTP-shaped
 * error (`.status` set) on any failure; returns `{ driver, access }` on
 * success.
 *
 * `action` drives which extra checks apply:
 *   "broadcast"      -> requires access.canReceiveBroadcasts
 *   "assign"/"reassign" -> requires access.canBeDirectlyAssigned
 *   "assign"/"reassign"/"offer_accept" -> capacity-checked
 *   anything else (e.g. "access", "complete", "retry") -> relationship +
 *     active-driver checks only, no capacity/permission-flag check --
 *     those actions operate on an assignment the driver already holds,
 *     so re-checking capacity against itself would be circular.
 */
export async function assertDriverEligibleForShop({ driverId, shopId, zoneId = null, action, excludeOrderId = null }) {
  if (!driverId) throw httpError(422, "driverId is required.");
  if (!shopId) throw httpError(422, "shopId is required.");

  const driver = await getDriverById(driverId);
  if (!driver) throw httpError(404, "Driver not found.");
  if (driver.isActive === false || driver.status === "inactive") {
    throw httpError(409, "Driver's account is not active.");
  }

  const access = await findDriverShopAccess(driverId, shopId);
  if (!access) {
    throw httpError(403, "Driver does not have access to this shop.");
  }
  const suspendedAllowed = access.status === "suspended" && SUSPENDED_RELATIONSHIP_ALLOWED_ACTIONS.has(action);
  if (access.status !== "active" && !suspendedAllowed) {
    throw httpError(403, "Driver does not have active access to this shop.");
  }

  if (BROADCAST_ACTIONS.has(action) && !access.canReceiveBroadcasts) {
    throw httpError(409, "This driver is not eligible to receive broadcasts for this shop.");
  }
  if (ASSIGNMENT_ACTIONS.has(action) && !access.canBeDirectlyAssigned) {
    throw httpError(409, "This driver cannot be directly assigned for this shop.");
  }
  if (zoneId && access.serviceZoneIds.length && !access.serviceZoneIds.includes(zoneId)) {
    throw httpError(409, "This driver does not service the selected delivery zone for this shop.");
  }
  if (CAPACITY_CHECKED_ACTIONS.has(action)) {
    const held = await countHeldAssignments(driverId, { excludeOrderId });
    if (held >= MAX_ACTIVE_ASSIGNMENTS_PER_DRIVER) {
      throw httpError(409, `Driver already has ${held} active assignment(s) -- maximum is ${MAX_ACTIVE_ASSIGNMENTS_PER_DRIVER}.`);
    }
  }

  return { driver, access };
}
