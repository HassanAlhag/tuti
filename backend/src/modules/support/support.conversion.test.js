import test from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const support = await import("./support.service.js");
const { __resetSeedOrdersForTests, getSeedOrders } = await import("../orders/orders.service.js");
const { __resetNotificationsForTests, listNotifications } = await import("../notifications/notifications.service.js");
const initialOrders = structuredClone(seedRepository.getState().orders);

const customer = {
  sub: "cus-lina",
  role: "customer",
  name: "Lina M.",
  email: "lina@example.com",
};

const otherCustomer = {
  sub: "cus-omar",
  role: "customer",
  name: "Omar R.",
  email: "omar@example.com",
};

const sellerRose = {
  sub: "seller-rose",
  role: "seller",
  name: "Rose Seller",
  email: "rose@example.com",
  shopId: "shop-rose-vault",
};

const admin = {
  sub: "adm-001",
  role: "admin",
  name: "Admin One",
  email: "admin@example.com",
};

const supportAgent = {
  sub: "support-001",
  role: "support",
  name: "Support One",
  email: "support@example.com",
};

function resetSeedState() {
  __resetSeedOrdersForTests();
  const state = seedRepository.getState();
  state.orders.splice(0, state.orders.length, ...structuredClone(initialOrders));
  support.__resetSupportTicketsForTests();
  __resetNotificationsForTests();
}

function findOrder(orderId) {
  return getSeedOrders().find((order) => order.orderId === orderId);
}

