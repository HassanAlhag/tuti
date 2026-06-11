import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const { getAdminOperationsSummary } = await import("./adminOperationsSummary.js");
const { __resetSupportTicketsForTests, createSupportTicket } = await import("../support/support.service.js");
const {
  __resetSeedDriversForTests,
  __getSeedDriverForTests,
  createSellerDeliveryOffer,
  listAdminDeliveryOffersSnapshot,
} = await import("../drivers/drivers.service.js");
const { __resetSeedOrdersForTests, __injectSeedOrderForTests } = await import("../orders/orders.service.js");
const { recordDeliveryEarning } = await import("../finance/sellerBalance.js");

const CUSTOMER = {
  sub: "cus-ops-001",
  role: "customer",
  name: "Operations Customer",
  email: "customer@example.com",
};

const SELLER = {
  sub: "seller-ops-001",
  role: "seller",
  name: "Operations Seller",
  email: "seller@example.com",
  shopId: "shop-ops-alpha",
};

const SHOP_ALPHA = {
  id: "shop-ops-alpha",
  name: "Alpha Vault",
  owner: "Operations Seller",
  city: "Dubai",
  status: "Approved",
  payoutHoldDays: 0,
  pendingBalance: 1000,
  availableBalance: 200,
  holdBalance: 30,
  paidBalance: 80,
};

const SHOP_BETA = {
  id: "shop-ops-beta",
  name: "Beta Atelier",
  owner: "Another Seller",
  city: "Abu Dhabi",
  status: "Approved",
  payoutHoldDays: 7,
  pendingBalance: 150,
  availableBalance: 250,
  holdBalance: 20,
  paidBalance: 40,
};

const READY_ACTIVE_ORDER = {
  orderId: "ORD-OPS-001",
  shopIds: [SHOP_ALPHA.id],
  customerName: "Order One",
  subtotal: 180,
  platformFee: 18,
  vendorNet: 162,
  status: "Ready for Delivery",
  paymentMethod: "card",
  paymentStatus: "Payout hold",
  deliveryAddress: "Dubai Marina",
  createdAt: "2026-06-04T06:00:00.000Z",
  updatedAt: "2026-06-04T06:00:00.000Z",
};

const READY_EXPIRED_ORDER = {
  orderId: "ORD-OPS-002",
  shopIds: [SHOP_ALPHA.id],
  customerName: "Order Two",
  subtotal: 220,
  platformFee: 22,
  vendorNet: 198,
  status: "Ready for Delivery",
  paymentMethod: "cod",
  paymentStatus: "Payout hold",
  deliveryAddress: "Downtown Dubai",
  createdAt: "2026-06-04T06:10:00.000Z",
  updatedAt: "2026-06-04T06:10:00.000Z",
};

const DISPUTED_ORDER = {
  orderId: "ORD-OPS-003",
  shopIds: [SHOP_ALPHA.id],
  customerName: "Order Three",
  subtotal: 260,
  platformFee: 26,
  vendorNet: 234,
  status: "Disputed",
  paymentMethod: "card",
  paymentStatus: "Dispute hold",
  supportCase: {
    kind: "dispute",
    status: "open",
    priority: "high",
    issueType: "delivery_issue",
  },
  deliveryAddress: "Business Bay",
  createdAt: "2026-06-04T06:20:00.000Z",
  updatedAt: "2026-06-04T06:30:00.000Z",
};

const DELIVERED_CARD_ORDER = {
  orderId: "ORD-OPS-004",
  shopIds: [SHOP_ALPHA.id],
  items: [{ shopId: SHOP_ALPHA.id, price: 300, quantity: 1, productId: "prf-ops-001" }],
  customerName: "Order Four",
  subtotal: 300,
  platformFee: 30,
  vendorNet: 270,
  status: "Delivered",
  paymentMethod: "card",
  paymentStatus: "Payout hold",
  driverAssignment: {
    driverId: "drv-001",
    driverName: "Alpha Driver",
    deliveredAt: "2026-06-04T08:00:00.000Z",
    codCollected: false,
    codAmount: 0,
    note: "",
  },
  deliveryAddress: "JLT",
  createdAt: "2026-06-04T06:40:00.000Z",
  updatedAt: "2026-06-04T08:00:00.000Z",
};

