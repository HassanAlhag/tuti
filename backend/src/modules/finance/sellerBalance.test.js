import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

// Force seed mode for all tests.
process.env.MONGO_URI = "";

const {
  recordDeliveryEarning,
  releaseEarningToAvailable,
  freezeSellerBalanceForDispute,
  releaseDisputeHold,
  debitForRefund,
} = await import("./sellerBalance.js");

// ── Test fixtures ─────────────────────────────────────────────────────────────

// Single-shop order: 310 AED, 14.12% commission (40/310).
// vendorNet = 310 - round(310 * 40/310) = 310 - 40 = 270
const ORDER = {
  orderId: "ORD-TEST-FINANCE-001",
  shopIds: ["shop-rose-vault"],
  items: [{ shopId: "shop-rose-vault", price: 310, quantity: 1, productId: "prf-002" }],
  subtotal: 310,
  platformFee: 40,
  vendorNet: 270,
  status: "Delivered",
  paymentStatus: "Authorization",
};

// Multi-shop order with 14% commission.
// rose-vault:     subtotal=310, fee=round(310*0.14)=43, net=267
// citrus-atelier: subtotal=490, fee=round(490*0.14)=69, net=421
const MULTI_ORDER = {
  orderId: "ORD-TEST-FINANCE-002",
  shopIds: ["shop-rose-vault", "shop-citrus-atelier"],
  items: [
    { shopId: "shop-rose-vault",    price: 310, quantity: 1, productId: "prf-002" },
    { shopId: "shop-citrus-atelier", price: 490, quantity: 1, productId: "prf-003" },
  ],
  subtotal: 800,
  platformFee: 112,   // 14% of 800
  vendorNet: 688,
  status: "Delivered",
  paymentStatus: "Authorization",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getShop(shopId) {
  return seedRepository.getState().shops.find((s) => s.id === shopId);
}

function getTx(orderId, shopId, type) {
  return (seedRepository.getState().sellerTransactions || [])
    .find((t) => t.orderId === orderId && t.shopId === shopId && t.type === type) || null;
}

function countTx(orderId, shopId, type) {
  return (seedRepository.getState().sellerTransactions || [])
    .filter((t) => t.orderId === orderId && t.shopId === shopId && t.type === type).length;
}

// ── Reset before each test ────────────────────────────────────────────────────

beforeEach(() => {
  seedRepository.__resetSellerTransactionsForTests();
});

// ── recordDeliveryEarning — COD skip ─────────────────────────────────────────

test("recordDeliveryEarning — skips COD orders entirely (no delivery_credit created)", async () => {
  const codOrder = { ...ORDER, paymentMethod: "cod", paymentStatus: "COD collected" };
  await recordDeliveryEarning(codOrder);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance, 0);
  assert.equal(getTx(codOrder.orderId, "shop-rose-vault", "delivery_credit"), null);
});

// ── recordDeliveryEarning ─────────────────────────────────────────────────────

test("recordDeliveryEarning — credits pendingBalance for single-shop order", async () => {
  await recordDeliveryEarning(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance, 270);
  assert.equal(shop.availableBalance, 0);
  assert.equal(shop.holdBalance, 0);
  assert.equal(shop.paidBalance, 0, "paidBalance must not change in Phase 1");
  const tx = getTx(ORDER.orderId, "shop-rose-vault", "delivery_credit");
  assert.ok(tx, "delivery_credit transaction must exist");
  assert.equal(tx.amount, 270);
});

test("recordDeliveryEarning — credits each shop separately for multi-shop order", async () => {
  await recordDeliveryEarning(MULTI_ORDER);
  const rose   = getShop("shop-rose-vault");
  const citrus = getShop("shop-citrus-atelier");
  assert.equal(rose.pendingBalance,   267);
  assert.equal(citrus.pendingBalance, 421);
  const txRose   = getTx(MULTI_ORDER.orderId, "shop-rose-vault",    "delivery_credit");
  const txCitrus = getTx(MULTI_ORDER.orderId, "shop-citrus-atelier", "delivery_credit");
  assert.ok(txRose,   "rose-vault delivery_credit must exist");
  assert.ok(txCitrus, "citrus delivery_credit must exist");
});

test("recordDeliveryEarning — idempotent: calling twice does not double-credit", async () => {
  await recordDeliveryEarning(ORDER);
  await recordDeliveryEarning(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance, 270);
  assert.equal(countTx(ORDER.orderId, "shop-rose-vault", "delivery_credit"), 1);
});

