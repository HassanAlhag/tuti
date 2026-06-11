import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const {
  getPayoutPreview,
  createPayout,
  getPayoutById,
  listPayouts,
  updatePayoutStatus,
  getSellerBalance,
  getSellerTransactions,
  getSellerPayouts,
} = await import("./payoutService.js");

const {
  recordDeliveryEarning,
  releaseEarningToAvailable,
  recordCodCredit,
  freezeSellerBalanceForDispute,
  releaseDisputeHold,
  debitForRefund,
} = await import("./sellerBalance.js");

const { __resetSeedOrdersForTests, __injectSeedOrderForTests } = await import("../orders/orders.service.js");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SHOP_ID  = "shop-rose-vault";
const SHOP_ID2 = "shop-citrus-atelier";
const ADMIN    = { sub: "admin-001", role: "admin" };

// Card order (delivery_credit path)
const CARD_ORDER = {
  orderId: "ORD-PAY-TEST-001",
  shopIds: [SHOP_ID],
  items:   [{ shopId: SHOP_ID, price: 310, quantity: 1, productId: "prf-002" }],
  subtotal: 310, platformFee: 40, vendorNet: 270,
  paymentMethod: "card", paymentStatus: "Payout hold", status: "Delivered",
};

// Second card order
const CARD_ORDER_B = {
  orderId: "ORD-PAY-TEST-002",
  shopIds: [SHOP_ID],
  items:   [{ shopId: SHOP_ID, price: 200, quantity: 1, productId: "prf-003" }],
  subtotal: 200, platformFee: 28, vendorNet: 172,
  paymentMethod: "card", paymentStatus: "Payout hold", status: "Delivered",
};

// COD order (cod_credit path)
const COD_ORDER = {
  orderId: "ORD-PAY-TEST-003",
  shopIds: [SHOP_ID],
  items:   [{ shopId: SHOP_ID, price: 400, quantity: 1, productId: "prf-004" }],
  subtotal: 400, platformFee: 56, vendorNet: 344,
  paymentMethod: "cod", paymentStatus: "COD collected", status: "Delivered",
};

// Order for a different shop
const OTHER_SHOP_ORDER = {
  orderId: "ORD-PAY-TEST-004",
  shopIds: [SHOP_ID2],
  items:   [{ shopId: SHOP_ID2, price: 255, quantity: 1, productId: "prf-005" }],
  subtotal: 255, platformFee: 36, vendorNet: 219,
  paymentMethod: "card", paymentStatus: "Payout hold", status: "Delivered",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getShop(shopId) {
  return seedRepository.getState().shops.find((s) => s.id === shopId);
}

function getTx(orderId, shopId, type) {
  return (seedRepository.getState().sellerTransactions || [])
    .find((t) => t.orderId === orderId && t.shopId === shopId && t.type === type) || null;
}

async function makeAvailable(order) {
  if (order.paymentMethod === "cod") {
    await recordCodCredit(order, ADMIN.sub);
  } else {
    await recordDeliveryEarning(order);
  }
  await releaseEarningToAvailable(order.shopIds[0], order.orderId, ADMIN.sub);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetSeedOrdersForTests();
  seedRepository.__resetSellerTransactionsForTests();
  seedRepository.__resetPayoutsForTests();
  __injectSeedOrderForTests(CARD_ORDER);
  __injectSeedOrderForTests(CARD_ORDER_B);
  __injectSeedOrderForTests(COD_ORDER);
  __injectSeedOrderForTests(OTHER_SHOP_ORDER);
});

// ── getPayoutPreview ──────────────────────────────────────────────────────────

test("getPayoutPreview — empty when no released earnings", async () => {
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleTotal,           0);
  assert.equal(preview.eligibleOrders.length,   0);
});

test("getPayoutPreview — includes eligible released earnings", async () => {
  await makeAvailable(CARD_ORDER);
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleOrders.length,  1);
  assert.equal(preview.eligibleTotal,          270);
  assert.equal(preview.eligibleOrders[0].orderId, CARD_ORDER.orderId);
});

test("getPayoutPreview — includes COD earned after settlement + release", async () => {
  await makeAvailable(COD_ORDER);
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleOrders.length, 1);
  assert.equal(preview.eligibleTotal,         344);
});

test("getPayoutPreview — excludes pending (no hold_release) earnings", async () => {
  await recordDeliveryEarning(CARD_ORDER); // in pendingBalance, not released
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleTotal, 0);
  const inelg = preview.ineligibleOrders.find((o) => o.orderId === CARD_ORDER.orderId);
  assert.ok(inelg, "pending order must appear in ineligible list");
  assert.equal(inelg.reason, "pending_hold_release");
});

