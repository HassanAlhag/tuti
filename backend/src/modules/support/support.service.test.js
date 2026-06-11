import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";

const support = await import("./support.service.js");
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

const disputedCustomer = {
  sub: "cus-hamad",
  role: "customer",
  name: "Hamad S.",
  email: "hamad@example.com",
};

const sellerRose = {
  sub: "seller-rose",
  role: "seller",
  name: "Rose Seller",
  email: "rose@example.com",
  shopId: "shop-rose-vault",
};

const sellerCitrus = {
  sub: "seller-citrus",
  role: "seller",
  name: "Citrus Seller",
  email: "citrus@example.com",
  shopId: "shop-citrus-atelier",
};

const driverOne = {
  sub: "driver-001",
  role: "driver",
  name: "Driver One",
  email: "driver1@example.com",
  shopId: "shop-rose-vault",
  driverId: "drv-test-001",
};

const driverTwo = {
  sub: "driver-002",
  role: "driver",
  name: "Driver Two",
  email: "driver2@example.com",
  shopId: "shop-citrus-atelier",
  driverId: "drv-test-002",
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

function findOrder(orderId) {
  return seedRepository.getState().orders.find((order) => order.orderId === orderId);
}

function snapshotOrder(order) {
  return {
    status: order.status,
    paymentStatus: order.paymentStatus,
    driverAssignment: order.driverAssignment ? structuredClone(order.driverAssignment) : undefined,
    supportCase: order.supportCase ? structuredClone(order.supportCase) : undefined,
    resolutionDecision: order.resolutionDecision ? structuredClone(order.resolutionDecision) : undefined,
  };
}

beforeEach(() => {
  const state = seedRepository.getState();
  state.orders.splice(0, state.orders.length, ...structuredClone(initialOrders));
  support.__resetSupportTicketsForTests();
  __resetNotificationsForTests();
});

test("customers can create a ticket and it does not mutate the linked order", async () => {
  const order = findOrder("ORD-9309");
  const before = snapshotOrder(order);

  const ticket = await support.createSupportTicket(
    {
      category: "order_help",
      priority: "normal",
      subject: "Need help with my order",
      description: "Please help me with my order status.",
      orderId: "ORD-9309",
    },
    customer
  );

  assert.equal(ticket.requesterUserId, customer.sub);
  assert.equal(ticket.requesterRole, "customer");
  assert.equal(ticket.status, "Open");
  assert.equal(ticket.internalNotes, undefined);
  assert.equal(ticket.orderId, "ORD-9309");
  assert.equal(ticket.messages.length, 1);
  assert.equal(ticket.messages[0].body, "Please help me with my order status.");

  assert.deepEqual(snapshotOrder(order), before);
});

test("customers only list their own tickets", async () => {
  await support.createSupportTicket(
    {
      category: "order_help",
      subject: "My order",
      description: "Help with my order.",
      orderId: "ORD-9309",
    },
    customer
  );
  await support.createSupportTicket(
    {
      category: "order_help",
      subject: "Other order",
      description: "Help with another order.",
      orderId: "ORD-9318",
    },
    otherCustomer
  );

  const list = await support.listSupportTickets(customer);
  assert.equal(list.tickets.length, 1);
  assert.equal(list.tickets[0].requesterUserId, customer.sub);
});

test("sellers only see tickets for their own shop", async () => {
  await support.createSupportTicket(
    {
      category: "shop_help",
      subject: "Rose ticket",
      description: "Help for rose shop.",
    },
    sellerRose
  );
  await support.createSupportTicket(
    {
      category: "shop_help",
      subject: "Citrus ticket",
      description: "Help for citrus shop.",
    },
    sellerCitrus
  );

  const list = await support.listSupportTickets(sellerRose);
  assert.equal(list.tickets.length, 1);
  assert.equal(list.tickets[0].shopId, sellerRose.shopId);
});

test("drivers only see tickets tied to their own driver record", async () => {
  await support.createSupportTicket(
    {
      category: "delivery_help",
      subject: "Driver one",
      description: "Help for driver one.",
    },
    driverOne
  );
  await support.createSupportTicket(
    {
      category: "delivery_help",
      subject: "Driver two",
      description: "Help for driver two.",
    },
    driverTwo
  );

  const list = await support.listSupportTickets(driverOne);
  assert.equal(list.tickets.length, 1);
  assert.equal(list.tickets[0].driverId, driverOne.driverId);
});

test("active disputes block support ticket creation for the same order", async () => {
  await assert.rejects(
    () => support.createSupportTicket(
      {
        category: "order_help",
        subject: "Disputed order",
        description: "This should use dispute workflow.",
        orderId: "ORD-9301",
      },
      disputedCustomer
    ),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );
});

test("replies append messages and admin notes stay hidden from non-admins", async () => {
  const ticket = await support.createSupportTicket(
    {
      category: "order_help",
      subject: "Reply test",
      description: "First message.",
      orderId: "ORD-9309",
    },
    customer
  );

  await support.replySupportTicket(ticket.ticketNumber, { message: "Customer follow-up." }, customer);
  const adminUpdated = await support.addSupportInternalNote(ticket.ticketNumber, { note: "Internal only." }, admin);

  assert.equal(adminUpdated.internalNotes.length, 1);
  assert.equal(adminUpdated.messages.length, 2);
  assert.equal(adminUpdated.messages[1].body, "Customer follow-up.");

  const customerView = await support.getSupportTicket(ticket.ticketNumber, customer);
  assert.equal(customerView.internalNotes, undefined);
  assert.equal(customerView.messages.length, 2);
});

test("admin can update status and assign the ticket", async () => {
  const ticket = await support.createSupportTicket(
    {
      category: "shop_help",
      subject: "Admin case",
      description: "General admin support case.",
    },
    sellerRose
  );

  const statusUpdated = await support.updateSupportTicketStatus(ticket.ticketNumber, "Waiting for Customer", admin);
  assert.equal(statusUpdated.status, "Waiting for Customer");

  const assigned = await support.assignSupportTicket(ticket.ticketNumber, { assignedToUserId: "support-user-001", assignedToRole: "support" }, admin);
  assert.equal(assigned.assignedToUserId, "support-user-001");
  assert.equal(assigned.status, "Waiting for Customer");

  const internal = await support.addSupportInternalNote(ticket.ticketNumber, { note: "Admin note." }, admin);
  assert.equal(internal.internalNotes.length, 1);
  assert.equal(internal.internalNotes[0].note, "Admin note.");
});

test("ticket creation notifies admin/support and stays scoped", async () => {
  await support.createSupportTicket(
    {
      category: "shop_help",
      subject: "Scoped seller ticket",
      description: "Please help the seller shop.",
    },
    sellerRose
  );

  const adminInbox = await listNotifications(admin);
  const supportInbox = await listNotifications(supportAgent);
  const otherSellerInbox = await listNotifications({ ...sellerCitrus, sub: "seller-citrus-2" });

  assert.equal(adminInbox.length, 1);
  assert.equal(adminInbox[0].type, "support_ticket_created");
  assert.equal(adminInbox[0].entityType, "support");
  assert.equal(adminInbox[0].shopId, sellerRose.shopId);
  assert.equal(supportInbox.length, 1);
  assert.equal(otherSellerInbox.length, 0);
});

test("requester replies notify admin/support and admin replies notify only the requester", async () => {
  const ticket = await support.createSupportTicket(
    {
      category: "order_help",
      subject: "Reply and notify",
      description: "Need a response.",
      orderId: "ORD-9309",
    },
    customer
  );

  const adminBefore = (await listNotifications(admin)).length;
  await support.replySupportTicket(ticket.ticketNumber, { message: "Customer follow-up." }, customer);
  const adminAfter = await listNotifications(admin);
  assert.equal(adminAfter.length, adminBefore + 1);
  assert.ok(adminAfter.some((item) => item.type === "support_ticket_replied"));

  const customerBefore = (await listNotifications(customer)).length;
  await support.replySupportTicket(ticket.ticketNumber, { message: "Admin reply." }, admin);
  const customerAfter = await listNotifications(customer);
  assert.equal(customerAfter.length, customerBefore + 1);
  assert.ok(customerAfter.some((item) => item.type === "support_ticket_replied"));
});

test("seller and driver notifications stay scoped and internal notes stay private", async () => {
  const sellerTicket = await support.createSupportTicket(
    {
      category: "shop_help",
      subject: "Seller scope",
      description: "Need help for this shop.",
    },
    sellerRose
  );
  const adminBeforeSellerReply = (await listNotifications(admin)).length;
  await support.replySupportTicket(sellerTicket.ticketNumber, { message: "Seller reply." }, sellerRose);

  const sellerInbox = await listNotifications(sellerRose);
  const adminAfterSellerReply = await listNotifications(admin);
  const citrusInbox = await listNotifications(sellerCitrus);
  assert.equal(adminAfterSellerReply.length, adminBeforeSellerReply + 1);
  assert.ok(adminAfterSellerReply.some((item) => item.type === "support_ticket_replied"));
  assert.equal(sellerInbox.filter((item) => item.type === "support_ticket_replied").length, 0);
  assert.equal(citrusInbox.length, 0);

  const driverTicket = await support.createSupportTicket(
    {
      category: "delivery_help",
      subject: "Driver scope",
      description: "Need help for this driver.",
    },
    driverOne
  );
  const adminBeforeDriverReply = (await listNotifications(admin)).length;
  await support.replySupportTicket(driverTicket.ticketNumber, { message: "Driver reply." }, driverOne);
  const adminAfterDriverReply = await listNotifications(admin);
  assert.equal(adminAfterDriverReply.length, adminBeforeDriverReply + 1);
  assert.ok(adminAfterDriverReply.some((item) => item.type === "support_ticket_replied"));

  await support.assignSupportTicket(driverTicket.ticketNumber, { assignedToUserId: supportAgent.sub, assignedToRole: supportAgent.role }, admin);
  await support.addSupportInternalNote(driverTicket.ticketNumber, { note: "Internal only note body." }, admin);

  const driverInbox = await listNotifications(driverOne);
  const otherDriverInbox = await listNotifications(driverTwo);
  const supportInbox = await listNotifications(supportAgent);
  assert.equal(otherDriverInbox.length, 0);
  assert.equal(driverInbox.filter((item) => item.type === "support_ticket_assigned").length, 0);
  assert.equal(driverInbox.filter((item) => item.type === "support_ticket_internal_note").length, 0);
  assert.ok(supportInbox.some((item) => item.type === "support_ticket_assigned"));
  assert.ok(supportInbox.some((item) => item.type === "support_ticket_internal_note"));
  assert.ok(!supportInbox.some((item) => String(item.message || "").includes("Internal only note body")));
});
