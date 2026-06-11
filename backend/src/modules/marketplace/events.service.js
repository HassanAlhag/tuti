import { MarketplaceEvent, MARKETPLACE_EVENT_PLACEMENT_TYPES, MARKETPLACE_EVENT_SOURCES, MARKETPLACE_EVENT_TYPES } from "../../models/MarketplaceEvent.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { env } from "../../config/env.js";

const SINGLE_EVENT_KEYS = new Set(["eventType", "occurredAt", "sessionId", "anonymousId", "source", "route", "context"]);
const BATCH_KEYS = new Set(["events"]);
const CONTEXT_KEYS = new Set([
  "productId",
  "shopId",
  "sellerShopId",
  "collectionId",
  "placementId",
  "placementType",
  "placementKey",
  "metadata",
]);
const METADATA_KEYS = new Set([
  "viewport",
  "productSlug",
  "sellerSlug",
  "collectionSlug",
  "placementLabel",
  "surface",
  "theme",
  "referrerType",
  "cardIndex",
  "listPosition",
  "impressionMethod",
]);
const MAX_BATCH_SIZE = 20;
const MAX_ROUTE_LENGTH = 200;
const MAX_ID_LENGTH = 64;
const MAX_PLACEMENT_KEY_LENGTH = 80;
const MAX_METADATA_BYTES = 1024;

