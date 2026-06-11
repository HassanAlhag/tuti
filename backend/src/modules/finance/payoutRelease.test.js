import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const {
  getReleasePreview,
  releaseEarnings,
  getPayoutPreview,
  createPayout,
  updatePayoutStatus,
} = await import("./payoutService.js");

const {
  recordDeliveryEarning,
  recordCodCredit,
  releaseEarningToAvailable,
  debitForRefund,
} = await import("./sellerBalance.js");

const { __resetSeedOrdersForTests, __injectSeedOrderForTests } = await import("../orders/orders.service.js");

const SHOP_ID = "shop-rose-vault";
const ADMIN = { sub: "admin-001", role: "admin" };
const LATE_NOW = new Date(Date.now() + (8 * 24 * 60 * 60 * 1000));

const CARD_ORDER = {
  orderId: "ORD-REL-001",
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, price: 310, quantity: 1, productId: "prf-002" }],
  subtotal: 310,
  platformFee: 40,
  vendorNet: 270,
  status: "Delivered",
  paymentMethod: "card",
  paymentStatus: "Payout hold",
};

const IMMATURE_ORDER = {
  orderId: "ORD-REL-002",
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, price: 200, quantity: 1, productId: "prf-003" }],
  subtotal: 200,
  platformFee: 28,
  vendorNet: 172,
  status: "Delivered",
  paymentMethod: "card",
  paymentStatus: "Payout hold",
};

const CANCELLED_ORDER = {
  orderId: "ORD-REL-003",
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, price: 280, quantity: 1, productId: "prf-004" }],
  subtotal: 280,
  platformFee: 39,
  vendorNet: 241,
  status: "Cancelled",
  paymentMethod: "card",
  paymentStatus: "Payout hold",
};

const REFUNDED_ORDER = {
  orderId: "ORD-REL-004",
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, price: 340, quantity: 1, productId: "prf-005" }],
  subtotal: 340,
  platformFee: 48,
  vendorNet: 292,
  status: "Refunded",
  paymentMethod: "card",
  paymentStatus: "Refunded",
};

const DISPUTED_ORDER = {
  orderId: "ORD-REL-005",
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, price: 420, quantity: 1, productId: "prf-006" }],
  subtotal: 420,
  platformFee: 59,
  vendorNet: 361,
  status: "Disputed",
  paymentMethod: "card",
  paymentStatus: "Dispute hold",
  supportCase: { kind: "dispute", status: "open" },
};

const COD_SETTLED_ORDER = {
  orderId: "ORD-REL-006",
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, price: 400, quantity: 1, productId: "prf-007" }],
  subtotal: 400,
  platformFee: 56,
  vendorNet: 344,
  status: "Delivered",
  paymentMethod: "cod",
  paymentStatus: "COD collected",
  driverAssignment: { codSettledAt: "2026-05-30T08:00:00.000Z" },
};

const COD_UNSETTLED_ORDER = {
  orderId: "ORD-REL-007",
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, price: 410, quantity: 1, productId: "prf-008" }],
  subtotal: 410,
  platformFee: 57,
  vendorNet: 353,
  status: "Delivered",
  paymentMethod: "cod",
  paymentStatus: "COD collected",
};

function getTx(orderId, type) {
  return (seedRepository.getState().sellerTransactions || [])
    .find((t) => t.orderId === orderId && t.shopId === SHOP_ID && t.type === type) || null;
}

function setTxCreatedAt(orderId, type, createdAt) {
  const tx = getTx(orderId, type);
  assert.ok(tx, `Expected ${type} tx for ${orderId}`);
  tx.createdAt = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
}

beforeEach(() => {
  __resetSeedOrdersForTests();
  seedRepository.__resetSellerTransactionsForTests();
  seedRepository.__resetPayoutsForTests();

  __injectSeedOrderForTests(structuredClone(CARD_ORDER));
  __injectSeedOrderForTests(structuredClone(IMMATURE_ORDER));
  __injectSeedOrderForTests(structuredClone(CANCELLED_ORDER));
  __injectSeedOrderForTests(structuredClone(REFUNDED_ORDER));
  __injectSeedOrderForTests(structuredClone(DISPUTED_ORDER));
  __injectSeedOrderForTests(structuredClone(COD_SETTLED_ORDER));
  __injectSeedOrderForTests(structuredClone(COD_UNSETTLED_ORDER));
});

async function seedCardRelease(order = CARD_ORDER) {
  await recordDeliveryEarning(order);
}

async function seedCodRelease(order = COD_SETTLED_ORDER) {
  await recordCodCredit(order, ADMIN.sub);
}

test("getReleasePreview — shows matured delivery_credit earnings as eligible", async () => {
  await seedCardRelease();
  const preview = await getReleasePreview(SHOP_ID, { now: LATE_NOW });
  assert.equal(preview.eligibleOrders.length, 1);
  assert.equal(preview.eligibleOrders[0].orderId, CARD_ORDER.orderId);
  assert.equal(preview.eligibleTotal, 270);
  assert.equal(preview.notYetMatureOrders.length, 0);
});

test("getReleasePreview — shows matured cod_credit earnings as eligible only after settlement", async () => {
  await seedCodRelease();
  const preview = await getReleasePreview(SHOP_ID, { now: LATE_NOW });
  assert.equal(preview.eligibleOrders.length, 1);
  assert.equal(preview.eligibleOrders[0].orderId, COD_SETTLED_ORDER.orderId);
  assert.equal(preview.eligibleTotal, 344);
});