test("getPayoutPreview — excludes already-paid earnings", async () => {
  await makeAvailable(CARD_ORDER);
  // Create and complete a payout to mark as paid
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], method: "bank_transfer", adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "processing", adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "completed", adminId: ADMIN.sub });
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleTotal, 0);
  const inelg = preview.ineligibleOrders.find((o) => o.orderId === CARD_ORDER.orderId);
  assert.ok(inelg);
  assert.equal(inelg.reason, "already_paid");
});

test("getPayoutPreview — excludes earnings in active payout", async () => {
  await makeAvailable(CARD_ORDER);
  await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], method: "bank_transfer", adminId: ADMIN.sub });
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleTotal, 0);
  const inelg = preview.ineligibleOrders.find((o) => o.orderId === CARD_ORDER.orderId);
  assert.ok(inelg);
  assert.equal(inelg.reason, "in_active_payout");
});

test("getPayoutPreview — excludes earnings in dispute hold", async () => {
  await recordDeliveryEarning(CARD_ORDER);
  await freezeSellerBalanceForDispute(CARD_ORDER);
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleTotal, 0);
  const inelg = preview.ineligibleOrders.find((o) => o.orderId === CARD_ORDER.orderId);
  assert.ok(inelg);
  assert.equal(inelg.reason, "in_dispute_hold");
});

test("getPayoutPreview — excludes refunded earnings", async () => {
  await recordDeliveryEarning(CARD_ORDER);
  await debitForRefund(CARD_ORDER);
  const preview = await getPayoutPreview(SHOP_ID);
  assert.equal(preview.eligibleTotal, 0);
  const inelg = preview.ineligibleOrders.find((o) => o.orderId === CARD_ORDER.orderId);
  assert.ok(inelg);
  assert.equal(inelg.reason, "refunded");
});

test("getPayoutPreview — throws 404 for unknown shop", async () => {
  await assert.rejects(
    () => getPayoutPreview("shop-does-not-exist"),
    (err) => { assert.equal(err.status, 404); return true; }
  );
});

// ── createPayout ──────────────────────────────────────────────────────────────

test("createPayout — creates payout with eligible orders", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], method: "bank_transfer", adminId: ADMIN.sub });
  assert.ok(payout.id.startsWith("PAY-"));
  assert.equal(payout.shopId, SHOP_ID);
  assert.equal(payout.amount, 270);
  assert.equal(payout.status, "pending");
  assert.deepEqual(payout.orderIds, [CARD_ORDER.orderId]);
});

test("createPayout — deduplicates duplicate orderIds", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({
    shopId: SHOP_ID,
    orderIds: [CARD_ORDER.orderId, CARD_ORDER.orderId],
    adminId: ADMIN.sub,
  });
  assert.equal(payout.orderIds.length, 1);
  assert.equal(payout.amount, 270);
});

test("createPayout — totals multiple orders", async () => {
  await makeAvailable(CARD_ORDER);
  await makeAvailable(CARD_ORDER_B);
  const payout = await createPayout({
    shopId: SHOP_ID,
    orderIds: [CARD_ORDER.orderId, CARD_ORDER_B.orderId],
    adminId: ADMIN.sub,
  });
  assert.equal(payout.amount, 270 + 172);
});

test("createPayout — rejects ineligible order (not released)", async () => {
  await recordDeliveryEarning(CARD_ORDER); // pending, not released
  await assert.rejects(
    () => createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("createPayout — rejects order in active payout (lock)", async () => {
  await makeAvailable(CARD_ORDER);
  await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await assert.rejects(
    () => createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("createPayout — order cannot be in two active payouts", async () => {
  await makeAvailable(CARD_ORDER);
  await makeAvailable(CARD_ORDER_B);
  await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  // Try to sneak same order into another payout alongside an eligible one
  await assert.rejects(
    () => createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId, CARD_ORDER_B.orderId], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

// ── updatePayoutStatus — transitions ─────────────────────────────────────────

test("updatePayoutStatus — pending → processing sets processedAt", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  const updated = await updatePayoutStatus({ payoutId: payout.id, newStatus: "processing", adminId: ADMIN.sub });
  assert.equal(updated.status, "processing");
  assert.ok(updated.processedAt);
  assert.equal(updated.processedBy, ADMIN.sub);
});

test("updatePayoutStatus — processing → completed applies payout_debit and updates balances", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "processing", adminId: ADMIN.sub });
  const completed = await updatePayoutStatus({ payoutId: payout.id, newStatus: "completed", adminId: ADMIN.sub });
  assert.equal(completed.status, "completed");
  // Ledger entry
  const debitTx = getTx(CARD_ORDER.orderId, SHOP_ID, "payout_debit");
  assert.ok(debitTx, "payout_debit ledger entry must exist");
  assert.equal(debitTx.amount, 270);
  // Balance
  const shop = getShop(SHOP_ID);
  assert.equal(shop.availableBalance, 0);
  assert.equal(shop.paidBalance,      270);
});

test("updatePayoutStatus — completed payout sets order paymentStatus to Released", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "processing", adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "completed", adminId: ADMIN.sub });
  const { getSeedOrders } = await import("../orders/orders.service.js");
  const order = getSeedOrders().find((o) => o.orderId === CARD_ORDER.orderId);
  assert.equal(order.paymentStatus, "Released");
});

test("updatePayoutStatus — completing twice is idempotent (no double-debit)", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "processing", adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "completed", adminId: ADMIN.sub });
  // Try to complete again — invalid transition
  await assert.rejects(
    () => updatePayoutStatus({ payoutId: payout.id, newStatus: "completed", adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
  // availableBalance still 0 (not negative), paidBalance still 270
  const shop = getShop(SHOP_ID);
  assert.equal(shop.availableBalance, 0);
  assert.equal(shop.paidBalance, 270);
});

test("updatePayoutStatus — cancelling pending payout does not debit seller", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "cancelled", adminId: ADMIN.sub, reason: "admin cancel" });
  // No payout_debit
  assert.equal(getTx(CARD_ORDER.orderId, SHOP_ID, "payout_debit"), null);
  // availableBalance unchanged
  assert.equal(getShop(SHOP_ID).availableBalance, 270);
});

