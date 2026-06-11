import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

// Force seed mode for all tests.
process.env.MONGO_URI = "";

const { listDriverCodSettlementCandidates, settleDriverCodOrders } = await import("./codSettlement.js");
const { __injectSeedOrderForTests, __resetSeedOrdersForTests }     = await import("../orders/orders.service.js");
const { __resetSeedDriversForTests, __getSeedDriverForTests }       = await import("../drivers/drivers.service.js");

// ── Test fixtures ─────────────────────────────────────────────────────────────

// drv-002 starts with codBalance: 320 in seed data.
const DRIVER_ID = "drv-002";

// Base COD order template for drv-002, shop-rose-vault.
// COD amount 310, vendorNet = 270 (310 - round(310 * 40/310) = 310 - 40).
const BASE_ORDER = {
  orderId:       "ORD-COD-TEST-001",
  shopIds:       ["shop-rose-vault"],
  items:         [{ shopId: "shop-rose-vault", price: 310, quantity: 1, productId: "prf-002" }],
  subtotal:      310,
  platformFee:   40,
  vendorNet:     270,
  paymentMethod: "cod",
  paymentStatus: "COD collected",
  status:        "Delivered",
  customerName:  "Test Customer",
  customerEmail: "test@example.com",
  driverAssignment: {
    driverId:     DRIVER_ID,
    driverName:   "Khalid Bin Hamdan",
    codCollected: true,
    codAmount:    310,
    deliveredAt:  "2026-06-01T10:00:00.000Z",
    codSettledAt:    null,
    codSettledBy:    null,
    codSettlementRef: null,
  },
};

// Second order for the same driver — different orderId.
const ORDER_B = {
  ...BASE_ORDER,
  orderId: "ORD-COD-TEST-002",
  items:   [{ shopId: "shop-rose-vault", price: 200, quantity: 1, productId: "prf-003" }],
  subtotal: 200,
  platformFee: 28,
  vendorNet: 172,
  driverAssignment: { ...BASE_ORDER.driverAssignment, codAmount: 200 },
};

// Order assigned to a DIFFERENT driver.
const ORDER_OTHER_DRIVER = {
  ...BASE_ORDER,
  orderId: "ORD-COD-TEST-003",
  driverAssignment: { ...BASE_ORDER.driverAssignment, driverId: "drv-001" },
};

// Order where cash was NOT collected (codCollected=false).
const ORDER_NOT_COLLECTED = {
  ...BASE_ORDER,
  orderId: "ORD-COD-TEST-004",
  paymentStatus: "COD pending",
  driverAssignment: { ...BASE_ORDER.driverAssignment, codCollected: false, codAmount: 0 },
};

// Card order (not COD).
const ORDER_CARD = {
  ...BASE_ORDER,
  orderId:       "ORD-CARD-TEST-001",
  paymentMethod: "card",
  paymentStatus: "Payout hold",
  driverAssignment: { ...BASE_ORDER.driverAssignment },
};

// Order with an active dispute.
const ORDER_DISPUTED = {
  ...BASE_ORDER,
  orderId: "ORD-COD-TEST-005",
  status:  "Disputed",
  supportCase: { status: "open" },
};

// Order with a closed support case (not an active dispute — eligible).
const ORDER_CLOSED_CASE = {
  ...BASE_ORDER,
  orderId: "ORD-COD-TEST-006",
  supportCase: { status: "closed" },
};

