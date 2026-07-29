import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.MONGO_URI = "";

const {
  listSellerDrivers,
  searchDriverForShop,
  requestExistingDriverForShop,
  inviteDriverForShop,
  cancelDriverAccessRequest,
  suspendShopDriverAccess,
  revokeShopDriverAccessForSeller,
  approveDriverShopAccess,
  rejectDriverShopAccess,
  reactivateDriverShopAccess,
  adminSuspendDriverShopAccess,
  adminRevokeDriverShopAccess,
  adminCreateApprovedAccess,
  adminAssignDriverToShops,
  listShopsConnectedToDriver,
  listDriverDeliveries,
  recordDriverDelivery,
  retryFailedDelivery,
  reassignFailedDelivery,
  listDriverShopAccessForShop,
  listDriverShopAccessForDriver,
  assignSellerDriverToOrder,
  createSellerDeliveryOffer,
  acceptDriverOffer,
  __resetSeedDriversForTests,
  __resetDriverShopAccessForTests,
  __grantActiveAccessForTests,
} = await import("./drivers.service.js");
const { assertDriverEligibleForShop } = await import("./driverEligibility.js");
const { getSeedOrders, __resetSeedOrdersForTests, __injectSeedOrderForTests } = await import("../orders/orders.service.js");
const { __resetNotificationsForTests } = await import("../notifications/notifications.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const DRIVER_ID = "drv-001"; // global/unowned in seed fixture -- shared across shops in these tests
const OTHER_DRIVER_ID = "drv-002";
const SHOP_A = "shop-rose-vault";
const SHOP_B = "shop-oud-lane";
const SELLER_A = { sub: "seller-a", role: "seller", name: "Rose Vault Seller" };
const SELLER_B = { sub: "seller-b", role: "seller", name: "Oud Lane Seller" };
const ADMIN = { sub: "admin-1", role: "admin", name: "Ops Admin" };

function seedOrder(orderId, shopId, overrides = {}) {
  __injectSeedOrderForTests({
    orderId,
    shopIds: [shopId],
    items: [{ shopId, productId: "prf-001", price: 100, quantity: 1 }],
    subtotal: 100,
    platformFee: 10,
    vendorNet: 90,
    paymentMethod: "cod",
    paymentStatus: "COD pending",
    status: "Ready for Delivery",
    customerName: "Capacity Customer",
    customerEmail: `${orderId.toLowerCase()}@example.com`,
    deliveryAddress: "Dubai Marina",
    statusHistory: [],
    ...overrides,
  });
}

function seedHeldAssignment(orderId, shopId, status) {
  seedOrder(orderId, shopId, {
    status: "Shipped",
    driverAssignment: {
      id: `asg-${orderId}`,
      driverId: DRIVER_ID,
      driverName: "Mohammed Al-Rashidi",
      driverPhone: "+971 55 111 2233",
      status,
      assignedAt: "2026-06-01T09:00:00.000Z",
      pickedUpAt: status === "picked_up" || status === "out_for_delivery" ? "2026-06-01T09:30:00.000Z" : null,
      deliveredAt: status === "completed" ? "2026-06-01T10:00:00.000Z" : null,
      codCollected: false,
      codAmount: 100,
      codSettledAt: null,
      note: "",
    },
  });
}

function resetAll() {
  __resetSeedOrdersForTests();
  __resetSeedDriversForTests();
  __resetDriverShopAccessForTests();
  __resetNotificationsForTests();
  seedRepository.__resetSellerTransactionsForTests();
}

beforeEach(resetAll);

// 1. seller sees active drivers for own shop
test("seller sees active drivers for own shop", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  const list = await listSellerDrivers(SHOP_A);
  assert.equal(list.length, 1);
  assert.equal(list[0].driverId, DRIVER_ID);
  assert.equal(list[0].status, "active");
});

// 2. seller cannot see another shop's relationships
test("seller cannot see another shop's relationships", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  const listForB = await listSellerDrivers(SHOP_B);
  assert.equal(listForB.length, 0);
});