test("recordDeliveryEarning — skips shop with no matching items", async () => {
  const orderNoItems = { ...ORDER, shopIds: ["shop-rose-vault", "shop-oud-lane"], items: ORDER.items };
  await recordDeliveryEarning(orderNoItems);
  // oud-lane has no items → its vendorNet is 0 → skipped
  const oudLane = getShop("shop-oud-lane");
  assert.equal(oudLane.pendingBalance, 0);
  assert.equal(getTx(orderNoItems.orderId, "shop-oud-lane", "delivery_credit"), null);
});

// ── freezeSellerBalanceForDispute ─────────────────────────────────────────────

test("freezeSellerBalanceForDispute — moves pendingBalance to holdBalance", async () => {
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance, 0);
  assert.equal(shop.holdBalance,    270);
  assert.equal(shop.availableBalance, 0);
  const tx = getTx(ORDER.orderId, "shop-rose-vault", "dispute_hold");
  assert.ok(tx);
  assert.equal(tx.amount, 270);
});

test("freezeSellerBalanceForDispute — idempotent: calling twice freezes only once", async () => {
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.holdBalance, 270);
  assert.equal(countTx(ORDER.orderId, "shop-rose-vault", "dispute_hold"), 1);
});

test("freezeSellerBalanceForDispute — no-op when no delivery credit exists", async () => {
  await freezeSellerBalanceForDispute(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.holdBalance,    0);
  assert.equal(shop.pendingBalance, 0);
  assert.equal(getTx(ORDER.orderId, "shop-rose-vault", "dispute_hold"), null);
});

test("freezeSellerBalanceForDispute — moves from availableBalance if hold was already released", async () => {
  await recordDeliveryEarning(ORDER);
  await releaseEarningToAvailable("shop-rose-vault", ORDER.orderId, "admin");
  await freezeSellerBalanceForDispute(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance,   0);
  assert.equal(shop.availableBalance, 0);
  assert.equal(shop.holdBalance,      270);
});

// ── releaseDisputeHold ────────────────────────────────────────────────────────

test("releaseDisputeHold — moves holdBalance to availableBalance", async () => {
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  await releaseDisputeHold(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.holdBalance,      0);
  assert.equal(shop.availableBalance, 270);
  assert.equal(shop.pendingBalance,   0);
  const tx = getTx(ORDER.orderId, "shop-rose-vault", "dispute_release");
  assert.ok(tx);
  assert.equal(tx.amount, 270);
});

test("releaseDisputeHold — idempotent: calling twice releases only once", async () => {
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  await releaseDisputeHold(ORDER);
  await releaseDisputeHold(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.availableBalance, 270);
  assert.equal(countTx(ORDER.orderId, "shop-rose-vault", "dispute_release"), 1);
});

test("releaseDisputeHold — no-op when no dispute_hold transaction exists", async () => {
  await recordDeliveryEarning(ORDER);
  await releaseDisputeHold(ORDER);
  const shop = getShop("shop-rose-vault");
  // Nothing frozen → nothing to release
  assert.equal(shop.availableBalance, 0);
  assert.equal(shop.pendingBalance,   270);
});

// ── debitForRefund ────────────────────────────────────────────────────────────

test("debitForRefund — deducts from holdBalance when dispute was open", async () => {
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  await debitForRefund(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.holdBalance, 0);
  const tx = getTx(ORDER.orderId, "shop-rose-vault", "refund_debit");
  assert.ok(tx);
  assert.equal(tx.amount, 270);
});

test("debitForRefund — deducts from pendingBalance when no dispute was opened", async () => {
  await recordDeliveryEarning(ORDER);
  // No freeze → no dispute_hold → debit from pendingBalance
  await debitForRefund(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance, 0);
  const tx = getTx(ORDER.orderId, "shop-rose-vault", "refund_debit");
  assert.ok(tx);
  assert.equal(tx.amount, 270);
});

test("debitForRefund — idempotent: calling twice debits only once", async () => {
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  await debitForRefund(ORDER);
  await debitForRefund(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.holdBalance, 0);
  assert.equal(countTx(ORDER.orderId, "shop-rose-vault", "refund_debit"), 1);
});

test("debitForRefund — no-op when no delivery credit exists", async () => {
  await debitForRefund(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.holdBalance,    0);
  assert.equal(shop.pendingBalance, 0);
  assert.equal(getTx(ORDER.orderId, "shop-rose-vault", "refund_debit"), null);
});

// ── releaseEarningToAvailable ─────────────────────────────────────────────────