// Already-settled order.
const ORDER_SETTLED = {
  ...BASE_ORDER,
  orderId: "ORD-COD-TEST-007",
  driverAssignment: {
    ...BASE_ORDER.driverAssignment,
    codSettledAt:    "2026-05-30T08:00:00.000Z",
    codSettledBy:    "admin-001",
    codSettlementRef: "SETTLE-ABCDEF01",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getShop(shopId) {
  return seedRepository.getState().shops.find((s) => s.id === shopId);
}

function getTx(orderId, shopId, type) {
  return (seedRepository.getState().sellerTransactions || [])
    .find((t) => t.orderId === orderId && t.shopId === shopId && t.type === type) || null;
}

const ADMIN = { sub: "admin-001", role: "admin", name: "Admin User" };

// ── Reset before each test ────────────────────────────────────────────────────

beforeEach(() => {
  __resetSeedOrdersForTests();
  __resetSeedDriversForTests();
  seedRepository.__resetSellerTransactionsForTests();
  // Inject all test fixtures
  __injectSeedOrderForTests(BASE_ORDER);
  __injectSeedOrderForTests(ORDER_B);
  __injectSeedOrderForTests(ORDER_OTHER_DRIVER);
  __injectSeedOrderForTests(ORDER_NOT_COLLECTED);
  __injectSeedOrderForTests(ORDER_CARD);
  __injectSeedOrderForTests(ORDER_DISPUTED);
  __injectSeedOrderForTests(ORDER_CLOSED_CASE);
  __injectSeedOrderForTests(ORDER_SETTLED);
});

// ── listDriverCodSettlementCandidates ─────────────────────────────────────────

test("listDriverCodSettlementCandidates — returns COD-collected unsettled orders for driver", async () => {
  const result = await listDriverCodSettlementCandidates(DRIVER_ID);
  const ids = result.candidates.map((c) => c.orderId);
  assert.ok(ids.includes("ORD-COD-TEST-001"), "BASE_ORDER is a candidate");
  assert.ok(ids.includes("ORD-COD-TEST-002"), "ORDER_B is a candidate");
});

test("listDriverCodSettlementCandidates — includes order with closed support case", async () => {
  const result = await listDriverCodSettlementCandidates(DRIVER_ID);
  assert.ok(result.candidates.some((c) => c.orderId === "ORD-COD-TEST-006"), "closed case is eligible");
});

test("listDriverCodSettlementCandidates — excludes card orders", async () => {
  const result = await listDriverCodSettlementCandidates(DRIVER_ID);
  assert.ok(!result.candidates.some((c) => c.orderId === "ORD-CARD-TEST-001"));
});

test("listDriverCodSettlementCandidates — excludes orders with codCollected=false", async () => {
  const result = await listDriverCodSettlementCandidates(DRIVER_ID);
  assert.ok(!result.candidates.some((c) => c.orderId === "ORD-COD-TEST-004"));
});

test("listDriverCodSettlementCandidates — excludes orders assigned to another driver", async () => {
  const result = await listDriverCodSettlementCandidates(DRIVER_ID);
  assert.ok(!result.candidates.some((c) => c.orderId === "ORD-COD-TEST-003"));
});

test("listDriverCodSettlementCandidates — excludes active dispute orders", async () => {
  const result = await listDriverCodSettlementCandidates(DRIVER_ID);
  assert.ok(!result.candidates.some((c) => c.orderId === "ORD-COD-TEST-005"));
});

test("listDriverCodSettlementCandidates — excludes already-settled orders", async () => {
  const result = await listDriverCodSettlementCandidates(DRIVER_ID);
  assert.ok(!result.candidates.some((c) => c.orderId === "ORD-COD-TEST-007"));
});

test("listDriverCodSettlementCandidates — returns driver name, codBalance and totals", async () => {
  const result = await listDriverCodSettlementCandidates(DRIVER_ID);
  assert.equal(result.driverId,   DRIVER_ID);
  assert.equal(result.driverName, "Khalid Bin Hamdan");
  assert.equal(result.codBalance, 320); // seed default
  assert.ok(typeof result.totalCash === "number");
});

test("listDriverCodSettlementCandidates — throws 404 for unknown driver", async () => {
  await assert.rejects(
    () => listDriverCodSettlementCandidates("drv-does-not-exist"),
    (err) => { assert.equal(err.status, 404); return true; }
  );
});

// ── settleDriverCodOrders ─────────────────────────────────────────────────────

test("settleDriverCodOrders — settles selected orders and creates cod_credit ledger entries", async () => {
  const result = await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001"],
    adminId:  ADMIN.sub,
  });
  assert.ok(result.settlementRef.startsWith("SETTLE-"));
  assert.deepEqual(result.settledOrders, ["ORD-COD-TEST-001"]);
  assert.equal(result.totalCashAmount, 310);
  const tx = getTx("ORD-COD-TEST-001", "shop-rose-vault", "cod_credit");
  assert.ok(tx, "cod_credit transaction must exist");
  assert.equal(tx.amount, 270); // vendorNet after 40 platform fee
});

