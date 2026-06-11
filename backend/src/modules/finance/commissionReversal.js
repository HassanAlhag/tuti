import { env } from "../../config/env.js";
import { CommissionEntry } from "../../models/CommissionEntry.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { shouldReverseCommission } from "../../../../packages/shared/utils/commission.js";

function reverseAuditFields(orderStatus, reason) {
  return {
    reversedAt: new Date(),
    reversedReason: reason || `Order ${orderStatus} triggered commission reversal.`,
    reversedOrderStatus: orderStatus,
  };
}

function seedCommissionEntries() {
  const state = seedRepository.getState();
  state.commissionEntries = state.commissionEntries || [];
  return state.commissionEntries;
}

function shouldReverseForOrder(orderStatus, entryStatus) {
  return ["Pending", "Confirmed"].includes(entryStatus) && shouldReverseCommission(orderStatus, entryStatus);
}

async function reverseMongoCommissionEntries(order, { reason = "" } = {}) {
  const orderId = order?.orderId;
  if (!orderId) return { reversed: 0 };

  const entries = await CommissionEntry.find({
    orderId,
    status: { $in: ["Pending", "Confirmed"] },
  }).lean();

  if (!entries.length) return { reversed: 0 };

  const audit = reverseAuditFields(order.status, reason);
  let reversed = 0;

  for (const entry of entries) {
    if (!shouldReverseForOrder(order.status, entry.status)) continue;
    await CommissionEntry.updateOne(
      { _id: entry._id, status: { $in: ["Pending", "Confirmed"] } },
      {
        $set: {
          status: "Reversed",
          ...audit,
        },
      }
    );
    reversed += 1;
  }

  return { reversed };
}

function reverseSeedCommissionEntries(order, { reason = "" } = {}) {
  const entries = seedCommissionEntries();
  const audit = reverseAuditFields(order.status, reason);
  let reversed = 0;

  for (const entry of entries) {
    if (entry.orderId !== order?.orderId) continue;
    if (!shouldReverseForOrder(order.status, entry.status)) continue;
    entry.status = "Reversed";
    entry.reversedAt = audit.reversedAt.toISOString();
    entry.reversedReason = audit.reversedReason;
    entry.reversedOrderStatus = audit.reversedOrderStatus;
    reversed += 1;
  }

  return { reversed };
}

export async function reverseOrderCommissions(order, { reason = "" } = {}) {
  if (!order?.orderId) return { reversed: 0 };
  if (!shouldReverseCommission(order.status, "Pending")) return { reversed: 0 };
  if (env.mongoUri) {
    return reverseMongoCommissionEntries(order, { reason });
  }
  return reverseSeedCommissionEntries(order, { reason });
}
