import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

// Force seed mode for driver delivery tests. The production NODE_ENV avoids
// the optional pino-pretty dev transport when auth/email dependencies import.
process.env.NODE_ENV = "production";
process.env.MONGO_URI = "";

const {
  confirmDriverPickup,
  createSellerDriver,
  getDriverDelivery,
  recordSellerDriverDelivery,
  recordDriverDelivery,
  __getSeedDriverForTests,
  __resetSeedDriversForTests,
} = await import("./drivers.service.js");
const {
  getSeedOrders,
  __injectSeedOrderForTests,
  __resetSeedOrdersForTests,
} = await import("../orders/orders.service.js");
const { Order } = await import("../../models/Order.js");
const { __resetNotificationsForTests } = await import("../notifications/notifications.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const DRIVER_ID = "drv-002";
const ORDER_ID = "ORD-DRV-DELIVERY-001";
const SHOP_ID = "shop-rose-vault";
const PROOF_URL = "https://cdn.tuti.test/proof/order-delivered.jpg";

const assignedCodOrder = {
  orderId: ORDER_ID,
  shopIds: [SHOP_ID],
  items: [{ shopId: SHOP_ID, productId: "prf-002", price: 310, quantity: 1 }],
  subtotal: 310,
  platformFee: 40,
  vendorNet: 270,
  paymentMethod: "cod",
  paymentStatus: "COD pending",
  status: "Shipped",
  customerName: "Driver Test Customer",
  customerEmail: "driver-test@example.com",
  phone: "+971501234567",
  deliveryAddress: "Dubai Marina",
  statusHistory: [],
  driverAssignment: {
    driverId: DRIVER_ID,
    driverName: "Khalid Bin Hamdan",
    driverPhone: "+971 50 987 6543",
    assignedAt: "2026-06-01T09:00:00.000Z",
    pickedUpAt: "2026-06-01T09:30:00.000Z",
    deliveredAt: null,
    codCollected: false,
    codAmount: 310,
    codSettledAt: null,
    codSettledBy: null,
    codSettlementRef: null,
    note: "",
  },
};

function resetAll() {
  __resetSeedOrdersForTests();
  __resetSeedDriversForTests();
  __resetNotificationsForTests();
  seedRepository.__resetSellerTransactionsForTests();
}

function seedAssignedOrder(overrides = {}) {
  const order = structuredClone({
    ...assignedCodOrder,
    ...overrides,
    driverAssignment: {
      ...assignedCodOrder.driverAssignment,
      ...(overrides.driverAssignment || {}),
    },
  });
  __injectSeedOrderForTests(order);
  const driver = __getSeedDriverForTests(DRIVER_ID);
  driver.status = "on_delivery";
  return order;
}

function getOrder(orderId = ORDER_ID) {
  const order = getSeedOrders().find((item) => item.orderId === orderId);
  assert.ok(order, `Expected seed order ${orderId}`);
  return order;
}

function deliveryUser() {
  return { sub: "driver-user-002", role: "driver", name: "Khalid Bin Hamdan", driverId: DRIVER_ID };
}

beforeEach(resetAll);

test("driver delivery: assigned COD delivery completes without safeShopId runtime failure", async () => {
  seedAssignedOrder();
  const driverBefore = structuredClone(__getSeedDriverForTests(DRIVER_ID));

  const result = await recordDriverDelivery(
    DRIVER_ID,
    ORDER_ID,
    { codCollected: true, codAmount: 310, note: "Delivered to reception." },
    deliveryUser()
  );

  assert.equal(result.orderId, ORDER_ID);
  assert.equal(result.status, "Delivered");
  assert.equal(result.paymentStatus, "COD collected");
  assert.equal(result.driverAssignment.codCollected, true);
  assert.equal(result.driverAssignment.codAmount, 310);
  assert.ok(result.driverAssignment.deliveredAt);
  assert.equal(result.driverAssignment.note, "Delivered to reception.");

  const driverAfter = __getSeedDriverForTests(DRIVER_ID);
  assert.equal(driverAfter.status, "active");
  assert.equal(driverAfter.totalDeliveries, driverBefore.totalDeliveries + 1);
  assert.equal(driverAfter.codBalance, driverBefore.codBalance + 310);
  assert.equal(driverAfter.totalCodCollected, driverBefore.totalCodCollected + 310);
});

test("driver delivery: Order schema keeps pickup and proof-of-delivery fields", () => {
  const pickedUpAt = new Date("2026-06-01T09:30:00.000Z");
  const order = new Order({
    orderId: "ORD-SCHEMA-POD-001",
    customerName: "Schema Customer",
    customerEmail: "schema@example.com",
    items: [{ productId: "prf-001", productName: "Schema Oud", shopId: SHOP_ID, price: 310, quantity: 1 }],
    subtotal: 310,
    platformFee: 40,
    vendorNet: 270,
    paymentMethod: "cod",
    paymentStatus: "COD pending",
    shopIds: [SHOP_ID],
    driverAssignment: {
      driverId: DRIVER_ID,
      pickedUpAt,
      proofOfDeliveryUrl: PROOF_URL,
    },
  });

  const assignment = order.toObject().driverAssignment;
  assert.equal(Order.schema.path("driverAssignment").schema.path("pickedUpAt").instance, "Date");
  assert.equal(Order.schema.path("driverAssignment").schema.path("proofOfDeliveryUrl").instance, "String");
  assert.equal(assignment.pickedUpAt.toISOString(), pickedUpAt.toISOString());
  assert.equal(assignment.proofOfDeliveryUrl, PROOF_URL);
});

test("driver delivery: general driver proof-of-delivery URL is kept and normalized", async () => {
  seedAssignedOrder();

  const result = await recordDriverDelivery(
    DRIVER_ID,
    ORDER_ID,
    { codCollected: true, codAmount: 310, note: "Delivered to reception.", proofOfDeliveryUrl: PROOF_URL },
    deliveryUser()
  );
  const normalized = await getDriverDelivery(DRIVER_ID, SHOP_ID, ORDER_ID);

  assert.equal(result.driverAssignment.proofOfDeliveryUrl, PROOF_URL);
  assert.equal(normalized.driverAssignment.proofOfDeliveryUrl, PROOF_URL);
  assert.equal(normalized.driverAssignment.pickedUpAt, assignedCodOrder.driverAssignment.pickedUpAt);
});

test("driver pickup: pickup timestamp is set and normalized without COD side effects", async () => {
  seedAssignedOrder({ status: "Ready for Delivery", driverAssignment: { pickedUpAt: null } });
  const driverBefore = structuredClone(__getSeedDriverForTests(DRIVER_ID));

  const result = await confirmDriverPickup(DRIVER_ID, ORDER_ID, deliveryUser());
  const normalized = await getDriverDelivery(DRIVER_ID, SHOP_ID, ORDER_ID);

  assert.equal(result.status, "Shipped");
  assert.ok(result.driverAssignment.pickedUpAt);
  assert.equal(normalized.driverAssignment.pickedUpAt, result.driverAssignment.pickedUpAt);
  assert.equal(result.paymentStatus, "COD pending");
  assert.equal(result.driverAssignment.deliveredAt, null);
  assert.equal(result.driverAssignment.codCollected, false);
  assert.equal(result.driverAssignment.codAmount, 310);
  assert.deepEqual(__getSeedDriverForTests(DRIVER_ID), driverBefore);
  assert.equal((seedRepository.getState().sellerTransactions || []).length, 0);
});

test("driver delivery: wrong driver cannot complete assigned order", async () => {
  seedAssignedOrder();
  const assignedDriverBefore = structuredClone(__getSeedDriverForTests(DRIVER_ID));

  await assert.rejects(
    () => recordDriverDelivery("drv-001", ORDER_ID, { codCollected: true, codAmount: 310 }, deliveryUser()),
    (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.message, "Order not found or not assigned to this driver.");
      return true;
    }
  );

  const order = getOrder();
  assert.equal(order.status, "Shipped");
  assert.equal(order.paymentStatus, "COD pending");
  assert.equal(order.driverAssignment.deliveredAt, null);
  assert.deepEqual(__getSeedDriverForTests(DRIVER_ID), assignedDriverBefore);
});