function createValidationError(details) {
  const error = new Error("Validation failed.");
  error.status = 400;
  error.details = details;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toText(value) {
  return String(value ?? "").trim();
}

function toNullableText(value, { maxLength = null, lowercase = false } = {}) {
  if (value == null || value === "") return null;
  let text = toText(value);
  if (lowercase) text = text.toLowerCase();
  if (maxLength != null && text.length > maxLength) return null;
  return text;
}

function normalizeSlugLike(value) {
  const text = toText(value).toLowerCase();
  if (!text) return null;
  const normalized = text
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/_{2,}/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");
  if (!normalized || normalized.length > MAX_PLACEMENT_KEY_LENGTH) return null;
  return normalized;
}

function normalizeRoute(value) {
  const route = toText(value);
  if (!route || route.length > MAX_ROUTE_LENGTH) return null;
  return route;
}

function normalizeDate(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeInteger(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeAllowedString(value, { maxLength = 120, allowEmpty = false } = {}) {
  if (value == null) return null;
  const text = toText(value);
  if (!text && !allowEmpty) return null;
  if (text.length > maxLength) return null;
  return text;
}

function validateOptionalTextField(value, { index, field, details, maxLength, lowercase = false, allowEmpty = false }) {
  if (value == null || value === "") return null;
  let text = toText(value);
  if (!text && !allowEmpty) {
    details.push({ index, field, message: "Must be a non-empty string." });
    return null;
  }
  if (lowercase) text = text.toLowerCase();
  if (text.length > maxLength) {
    details.push({ index, field, message: `Must be ${maxLength} characters or fewer.` });
    return null;
  }
  return text;
}

function normalizeEnum(value, allowed, { lowercase = true } = {}) {
  const text = toText(value);
  if (!text) return null;
  const normalized = lowercase ? text.toLowerCase() : text;
  return allowed.includes(normalized) ? normalized : null;
}

function isSensitiveKey(key) {
  const lowered = toText(key).toLowerCase();
  return [
    "email",
    "phone",
    "name",
    "address",
    "payment",
    "orderid",
    "supportticketid",
    "note",
    "comment",
  ].some((needle) => lowered.includes(needle));
}

function validateMetadata(metadata, index, details) {
  if (metadata == null) return {};
  if (!isPlainObject(metadata)) {
    details.push({ index, field: "context.metadata", message: "Metadata must be a flat object." });
    return null;
  }

  const keys = Object.keys(metadata);
  for (const key of keys) {
    if (!METADATA_KEYS.has(key)) {
      details.push({ index, field: `context.metadata.${key}`, message: "Unknown metadata key." });
      continue;
    }
    if (isSensitiveKey(key)) {
      details.push({ index, field: `context.metadata.${key}`, message: "Sensitive metadata fields are not allowed." });
      continue;
    }
    const value = metadata[key];
    if (Array.isArray(value) || isPlainObject(value)) {
      details.push({ index, field: `context.metadata.${key}`, message: "Metadata values must be scalar." });
      continue;
    }

    if (key === "viewport") {
      if (!["mobile", "tablet", "desktop"].includes(toText(value))) {
        details.push({ index, field: `context.metadata.${key}`, message: "Invalid viewport value." });
      }
      continue;
    }

    if (key === "impressionMethod") {
      if (!["intersection", "page_load", "manual"].includes(toText(value))) {
        details.push({ index, field: `context.metadata.${key}`, message: "Invalid impression method." });
      }
      continue;
    }

    if (key === "cardIndex" || key === "listPosition") {
      const parsed = normalizeInteger(value);
      if (parsed == null) {
        details.push({ index, field: `context.metadata.${key}`, message: "Must be an integer greater than or equal to 0." });
      }
      continue;
    }

    if (key === "productSlug" || key === "sellerSlug" || key === "collectionSlug") {
      if (!normalizeSlugLike(value)) {
        details.push({ index, field: `context.metadata.${key}`, message: "Must be a valid slug-style string." });
      }
      continue;
    }

    if (key === "placementLabel" || key === "surface" || key === "theme" || key === "referrerType") {
      const normalized = normalizeAllowedString(value, { maxLength: 80 });
      if (normalized == null) {
        details.push({ index, field: `context.metadata.${key}`, message: "Must be a short text value." });
      }
    }
  }

  const serializedBytes = Buffer.byteLength(JSON.stringify(metadata), "utf8");
  if (serializedBytes > MAX_METADATA_BYTES) {
    details.push({ index, field: "context.metadata", message: "Metadata exceeds the 1 KB limit." });
  }

  return metadata;
}

function validateContext(rawContext, index, details) {
  if (!isPlainObject(rawContext)) {
    details.push({ index, field: "context", message: "Context is required." });
    return null;
  }

  for (const key of Object.keys(rawContext)) {
    if (!CONTEXT_KEYS.has(key)) {
      details.push({ index, field: `context.${key}`, message: "Unknown context field." });
    }
  }

  const context = {
    productId: validateOptionalTextField(rawContext.productId, { index, field: "context.productId", details, maxLength: 80 }),
    shopId: validateOptionalTextField(rawContext.shopId, { index, field: "context.shopId", details, maxLength: 80 }),
    sellerShopId: validateOptionalTextField(rawContext.sellerShopId, { index, field: "context.sellerShopId", details, maxLength: 80 }),
    collectionId: validateOptionalTextField(rawContext.collectionId, { index, field: "context.collectionId", details, maxLength: 80 }),
    placementId: validateOptionalTextField(rawContext.placementId, { index, field: "context.placementId", details, maxLength: 80 }),
    placementType: normalizeEnum(rawContext.placementType, MARKETPLACE_EVENT_PLACEMENT_TYPES, { lowercase: false }),
    placementKey: normalizeSlugLike(rawContext.placementKey),
    metadata: {},
  };

  if (rawContext.metadata != null) {
    const metadata = validateMetadata(rawContext.metadata, index, details);
    if (metadata) context.metadata = metadata;
  }

  return context;
}

function validateSingleEventShape(rawEvent, index, details) {
  if (!isPlainObject(rawEvent) || Array.isArray(rawEvent)) {
    details.push({ index, field: "root", message: "Event must be an object." });
    return null;
  }

  for (const key of Object.keys(rawEvent)) {
    if (!SINGLE_EVENT_KEYS.has(key)) {
      if (key === "userId" || key === "userRole") {
        details.push({ index, field: key, message: "Client-supplied user context is not allowed." });
      } else {
        details.push({ index, field: key, message: "Unknown top-level field." });
      }
    }
  }

  const eventType = normalizeEnum(rawEvent.eventType, MARKETPLACE_EVENT_TYPES, { lowercase: false });
  if (!eventType) {
    details.push({ index, field: "eventType", message: "Unsupported event type." });
  }

  const occurredAt = normalizeDate(rawEvent.occurredAt);
  if (!occurredAt) {
    details.push({ index, field: "occurredAt", message: "occurredAt must be a valid ISO timestamp." });
  }

  const source = normalizeEnum(rawEvent.source, MARKETPLACE_EVENT_SOURCES, { lowercase: false });
  if (!source) {
    details.push({ index, field: "source", message: "Unsupported source." });
  }

  const route = validateOptionalTextField(rawEvent.route, { index, field: "route", details, maxLength: MAX_ROUTE_LENGTH });
  if (!route) {
    details.push({ index, field: "route", message: `Route is required and must be at most ${MAX_ROUTE_LENGTH} characters.` });
  }

  const sessionId = validateOptionalTextField(rawEvent.sessionId, { index, field: "sessionId", details, maxLength: MAX_ID_LENGTH });
  const anonymousId = validateOptionalTextField(rawEvent.anonymousId, { index, field: "anonymousId", details, maxLength: MAX_ID_LENGTH });
  if (!sessionId && !anonymousId) {
    details.push({ index, field: "sessionId", message: "Provide sessionId or anonymousId." });
  }

  const context = validateContext(rawEvent.context, index, details);

  if (context) {
    const hasProductRef = Boolean(context.productId || context.metadata?.productSlug);
    const hasSellerRef = Boolean(context.sellerShopId || context.metadata?.sellerSlug);
    const hasCollectionRef = Boolean(context.collectionId || context.metadata?.collectionSlug);
    const isPlacementEvent = eventType === "placement_impression" || eventType === "placement_click";

    if ((eventType === "product_view" || eventType === "product_click") && !hasProductRef) {
      details.push({
        index,
        field: "context.productId",
        message: "Provide productId or metadata.productSlug.",
      });
    }

    if (eventType === "seller_brand_view" && !hasSellerRef) {
      details.push({
        index,
        field: "context.sellerShopId",
        message: "Provide sellerShopId or metadata.sellerSlug.",
      });
    }

    if (eventType === "collection_view" && !hasCollectionRef) {
      details.push({
        index,
        field: "context.collectionId",
        message: "Provide collectionId or metadata.collectionSlug.",
      });
    }

    if (isPlacementEvent) {
      if (!context.placementType) {
        details.push({
          index,
          field: "context.placementType",
          message: "placementType is required for placement events.",
        });
      }
      if (!context.placementKey) {
        details.push({
          index,
          field: "context.placementKey",
          message: "placementKey is required for placement events.",
        });
      }
    }
  }

  if (details.length) return null;

  return {
    eventType,
    occurredAt,
    sessionId,
    anonymousId,
    source,
    route,
    context,
  };
}

function validateEnvelope(payload) {
  const details = [];
  if (!isPlainObject(payload) || Array.isArray(payload)) {
    return { events: [], details: [{ index: 0, field: "root", message: "Request body must be an object." }] };
  }

  if ("events" in payload) {
    for (const key of Object.keys(payload)) {
      if (!BATCH_KEYS.has(key)) {
        details.push({ index: 0, field: key, message: "Unknown top-level field." });
      }
    }

    if (!Array.isArray(payload.events) || payload.events.length === 0) {
      details.push({ index: 0, field: "events", message: "events must be a non-empty array." });
      return { events: [], details };
    }

    if (payload.events.length > MAX_BATCH_SIZE) {
      details.push({ index: 0, field: "events", message: `Batch size limit is ${MAX_BATCH_SIZE} events.` });
      return { events: [], details };
    }

    const normalizedEvents = [];
    payload.events.forEach((event, index) => {
      const normalized = validateSingleEventShape(event, index, details);
      if (normalized) normalizedEvents.push(normalized);
    });

    if (details.length) return { events: [], details };
    return { events: normalizedEvents, details: [] };
  }

  for (const key of Object.keys(payload)) {
    if (!SINGLE_EVENT_KEYS.has(key)) {
      details.push({ index: 0, field: key, message: "Unknown top-level field." });
    }
  }

  const normalizedEvent = validateSingleEventShape(payload, 0, details);
  if (details.length || !normalizedEvent) {
    return { events: [], details };
  }
  return { events: [normalizedEvent], details: [] };
}

function attachActorContext(event, actor) {
  if (!actor) return event;

  const next = { ...event };
  const userId = toNullableText(actor.sub || actor.userId || actor.id, { maxLength: 80 });
  const userRole = toNullableText(actor.role, { maxLength: 40 });

  if (userId) next.userId = userId;
  if (userRole) next.userRole = userRole;

  if (userRole === "seller" && toNullableText(actor.shopId, { maxLength: 80 })) {
    const sellerShopId = toNullableText(actor.shopId, { maxLength: 80 });
    if (!next.context.sellerShopId) next.context.sellerShopId = sellerShopId;
    if (!next.context.shopId) next.context.shopId = sellerShopId;
  }

  return next;
}

function getStoredEvents() {
  if (env.mongoUri) {
    return null;
  }
  const state = seedRepository.getState();
  if (!Array.isArray(state.marketplaceEvents)) state.marketplaceEvents = [];
  return state.marketplaceEvents;
}

async function persistEvents(events) {
  if (env.mongoUri) {
    await MarketplaceEvent.insertMany(events.map((event) => ({
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      sessionId: event.sessionId,
      anonymousId: event.anonymousId,
      userId: event.userId || null,
      userRole: event.userRole || null,
      shopId: event.context.shopId || null,
      sellerShopId: event.context.sellerShopId || null,
      productId: event.context.productId || null,
      collectionId: event.context.collectionId || null,
      placementId: event.context.placementId || null,
      placementType: event.context.placementType || null,
      placementKey: event.context.placementKey || null,
      source: event.source,
      route: event.route,
      metadata: event.context.metadata || {},
    })));
    return;
  }

  const store = getStoredEvents();
  for (const event of events) {
    store.unshift({
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      sessionId: event.sessionId,
      anonymousId: event.anonymousId,
      userId: event.userId || null,
      userRole: event.userRole || null,
      shopId: event.context.shopId || null,
      sellerShopId: event.context.sellerShopId || null,
      productId: event.context.productId || null,
      collectionId: event.context.collectionId || null,
      placementId: event.context.placementId || null,
      placementType: event.context.placementType || null,
      placementKey: event.context.placementKey || null,
      source: event.source,
      route: event.route,
      metadata: event.context.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function trackMarketplaceEvents(payload, actor = null) {
  const { events, details } = validateEnvelope(payload);
  if (details.length) {
    throw createValidationError(details);
  }

  const acceptedEvents = events.map((event) => attachActorContext(event, actor));
  await persistEvents(acceptedEvents);

  return {
    receivedCount: events.length,
    acceptedCount: acceptedEvents.length,
    rejectedCount: 0,
  };
}

export {
  MARKETPLACE_EVENT_PLACEMENT_TYPES,
  MARKETPLACE_EVENT_SOURCES,
  MARKETPLACE_EVENT_TYPES,
};