test("updatePayoutStatus — failing processing payout does not debit seller", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "processing", adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "failed",     adminId: ADMIN.sub, reason: "transfer failed" });
  // No payout_debit
  assert.equal(getTx(CARD_ORDER.orderId, SHOP_ID, "payout_debit"), null);
  // availableBalance unchanged
  assert.equal(getShop(SHOP_ID).availableBalance, 270);
});

test("updatePayoutStatus — failed → pending allows retry; order becomes eligible again", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "processing", adminId: ADMIN.sub });
  await updatePayoutStatus({ payoutId: payout.id, newStatus: "failed",     adminId: ADMIN.sub, reason: "bank error" });
  // After reset to pending, order is again locked (payout still pending for it)
  const retried = await updatePayoutStatus({ payoutId: payout.id, newStatus: "pending", adminId: ADMIN.sub });
  assert.equal(retried.status,    "pending");
  assert.equal(retried.failedAt,  null);
  assert.equal(retried.failureReason, "");
});

test("updatePayoutStatus — invalid transition throws 409", async () => {
  await makeAvailable(CARD_ORDER);
  const payout = await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  // pending → completed (must go via processing first)
  await assert.rejects(
    () => updatePayoutStatus({ payoutId: payout.id, newStatus: "completed", adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

// ── Seller read-only endpoints ────────────────────────────────────────────────

test("getSellerBalance — returns correct balance buckets for the seller's shop", async () => {
  await recordDeliveryEarning(CARD_ORDER);
  const balance = await getSellerBalance(SHOP_ID);
  assert.equal(balance.pendingBalance,   270);
  assert.equal(balance.availableBalance, 0);
  assert.equal(balance.holdBalance,      0);
  assert.equal(balance.paidBalance,      0);
});

test("getSellerBalance — does not expose other shop's balance", async () => {
  await recordDeliveryEarning(OTHER_SHOP_ORDER);
  await releaseEarningToAvailable(SHOP_ID2, OTHER_SHOP_ORDER.orderId, ADMIN.sub);
  // SHOP_ID has no earnings
  const balance = await getSellerBalance(SHOP_ID);
  assert.equal(balance.pendingBalance,   0);
  assert.equal(balance.availableBalance, 0);
});

test("getSellerTransactions — returns only transactions for the seller's shop", async () => {
  await recordDeliveryEarning(CARD_ORDER);
  await recordDeliveryEarning(OTHER_SHOP_ORDER);
  const { transactions } = await getSellerTransactions(SHOP_ID);
  assert.ok(transactions.every((t) => t.shopId === SHOP_ID));
});

test("getSellerPayouts — returns only payouts for the seller's shop", async () => {
  await makeAvailable(CARD_ORDER);
  await createPayout({ shopId: SHOP_ID, orderIds: [CARD_ORDER.orderId], adminId: ADMIN.sub });
  await makeAvailable(OTHER_SHOP_ORDER);
  await createPayout({ shopId: SHOP_ID2, orderIds: [OTHER_SHOP_ORDER.orderId], adminId: ADMIN.sub });
  const { payouts } = await getSellerPayouts(SHOP_ID);
  assert.ok(payouts.every((p) => p.shopId === SHOP_ID));
  assert.equal(payouts.length, 1);
});