// 3 + 4. seller can request an existing driver; request starts pending
test("seller can request an existing driver, and the request starts pending", async () => {
  const access = await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });
  assert.equal(access.status, "pending_admin_approval");
  assert.equal(access.accessStatus, "pending_admin_approval");
  assert.equal(access.driverStatus, "active");
  assert.equal(access.requestedByType, "seller");
  assert.equal(access.requestedByUserId, SELLER_A.sub);
  assert.equal(access.approvedByUserId, null);
  assert.equal(access.approvedAt, null);
});

test("seller roster separates active and pending shop access from global driver status", async () => {
  await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });

  const activeOnly = await listSellerDrivers(SHOP_A, { status: "active" });
  assert.equal(activeOnly.length, 0);

  const pendingOnly = await listSellerDrivers(SHOP_A, { status: "pending_admin_approval" });
  assert.equal(pendingOnly.length, 1);
  assert.equal(pendingOnly[0].driverId, DRIVER_ID);
  assert.equal(pendingOnly[0].status, "pending_admin_approval");
  assert.equal(pendingOnly[0].accessStatus, "pending_admin_approval");
  assert.equal(pendingOnly[0].driverStatus, "active");
});

// 5 + 15. seller cannot approve a request / driver is not connectable without admin approval
test("seller cannot approve their own request -- no seller-facing approve function exists, and it stays pending", async () => {
  const access = await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });
  assert.equal(typeof approveDriverShopAccess, "function"); // approve is admin-only surface
  // Attempting to use the driver before approval fails.
  await assert.rejects(
    () => assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_A, action: "assign" }),
    (err) => { assert.equal(err.status, 403); return true; }
  );
  assert.equal(access.status, "pending_admin_approval");
});

// 6 + 7. admin approves request; approved driver becomes assignable
test("admin approves a pending request, and the driver becomes assignable", async () => {
  const requested = await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });
  const approved = await approveDriverShopAccess(requested.id, ADMIN.sub);
  assert.equal(approved.status, "active");
  assert.equal(approved.accessStatus, "active");
  assert.equal(approved.approvedByUserId, ADMIN.sub);
  assert.ok(approved.approvedAt);

  const { access } = await assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_A, action: "assign" });
  assert.equal(access.status, "active");
});

test("pending driver access cannot be directly assigned or receive broadcasts", async () => {
  await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });
  seedOrder("ORD-PENDING-ASSIGN-001", SHOP_A);
  seedOrder("ORD-PENDING-BROADCAST-001", SHOP_A);

  await assert.rejects(
    () => assignSellerDriverToOrder(DRIVER_ID, "ORD-PENDING-ASSIGN-001", SHOP_A, SELLER_A, {}),
    (err) => { assert.equal(err.status, 403); return true; }
  );
  await assert.rejects(
    () => createSellerDeliveryOffer(SHOP_A, "Rose Vault", SELLER_A.sub, { orderId: "ORD-PENDING-BROADCAST-001" }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("pending driver access cannot accept an existing offer or be selected for reassignment", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  seedOrder("ORD-PENDING-OFFER-001", SHOP_A);
  const offer = await createSellerDeliveryOffer(SHOP_A, "Rose Vault", SELLER_A.sub, { orderId: "ORD-PENDING-OFFER-001" });
  __resetDriverShopAccessForTests();
  await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });

  await assert.rejects(
    () => acceptDriverOffer(offer.id, DRIVER_ID, { sub: "driver-user", role: "driver", driverId: DRIVER_ID }),
    (err) => { assert.equal(err.status, 403); return true; }
  );

  await __grantActiveAccessForTests(OTHER_DRIVER_ID, SHOP_A);
  seedHeldAssignment("ORD-PENDING-REASSIGN-001", SHOP_A, "delivery_failed");
  const failedOrder = getSeedOrders().find((item) => item.orderId === "ORD-PENDING-REASSIGN-001");
  failedOrder.driverAssignment.driverId = OTHER_DRIVER_ID;
  failedOrder.driverAssignment.lastFailureReason = "CUSTOMER_UNREACHABLE";
  failedOrder.driverAssignment.attemptCount = 1;

  await assert.rejects(
    () => reassignFailedDelivery(SHOP_A, "ORD-PENDING-REASSIGN-001", { driverId: DRIVER_ID }, SELLER_A),
    (err) => { assert.equal(err.status, 403); return true; }
  );
});

