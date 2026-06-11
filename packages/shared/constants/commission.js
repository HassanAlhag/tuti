export const COMMISSION_PLAN_TYPES = ["Standard", "Premium", "Starter", "Enterprise"];

export const COMMISSION_ENTRY_STATUSES = ["Pending", "Confirmed", "Paid", "Reversed", "Paused"];

export const REFERRAL_STATUSES = ["Referred", "Registered", "Approved", "First Sale", "Active", "Churned"];

export const DEFAULT_COMMISSION_PLANS = {
  Starter: {
    id: "starter",
    name: "Starter",
    signupBonus: 0,
    firstSaleBonus: 50,
    gmvRate: 0.02,
    tierThresholds: [],
    minSellerHealth: "At Risk",
    pauseOnAtRisk: false,
    reverseOnRefund: true,
    currency: "AED",
  },
  Standard: {
    id: "standard",
    name: "Standard",
    signupBonus: 50,
    firstSaleBonus: 100,
    gmvRate: 0.03,
    tierThresholds: [],
    minSellerHealth: "Warning",
    pauseOnAtRisk: true,
    reverseOnRefund: true,
    currency: "AED",
  },
  Premium: {
    id: "premium",
    name: "Premium",
    signupBonus: 100,
    firstSaleBonus: 250,
    gmvRate: 0.04,
    tierThresholds: [
      { minMonthlyGmv: 5000,  rate: 0.045 },
      { minMonthlyGmv: 15000, rate: 0.05  },
    ],
    minSellerHealth: "Warning",
    pauseOnAtRisk: true,
    reverseOnRefund: true,
    currency: "AED",
  },
  Enterprise: {
    id: "enterprise",
    name: "Enterprise",
    signupBonus: 500,
    firstSaleBonus: 1000,
    gmvRate: 0.05,
    tierThresholds: [
      { minMonthlyGmv: 20000, rate: 0.055 },
      { minMonthlyGmv: 50000, rate: 0.06  },
    ],
    minSellerHealth: "Warning",
    pauseOnAtRisk: true,
    reverseOnRefund: false,
    currency: "AED",
  },
};
