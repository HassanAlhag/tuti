import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { env } from "../../config/env.js";
import { Order } from "../../models/Order.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { User } from "../../models/User.js";
import { createNotification, createNotificationsForRole } from "../notifications/notifications.service.js";
import { getSeedOrders } from "../orders/orders.service.js";

const seedSupportTickets = new Map();

export const supportTicketStatuses = [
  "Open",
  "In Progress",
  "Waiting for Customer",
  "Waiting for Seller",
  "Waiting for Driver",
  "Resolved",
  "Closed",
];

function nowIso() {
  return new Date().toISOString();
}

function supportTicketRef() {
  return `ST-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function isAdminSupport(user) {
  return ["admin", "support"].includes(user?.role);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAttachments(attachments = []) {
  return Array.isArray(attachments)
    ? attachments.filter((item) => typeof item === "string" || isPlainObject(item))
    : [];
}

function messageEntry(body, user, attachments = []) {
  return {
    id: `msg-${randomUUID().slice(0, 8)}`,
    body: body.trim(),
    by: user?.name || user?.email || user?.sub || "system",
    role: user?.role || "system",
    userId: user?.sub || null,
    attachments: normalizeAttachments(attachments),
    createdAt: nowIso(),
  };
}

function internalNoteEntry(note, user) {
  return {
    id: `note-${randomUUID().slice(0, 8)}`,
    note: note.trim(),
    by: user?.name || user?.email || user?.sub || "system",
    role: user?.role || "system",
    userId: user?.sub || null,
    createdAt: nowIso(),
  };
}

function seedListTickets() {
  return [...seedSupportTickets.values()];
}

function findSeedTicket(ticketId) {
  return seedSupportTickets.get(ticketId) || [...seedSupportTickets.values()].find((ticket) => ticket.ticketNumber === ticketId) || null;
}

async function loadOrder(orderId) {
  if (!orderId) return null;
  if (env.mongoUri) {
    return Order.findOne({ orderId }).lean();
  }
  return getSeedOrders().find((order) => order.orderId === orderId) || null;
}

function orderHasActiveDispute(order) {
  if (!order) return false;
  if (order.supportCase?.kind === "dispute" && !["resolved", "rejected", "closed"].includes(order.supportCase?.status || "")) {
    return true;
  }
  if (order.status === "Disputed" || order.paymentStatus === "Dispute hold" || order.customerResponse?.action === "dispute") {
    return true;
  }
  return false;
}

function deriveScopeFromRequest(order, user) {
  if (user?.role === "seller") {
    return { shopId: user.shopId || null, driverId: null };
  }
  if (user?.role === "driver") {
    return { shopId: user.shopId || null, driverId: user.driverId || null };
  }
  if (user?.role === "customer") {
    return {
      shopId: order && Array.isArray(order.shopIds) && order.shopIds.length === 1 ? order.shopIds[0] : null,
      driverId: null,
    };
  }
  return {
    shopId: order && Array.isArray(order.shopIds) && order.shopIds.length === 1 ? order.shopIds[0] : null,
    driverId: null,
  };
}

function ensureRequesterOrderScope(order, user) {
  if (!order) return;
  if (!user?.role) {
    const err = new Error("Access denied.");
    err.status = 403;
    throw err;
  }
  if (isAdminSupport(user)) return;
  if (user.role === "customer") {
    if (order.customerId !== user.sub) {
      const err = new Error("You can only access your own order-related support tickets.");
      err.status = 403;
      throw err;
    }
    return;
  }
  if (user.role === "seller") {
    if (!Array.isArray(order.shopIds) || !order.shopIds.includes(user.shopId)) {
      const err = new Error("You can only access tickets for your own shop.");
      err.status = 403;
      throw err;
    }
    return;
  }
  if (user.role === "driver") {
    if (order.driverAssignment?.driverId !== user.driverId) {
      const err = new Error("You can only access tickets for your own assigned deliveries.");
      err.status = 403;
      throw err;
    }
    return;
  }
  const err = new Error("Insufficient permissions.");
  err.status = 403;
  throw err;
}

function ensureTicketVisibility(ticket, user) {
  if (!ticket || !user?.role) {
    const err = new Error("Ticket not found.");
    err.status = 404;
    throw err;
  }
  if (isAdminSupport(user)) return ticket;
  if (user.role === "customer" && ticket.requesterUserId === user.sub) return ticket;
  if (user.role === "seller" && ticket.shopId && ticket.shopId === user.shopId) return ticket;
  if (user.role === "driver" && ticket.driverId && ticket.driverId === user.driverId) return ticket;
  const err = new Error("Ticket not found.");
  err.status = 404;
  throw err;
}

function sanitizeTicket(ticket, user, { includeInternalNotes = false } = {}) {
  if (!ticket) return null;
  const payload = typeof ticket.toObject === "function" ? ticket.toObject() : { ...ticket };
  if (!isAdminSupport(user) || !includeInternalNotes) {
    delete payload.internalNotes;
    delete payload.convertedNote;
  }
  return payload;
}

function normalizeTicketQuery(query = {}) {
  return {
    q: String(query.q || "").trim(),
    status: String(query.status || "").trim(),
    priority: String(query.priority || "").trim(),
    category: String(query.category || "").trim(),
    orderId: String(query.orderId || "").trim(),
    page: Math.max(Number(query.page) || 1, 1),
    limit: Math.min(Math.max(Number(query.limit) || 20, 1), 100),
  };
}

function buildAccessFilter(user) {
  if (isAdminSupport(user)) return {};
  if (user?.role === "customer") return { requesterUserId: user.sub };
  if (user?.role === "seller") {
    if (!user.shopId) {
      const err = new Error("Seller shop context required.");
      err.status = 403;
      throw err;
    }
    return { shopId: user.shopId };
  }
  if (user?.role === "driver") {
    if (!user.driverId) {
      const err = new Error("Driver profile is not linked.");
      err.status = 403;
      throw err;
    }
    return { driverId: user.driverId };
  }
  const err = new Error("Insufficient permissions.");
  err.status = 403;
  throw err;
}

function enrichTicketForResponse(ticket, user) {
  return sanitizeTicket(ticket, user, { includeInternalNotes: isAdminSupport(user) });
}

async function loadTicket(ticketId) {
  if (env.mongoUri) {
    const lookup = [{ ticketNumber: ticketId }, { id: ticketId }];
    if (mongoose.isValidObjectId(ticketId)) lookup.push({ _id: ticketId });
    return SupportTicket.findOne({ $or: lookup });
  }
  return findSeedTicket(ticketId);
}

function ticketReplyTransition(ticket, user) {
  if (!ticket?.status) return "Open";
  if (isAdminSupport(user) && ticket.status === "Open") return "In Progress";
  if (!isAdminSupport(user) && ["Waiting for Customer", "Waiting for Seller", "Waiting for Driver", "Resolved", "Closed"].includes(ticket.status)) {
    return "In Progress";
  }
  return ticket.status;
}

function ensureNoActiveDispute(ticketOrder) {
  if (!ticketOrder) return;
  if (orderHasActiveDispute(ticketOrder)) {
    const err = new Error("Order already has an active dispute. Use the dispute workflow.");
    err.status = 409;
    throw err;
  }
}

async function runSupportNotificationTasks(tasks = []) {
  const pending = tasks.filter(Boolean);
  if (!pending.length) return;
  const results = await Promise.allSettled(pending);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[support-notification]", result.reason?.message || result.reason);
    }
  }
}

function supportEntityId(ticket) {
  return ticket?.ticketNumber || ticket?.id || "";
}

function supportActorLabel(user) {
  return user?.name || user?.email || user?.sub || "Someone";
}

function supportContextLabel(ticket) {
  if (ticket?.orderId) return `order ${ticket.orderId}`;
  if (ticket?.shopId) return `shop ${ticket.shopId}`;
  if (ticket?.driverId) return `driver ${ticket.driverId}`;
  return "general help";
}

async function notifySupportAdminAudience(ticket, user, title, message, type) {
  const entityId = supportEntityId(ticket);
  if (!entityId) return [];
  const payload = {
    shopId: ticket.shopId || null,
    title,
    message,
    type,
    entityType: "support",
    entityId,
  };
  return Promise.all([
    createNotificationsForRole({ recipientRole: "admin", ...payload }),
    createNotificationsForRole({ recipientRole: "support", ...payload }),
  ]);
}

async function notifySupportRequester(ticket, title, message, type) {
  const entityId = supportEntityId(ticket);
  if (!entityId || !ticket?.requesterUserId) return null;

  if (ticket.requesterRole === "seller") {
    return createNotificationsForRole({
      recipientRole: "seller",
      shopId: ticket.shopId || null,
      title,
      message,
      type,
      entityType: "support",
      entityId,
    });
  }

  return createNotification({
    recipientRole: ticket.requesterRole || "customer",
    recipientUserId: ticket.requesterUserId,
    shopId: ticket.shopId || null,
    title,
    message,
    type,
    entityType: "support",
    entityId,
  });
}

async function notifySupportAssignee(ticket, title, message, type) {
  const entityId = supportEntityId(ticket);
  if (!entityId || !ticket?.assignedToUserId) return null;
  return createNotification({
    recipientRole: ticket.assignedToRole || "support",
    recipientUserId: ticket.assignedToUserId,
    shopId: ticket.shopId || null,
    title,
    message,
    type,
    entityType: "support",
    entityId,
  });
}

async function notifySupportTicketCreated(ticket, user) {
  if (isAdminSupport(user)) return [];
  return runSupportNotificationTasks([notifySupportAdminAudience(
    ticket,
    user,
    "New support ticket",
    `${supportActorLabel(user)} opened ticket ${supportEntityId(ticket)}${ticket?.subject ? ` · ${ticket.subject}` : ""} ${supportContextLabel(ticket)}.`,
    "support_ticket_created"
  )]);
}

async function notifySupportTicketReplied(ticket, user) {
  const title = "Support ticket replied";
  if (isAdminSupport(user)) {
    return runSupportNotificationTasks([notifySupportRequester(
      ticket,
      title,
      `${supportActorLabel(user)} replied on support ticket ${supportEntityId(ticket)}${ticket?.subject ? ` · ${ticket.subject}` : ""}.`,
      "support_ticket_replied"
    )]);
  }
  return runSupportNotificationTasks([notifySupportAdminAudience(
    ticket,
    user,
    title,
    `${supportActorLabel(user)} replied on ticket ${supportEntityId(ticket)}${ticket?.subject ? ` · ${ticket.subject}` : ""} ${supportContextLabel(ticket)}.`,
    "support_ticket_replied"
  )]);
}

async function notifySupportTicketStatusChanged(ticket, user, nextStatus) {
  return runSupportNotificationTasks([notifySupportRequester(
    ticket,
    "Support ticket status updated",
    `Your support ticket ${supportEntityId(ticket)}${ticket?.subject ? ` · ${ticket.subject}` : ""} is now ${nextStatus}.`,
    "support_ticket_status_changed"
  )]);
}

async function notifySupportTicketAssigned(ticket, user) {
  return runSupportNotificationTasks([notifySupportAssignee(
    ticket,
    "Support ticket assigned",
    `A support ticket (${supportEntityId(ticket)}) has been assigned to you.`,
    "support_ticket_assigned"
  )]);
}

async function notifySupportInternalNote(ticket, user) {
  return runSupportNotificationTasks([notifySupportAssignee(
    ticket,
    "Internal support note",
    `An internal note was added to support ticket ${supportEntityId(ticket)}.`,
    "support_ticket_internal_note"
  )]);
}

export const createSupportTicketSchema = z.object({
  category: z.string().min(2).max(80).trim(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  subject: z.string().min(2).max(140).trim(),
  description: z.string().min(2).max(4000).trim(),
  orderId: z.string().trim().min(1).optional().nullable().default(null),
  attachments: z.array(z.union([z.string().min(1), z.record(z.any())])).optional().default([]),
});

export const replySupportTicketSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  attachments: z.array(z.union([z.string().min(1), z.record(z.any())])).optional().default([]),
});

export const updateSupportTicketStatusSchema = z.object({
  status: z.enum(supportTicketStatuses),
});

export const assignSupportTicketSchema = z.object({
  assignedToUserId: z.string().trim().min(1),
  assignedToRole: z.string().trim().min(1).optional().nullable().default(null),
});

export const addSupportInternalNoteSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});

export const convertSupportTicketToDisputeSchema = z.object({
  issueType: z.string().trim().min(2).max(80),
  adminNote: z.string().trim().max(1000).optional().default(""),
  priorityEscalation: z.boolean().optional().default(false),
  overrideClosed: z.boolean().optional().default(false),
});

function normalizeIssueType(value) {
  return String(value || "").trim().toLowerCase();
}

function isClosedSupportTicket(ticket) {
  return ["Resolved", "Closed"].includes(ticket?.status || "");
}

function orderSupportCaseIssueType(order) {
  return normalizeIssueType(order?.supportCase?.issueType);
}

function hasActiveFormalDispute(order) {
  if (!order) return false;
  if (order.supportCase?.kind === "dispute" && !["resolved", "rejected", "closed"].includes(String(order.supportCase?.status || "").toLowerCase())) {
    return true;
  }
  if (order.status === "Disputed" || order.paymentStatus === "Dispute hold" || order.customerResponse?.action === "dispute") {
    return true;
  }
  return false;
}

function hasDuplicateDispute(order, issueType) {
  if (!hasActiveFormalDispute(order)) return false;
  const existing = orderSupportCaseIssueType(order);
  const normalizedIssueType = normalizeIssueType(issueType);
  if (!existing || !normalizedIssueType) return true;
  return existing === normalizedIssueType;
}

function systemSupportMessage(body) {
  return {
    id: `msg-${randomUUID().slice(0, 8)}`,
    body,
    by: "System",
    role: "system",
    userId: null,
    attachments: [],
    createdAt: nowIso(),
  };
}

function supportConversionSummary(ticket, issueType, adminNote) {
  const parts = [
    `Converted from support ticket ${supportEntityId(ticket)}`,
    ticket?.subject ? `Subject: ${ticket.subject}` : null,
    ticket?.category ? `Category: ${ticket.category}` : null,
    issueType ? `Issue type: ${issueType}` : null,
    adminNote ? `Admin note: ${adminNote}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

async function notifySupportConversion(ticket, order, user, issueType) {
  const entityId = order?.orderId || ticket?.orderId || supportEntityId(ticket);
  if (!entityId) return;
  const title = "Support ticket converted to dispute";
  const message = `Support ticket ${supportEntityId(ticket)}${ticket?.subject ? ` · ${ticket.subject}` : ""} was converted to a dispute case for order ${order?.orderId || ticket?.orderId}${issueType ? ` (${issueType})` : ""}.`;
  const tasks = [];
  const sellerShopIds = [...new Set([...(order?.shopIds || []), ticket?.shopId || null].filter(Boolean))];

  if (ticket?.requesterUserId) {
    if (ticket.requesterRole === "customer" || ticket.requesterRole === "driver") {
      tasks.push(createNotification({
        recipientRole: ticket.requesterRole,
        recipientUserId: ticket.requesterUserId,
        shopId: ticket.shopId || null,
        title,
        message,
        type: "dispute_opened",
        entityType: "order",
        entityId,
      }));
    }
  }

  for (const shopId of sellerShopIds) {
    tasks.push(createNotificationsForRole({
      recipientRole: "seller",
      shopId,
      title,
      message,
      type: "dispute_opened",
      entityType: "order",
      entityId,
    }));
  }

  tasks.push(createNotificationsForRole({
    recipientRole: "admin",
    title,
    message,
    type: "dispute_opened",
    entityType: "order",
    entityId,
  }));
  tasks.push(createNotificationsForRole({
    recipientRole: "support",
    title,
    message,
    type: "dispute_opened",
    entityType: "order",
    entityId,
  }));

  await runSupportNotificationTasks(tasks);
}

export async function createSupportTicket(rawPayload, user) {
  const parsed = createSupportTicketSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const err = new Error("Invalid support ticket payload: " + parsed.error.issues.map((issue) => issue.message).join(", "));
    err.status = 422;
    throw err;
  }
  if (!user?.role) {
    const err = new Error("Authentication required.");
    err.status = 401;
    throw err;
  }

  const order = parsed.data.orderId ? await loadOrder(parsed.data.orderId) : null;
  if (parsed.data.orderId && !order) {
    const err = new Error("Order not found.");
    err.status = 404;
    throw err;
  }
  if (order) {
    ensureRequesterOrderScope(order, user);
    ensureNoActiveDispute(order);
  }

  if (user.role === "seller" && !user.shopId) {
    const err = new Error("Seller shop context required.");
    err.status = 403;
    throw err;
  }
  if (user.role === "driver" && !user.driverId) {
    const err = new Error("Driver profile is not linked.");
    err.status = 403;
    throw err;
  }

  const scope = deriveScopeFromRequest(order, user);
  const now = nowIso();
  const ref = supportTicketRef();
  const ticketPayload = {
    id: ref,
    ticketNumber: ref,
    requesterUserId: user.sub,
    requesterName: user.name || "",
    requesterEmail: user.email || "",
    requesterRole: user.role,
    shopId: scope.shopId || null,
    driverId: scope.driverId || null,
    orderId: parsed.data.orderId || null,
    category: parsed.data.category,
    priority: parsed.data.priority || "normal",
    status: "Open",
    subject: parsed.data.subject,
    description: parsed.data.description,
    messages: [messageEntry(parsed.data.description, user, parsed.data.attachments)],
    internalNotes: [],
    assignedToUserId: null,
    assignedToRole: null,
    attachments: normalizeAttachments(parsed.data.attachments),
    convertedOrderId: null,
    convertedDisputeRef: null,
    lastMessageAt: now,
    lastStatusAt: now,
  };

  if (env.mongoUri) {
    const created = await SupportTicket.create(ticketPayload);
    const response = enrichTicketForResponse(created, user);
    await notifySupportTicketCreated(response, user);
    return response;
  }

  seedSupportTickets.set(ref, {
    ...ticketPayload,
    createdAt: now,
    updatedAt: now,
  });
  const response = enrichTicketForResponse(seedSupportTickets.get(ref), user);
  await notifySupportTicketCreated(response, user);
  return response;
}