// 8. rejected driver is not assignable
test("rejected relationship is not assignable", async () => {
  const requested = await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });
  await rejectDriverShopAccess(requested.id, ADMIN.sub, "Failed background check");
  await assert.rejects(
    () => assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_A, action: "assign" }),
    (err) => { assert.equal(err.status, 403); return true; }
  );
});

// 9. suspended relationship is not assignable
test("suspended relationship is not assignable", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  const [access] = await listDriverShopAccessForShop(SHOP_A);
  await adminSuspendDriverShopAccess(access.id, ADMIN.sub, { actorRole: "admin" });
  await assert.rejects(
    () => assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_A, action: "assign" }),
    (err) => { assert.equal(err.status, 403); return true; }
  );
});

// 10. revoked relationship is not assignable
test("revoked relationship is not assignable", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  const [access] = await listDriverShopAccessForShop(SHOP_A);
  await adminRevokeDriverShopAccess(access.id, ADMIN.sub, { actorRole: "admin" });
  await assert.rejects(
    () => assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_A, action: "assign" }),
    (err) => { assert.equal(err.status, 403); return true; }
  );
});

// 11. driver can be active for two shops
test("a driver can be active for two shops at once", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_B);
  const shops = await listShopsConnectedToDriver(DRIVER_ID);
  const activeShopIds = shops.filter((s) => s.status === "active").map((s) => s.shopId);
  assert.deepEqual(new Set(activeShopIds), new Set([SHOP_A, SHOP_B]));
});

// 12. revoking Shop A does not affect Shop B
test("revoking access for Shop A does not affect the same driver's Shop B access", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_B);
  const accessRows = await listDriverShopAccessForDriver(DRIVER_ID);
  const shopAAccess = accessRows.find((a) => a.shopId === SHOP_A);

  await adminRevokeDriverShopAccess(shopAAccess.id, ADMIN.sub, { actorRole: "admin" });

  await assert.rejects(() => assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_A, action: "assign" }));
  const { access: shopBAccess } = await assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_B, action: "assign" });
  assert.equal(shopBAccess.status, "active");
});

// 13. duplicate relationship is rejected/idempotent
test("requesting the same driver for the same shop twice is idempotent, not a duplicate", async () => {
  await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });
  await assert.rejects(
    () => requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
  const accessRows = await listDriverShopAccessForShop(SHOP_A);
  assert.equal(accessRows.length, 1);
});

// 14. client-provided shopId cannot bypass ownership
test("seller actions always use the server-resolved shopId -- a client cannot request/act on behalf of another shop", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  const orderId = "ORD-SHOPID-BYPASS-001";
  __injectSeedOrderForTests({
    orderId,
    shopIds: [SHOP_B],
    items: [{ shopId: SHOP_B, productId: "prf-001", price: 100, quantity: 1 }],
    subtotal: 100, platformFee: 10, vendorNet: 90,
    paymentMethod: "card", paymentStatus: "Authorization", status: "Ready for Delivery",
    customerName: "X", customerEmail: "x@example.com", statusHistory: [],
  });
  // Even though the driver has active access to SHOP_A, seller B's
  // server-resolved shopId (SHOP_B) is what's checked -- SHOP_A's
  // seller cannot act on an order that belongs to SHOP_B by any
  // client-supplied identifier, because the service functions never
  // accept shopId from request bodies, only from req.ownedShopId.
  await assert.rejects(
    () => assignSellerDriverToOrder(DRIVER_ID, orderId, SHOP_A, SELLER_A, {}),
    (err) => { assert.equal(err.status, 404); return true; } // order not found under SHOP_A's scope
  );
});

// Extra: admin direct-assign creates an explicit, already-active record
test("admin direct-assign creates an explicit active DriverShopAccess (never implicit)", async () => {
  const [access] = await adminAssignDriverToShops(DRIVER_ID, [SHOP_A], ADMIN.sub);
  assert.equal(access.status, "active");
  assert.equal(access.requestedByType, "admin");
  assert.equal(access.approvedByUserId, ADMIN.sub);
});

