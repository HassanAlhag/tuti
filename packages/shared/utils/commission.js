export function calculateSignupBonus(plan) {
  return plan?.signupBonus ?? 0;
}

export function calculateFirstSaleBonus(plan) {
  return plan?.firstSaleBonus ?? 0;
}

export function calculateGmvCommission(order, shop, plan, monthlyTotal = 0) {
  if (!order || !plan) return { amount: 0, rate: 0, tier: null };

  const orderValue = order.subtotal || 0;
  let rate = plan.gmvRate || 0;
  let tier = null;

  if (plan.tierThresholds?.length) {
    for (const t of plan.tierThresholds) {
      if (monthlyTotal >= t.minMonthlyGmv) {
        rate = t.rate;
        tier = t;
      }
    }
  }

  return {
    amount: Math.round(orderValue * rate * 100) / 100,
    rate,
    tier,
  };
}

export function shouldPauseCommission(sellerHealthLevel, plan) {
  if (!plan) return false;
  if (sellerHealthLevel === "Suspended" || sellerHealthLevel === "Terminated") return true;
  if (sellerHealthLevel === "At Risk" && plan.pauseOnAtRisk) return true;
  return false;
}

export function shouldReverseCommission(orderStatus, entryStatus) {
  if (entryStatus === "Paid") return false;
  return ["Cancelled", "Refunded"].includes(orderStatus);
}