test("releaseEarningToAvailable — moves pendingBalance to availableBalance", async () => {
  await recordDeliveryEarning(ORDER);
  await releaseEarningToAvailable("shop-rose-vault", ORDER.orderId, "admin");
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance,   0);
  assert.equal(shop.availableBalance, 270);
  const tx = getTx(ORDER.orderId, "shop-rose-vault", "hold_release");
  assert.ok(tx);
  assert.equal(tx.amount, 270);
});

test("releaseEarningToAvailable — idempotent: calling twice releases only once", async () => {
  await recordDeliveryEarning(ORDER);
  await releaseEarningToAvailable("shop-rose-vault", ORDER.orderId, "admin");
  const result = await releaseEarningToAvailable("shop-rose-vault", ORDER.orderId, "admin");
  assert.equal(result, null, "second call should return null (idempotent)");
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.availableBalance, 270);
  assert.equal(countTx(ORDER.orderId, "shop-rose-vault", "hold_release"), 1);
});

test("releaseEarningToAvailable — throws 404 if no delivery credit exists", async () => {
  await assert.rejects(
    () => releaseEarningToAvailable("shop-rose-vault", "ORD-DOES-NOT-EXIST", "admin"),
    (err) => { assert.equal(err.status, 404); return true; }
  );
});

test("releaseEarningToAvailable — works for cod_credit (settled COD order)", async () => {
  // Simulate settled COD order: recordCodCredit puts amount in pendingBalance
  const COD_ORD = {
    orderId: "ORD-COD-RELEASE-TEST",
    shopIds: ["shop-rose-vault"],
    items: [{ shopId: "shop-rose-vault", price: 310, quantity: 1, productId: "prf-002" }],
    subtotal: 310, platformFee: 40, vendorNet: 270,
    paymentMethod: "cod", paymentStatus: "COD collected", status: "Delivered",
  };
  await recordCodCredit(COD_ORD, "admin-001");
  assert.equal(getShop("shop-rose-vault").pendingBalance, 270);

  await releaseEarningToAvailable("shop-rose-vault", COD_ORD.orderId, "admin");
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance,   0);
  assert.equal(shop.availableBalance, 270);
  const tx = getTx(COD_ORD.orderId, "shop-rose-vault", "hold_release");
  assert.ok(tx);
  assert.equal(tx.amount, 270);
});

test("releaseEarningToAvailable — throws 404 for unsettled COD (no cod_credit yet)", async () => {
  // COD delivered but admin hasn't settled — no cod_credit in ledger
  await assert.rejects(
    () => releaseEarningToAvailable("shop-rose-vault", "ORD-COD-UNSETTLED", "admin"),
    (err) => { assert.equal(err.status, 404); return true; }
  );
});

test("releaseEarningToAvailable — throws 409 when earnings are frozen in active dispute hold", async () => {
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  await assert.rejects(
    () => releaseEarningToAvailable("shop-rose-vault", ORDER.orderId, "admin"),
    (err) => { assert.equal(err.status, 409); assert.match(err.message, /dispute hold/i); return true; }
  );
  // Balance must remain in holdBalance, not moved
  assert.equal(getShop("shop-rose-vault").holdBalance,      270);
  assert.equal(getShop("shop-rose-vault").availableBalance, 0);
});

test("releaseEarningToAvailable — throws 409 when earnings have been refunded", async () => {
  await recordDeliveryEarning(ORDER);
  await debitForRefund(ORDER); // applies refund_debit from pendingBalance
  await assert.rejects(
    () => releaseEarningToAvailable("shop-rose-vault", ORDER.orderId, "admin"),
    (err) => { assert.equal(err.status, 409); assert.match(err.message, /refund/i); return true; }
  );
});

test("releaseEarningToAvailable — returns null (idempotent) when already released via dispute_release", async () => {
  // Dispute-then-resolved path: delivery_credit → dispute_hold → dispute_release
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  await releaseDisputeHold(ORDER); // → dispute_release, money in availableBalance
  // Now admin tries to also run releaseEarningToAvailable — should be idempotent
  const result = await releaseEarningToAvailable("shop-rose-vault", ORDER.orderId, "admin");
  assert.equal(result, null, "should be a no-op when already available via dispute_release");
  assert.equal(getShop("shop-rose-vault").availableBalance, 270); // unchanged
});

// ── Full flow: delivery → dispute → release ───────────────────────────────────