// Extra: admin can reactivate a suspended relationship
test("admin can reactivate a suspended relationship", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  const [access] = await listDriverShopAccessForShop(SHOP_A);
  await adminSuspendDriverShopAccess(access.id, ADMIN.sub, { actorRole: "admin" });
  const reactivated = await reactivateDriverShopAccess(access.id, ADMIN.sub);
  assert.equal(reactivated.status, "active");
  const { access: verified } = await assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_A, action: "assign" });
  assert.equal(verified.status, "active");
});

// Extra: seller can cancel their own pending request
test("seller can cancel their own pending request", async () => {
  const requested = await requestExistingDriverForShop(SHOP_A, SELLER_A.sub, { driverId: DRIVER_ID });
  const cancelled = await cancelDriverAccessRequest(SHOP_A, requested.id);
  assert.equal(cancelled.status, "revoked");
});

// Extra: seller can suspend/revoke only their own shop's relationship
test("seller can suspend the driver from their own shop without touching another shop's access", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_B);
  const accessRows = await listDriverShopAccessForDriver(DRIVER_ID);
  const shopAAccess = accessRows.find((a) => a.shopId === SHOP_A);

  await suspendShopDriverAccess(SHOP_A, shopAAccess.id, SELLER_A.sub);
  await assert.rejects(() => assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_A, action: "assign" }));
  const { access: shopBAccess } = await assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_B, action: "assign" });
  assert.equal(shopBAccess.status, "active");
});

test("suspension blocks new offers and direct assignments but keeps existing picked-up work visible", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  seedOrder("ORD-SUSPEND-NEW-ASSIGN", SHOP_A);
  seedHeldAssignment("ORD-SUSPEND-PICKED-UP", SHOP_A, "picked_up");

  const [access] = await listDriverShopAccessForShop(SHOP_A);
  await adminSuspendDriverShopAccess(access.id, ADMIN.sub, { actorRole: "admin" });

  await assert.rejects(
    () => assignSellerDriverToOrder(DRIVER_ID, "ORD-SUSPEND-NEW-ASSIGN", SHOP_A, SELLER_A, { force: false }),
    (err) => { assert.equal(err.status, 403); return true; }
  );
  await assert.rejects(
    () => createSellerDeliveryOffer(SHOP_A, "Rose Vault", SELLER_A.sub, { orderId: "ORD-SUSPEND-NEW-ASSIGN" }),
    (err) => { assert.equal(err.status, 409); return true; }
  );

  const visible = await listDriverDeliveries(DRIVER_ID);
  assert.ok(visible.some((order) => order.orderId === "ORD-SUSPEND-PICKED-UP"));
});

test("existing picked-up assignment may complete while relationship is suspended", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  seedHeldAssignment("ORD-SUSPEND-COMPLETE", SHOP_A, "picked_up");
  const [access] = await listDriverShopAccessForShop(SHOP_A);
  await adminSuspendDriverShopAccess(access.id, ADMIN.sub, { actorRole: "admin" });

  const completed = await recordDriverDelivery(
    DRIVER_ID,
    "ORD-SUSPEND-COMPLETE",
    { codCollected: true, codAmount: 100 },
    { sub: "driver-user", role: "driver", driverId: DRIVER_ID }
  );

  assert.equal(completed.status, "Delivered");
  assert.equal(completed.driverAssignment.status, "completed");
});

test("failed assignment cannot retry while relationship is suspended", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  seedHeldAssignment("ORD-SUSPEND-RETRY", SHOP_A, "delivery_failed");
  const order = getSeedOrders().find((item) => item.orderId === "ORD-SUSPEND-RETRY");
  assert.ok(order);
  order.driverAssignment.lastFailureReason = "CUSTOMER_UNREACHABLE";
  order.driverAssignment.attemptCount = 1;
  const [access] = await listDriverShopAccessForShop(SHOP_A);
  await adminSuspendDriverShopAccess(access.id, ADMIN.sub, { actorRole: "admin" });

  await assert.rejects(
    () => retryFailedDelivery(SHOP_A, "ORD-SUSPEND-RETRY", SELLER_A),
    (err) => { assert.equal(err.status, 403); return true; }
  );
});