test("settleDriverCodOrders — credits seller pendingBalance (not availableBalance)", async () => {
  await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001"],
    adminId:  ADMIN.sub,
  });
  const shop = getShop("shop-rose-vault");
  assert.equal(shop.pendingBalance,   270);
  assert.equal(shop.availableBalance, 0);
  assert.equal(shop.holdBalance,      0);
  assert.equal(shop.paidBalance,      0);
});

test("settleDriverCodOrders — decrements driver codBalance by settled cash amount", async () => {
  await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001"],
    adminId:  ADMIN.sub,
  });
  const driver = __getSeedDriverForTests(DRIVER_ID);
  // 320 (seed default) - 310 (codAmount) = 10
  assert.equal(driver.codBalance, 10);
});

test("settleDriverCodOrders — marks order driverAssignment.codSettledAt", async () => {
  await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001"],
    adminId:  ADMIN.sub,
  });
  const { getSeedOrders } = await import("../orders/orders.service.js");
  const order = getSeedOrders().find((o) => o.orderId === "ORD-COD-TEST-001");
  assert.ok(order.driverAssignment.codSettledAt, "codSettledAt must be set");
  assert.equal(order.driverAssignment.codSettledBy, ADMIN.sub);
  assert.ok(order.driverAssignment.codSettlementRef.startsWith("SETTLE-"));
});

test("settleDriverCodOrders — settles multiple orders in one batch", async () => {
  const result = await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001", "ORD-COD-TEST-002"],
    adminId:  ADMIN.sub,
  });
  assert.equal(result.settledOrders.length, 2);
  assert.equal(result.totalCashAmount, 510); // 310 + 200
  const shop = getShop("shop-rose-vault");
  // order-001 vendorNet=270, order-002: 200-28=172
  assert.equal(shop.pendingBalance, 270 + 172);
  const driver = __getSeedDriverForTests(DRIVER_ID);
  // 320 - 510 = negative → floored at 0
  assert.equal(driver.codBalance, 0);
});

test("settleDriverCodOrders — driver codBalance floors at zero (no negative balance)", async () => {
  // Override codBalance to a value less than total cash
  __getSeedDriverForTests(DRIVER_ID).codBalance = 50;
  await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001"], // codAmount = 310
    adminId:  ADMIN.sub,
  });
  const driver = __getSeedDriverForTests(DRIVER_ID);
  assert.equal(driver.codBalance, 0);
});