const DELIVERED_COD_UNSETTLED_ORDER = {
  orderId: "ORD-OPS-005",
  shopIds: [SHOP_ALPHA.id],
  customerName: "Order Five",
  subtotal: 340,
  platformFee: 34,
  vendorNet: 306,
  status: "Delivered",
  paymentMethod: "cod",
  paymentStatus: "COD collected",
  driverAssignment: {
    driverId: "drv-002",
    driverName: "Bravo Driver",
    deliveredAt: "2026-06-04T08:30:00.000Z",
    codCollected: true,
    codAmount: 340,
    note: "",
  },
  deliveryAddress: "Business Bay",
  createdAt: "2026-06-04T06:50:00.000Z",
  updatedAt: "2026-06-04T08:30:00.000Z",
};

function resetState() {
  __resetSeedOrdersForTests();
  __resetSeedDriversForTests();
  __resetSupportTicketsForTests();
  seedRepository.__resetSellerTransactionsForTests();
  seedRepository.__resetPayoutsForTests();

  const state = seedRepository.getState();
  state.orders.splice(0, state.orders.length);
  state.shops.splice(0, state.shops.length, structuredClone(SHOP_ALPHA), structuredClone(SHOP_BETA));
  state.payoutRecords = [];
}

function seedDrivers() {
  const alpha = __getSeedDriverForTests("drv-001");
  const bravo = __getSeedDriverForTests("drv-002");
  const charlie = __getSeedDriverForTests("drv-003");

  Object.assign(alpha, {
    shopId: SHOP_ALPHA.id,
    shopName: SHOP_ALPHA.name,
    codBalance: 1200,
    totalDeliveries: 42,
    totalCodCollected: 5000,
    zone: "Dubai Marina",
    status: "active",
    isActive: true,
  });

  Object.assign(bravo, {
    shopId: SHOP_ALPHA.id,
    shopName: SHOP_ALPHA.name,
    codBalance: 400,
    totalDeliveries: 20,
    totalCodCollected: 2200,
    zone: "Downtown Dubai",
    status: "active",
    isActive: true,
  });

  Object.assign(charlie, {
    shopId: SHOP_BETA.id,
    shopName: SHOP_BETA.name,
    codBalance: 0,
    totalDeliveries: 8,
    totalCodCollected: 800,
    zone: "Abu Dhabi",
    status: "inactive",
    isActive: false,
  });
}

function seedOrders() {
  __injectSeedOrderForTests(structuredClone(READY_ACTIVE_ORDER));
  __injectSeedOrderForTests(structuredClone(READY_EXPIRED_ORDER));
  __injectSeedOrderForTests(structuredClone(DISPUTED_ORDER));
  __injectSeedOrderForTests(structuredClone(DELIVERED_CARD_ORDER));
  __injectSeedOrderForTests(structuredClone(DELIVERED_COD_UNSETTLED_ORDER));
}

function seedPayouts() {
  seedRepository.getState().payoutRecords = [
    {
      id: "PAY-OPS-001",
      shopId: SHOP_ALPHA.id,
      orderIds: [DELIVERED_CARD_ORDER.orderId],
      amount: 270,
      method: "bank_transfer",
      status: "pending",
      createdAt: "2026-06-04T09:00:00.000Z",
      updatedAt: "2026-06-04T09:00:00.000Z",
    },
    {
      id: "PAY-OPS-002",
      shopId: SHOP_ALPHA.id,
      orderIds: [DELIVERED_COD_UNSETTLED_ORDER.orderId],
      amount: 306,
      method: "bank_transfer",
      status: "processing",
      createdAt: "2026-06-04T09:30:00.000Z",
      updatedAt: "2026-06-04T09:45:00.000Z",
    },
    {
      id: "PAY-OPS-003",
      shopId: SHOP_BETA.id,
      orderIds: [],
      amount: 88,
      method: "bank_transfer",
      status: "failed",
      failureReason: "Bank rejected account",
      createdAt: "2026-06-03T09:00:00.000Z",
      updatedAt: "2026-06-03T09:45:00.000Z",
      failedAt: "2026-06-03T09:45:00.000Z",
    },
    {
      id: "PAY-OPS-004",
      shopId: SHOP_BETA.id,
      orderIds: [],
      amount: 111,
      method: "bank_transfer",
      status: "completed",
      createdAt: "2026-06-03T10:00:00.000Z",
      updatedAt: "2026-06-03T10:10:00.000Z",
      completedAt: "2026-06-03T10:10:00.000Z",
    },
  ];
}

beforeEach(() => {
  resetState();
});