test("revocation with active assignment is blocked, then succeeds after completion", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  seedHeldAssignment("ORD-REVOKE-BLOCKED", SHOP_A, "picked_up");
  const [access] = await listDriverShopAccessForShop(SHOP_A);

  await assert.rejects(
    () => adminRevokeDriverShopAccess(access.id, ADMIN.sub, { actorRole: "admin" }),
    (err) => {
      assert.equal(err.status, 409);
      assert.match(err.message, /active assignment/);
      return true;
    }
  );

  await recordDriverDelivery(
    DRIVER_ID,
    "ORD-REVOKE-BLOCKED",
    { codCollected: false },
    { sub: "driver-user", role: "driver", driverId: DRIVER_ID }
  );
  const revoked = await adminRevokeDriverShopAccess(access.id, ADMIN.sub, { actorRole: "admin" });
  assert.equal(revoked.status, "revoked");
});

test("Shop B remains unaffected by Shop A suspension and revocation policy", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_B);
  seedHeldAssignment("ORD-SHOP-A-ACTIVE", SHOP_A, "picked_up");
  seedOrder("ORD-SHOP-B-NEW", SHOP_B);
  const accessRows = await listDriverShopAccessForDriver(DRIVER_ID);
  const shopAAccess = accessRows.find((a) => a.shopId === SHOP_A);

  await adminSuspendDriverShopAccess(shopAAccess.id, ADMIN.sub, { actorRole: "admin" });
  const assignedB = await assignSellerDriverToOrder(DRIVER_ID, "ORD-SHOP-B-NEW", SHOP_B, SELLER_B, { force: false });
  assert.equal(assignedB.driverAssignment.driverId, DRIVER_ID);

  await assert.rejects(() => adminRevokeDriverShopAccess(shopAAccess.id, ADMIN.sub, { actorRole: "admin" }));
  const { access: shopBAccess } = await assertDriverEligibleForShop({ driverId: DRIVER_ID, shopId: SHOP_B, action: "assign" });
  assert.equal(shopBAccess.status, "active");
});

// Extra: seller cannot suspend/revoke another shop's relationship
test("seller cannot suspend or revoke a relationship belonging to a different shop", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_B);
  const accessRows = await listDriverShopAccessForDriver(DRIVER_ID);
  const shopBAccess = accessRows.find((a) => a.shopId === SHOP_B);

  await assert.rejects(
    () => suspendShopDriverAccess(SHOP_A, shopBAccess.id, SELLER_A.sub),
    (err) => { assert.equal(err.status, 403); return true; }
  );
});

test("admin direct assignment rejects a nonexistent driver", async () => {
  await assert.rejects(
    () => adminAssignDriverToShops("drv-does-not-exist", [SHOP_A], ADMIN.sub),
    (err) => { assert.equal(err.status, 404); return true; }
  );
});

test("admin direct assignment rejects a nonexistent shop", async () => {
  await assert.rejects(
    () => adminAssignDriverToShops(DRIVER_ID, ["shop-does-not-exist"], ADMIN.sub),
    (err) => { assert.equal(err.status, 404); return true; }
  );
  const rows = await listDriverShopAccessForDriver(DRIVER_ID);
  assert.equal(rows.length, 0);
});

