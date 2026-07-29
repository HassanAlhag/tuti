import test from "node:test";
import assert from "node:assert/strict";

import {
  driverStatusTone,
  formatDriverStatus,
  isSellerDriverActive,
} from "./driverAccessViewModel.js";

test("seller driver view model treats pending shop access as pending even when account is active", () => {
  const driver = {
    driverId: "drv-001",
    accessStatus: "pending_admin_approval",
    driverStatus: "active",
    isActive: true,
  };

  assert.equal(isSellerDriverActive(driver), false);
  assert.equal(formatDriverStatus(driver.accessStatus), "Pending approval");
  assert.equal(driverStatusTone(driver), "amber");
});

test("seller driver view model requires active shop access and active global account", () => {
  assert.equal(isSellerDriverActive({ accessStatus: "active", driverStatus: "active", isActive: true }), true);
  assert.equal(isSellerDriverActive({ accessStatus: "active", driverStatus: "inactive", isActive: true }), false);
  assert.equal(isSellerDriverActive({ accessStatus: "suspended", driverStatus: "active", isActive: true }), false);
});