export async function listSupportTickets(user, rawQuery = {}) {
  if (!user?.role) {
    const err = new Error("Authentication required.");
    err.status = 401;
    throw err;
  }
  const query = normalizeTicketQuery(rawQuery);
  const accessFilter = buildAccessFilter(user);

  if (env.mongoUri) {
    const filter = { ...accessFilter };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.category) filter.category = new RegExp(query.category, "i");
    if (query.orderId) filter.orderId = query.orderId;
    if (query.q) {
      const pattern = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { ticketNumber: pattern },
        { subject: pattern },
        { description: pattern },
        { category: pattern },
        { requesterRole: pattern },
      ];
    }
    const skip = (query.page - 1) * query.limit;
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(query.limit).lean(),
      SupportTicket.countDocuments(filter),
    ]);
    return {
      tickets: tickets.map((ticket) => enrichTicketForResponse(ticket, user)),
      total,
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  let tickets = seedListTickets().filter((ticket) => {
    if (accessFilter.requesterUserId && ticket.requesterUserId !== accessFilter.requesterUserId) return false;
    if (accessFilter.shopId && ticket.shopId !== accessFilter.shopId) return false;
    if (accessFilter.driverId && ticket.driverId !== accessFilter.driverId) return false;
    if (query.status && ticket.status !== query.status) return false;
    if (query.priority && ticket.priority !== query.priority) return false;
    if (query.category && !String(ticket.category || "").toLowerCase().includes(query.category.toLowerCase())) return false;
    if (query.orderId && ticket.orderId !== query.orderId) return false;
    if (query.q) {
      const q = query.q.toLowerCase();
      const haystack = [
        ticket.ticketNumber,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.requesterRole,
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  tickets = tickets.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  const total = tickets.length;
  const start = (query.page - 1) * query.limit;
  return {
    tickets: tickets.slice(start, start + query.limit).map((ticket) => enrichTicketForResponse(ticket, user)),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function listSupportTicketsSnapshot(user, rawQuery = {}) {
  if (!user?.role) {
    const err = new Error("Authentication required.");
    err.status = 401;
    throw err;
  }
  const query = normalizeTicketQuery(rawQuery);
  const accessFilter = buildAccessFilter(user);

  if (env.mongoUri) {
    const filter = { ...accessFilter };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.category) filter.category = new RegExp(query.category, "i");
    if (query.orderId) filter.orderId = query.orderId;
    if (query.q) {
      const pattern = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { ticketNumber: pattern },
        { subject: pattern },
        { description: pattern },
        { category: pattern },
        { requesterRole: pattern },
      ];
    }
    const tickets = await SupportTicket.find(filter).sort({ updatedAt: -1 }).lean();
    return {
      tickets: tickets.map((ticket) => enrichTicketForResponse(ticket, user)),
      total: tickets.length,
      page: 1,
      pages: 1,
    };
  }

  let tickets = seedListTickets().filter((ticket) => {
    if (accessFilter.requesterUserId && ticket.requesterUserId !== accessFilter.requesterUserId) return false;
    if (accessFilter.shopId && ticket.shopId !== accessFilter.shopId) return false;
    if (accessFilter.driverId && ticket.driverId !== accessFilter.driverId) return false;
    if (query.status && ticket.status !== query.status) return false;
    if (query.priority && ticket.priority !== query.priority) return false;
    if (query.category && !String(ticket.category || "").toLowerCase().includes(query.category.toLowerCase())) return false;
    if (query.orderId && ticket.orderId !== query.orderId) return false;
    if (query.q) {
      const q = query.q.toLowerCase();
      const haystack = [
        ticket.ticketNumber,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.requesterRole,
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  tickets = tickets.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  return {
    tickets: tickets.map((ticket) => enrichTicketForResponse(ticket, user)),
    total: tickets.length,
    page: 1,
    pages: 1,
  };
}

export async function getSupportTicket(ticketId, user) {
  if (!user?.role) {
    const err = new Error("Authentication required.");
    err.status = 401;
    throw err;
  }
  const ticket = await loadTicket(ticketId);
  if (!ticket) {
    const err = new Error("Ticket not found.");
    err.status = 404;
    throw err;
  }
  ensureTicketVisibility(ticket, user);
  return enrichTicketForResponse(ticket, user);
}

export async function replySupportTicket(ticketId, rawPayload, user) {
  const parsed = replySupportTicketSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const err = new Error("Invalid reply payload: " + parsed.error.issues.map((issue) => issue.message).join(", "));
    err.status = 422;
    throw err;
  }
  const ticket = await loadTicket(ticketId);
  if (!ticket) {
    const err = new Error("Ticket not found.");
    err.status = 404;
    throw err;
  }
  ensureTicketVisibility(ticket, user);

  const previousStatus = ticket.status;
  const nextStatus = ticketReplyTransition(ticket, user);
  const nextMessage = messageEntry(parsed.data.message, user, parsed.data.attachments);

  if (env.mongoUri) {
    const updated = await SupportTicket.findOneAndUpdate(
      { ticketNumber: ticket.ticketNumber || ticket.id },
      {
        $push: { messages: nextMessage },
        $set: {
          status: nextStatus,
          lastMessageAt: new Date(nextMessage.createdAt),
          lastStatusAt: nextStatus !== previousStatus ? new Date(nextMessage.createdAt) : ticket.lastStatusAt || new Date(nextMessage.createdAt),
        },
      },
      { returnDocument: "after" }
    ).lean();
    const response = enrichTicketForResponse(updated, user);
    await notifySupportTicketReplied(response, user);
    return response;
  }

  ticket.messages = [...(ticket.messages || []), nextMessage];
  ticket.status = nextStatus;
  ticket.lastMessageAt = nextMessage.createdAt;
  ticket.lastStatusAt = nextStatus !== previousStatus ? nextMessage.createdAt : ticket.lastStatusAt || nextMessage.createdAt;
  ticket.updatedAt = nowIso();
  const response = enrichTicketForResponse(ticket, user);
  await notifySupportTicketReplied(response, user);
  return response;
}

export async function updateSupportTicketStatus(ticketId, status, user) {
  if (!isAdminSupport(user)) {
    const err = new Error("Insufficient permissions.");
    err.status = 403;
    throw err;
  }
  const parsed = updateSupportTicketStatusSchema.safeParse({ status });
  if (!parsed.success) {
    const err = new Error("Invalid status.");
    err.status = 422;
    throw err;
  }
  const ticket = await loadTicket(ticketId);
  if (!ticket) {
    const err = new Error("Ticket not found.");
    err.status = 404;
    throw err;
  }

  if (env.mongoUri) {
    const updated = await SupportTicket.findOneAndUpdate(
      { ticketNumber: ticket.ticketNumber || ticket.id },
      { $set: { status: parsed.data.status, lastStatusAt: new Date() } },
      { returnDocument: "after" }
    ).lean();
    const response = enrichTicketForResponse(updated, user);
    await notifySupportTicketStatusChanged(response, user, parsed.data.status);
    return response;
  }

  ticket.status = parsed.data.status;
  ticket.lastStatusAt = nowIso();
  ticket.updatedAt = nowIso();
  const response = enrichTicketForResponse(ticket, user);
  await notifySupportTicketStatusChanged(response, user, parsed.data.status);
  return response;
}

export async function assignSupportTicket(ticketId, rawPayload, user) {
  if (!isAdminSupport(user)) {
    const err = new Error("Insufficient permissions.");
    err.status = 403;
    throw err;
  }
  const parsed = assignSupportTicketSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const err = new Error("Invalid assignment payload: " + parsed.error.issues.map((issue) => issue.message).join(", "));
    err.status = 422;
    throw err;
  }

  let assignedUser = null;
  if (env.mongoUri) {
    assignedUser = await User.findOne({ _id: parsed.data.assignedToUserId }).select("role name email").lean();
    if (!assignedUser) {
      const err = new Error("Assigned user not found.");
      err.status = 404;
      throw err;
    }
    if (!["admin", "support"].includes(assignedUser.role)) {
      const err = new Error("Assigned user must be an admin or support user.");
      err.status = 422;
      throw err;
    }
  }

  const ticket = await loadTicket(ticketId);
  if (!ticket) {
    const err = new Error("Ticket not found.");
    err.status = 404;
    throw err;
  }

  if (env.mongoUri) {
    const updated = await SupportTicket.findOneAndUpdate(
      { ticketNumber: ticket.ticketNumber || ticket.id },
      {
        $set: {
          assignedToUserId: parsed.data.assignedToUserId,
          assignedToUserName: assignedUser?.name || assignedUser?.email || parsed.data.assignedToUserId,
          assignedToUserEmail: assignedUser?.email || "",
          assignedToRole: parsed.data.assignedToRole || null,
          status: ticket.status === "Open" ? "In Progress" : ticket.status,
          lastStatusAt: ticket.status === "Open" ? new Date() : ticket.lastStatusAt || new Date(),
        },
      },
      { returnDocument: "after" }
    ).lean();
    const response = enrichTicketForResponse(updated, user);
    await notifySupportTicketAssigned(response, user);
    return response;
  }

  ticket.assignedToUserId = parsed.data.assignedToUserId;
  ticket.assignedToUserName = assignedUser?.name || assignedUser?.email || parsed.data.assignedToUserId;
  ticket.assignedToUserEmail = assignedUser?.email || "";
  ticket.assignedToRole = parsed.data.assignedToRole || null;
  if (ticket.status === "Open") {
    ticket.status = "In Progress";
    ticket.lastStatusAt = nowIso();
  }
  ticket.updatedAt = nowIso();
  const response = enrichTicketForResponse(ticket, user);
  await notifySupportTicketAssigned(response, user);
  return response;
}

export async function addSupportInternalNote(ticketId, rawPayload, user) {
  if (!isAdminSupport(user)) {
    const err = new Error("Insufficient permissions.");
    err.status = 403;
    throw err;
  }
  const parsed = addSupportInternalNoteSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const err = new Error("Invalid note payload: " + parsed.error.issues.map((issue) => issue.message).join(", "));
    err.status = 422;
    throw err;
  }
  const ticket = await loadTicket(ticketId);
  if (!ticket) {
    const err = new Error("Ticket not found.");
    err.status = 404;
    throw err;
  }
  const note = internalNoteEntry(parsed.data.note, user);

  if (env.mongoUri) {
    const updated = await SupportTicket.findOneAndUpdate(
      { ticketNumber: ticket.ticketNumber || ticket.id },
      {
        $push: { internalNotes: note },
        $set: { lastStatusAt: ticket.lastStatusAt || new Date() },
      },
      { returnDocument: "after" }
    ).lean();
    const response = enrichTicketForResponse(updated, user);
    await notifySupportInternalNote(response, user);
    return response;
  }

  ticket.internalNotes = [...(ticket.internalNotes || []), note];
  ticket.updatedAt = nowIso();
  const response = enrichTicketForResponse(ticket, user);
  await notifySupportInternalNote(response, user);
  return response;
}

export async function convertSupportTicketToDispute(ticketId, rawPayload, user) {
  if (!isAdminSupport(user)) {
    const err = new Error("Insufficient permissions.");
    err.status = 403;
    throw err;
  }
  const parsed = convertSupportTicketToDisputeSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const err = new Error("Invalid conversion payload: " + parsed.error.issues.map((issue) => issue.message).join(", "));
    err.status = 422;
    throw err;
  }

  const ticket = await loadTicket(ticketId);
  if (!ticket) {
    const err = new Error("Ticket not found.");
    err.status = 404;
    throw err;
  }

  if (!ticket.orderId) {
    const err = new Error("Support ticket must be linked to an order before conversion.");
    err.status = 409;
    throw err;
  }

  if (ticket.convertedAt || ticket.convertedOrderId || ticket.convertedDisputeRef) {
    const err = new Error("Support ticket is already converted to a dispute.");
    err.status = 409;
    throw err;
  }

  if (isClosedSupportTicket(ticket) && !parsed.data.overrideClosed) {
    const err = new Error("Closed support tickets require an explicit override before conversion.");
    err.status = 409;
    throw err;
  }

  const order = await loadOrder(ticket.orderId);
  if (!order) {
    const err = new Error("Linked order not found.");
    err.status = 404;
    throw err;
  }

  if (hasDuplicateDispute(order, parsed.data.issueType)) {
    const err = new Error(`Order ${order.orderId} already has an active dispute for this issue.`);
    err.status = 409;
    throw err;
  }

  const convertedAt = nowIso();
  const issueType = parsed.data.issueType;
  const conversionNote = supportConversionSummary(ticket, issueType, parsed.data.adminNote || "");
  const supportTicketUpdate = {
    convertedOrderId: order.orderId,
    convertedDisputeRef: order.orderId,
    convertedIssueType: issueType,
    convertedNote: parsed.data.adminNote || "",
    convertedAt,
    convertedBy: user?.sub || null,
    convertedByRole: user?.role || null,
    status: "Resolved",
    lastStatusAt: convertedAt,
    updatedAt: convertedAt,
    messages: [...(ticket.messages || []), systemSupportMessage("Converted to dispute case.")],
  };

  const orderNote = supportConversionSummary(ticket, issueType, parsed.data.adminNote || "");
  const nextOrderSupportCase = {
    kind: "dispute",
    issueType,
    status: order.supportCase?.status && !["resolved", "rejected", "closed"].includes(String(order.supportCase.status).toLowerCase())
      ? order.supportCase.status
      : "open",
    priority: parsed.data.priorityEscalation ? "urgent" : (ticket.priority === "urgent" ? "urgent" : ticket.priority === "high" ? "high" : "normal"),
    sourceSupportTicketId: ticket.id || ticket.ticketNumber,
    sourceSupportTicketNumber: ticket.ticketNumber,
    convertedAt,
    convertedBy: user?.sub || null,
    convertedByRole: user?.role || null,
    conversionNote: parsed.data.adminNote || "",
    internalNotes: [
      ...(Array.isArray(order.supportCase?.internalNotes) ? order.supportCase.internalNotes : []),
      internalNoteEntry(orderNote, user),
    ],
    lastActionAt: convertedAt,
    escalatedAt: parsed.data.priorityEscalation ? convertedAt : order.supportCase?.escalatedAt || null,
  };

  if (env.mongoUri) {
    const [updatedTicket, updatedOrder] = await Promise.all([
      SupportTicket.findOneAndUpdate(
        { ticketNumber: ticket.ticketNumber || ticket.id },
        { $set: supportTicketUpdate },
        { returnDocument: "after" }
      ).lean(),
      Order.findOneAndUpdate(
        { orderId: order.orderId },
        { $set: { supportCase: nextOrderSupportCase } },
        { returnDocument: "after" }
      ).lean(),
    ]);
    await notifySupportConversion(updatedTicket, updatedOrder, user, issueType);
    return {
      ticket: enrichTicketForResponse(updatedTicket, user),
      order: updatedOrder,
      disputeRef: updatedOrder?.orderId || order.orderId,
    };
  }

  ticket.convertedOrderId = supportTicketUpdate.convertedOrderId;
  ticket.convertedDisputeRef = supportTicketUpdate.convertedDisputeRef;
  ticket.convertedIssueType = supportTicketUpdate.convertedIssueType;
  ticket.convertedNote = supportTicketUpdate.convertedNote;
  ticket.convertedAt = supportTicketUpdate.convertedAt;
  ticket.convertedBy = supportTicketUpdate.convertedBy;
  ticket.convertedByRole = supportTicketUpdate.convertedByRole;
  ticket.status = supportTicketUpdate.status;
  ticket.lastStatusAt = supportTicketUpdate.lastStatusAt;
  ticket.updatedAt = supportTicketUpdate.updatedAt;
  ticket.messages = supportTicketUpdate.messages;

  order.supportCase = nextOrderSupportCase;
  order.updatedAt = convertedAt;

  await notifySupportConversion(ticket, order, user, issueType);
  return {
    ticket: enrichTicketForResponse(ticket, user),
    order,
    disputeRef: order.orderId,
  };
}

export function __resetSupportTicketsForTests() {
  seedSupportTickets.clear();
}
