import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionProductStatus, getAllowedProductActions } from "./productWorkflow.js";

test("seller product transitions allow submission and revision", () => {
  assert.equal(canTransitionProductStatus("Draft", "Needs approval", "seller"), true);
  assert.equal(canTransitionProductStatus("Rejected", "Draft", "seller"), true);
  assert.equal(canTransitionProductStatus("Needs approval", "Live", "seller"), false);
});

test("admin product transitions allow approval, rejection, and drafting", () => {
  assert.equal(canTransitionProductStatus("Needs approval", "Live", "admin"), true);
  assert.equal(canTransitionProductStatus("Needs approval", "Rejected", "admin"), true);
  assert.equal(canTransitionProductStatus("Live", "Draft", "admin"), true);
  assert.equal(canTransitionProductStatus("Live", "Rejected", "admin"), false);
  assert.deepEqual(getAllowedProductActions("Needs approval", "admin"), ["Live", "Rejected"]);
});