test("getReleasePreview — blocks immature earnings unless forced later", async () => {
  await seedCardRelease(IMMATURE_ORDER);
  const preview = await getReleasePreview(SHOP_ID);
  const blocked = preview.notYetMatureOrders.find((item) => item.orderId === IMMATURE_ORDER.orderId);
  assert.ok(blocked);
  assert.equal(preview.eligibleTotal, 0);
  assert.equal(preview.notYetMatureOrders.length, 1);
});

test("getReleasePreview — blocks cancelled, refunded, disputed, unsettled COD, and already paid earnings", async () => {
  await seedCardRelease(CARD_ORDER);
  await seedCardRelease(CANCELLED_ORDER);
  await seedCardRelease(REFUNDED_ORDER);
  await seedCardRelease(DISPUTED_ORDER);
  await seedCodRelease(COD_UNSETTLED_ORDER);
  await releaseEarnings({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], now: LATE_NOW, adminId: ADMIN.sub });
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "processing", adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "completed", adminId: ADMIN.sub });

  const preview = await getReleasePreview(SHOP_ID, { now: LATE_NOW });
  const reasons = new Map(preview.skippedOrders.map((item) => [item.orderId, item.reason]));
  assert.equal(reasons.get(CANCELLED_ORDER.orderId), "cancelled");
  assert.equal(reasons.get(REFUNDED_ORDER.orderId), "refunded");
  assert.equal(reasons.get(DISPUTED_ORDER.orderId), "in_dispute_hold");
  assert.equal(reasons.get(COD_UNSETTLED_ORDER.orderId), "unsettled_cod");
  assert.equal(reasons.get(CARD_ORDER.orderId), "already_paid");
});

test("releaseEarnings — force releases immature earnings but still blocks unsafe orders", async () => {
  await seedCardRelease(IMMATURE_ORDER);
  await seedCardRelease(CANCELLED_ORDER);
  const result = await releaseEarnings({
    shopId: SHOP_ID,
    orderIds: [IMMATURE_ORDER.orderId, CANCELLED_ORDER.orderId],
    force: true,
    notes: "Manual review",
    adminId: ADMIN.sub,
    now: new Date(),
  });

  assert.equal(result.releasedOrders.length, 1);
  assert.equal(result.releasedOrders[0].orderId, IMMATURE_ORDER.orderId);
  assert.equal(result.skippedOrders[0].orderId, CANCELLED_ORDER.orderId);
  assert.equal(result.skippedOrders[0].reason, "cancelled");
  assert.equal(getTx(IMMATURE_ORDER.orderId, "hold_release")?.note.includes("Manual review"), true);
});

test("releaseEarnings — idempotent retry does not double-release", async () => {
  await seedCardRelease(CARD_ORDER);
  const first = await releaseEarnings({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub, now: LATE_NOW });
  const second = await releaseEarnings({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub, now: LATE_NOW });

  assert.equal(first.releasedOrders.length, 1);
  assert.equal(second.releasedOrders.length, 0);
  assert.equal(second.skippedOrders[0].reason, "already_released");
  assert.equal((seedRepository.getState().sellerTransactions || []).filter((t) => t.orderId === CARD_ORDER.orderId && t.type === "hold_release").length, 1);
});

test("releaseEarnings — releaseAllEligible only releases eligible orders", async () => {
  await seedCardRelease(CARD_ORDER);
  await seedCardRelease(IMMATURE_ORDER);
  await seedCardRelease(CANCELLED_ORDER);
  await seedCodRelease(COD_SETTLED_ORDER);

  const matureAt = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000));
  setTxCreatedAt(CARD_ORDER.orderId, "delivery_credit", matureAt);
  setTxCreatedAt(COD_SETTLED_ORDER.orderId, "cod_credit", matureAt);

  const result = await releaseEarnings({
    shopId: SHOP_ID,
    releaseAllEligible: true,
    adminId: ADMIN.sub,
  });

  const releasedIds = result.releasedOrders.map((item) => item.orderId).sort();
  assert.deepEqual(releasedIds, [CARD_ORDER.orderId, COD_SETTLED_ORDER.orderId].sort());
  assert.ok(result.skippedOrders.some((item) => item.orderId === IMMATURE_ORDER.orderId && item.reason === "not_matured"));
  assert.ok(result.skippedOrders.some((item) => item.orderId === CANCELLED_ORDER.orderId && item.reason === "cancelled"));
});

test("releaseEarnings — payout preview sees released earnings after hold_release", async () => {
  await seedCardRelease(CARD_ORDER);
  await releaseEarnings({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub, now: LATE_NOW });
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleOrders.length, 1);
  assert.equal(preview.eligibleOrders[0].orderId, CARD_ORDER.orderId);
  assert.equal(preview.eligibleTotal, 270);
});

test("releaseEarnings — no-op when no orders are eligible", async () => {
  const result = await releaseEarnings({
    shopId: SHOP_ID,
    releaseAllEligible: true,
    adminId: ADMIN.sub,
    now: new Date(),
  });
  assert.equal(result.releasedOrders.length, 0);
  assert.equal(result.totalReleasedAmount, 0);
});

test("releaseEarnings — keeps finance-safe blocks intact for refunded orders", async () => {
  await seedCardRelease(REFUNDED_ORDER);
  await debitForRefund(REFUNDED_ORDER);

  const result = await releaseEarnings({
    shopId: SHOP_ID,
    orderIds: [REFUNDED_ORDER.orderId],
    adminId: ADMIN.sub,
    now: LATE_NOW,
  });

  assert.equal(result.releasedOrders.length, 0);
  assert.equal(result.skippedOrders[0].reason, "refunded");
});