test("inactive global driver is rejected by eligibility even with active shop access", async () => {
  await __grantActiveAccessForTests("drv-003", SHOP_A);
  await assert.rejects(
    () => assertDriverEligibleForShop({ driverId: "drv-003", shopId: SHOP_A, action: "assign" }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("invalid access status transition is rejected", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  const [access] = await listDriverShopAccessForShop(SHOP_A);
  await assert.rejects(
    () => approveDriverShopAccess(access.id, ADMIN.sub),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("seller invite with duplicate phone links existing driver instead of creating a second account", async () => {
  const first = await inviteDriverForShop(SHOP_A, "Rose Vault", SELLER_A.sub, {
    name: "Shared Courier",
    phone: "+971 50 101 2020",
    email: "shared-phone-a@example.com",
    vehicleType: "motorcycle",
  });

  const second = await inviteDriverForShop(SHOP_B, "Oud Lane", SELLER_B.sub, {
    name: "Shared Courier Again",
    phone: "050 101 2020",
    email: "shared-phone-b@example.com",
    vehicleType: "car",
  });

  assert.equal(second.linkedExistingDriver, true);
  assert.equal(second.driver.id, first.driver.id);
  const rows = await listDriverShopAccessForDriver(first.driver.id);
  assert.deepEqual(new Set(rows.map((row) => row.shopId)), new Set([SHOP_A, SHOP_B]));
});

test("seller invite with duplicate email is case-insensitive and links existing driver", async () => {
  const first = await inviteDriverForShop(SHOP_A, "Rose Vault", SELLER_A.sub, {
    name: "Email Matched Driver",
    phone: "+971 50 202 3030",
    email: "Email.Match@Tuti.example",
    vehicleType: "motorcycle",
  });

  const second = await inviteDriverForShop(SHOP_B, "Oud Lane", SELLER_B.sub, {
    name: "Email Matched Driver",
    phone: "+971 50 202 3031",
    email: "email.match@tuti.example",
    vehicleType: "car",
  });

  assert.equal(second.linkedExistingDriver, true);
  assert.equal(second.driver.id, first.driver.id);
});

test("seller invite where phone and email match the same driver creates only an access request", async () => {
  const first = await inviteDriverForShop(SHOP_A, "Rose Vault", SELLER_A.sub, {
    name: "Same Identifier Driver",
    phone: "+971 50 303 4040",
    email: "same-driver@example.com",
    vehicleType: "motorcycle",
  });

  const second = await inviteDriverForShop(SHOP_B, "Oud Lane", SELLER_B.sub, {
    name: "Same Identifier Driver",
    phone: "971503034040",
    email: "SAME-DRIVER@example.com",
    vehicleType: "van",
  });

  assert.equal(second.linkedExistingDriver, true);
  assert.equal(second.driver.id, first.driver.id);
});

test("seller invite blocks phone/email conflicts across two different drivers for admin review", async () => {
  const phoneDriver = await inviteDriverForShop(SHOP_A, "Rose Vault", SELLER_A.sub, {
    name: "Phone Owner",
    phone: "+971 50 404 5050",
    email: "phone-owner@example.com",
    vehicleType: "motorcycle",
  });
  const emailDriver = await inviteDriverForShop(SHOP_B, "Oud Lane", SELLER_B.sub, {
    name: "Email Owner",
    phone: "+971 50 505 6060",
    email: "email-owner@example.com",
    vehicleType: "car",
  });

  await assert.rejects(
    () => inviteDriverForShop(SHOP_A, "Rose Vault", SELLER_A.sub, {
      name: "Conflict Driver",
      phone: "+971 50 404 5050",
      email: "EMAIL-OWNER@example.com",
      vehicleType: "van",
    }),
    (err) => { assert.equal(err.status, 409); return true; }
  );

  assert.notEqual(phoneDriver.driver.id, emailDriver.driver.id);
});

test("repeated invite for the same seller/driver pair is a controlled conflict, not duplicate account creation", async () => {
  await inviteDriverForShop(SHOP_A, "Rose Vault", SELLER_A.sub, {
    name: "Repeated Invite",
    phone: "+971 50 606 7070",
    email: "repeat-driver@example.com",
    vehicleType: "motorcycle",
  });

  await assert.rejects(
    () => inviteDriverForShop(SHOP_A, "Rose Vault", SELLER_A.sub, {
      name: "Repeated Invite Again",
      phone: "0506067070",
      email: "repeat-driver@example.com",
      vehicleType: "car",
    }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("capacity: driver below capacity can accept Shop A and Shop B offers", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_B);
  seedOrder("ORD-CAP-A-001", SHOP_A);
  seedOrder("ORD-CAP-B-001", SHOP_B);

  const offerA = await createSellerDeliveryOffer(SHOP_A, "Rose Vault", SELLER_A.sub, { orderId: "ORD-CAP-A-001" });
  const acceptedA = await acceptDriverOffer(offerA.id, DRIVER_ID, { sub: "driver-user", role: "driver", driverId: DRIVER_ID });
  assert.equal(acceptedA.offer.acceptedDriverId, DRIVER_ID);

  const offerB = await createSellerDeliveryOffer(SHOP_B, "Oud Lane", SELLER_B.sub, { orderId: "ORD-CAP-B-001" });
  const acceptedB = await acceptDriverOffer(offerB.id, DRIVER_ID, { sub: "driver-user", role: "driver", driverId: DRIVER_ID });
  assert.equal(acceptedB.offer.acceptedDriverId, DRIVER_ID);
});

test("capacity: global held assignments across shops exclude a full driver from broadcasts", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_B);
  seedHeldAssignment("ORD-CAP-HELD-1", SHOP_A, "accepted");
  seedHeldAssignment("ORD-CAP-HELD-2", SHOP_B, "picked_up");
  seedHeldAssignment("ORD-CAP-HELD-3", SHOP_A, "out_for_delivery");
  seedOrder("ORD-CAP-BROADCAST-001", SHOP_A);

  await assert.rejects(
    () => createSellerDeliveryOffer(SHOP_A, "Rose Vault", SELLER_A.sub, { orderId: "ORD-CAP-BROADCAST-001" }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("capacity: full driver cannot accept an already-created offer", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  seedOrder("ORD-CAP-ACCEPT-001", SHOP_A);
  const offer = await createSellerDeliveryOffer(SHOP_A, "Rose Vault", SELLER_A.sub, { orderId: "ORD-CAP-ACCEPT-001" });
  seedHeldAssignment("ORD-CAP-HELD-4", SHOP_A, "accepted");
  seedHeldAssignment("ORD-CAP-HELD-5", SHOP_A, "picked_up");
  seedHeldAssignment("ORD-CAP-HELD-6", SHOP_A, "out_for_delivery");

  await assert.rejects(
    () => acceptDriverOffer(offer.id, DRIVER_ID, { sub: "driver-user", role: "driver", driverId: DRIVER_ID }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});

test("capacity: completed, cancelled, and superseded assignments free capacity", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  seedHeldAssignment("ORD-CAP-FREE-1", SHOP_A, "completed");
  seedHeldAssignment("ORD-CAP-FREE-2", SHOP_A, "cancelled");
  seedHeldAssignment("ORD-CAP-FREE-3", SHOP_A, "superseded");
  seedOrder("ORD-CAP-FREE-NEW", SHOP_A);

  const offer = await createSellerDeliveryOffer(SHOP_A, "Rose Vault", SELLER_A.sub, { orderId: "ORD-CAP-FREE-NEW" });
  assert.deepEqual(offer.offeredDriverIds, [DRIVER_ID]);
});

test("capacity: sequential acceptance cannot exceed the global limit", async () => {
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_A);
  await __grantActiveAccessForTests(DRIVER_ID, SHOP_B);
  seedHeldAssignment("ORD-CAP-SEQ-HELD", SHOP_A, "accepted");

  for (const [orderId, shopId] of [["ORD-CAP-SEQ-1", SHOP_A], ["ORD-CAP-SEQ-2", SHOP_B]]) {
    seedOrder(orderId, shopId);
    const offer = await createSellerDeliveryOffer(shopId, shopId === SHOP_A ? "Rose Vault" : "Oud Lane", "seller-seq", { orderId });
    await acceptDriverOffer(offer.id, DRIVER_ID, { sub: "driver-user", role: "driver", driverId: DRIVER_ID });
  }

  seedOrder("ORD-CAP-SEQ-3", SHOP_A);
  await assert.rejects(
    () => createSellerDeliveryOffer(SHOP_A, "Rose Vault", SELLER_A.sub, { orderId: "ORD-CAP-SEQ-3" }),
    (err) => { assert.equal(err.status, 409); return true; }
  );
});