test("full flow: delivery credit → dispute freeze → dispute release", async () => {
  await recordDeliveryEarning(ORDER);
  const afterDelivery = getShop("shop-rose-vault");
  assert.equal(afterDelivery.pendingBalance, 270);

  await freezeSellerBalanceForDispute(ORDER);
  const afterFreeze = getShop("shop-rose-vault");
  assert.equal(afterFreeze.pendingBalance,   0);
  assert.equal(afterFreeze.holdBalance,      270);
  assert.equal(afterFreeze.availableBalance, 0);

  await releaseDisputeHold(ORDER);
  const afterRelease = getShop("shop-rose-vault");
  assert.equal(afterRelease.holdBalance,      0);
  assert.equal(afterRelease.availableBalance, 270);
  assert.equal(afterRelease.paidBalance,      0, "paidBalance must not change in Phase 1");
});

// ── Full flow: delivery → dispute → refund debit ──────────────────────────────

test("full flow: delivery credit → dispute freeze → refund debit", async () => {
  await recordDeliveryEarning(ORDER);
  await freezeSellerBalanceForDispute(ORDER);
  await debitForRefund(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance,   0);
  assert.equal(shop.holdBalance,      0);
  assert.equal(shop.availableBalance, 0);
  assert.equal(shop.paidBalance,      0, "paidBalance must not change in Phase 1");
  assert.ok(getTx(ORDER.orderId, "shop-rose-vault", "delivery_credit"));
  assert.ok(getTx(ORDER.orderId, "shop-rose-vault", "dispute_hold"));
  assert.ok(getTx(ORDER.orderId, "shop-rose-vault", "refund_debit"));
});

// ── Full flow: delivery → hold release → dispute freeze (late dispute) ────────

test("full flow: delivery → hold release → late dispute freeze", async () => {
  await recordDeliveryEarning(ORDER);
  await releaseEarningToAvailable("shop-rose-vault", ORDER.orderId, "admin");
  // Dispute opened after hold was released
  await freezeSellerBalanceForDispute(ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.availableBalance, 0);
  assert.equal(shop.holdBalance,      270);
  const holdTx = getTx(ORDER.orderId, "shop-rose-vault", "dispute_hold");
  assert.ok(holdTx);
});

// ── COD + dispute cross-flows ─────────────────────────────────────────────────
// These tests guard the bug-fix: freezeSellerBalanceForDispute and debitForRefund
// must support cod_credit as the credit anchor, not only delivery_credit.

const { recordCodCredit } = await import("./sellerBalance.js");

const COD_ORDER = {
  orderId: "ORD-COD-DISPUTE-TEST",
  shopIds: ["shop-rose-vault"],
  items: [{ shopId: "shop-rose-vault", price: 310, quantity: 1, productId: "prf-002" }],
  subtotal: 310,
  platformFee: 40,
  vendorNet: 270,
  paymentMethod: "cod",
  paymentStatus: "COD collected",
  status: "Delivered",
};

test("freezeSellerBalanceForDispute — freezes cod_credit earnings when COD order is settled then disputed", async () => {
  // Simulate: admin settled COD → cod_credit in pendingBalance → customer disputes
  await recordCodCredit(COD_ORDER, "admin-001");
  assert.equal(getShop("shop-rose-vault").pendingBalance, 270);

  await freezeSellerBalanceForDispute(COD_ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance,   0);
  assert.equal(shop.holdBalance,      270);
  assert.ok(getTx(COD_ORDER.orderId, "shop-rose-vault", "dispute_hold"));
});

test("debitForRefund — debits cod_credit earnings when COD order is settled then refund decided", async () => {
  // Simulate: admin settled COD → cod_credit → dispute opened → freeze → refund decided
  await recordCodCredit(COD_ORDER, "admin-001");
  await freezeSellerBalanceForDispute(COD_ORDER);
  await debitForRefund(COD_ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.holdBalance,      0);
  assert.equal(shop.pendingBalance,   0);
  assert.equal(shop.availableBalance, 0);
  assert.ok(getTx(COD_ORDER.orderId, "shop-rose-vault", "refund_debit"));
});

test("freezeSellerBalanceForDispute — no-op when COD order is disputed before settlement (no credit exists)", async () => {
  // COD delivered but not yet settled → no cod_credit → nothing to freeze
  await freezeSellerBalanceForDispute(COD_ORDER);
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.holdBalance,    0);
  assert.equal(shop.pendingBalance, 0);
  assert.equal(getTx(COD_ORDER.orderId, "shop-rose-vault", "dispute_hold"), null);
});