test("support tickets convert to disputes safely and keep money/order state untouched", async () => {
  resetSeedState();

  const order = findOrder("ORD-9309");
  const before = {
    status: order.status,
    paymentStatus: order.paymentStatus,
    driverAssignment: order.driverAssignment ? structuredClone(order.driverAssignment) : undefined,
    resolutionDecision: order.resolutionDecision ? structuredClone(order.resolutionDecision) : undefined,
  };

  const ticket = await support.createSupportTicket(
    {
      category: "delivery_help",
      subject: "Convert eligible case",
      description: "This is ready to become a formal dispute.",
      orderId: "ORD-9309",
    },
    customer
  );

  await support.addSupportInternalNote(ticket.ticketNumber, { note: "Do not expose this note." }, admin);

  const converted = await support.convertSupportTicketToDispute(ticket.ticketNumber, {
    issueType: "delivery_issue",
    adminNote: "Escalated for formal review.",
    priorityEscalation: true,
  }, admin);

  assert.equal(converted.ticket.status, "Resolved");
  assert.ok(converted.ticket.convertedAt);
  assert.equal(converted.ticket.convertedBy, admin.sub);
  assert.equal(converted.ticket.convertedByRole, admin.role);
  assert.equal(converted.ticket.convertedIssueType, "delivery_issue");
  assert.equal(converted.ticket.convertedOrderId, "ORD-9309");
  assert.equal(converted.ticket.convertedDisputeRef, "ORD-9309");
  assert.ok(converted.ticket.messages.some((message) => message.body === "Converted to dispute case."));
  assert.equal(converted.order.status, before.status);
  assert.equal(converted.order.paymentStatus, before.paymentStatus);
  assert.equal(converted.order.driverAssignment?.driverId, before.driverAssignment?.driverId);
  assert.equal(converted.order.resolutionDecision?.status, before.resolutionDecision?.status);
  assert.equal(converted.order.supportCase.kind, "dispute");
  assert.equal(converted.order.supportCase.issueType, "delivery_issue");
  assert.equal(converted.order.supportCase.sourceSupportTicketNumber, ticket.ticketNumber);
  assert.equal(converted.order.supportCase.convertedBy, admin.sub);
  assert.equal(converted.order.supportCase.convertedByRole, admin.role);
  assert.equal(converted.order.supportCase.conversionNote, "Escalated for formal review.");
  assert.ok(converted.order.supportCase.internalNotes.some((note) => String(note.note || "").includes("Converted from support ticket")));
  assert.ok(!converted.order.supportCase.internalNotes.some((note) => String(note.note || "").includes("Do not expose this note.")));

  const adminInbox = await listNotifications(admin);
  const supportInbox = await listNotifications(supportAgent);
  const customerInbox = await listNotifications(customer);
  const sellerInbox = await listNotifications({ ...sellerRose, sub: "seller-rose-convert", shopId: order.shopIds?.[0] || sellerRose.shopId });

  assert.ok(adminInbox.some((item) => item.type === "dispute_opened" && item.entityType === "order" && item.entityId === "ORD-9309"));
  assert.ok(supportInbox.some((item) => item.type === "dispute_opened" && item.entityType === "order" && item.entityId === "ORD-9309"));
  assert.ok(customerInbox.some((item) => item.type === "dispute_opened" && item.entityType === "order" && item.entityId === "ORD-9309"));
  assert.equal(sellerInbox.filter((item) => item.type === "dispute_opened" && item.entityType === "order" && item.entityId === "ORD-9309").length, 1);
  assert.ok(!customerInbox.some((item) => String(item.message || "").includes("Do not expose this note.")));

  const customerView = await support.getSupportTicket(ticket.ticketNumber, customer);
  assert.equal(customerView.internalNotes, undefined);
  assert.equal(customerView.convertedNote, undefined);

  resetSeedState();

  const noOrderTicket = await support.createSupportTicket(
    {
      category: "general",
      subject: "No order",
      description: "General help ticket.",
    },
    customer
  );

  await assert.rejects(
    () => support.convertSupportTicketToDispute(noOrderTicket.ticketNumber, {
      issueType: "payment_issue",
      adminNote: "Should fail.",
      priorityEscalation: false,
    }, admin),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );

  resetSeedState();

  const blockedTicket = await support.createSupportTicket(
    {
      category: "delivery_help",
      subject: "Duplicate dispute",
      description: "Should be blocked by active dispute.",
      orderId: "ORD-9318",
    },
    otherCustomer
  );

  const disputeOrder = findOrder("ORD-9318");
  disputeOrder.supportCase = {
    kind: "dispute",
    issueType: "delivery_issue",
    status: "open",
    priority: "high",
    internalNotes: [],
    lastActionAt: new Date().toISOString(),
    escalatedAt: null,
  };
  disputeOrder.status = "Disputed";
  disputeOrder.paymentStatus = "Dispute hold";

  await assert.rejects(
    () => support.convertSupportTicketToDispute(blockedTicket.ticketNumber, {
      issueType: "delivery_issue",
      adminNote: "Duplicate should fail.",
      priorityEscalation: true,
    }, admin),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );

  resetSeedState();

  const unauthorizedTicket = await support.createSupportTicket(
    {
      category: "order_help",
      subject: "Unauthorized convert",
      description: "This should be rejected.",
      orderId: "ORD-9309",
    },
    customer
  );

  await assert.rejects(
    () => support.convertSupportTicketToDispute(unauthorizedTicket.ticketNumber, {
      issueType: "payment_issue",
      adminNote: "Nope.",
      priorityEscalation: false,
    }, customer),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    }
  );

  resetSeedState();

  const doubleConvertTicket = await support.createSupportTicket(
    {
      category: "delivery_help",
      subject: "Already converted",
      description: "This ticket should only convert once.",
      orderId: "ORD-9309",
    },
    customer
  );

  await support.convertSupportTicketToDispute(doubleConvertTicket.ticketNumber, {
    issueType: "delivery_issue",
    adminNote: "First conversion.",
    priorityEscalation: false,
  }, admin);

  await assert.rejects(
    () => support.convertSupportTicketToDispute(doubleConvertTicket.ticketNumber, {
      issueType: "delivery_issue",
      adminNote: "Second conversion should fail.",
      priorityEscalation: false,
    }, admin),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );
});