test("returns the full empty shape and caps queueLimit at 10", async () => {
  const summary = await getAdminOperationsSummary({ queueLimit: 99, now: new Date("2026-06-04T10:00:00.000Z") });

  assert.equal(summary.meta.queueLimit, 10);
  assert.equal(summary.meta.queueMaxLimit, 10);
  assert.equal(summary.meta.countsAreExact, true);
  assert.equal(typeof summary.snapshot.newOrders.count, "number");
  assert.equal(typeof summary.snapshot.openSupportTickets.count, "number");
  assert.equal(typeof summary.snapshot.openDisputes.count, "number");
  assert.equal(typeof summary.snapshot.driverCodOutstanding.count, "number");
  assert.equal(typeof summary.queues.readyUnassignedOrders.total, "number");
  assert.equal(typeof summary.queues.supportWaitingForAdmin.total, "number");
  assert.equal(typeof summary.queues.expiredDeliveryOffers.total, "number");
  assert.equal(typeof summary.queues.payoutsInProgress.total, "number");
  assert.equal(typeof summary.queues.failedPayouts.total, "number");
  assert.equal(typeof summary.finance.totalPendingSellerBalance, "number");
  assert.equal(summary.snapshot.openSupportTickets.route, "/admin/support-tickets");
  assert.equal(summary.snapshot.openDisputes.route, "/admin/support?section=support");
  assert.equal(summary.quickLinks.some((link) => link.route === "/admin/support-tickets"), true);
});

test("counts support tickets and disputes separately, sums driver COD, and stays read-only", async () => {
  const base = await getAdminOperationsSummary({ queueLimit: 5, now: new Date("2026-06-04T10:00:00.000Z") });
  seedDrivers();
  seedOrders();
  seedPayouts();

  const supportTicket = await createSupportTicket(
    {
      category: "general",
      priority: "normal",
      subject: "General help",
      description: "Please help with platform settings.",
    },
    CUSTOMER
  );

  await recordDeliveryEarning(DELIVERED_CARD_ORDER);

  await createSellerDeliveryOffer(SHOP_ALPHA.id, SHOP_ALPHA.name, SELLER.sub, {
    orderId: READY_ACTIVE_ORDER.orderId,
    deliveryZone: "Dubai Marina",
    deliveryAddressSummary: READY_ACTIVE_ORDER.deliveryAddress,
    expiresAt: "2026-06-04T12:00:00.000Z",
    codAmount: 180,
    notes: "First broadcast",
  });

  await createSellerDeliveryOffer(SHOP_ALPHA.id, SHOP_ALPHA.name, SELLER.sub, {
    orderId: READY_EXPIRED_ORDER.orderId,
    deliveryZone: "Downtown Dubai",
    deliveryAddressSummary: READY_EXPIRED_ORDER.deliveryAddress,
    expiresAt: "2026-06-04T08:00:00.000Z",
    codAmount: 220,
    notes: "Expired broadcast",
  });

  const beforeOffers = await listAdminDeliveryOffersSnapshot();
  const beforeOrders = structuredClone(seedRepository.getState().orders);

  const summary = await getAdminOperationsSummary({ queueLimit: 99, now: new Date("2026-06-04T10:00:00.000Z") });

  const afterOffers = await listAdminDeliveryOffersSnapshot();

  assert.equal(summary.snapshot.openSupportTickets.count, base.snapshot.openSupportTickets.count + 1);
  assert.equal(summary.snapshot.openDisputes.count, base.snapshot.openDisputes.count + 1);
  assert.equal(summary.snapshot.driverCodOutstanding.count, 1600);
  assert.equal(summary.snapshot.activeDeliveryOffers.count, 1);
  assert.equal(summary.queues.expiredDeliveryOffers.total, 1);
  assert.equal(typeof summary.queues.earningsReadyForRelease.total, "number");
  assert.equal(summary.queues.payoutsInProgress.total, 2);
  assert.equal(summary.queues.failedPayouts.total, 1);
  assert.equal(summary.finance.totalPendingSellerBalance, 1420);
  assert.equal(summary.finance.totalAvailableSellerBalance, 450);
  assert.equal(summary.finance.totalHoldSellerBalance, 50);
  assert.equal(summary.finance.totalPaidSellerBalance, 120);
  assert.equal(summary.finance.totalPendingPayouts.count, 1);
  assert.equal(summary.finance.totalPendingPayouts.amount, 270);
  assert.equal(summary.finance.totalProcessingPayouts.count, 1);
  assert.equal(summary.finance.totalProcessingPayouts.amount, 306);
  assert.equal(summary.finance.totalCompletedPayoutsThisMonth.count, 1);
  assert.equal(summary.finance.totalCompletedPayoutsThisMonth.amount, 111);

  assert.deepEqual(afterOffers, beforeOffers);
  assert.deepEqual(seedRepository.getState().orders, beforeOrders);
  assert.equal(supportTicket.internalNotes, undefined);
});
