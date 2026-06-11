import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionOrderStatus, getAllowedOrderActions } from "./orderWorkflow.js";

test("seller order transitions follow fulfillment flow", () => {
  assert.equal(canTransitionOrderStatus("Pending", "Confirmed", "seller"), true);
  assert.equal(canTransitionOrderStatus("Pending", "Delivered", "seller"), false);
  assert.equal(canTransitionOrderStatus("Delivered", "Processing", "seller"), false);
  assert.deepEqual(getAllowedOrderActions("Ready for Delivery", "seller"), []);
});

test("admin order transitions include cancellation and refund paths", () => {
  assert.equal(canTransitionOrderStatus("Pending", "Cancelled", "admin"), true);
  assert.equal(canTransitionOrderStatus("Delivered", "Refunded", "admin"), true);
  assert.equal(canTransitionOrderStatus("Cancelled", "Delivered", "admin"), false);
});

test("support order transitions are cancellation-only", () => {
  assert.equal(canTransitionOrderStatus("Pending", "Cancelled", "support"), true);
  assert.equal(canTransitionOrderStatus("Pending", "Confirmed", "support"), false);
});