test("driver delivery: duplicate completion rejects before duplicate COD or delivery stats", async () => {
  seedAssignedOrder();

  await recordDriverDelivery(DRIVER_ID, ORDER_ID, { codCollected: true, codAmount: 310 }, deliveryUser());
  const driverAfterFirstCompletion = structuredClone(__getSeedDriverForTests(DRIVER_ID));
  const orderAfterFirstCompletion = structuredClone(getOrder());

  await assert.rejects(
    () => recordDriverDelivery(DRIVER_ID, ORDER_ID, { codCollected: true, codAmount: 310 }, deliveryUser()),
    (err) => {
      assert.equal(err.status, 409);
      assert.equal(err.message, "Order is already delivered.");
      return true;
    }
  );

  assert.deepEqual(__getSeedDriverForTests(DRIVER_ID), driverAfterFirstCompletion);
  assert.deepEqual(getOrder(), orderAfterFirstCompletion);
  assert.equal((getOrder().statusHistory || []).filter((entry) => entry.to === "Delivered").length, 1);
});

test("driver delivery: COD completion does not create COD settlement or seller ledger credit", async () => {
  seedAssignedOrder();

  await recordDriverDelivery(DRIVER_ID, ORDER_ID, { codCollected: true, codAmount: 310 }, deliveryUser());

  const order = getOrder();
  assert.equal(order.driverAssignment.codSettledAt, null);
  assert.equal(order.driverAssignment.codSettlementRef, null);
  assert.equal((seedRepository.getState().sellerTransactions || []).length, 0);
});

test("driver delivery: seller driver proof-of-delivery URL is kept", async () => {
  const sellerDriver = await createSellerDriver(
    SHOP_ID,
    "Rose Vault",
    "seller-user-001",
    {
      name: "Seller Proof Driver",
      phone: "+971501110000",
      email: "seller-proof-driver@example.com",
      vehicleType: "motorcycle",
      zone: "Dubai Marina",
    }
  );
  seedAssignedOrder({
    orderId: "ORD-SELLER-POD-001",
    driverAssignment: {
      driverId: sellerDriver.id,
      driverName: sellerDriver.name,
      driverPhone: sellerDriver.phone,
      proofOfDeliveryUrl: "",
    },
  });

  const result = await recordSellerDriverDelivery(
    sellerDriver.id,
    "ORD-SELLER-POD-001",
    SHOP_ID,
    { codCollected: true, codAmount: 310, note: "Seller driver delivered.", proofOfDeliveryUrl: PROOF_URL },
    { sub: "seller-user-001", role: "seller", name: "Rose Vault Seller", shopId: SHOP_ID }
  );

  assert.equal(result.status, "Delivered");
  assert.equal(result.paymentStatus, "COD collected");
  assert.equal(result.driverAssignment.proofOfDeliveryUrl, PROOF_URL);
  assert.equal(result.driverAssignment.codCollected, true);
  assert.equal(result.driverAssignment.codAmount, 310);
  assert.equal(result.driverAssignment.codSettledAt, null);
  assert.equal(result.driverAssignment.codSettlementRef, null);
});