test("settleDriverCodOrders — idempotent: retrying the same batch after settlement throws 409", async () => {
  await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001"],
    adminId:  ADMIN.sub,
  });
  await assert.rejects(
    () => settleDriverCodOrders({ driverId: DRIVER_ID, orderIds: ["ORD-COD-TEST-001"], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("settleDriverCodOrders — cod_credit is created only once even on retry (no double-credit)", async () => {
  await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001"],
    adminId:  ADMIN.sub,
  });
  // Second call throws before touching ledger — verify ledger still has exactly one entry
  try { await settleDriverCodOrders({ driverId: DRIVER_ID, orderIds: ["ORD-COD-TEST-001"], adminId: ADMIN.sub }); }
  catch { /* expected */ }
  const txList = (seedRepository.getState().sellerTransactions || [])
    .filter((t) => t.orderId === "ORD-COD-TEST-001" && t.shopId === "shop-rose-vault" && t.type === "cod_credit");
  assert.equal(txList.length, 1, "only one cod_credit must exist");
  assert.equal(getShop("shop-rose-vault").pendingBalance, 270);
});

test("settleDriverCodOrders — no double-credit if delivery_credit already exists for order", async () => {
  // Simulate a bug scenario: delivery_credit exists (shouldn't happen after Phase 1 fix).
  // The defensive guard in recordCodCredit must skip the cod_credit.
  const state = seedRepository.getState();
  state.sellerTransactions.push({
    id: "stx-pre-existing",
    shopId: "shop-rose-vault",
    orderId: "ORD-COD-TEST-001",
    type: "delivery_credit",
    amount: 270,
    note: "pre-existing from hypothetical bug",
    createdAt: new Date().toISOString(),
  });
  await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001"],
    adminId:  ADMIN.sub,
  });
  // cod_credit must NOT exist; pendingBalance must NOT be doubled.
  assert.equal(getTx("ORD-COD-TEST-001", "shop-rose-vault", "cod_credit"), null);
  // pendingBalance remains 0 (delivery_credit didn't come through balance service, just ledger)
  assert.equal(getShop("shop-rose-vault").pendingBalance, 0);
});

test("settleDriverCodOrders — fails if order not assigned to the driver (409)", async () => {
  await assert.rejects(
    () => settleDriverCodOrders({ driverId: DRIVER_ID, orderIds: ["ORD-COD-TEST-003"], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("settleDriverCodOrders — fails if order already settled (409)", async () => {
  await assert.rejects(
    () => settleDriverCodOrders({ driverId: DRIVER_ID, orderIds: ["ORD-COD-TEST-007"], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("settleDriverCodOrders — fails if order has active dispute (409)", async () => {
  await assert.rejects(
    () => settleDriverCodOrders({ driverId: DRIVER_ID, orderIds: ["ORD-COD-TEST-005"], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("settleDriverCodOrders — all-or-nothing: invalid order in batch prevents all mutations", async () => {
  // Mix a valid order with an invalid one — no order should be settled.
  await assert.rejects(
    () => settleDriverCodOrders({
      driverId: DRIVER_ID,
      orderIds: ["ORD-COD-TEST-001", "ORD-COD-TEST-007"], // 001=valid, 007=already settled
      adminId:  ADMIN.sub,
    }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
  // ORDER_COD_001 must NOT be settled
  const { getSeedOrders } = await import("../orders/orders.service.js");
  const order = getSeedOrders().find((o) => o.orderId === "ORD-COD-TEST-001");
  assert.equal(order.driverAssignment.codSettledAt, null, "order must not be marked settled");
  // No cod_credit must exist
  assert.equal(getTx("ORD-COD-TEST-001", "shop-rose-vault", "cod_credit"), null);
  // Shop balance must be untouched
  assert.equal(getShop("shop-rose-vault").pendingBalance, 0);
});

test("settleDriverCodOrders — throws 404 for unknown driver", async () => {
  await assert.rejects(
    () => settleDriverCodOrders({ driverId: "drv-unknown", orderIds: ["ORD-COD-TEST-001"], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 404); return true; }
  );
});

test("settleDriverCodOrders — throws 400 if orderIds is empty", async () => {
  await assert.rejects(
    () => settleDriverCodOrders({ driverId: DRIVER_ID, orderIds: [], adminId: ADMIN.sub }),
    (err) => { assert.equal(err.status, 400); return true; }
  );
});

test("settleDriverCodOrders — deduplicates duplicate orderIds in same batch", async () => {
  const result = await settleDriverCodOrders({
    driverId: DRIVER_ID,
    orderIds: ["ORD-COD-TEST-001", "ORD-COD-TEST-001"], // duplicate
    adminId:  ADMIN.sub,
  });
  assert.equal(result.settledOrders.length, 1);
  assert.equal(result.totalCashAmount, 310);
});
