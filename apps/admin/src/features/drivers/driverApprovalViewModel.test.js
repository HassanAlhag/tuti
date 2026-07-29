import test from "node:test";
import assert from "node:assert/strict";

import {
  formatAccessStatus,
  formatDriverAccountStatus,
  getPendingApprovalCount,
  getPendingApprovalKey,
  isPendingDriverApproval,
} from "./driverApprovalViewModel.js";

test("pending approval view model keys rows by accessId and counts accessStatus", () => {
  const requests = [
    { accessId: "dsa-1", accessStatus: "pending_admin_approval", driverStatus: "active" },
    { accessId: "dsa-2", accessStatus: "active", driverStatus: "active" },
    { id: "dsa-3", status: "pending_admin_approval", driverStatus: "inactive" },
  ];

  assert.equal(getPendingApprovalKey(requests[0]), "dsa-1");
  assert.equal(getPendingApprovalKey(requests[2]), "dsa-3");
  assert.equal(getPendingApprovalCount(requests), 2);
  assert.equal(isPendingDriverApproval(requests[0]), true);
  assert.equal(isPendingDriverApproval(requests[1]), false);
});

test("pending approval labels keep access status and driver account status separate", () => {
  assert.equal(formatAccessStatus("pending_admin_approval"), "Pending approval");
  assert.equal(formatDriverAccountStatus("active"), "Active");
  assert.equal(formatDriverAccountStatus("inactive"), "Inactive");
});
