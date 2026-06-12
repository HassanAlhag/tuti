import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { AuditEvent } from "../../models/AuditEvent.js";

// In-memory store for seed mode — bounded ring buffer (max 500 entries).
const SEED_MAX = 500;
const seedStore = [];

function makeEvent({ action, actorId = null, actorName = null, actorRole = null, entityType = null, entityId = null, summary, meta = null }) {
  return {
    id:         `audit-${randomUUID()}`,
    action,
    actorId,
    actorName,
    actorRole,
    entityType,
    entityId,
    summary,
    meta,
    createdAt:  new Date(),
  };
}

export async function logAuditEvent(payload) {
  const event = makeEvent(payload);
  try {
    if (env.mongoUri) {
      await AuditEvent.create(event);
    } else {
      if (seedStore.length >= SEED_MAX) seedStore.splice(0, seedStore.length - SEED_MAX + 1);
      seedStore.unshift(event);
    }
  } catch {
    // Never let audit failures break the request
  }
  return event;
}

export async function listAuditEvents({ action, entityType, entityId, actorId, from, to, page = 1, limit = 50 } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * pageSize;

  if (env.mongoUri) {
    const filter = {};
    if (action)     filter.action     = action;
    if (entityType) filter.entityType = entityType;
    if (entityId)   filter.entityId   = entityId;
    if (actorId)    filter.actorId    = actorId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    const [events, total] = await Promise.all([
      AuditEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      AuditEvent.countDocuments(filter),
    ]);
    return { events, total, page: pageNum, limit: pageSize };
  }

  let events = [...seedStore];
  if (action)     events = events.filter((e) => e.action === action);
  if (entityType) events = events.filter((e) => e.entityType === entityType);
  if (entityId)   events = events.filter((e) => e.entityId === entityId);
  if (actorId)    events = events.filter((e) => e.actorId === actorId);
  if (from) { const d = new Date(from); events = events.filter((e) => new Date(e.createdAt) >= d); }
  if (to)   { const d = new Date(to);   events = events.filter((e) => new Date(e.createdAt) <= d); }

  const total = events.length;
  return { events: events.slice(skip, skip + pageSize), total, page: pageNum, limit: pageSize };
}
