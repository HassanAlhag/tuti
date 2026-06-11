import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const { reverseOrderCommissions } = await import("./commissionReversal.js");
const {
  finalizeResolutionDecision,
  updateOrderStatus,
  __injectSeedOrderForTests,
  __resetSeedOrdersForTests,
} = await import("../orders/orders.service.js");

const ADMIN = { sub: "admin-001", role: "admin", name: "Admin User" };
const SUPPORT = { sub: "support-001", role: "support", name: "Support User" };

function setCommissionEntries(entries) {
  seedRepository.getState().commissionEntries = structuredClone(entries);
}

function getCommissionEntries() {
  return seedRepository.getState().commissionEntries || [];
}

beforeEach(() => {
  __resetSeedOrdersForTests();
  seedRepository.getState().commissionEntries = [];
});

test("reverseOrderCommissions — reverses pending and confirmed entries for cancelled orders", async () => {
  setCommissionEntries([
    { id: "com-1", orderId: "ORD-REV-001", status: "Pending", amount: 10, shopId: "shop-rose-vault" },
    { id: "com-2", orderId: "ORD-REV-001", status: "Confirmed", amount: 20, shopId: "shop-rose-vault" },
    { id: "com-3", orderId: "ORD-REV-001", status: "Paid", amount: 30, shopId: "shop-rose-vault" },
    { id: "com-4", orderId: "ORD-REV-001", status: "Reversed", amount: 40, shopId: "shop-rose-vault" },
    { id: "com-5", orderId: "ORD-REV-OTHER", status: "Pending", amount: 50, shopId: "shop-rose-vault" },
  ]);

  const result = await reverseOrderCommissions({ orderId: "ORD-REV-001", status: "Cancelled" }, { reason: "Order cancelled" });
  assert.equal(result.reversed, 2);

  const entries = getCommissionEntries();
  assert.equal(entries.find((item) => item.id === "com-1").status, "Reversed");
  assert.equal(entries.find((item) => item.id === "com-2").status, "Reversed");
  assert.equal(entries.find((item) => item.id === "com-3").status, "Paid");
  assert.equal(entries.find((item) => item.id === "com-4").status, "Reversed");
  assert.equal(entries.find((item) => item.id === "com-5").status, "Pending");
  assert.equal(entries.find((item) => item.id === "com-1").reversedReason, "Order cancelled");
  assert.equal(entries.find((item) => item.id === "com-1").reversedOrderStatus, "Cancelled");
  assert.ok(entries.find((item) => item.id === "com-1").reversedAt);
});

test("reverseOrderCommissions — idempotent and no-op when nothing is reversible", async () => {
  setCommissionEntries([
    { id: "com-6", orderId: "ORD-REV-002", status: "Reversed", amount: 55, shopId: "shop-rose-vault" },
    { id: "com-7", orderId: "ORD-REV-002", status: "Paid", amount: 65, shopId: "shop-rose-vault" },
  ]);

  const first = await reverseOrderCommissions({ orderId: "ORD-REV-002", status: "Refunded" }, { reason: "Refund issued" });
  const second = await reverseOrderCommissions({ orderId: "ORD-REV-002", status: "Refunded" }, { reason: "Refund issued" });

  assert.equal(first.reversed, 0);
  assert.equal(second.reversed, 0);
  assert.equal(getCommissionEntries().find((item) => item.id === "com-6").status, "Reversed");
  assert.equal(getCommissionEntries().find((item) => item.id === "com-7").status, "Paid");
});

test("updateOrderStatus — cancelling an order triggers commission reversal", async () => {
  __injectSeedOrderForTests({
    orderId: "ORD-REV-100",
    status: "Processing",
    shopIds: ["shop-rose-vault"],
    customerId: "cus-001",
    items: [{ shopId: "shop-rose-vault", price: 100, quantity: 1 }],
    paymentStatus: "Authorization",
  });
  setCommissionEntries([
    { id: "com-8", orderId: "ORD-REV-100", status: "Pending", amount: 25, shopId: "shop-rose-vault" },
  ]);

  const updated = await updateOrderStatus("ORD-REV-100", "Cancelled", ADMIN, "Shop cancelled");
  assert.equal(updated.status, "Cancelled");
  assert.equal(getCommissionEntries().find((item) => item.id === "com-8").status, "Reversed");
});

test("finalizeResolutionDecision — cancellation finalization reverses commissions", async () => {
  __injectSeedOrderForTests({
    orderId: "ORD-REV-200",
    status: "Delivered",
    shopIds: ["shop-rose-vault"],
    customerId: "cus-001",
    items: [{ shopId: "shop-rose-vault", price: 100, quantity: 1 }],
    paymentStatus: "Dispute hold",
    supportCase: { kind: "dispute", status: "open" },
    resolutionDecision: {
      status: "decided",
      liability: "seller",
      refundDecision: "none",
      payoutDecision: "hold",
      orderDecision: "cancel_order",
      codResolution: "no_refund_due",
      decisionNote: "Order cancelled during dispute review.",
    },
  });
  setCommissionEntries([
    { id: "com-9", orderId: "ORD-REV-200", status: "Confirmed", amount: 35, shopId: "shop-rose-vault" },
  ]);

  const finalized = await finalizeResolutionDecision("ORD-REV-200", ADMIN);
  assert.equal(finalized.status, "Cancelled");
  assert.equal(getCommissionEntries().find((item) => item.id === "com-9").status, "Reversed");
});
