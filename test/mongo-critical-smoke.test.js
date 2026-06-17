import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const mongoSmokeUri = process.env.MONGO_SMOKE_URI;

if (!mongoSmokeUri) {
  test("mongo critical smoke: skipped unless MONGO_SMOKE_URI is set", { skip: "Set MONGO_SMOKE_URI to run Mongo-backed critical smoke coverage." }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = mongoSmokeUri;
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

  const prefix = `mongo-smoke-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const createdOrderIds = new Set();

  let mongoose;
  let Product;
  let Shop;
  let Order;
  let Driver;
  let Notification;
  let CommissionEntry;
  let SellerTransaction;
  let createOrder;
  let getStorefrontData;
  let searchProducts;
  let confirmDriverPickup;
  let recordDriverDelivery;

  function prefixed(value) {
    return `${prefix}-${value}`;
  }

  function prefixedRegex() {
    return new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-`);
  }

  async function cleanupSmokeRecords() {
    if (!Product || !Shop || !Order || !Driver || !Notification || !CommissionEntry || !SellerTransaction) return;

    const idRegex = prefixedRegex();
    const orderIds = [...createdOrderIds];

    await Promise.all([
      Product.deleteMany({ id: idRegex }),
      Shop.deleteMany({ id: idRegex }),
      Driver.deleteMany({ id: idRegex }),
      Order.deleteMany({
        $or: [
          { customerEmail: `${prefix}@example.test` },
          ...(orderIds.length ? [{ orderId: { $in: orderIds } }] : []),
        ],
      }),
      Notification.deleteMany({
        $or: [
          { shopId: idRegex },
          { entityId: idRegex },
          ...(orderIds.length ? [{ entityId: { $in: orderIds } }] : []),
        ],
      }),
      CommissionEntry.deleteMany({
        $or: [
          { shopId: idRegex },
          ...(orderIds.length ? [{ orderId: { $in: orderIds } }] : []),
        ],
      }),
      SellerTransaction.deleteMany({
        $or: [
          { shopId: idRegex },
          ...(orderIds.length ? [{ orderId: { $in: orderIds } }] : []),
        ],
      }),
    ]);
  }

  before(async () => {
    ({ default: mongoose } = await import("mongoose"));
    await mongoose.connect(mongoSmokeUri);

    ({ Product } = await import("../backend/src/models/Product.js"));
    ({ Shop } = await import("../backend/src/models/Shop.js"));
    ({ Order } = await import("../backend/src/models/Order.js"));
    ({ Driver } = await import("../backend/src/models/Driver.js"));
    ({ Notification } = await import("../backend/src/models/Notification.js"));
    ({ CommissionEntry } = await import("../backend/src/models/CommissionEntry.js"));
    ({ SellerTransaction } = await import("../backend/src/models/SellerTransaction.js"));
    ({ createOrder } = await import("../backend/src/modules/orders/orders.service.js"));
    ({ getStorefrontData, searchProducts } = await import("../backend/src/modules/marketplace/marketplace.service.js"));
    ({ confirmDriverPickup, recordDriverDelivery } = await import("../backend/src/modules/drivers/drivers.service.js"));

    await cleanupSmokeRecords();
  });

  after(async () => {
    await cleanupSmokeRecords();
    await mongoose.disconnect();
  });

  test("mongo critical smoke: checkout uses backend product authority and decrements stock", async () => {
    const approvedShopId = prefixed("approved-shop");
    const productId = prefixed("checkout-product");
    const wrongShopId = prefixed("tampered-shop");

    await Shop.create({
      id: approvedShopId,
      name: prefixed("Mongo Smoke Approved Shop"),
      owner: prefixed("Mongo Smoke Seller"),
      city: "Dubai",
      status: "Approved",
    });
    await Product.create({
      id: productId,
      name: prefixed("Mongo Smoke Backend Price Perfume"),
      shopId: approvedShopId,
      category: "perfume",
      price: 245,
      stock: 5,
      status: "Live",
      family: "Oud",
      gender: "Unisex",
      size: "50ml",
    });

    const order = await createOrder({
      checkoutMode: "guest",
      paymentMethod: "cod",
      customerName: prefixed("Mongo Smoke Customer"),
      customerEmail: `${prefix}@example.test`,
      phone: "+971501234567",
      deliveryAddress: "Mongo Smoke Address",
      items: [{
        productId,
        productName: "Tampered Client Product Name",
        shopId: wrongShopId,
        price: 1,
        quantity: 2,
      }],
    });
    createdOrderIds.add(order.orderId);

    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].productName, prefixed("Mongo Smoke Backend Price Perfume"));
    assert.equal(order.items[0].shopId, approvedShopId);
    assert.equal(order.items[0].price, 245);
    assert.equal(order.items[0].quantity, 2);
    assert.equal(order.subtotal, 490);
    assert.deepEqual(order.shopIds, [approvedShopId]);
    assert.equal(order.paymentMethod, "cod");
    assert.equal(order.paymentStatus, "COD pending");

    const storedProduct = await Product.findOne({ id: productId }).lean();
    assert.equal(storedProduct.stock, 3);
  });

  test("mongo critical smoke: public storefront and search expose only live products from approved shops", async () => {
    const approvedShopId = prefixed("storefront-approved-shop");
    const pendingShopId = prefixed("storefront-pending-shop");
    const liveApprovedProductId = prefixed("live-approved-product");
    const draftApprovedProductId = prefixed("draft-approved-product");
    const livePendingProductId = prefixed("live-pending-product");

    await Shop.insertMany([
      {
        id: approvedShopId,
        name: prefixed("Mongo Smoke Public Shop"),
        owner: prefixed("Mongo Smoke Seller"),
        city: "Dubai",
        status: "Approved",
        pendingBalance: 999,
        availableBalance: 888,
        payoutHoldDays: 30,
        commissionRate: 25,
        adminNotices: [{ id: prefixed("notice"), type: "warning", note: "hidden", issuedAt: new Date().toISOString() }],
      },
      {
        id: pendingShopId,
        name: prefixed("Mongo Smoke Pending Shop"),
        owner: prefixed("Mongo Smoke Seller"),
        city: "Dubai",
        status: "Pending review",
      },
    ]);

    await Product.insertMany([
      {
        id: liveApprovedProductId,
        name: prefixed("Mongo Smoke Searchable Live Approved"),
        shopId: approvedShopId,
        category: "perfume",
        price: 150,
        stock: 4,
        status: "Live",
        sellerLastEditedAt: new Date(),
      },
      {
        id: draftApprovedProductId,
        name: prefixed("Mongo Smoke Searchable Draft Approved"),
        shopId: approvedShopId,
        category: "perfume",
        price: 99,
        stock: 4,
        status: "Draft",
      },
      {
        id: livePendingProductId,
        name: prefixed("Mongo Smoke Searchable Live Pending"),
        shopId: pendingShopId,
        category: "perfume",
        price: 199,
        stock: 4,
        status: "Live",
      },
    ]);

    const storefront = await getStorefrontData();
    const productIds = storefront.products.map((product) => product.id);
    const shopIds = storefront.shops.map((shop) => shop.id);

    assert.ok(productIds.includes(liveApprovedProductId));
    assert.equal(productIds.includes(draftApprovedProductId), false);
    assert.equal(productIds.includes(livePendingProductId), false);
    assert.ok(shopIds.includes(approvedShopId));
    assert.equal(shopIds.includes(pendingShopId), false);

    const publicShop = storefront.shops.find((shop) => shop.id === approvedShopId);
    assert.ok(publicShop);
    assert.equal(Object.hasOwn(publicShop, "pendingBalance"), false);
    assert.equal(Object.hasOwn(publicShop, "availableBalance"), false);
    assert.equal(Object.hasOwn(publicShop, "adminNotices"), false);
    assert.equal(Object.hasOwn(publicShop, "commissionRate"), false);

    const publicProduct = storefront.products.find((product) => product.id === liveApprovedProductId);
    assert.ok(publicProduct);
    assert.equal(Object.hasOwn(publicProduct, "sellerLastEditedAt"), false);

    const search = await searchProducts({ q: prefix, limit: 20 });
    const searchIds = search.results.map((product) => product.id);
    assert.ok(searchIds.includes(liveApprovedProductId));
    assert.equal(searchIds.includes(draftApprovedProductId), false);
    assert.equal(searchIds.includes(livePendingProductId), false);
  });

  test("mongo critical smoke: driver pickup and proof-of-delivery fields persist", async () => {
    const shopId = prefixed("delivery-shop");
    const driverId = prefixed("driver");
    const orderId = prefixed("delivery-order");
    const proofOfDeliveryUrl = `https://cdn.tuti.test/proof/${prefix}.jpg`;

    createdOrderIds.add(orderId);

    await Shop.create({
      id: shopId,
      name: prefixed("Mongo Smoke Delivery Shop"),
      owner: prefixed("Mongo Smoke Seller"),
      city: "Dubai",
      status: "Approved",
    });
    await Driver.create({
      id: driverId,
      name: prefixed("Mongo Smoke Driver"),
      phone: "+971501111111",
      shopId,
      shopName: prefixed("Mongo Smoke Delivery Shop"),
      status: "active",
      isActive: true,
    });
    await Order.create({
      orderId,
      checkoutMode: "guest",
      paymentMethod: "cod",
      customerName: prefixed("Mongo Smoke Customer"),
      customerEmail: `${prefix}@example.test`,
      phone: "+971501234567",
      items: [{
        productId: prefixed("delivery-product"),
        productName: prefixed("Mongo Smoke Delivery Product"),
        shopId,
        price: 120,
        quantity: 1,
      }],
      subtotal: 120,
      platformFee: 17,
      vendorNet: 103,
      status: "Ready for Delivery",
      paymentStatus: "COD pending",
      deliveryAddress: "Mongo Smoke Delivery Address",
      shopIds: [shopId],
      statusHistory: [],
      driverAssignment: {
        driverId,
        driverName: "Mongo Smoke Driver",
        driverPhone: "+971501111111",
        assignedAt: new Date(),
        deliveredAt: null,
        codCollected: false,
        codAmount: 120,
        note: "",
      },
    });

    await confirmDriverPickup(driverId, orderId, { name: prefixed("Mongo Smoke Driver"), role: "driver", sub: driverId });
    const pickedUp = await Order.findOne({ orderId }).lean();
    assert.ok(pickedUp.driverAssignment.pickedUpAt instanceof Date);
    assert.equal(pickedUp.status, "Shipped");

    await recordDriverDelivery(
      driverId,
      orderId,
      { codCollected: true, codAmount: 120, note: "Delivered cleanly.", proofOfDeliveryUrl },
      { name: prefixed("Mongo Smoke Driver"), role: "driver", sub: driverId },
    );

    const delivered = await Order.findOne({ orderId }).lean();
    assert.equal(delivered.status, "Delivered");
    assert.equal(delivered.paymentStatus, "COD collected");
    assert.ok(delivered.driverAssignment.pickedUpAt instanceof Date);
    assert.ok(delivered.driverAssignment.deliveredAt instanceof Date);
    assert.equal(delivered.driverAssignment.proofOfDeliveryUrl, proofOfDeliveryUrl);
    assert.equal(delivered.driverAssignment.codCollected, true);
    assert.equal(delivered.driverAssignment.codAmount, 120);
  });
}
