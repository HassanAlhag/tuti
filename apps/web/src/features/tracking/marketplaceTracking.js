import { useEffect, useMemo, useRef } from "react";
import { marketplaceEventsApi } from "@tuti/shared/api/client.js";

const VIEWPORT_BREAKPOINTS = {
  tablet: 1024,
  mobile: 768,
};

const ALLOWED_METADATA_KEYS = new Set([
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

let memoryAnonymousId = "";
let memorySessionId = "";

function canUseStorage(kind) {
  try {
    if (typeof window === "undefined" || !window[kind]) return false;
    const probe = "__tuti_probe__";
    window[kind].setItem(probe, probe);
    window[kind].removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function readStorage(kind, key) {
  try {
    if (!canUseStorage(kind)) return "";
    return window[kind].getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(kind, key, value) {
  try {
    if (!canUseStorage(kind)) return false;
    window[kind].setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function makeId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSlugLike(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  return text
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/_{2,}/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function normalizeMetadata(metadata = {}) {
  if (!isPlainObject(metadata)) return {};
  const next = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (value == null || value === "") continue;

    if (key === "viewport") {
      const viewport = String(value).toLowerCase();
      if (["mobile", "tablet", "desktop"].includes(viewport)) next.viewport = viewport;
      continue;
    }

    if (key === "impressionMethod") {
      const method = String(value);
      if (["intersection", "page_load", "manual"].includes(method)) next.impressionMethod = method;
      continue;
    }

    if (key === "cardIndex" || key === "listPosition") {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed >= 0) next[key] = parsed;
      continue;
    }

    if (["productSlug", "sellerSlug", "collectionSlug"].includes(key)) {
      const slug = normalizeSlugLike(value);
      if (slug) next[key] = slug;
      continue;
    }

    const text = String(value).trim();
    if (text) next[key] = text.slice(0, 120);
  }
  return next;
}

export function getOrCreateAnonymousId() {
  const storageKey = "tuti_anon_id";
  const stored = readStorage("localStorage", storageKey);
  if (stored) return stored;
  if (memoryAnonymousId) return memoryAnonymousId;

  const generated = makeId("anon");
  memoryAnonymousId = generated;
  writeStorage("localStorage", storageKey, generated);
  return generated;
}

export function getOrCreateSessionId() {
  const storageKey = "tuti_session_id";
  const stored = readStorage("sessionStorage", storageKey);
  if (stored) return stored;
  if (memorySessionId) return memorySessionId;

  const generated = makeId("sess");
  memorySessionId = generated;
  writeStorage("sessionStorage", storageKey, generated);
  return generated;
}

export function getViewportType() {
  if (typeof window === "undefined") return "desktop";
  const width = Number(window.innerWidth || 0);
  if (width < VIEWPORT_BREAKPOINTS.mobile) return "mobile";
  if (width < VIEWPORT_BREAKPOINTS.tablet) return "tablet";
  return "desktop";
}

function normalizeContext(context = {}) {
  const next = {};
  if (!isPlainObject(context)) return next;

  const allowedKeys = [
    "productId",
    "shopId",
    "sellerShopId",
    "collectionId",
    "placementId",
    "placementType",
    "placementKey",
    "metadata",
  ];

  for (const key of allowedKeys) {
    if (!(key in context)) continue;
    const value = context[key];
    if (value == null || value === "") continue;
    if (key === "metadata") {
      const metadata = normalizeMetadata(value);
      if (Object.keys(metadata).length) next.metadata = metadata;
      continue;
    }
    next[key] = String(value).trim();
  }

  if (!next.metadata) next.metadata = {};
  return next;
}

function buildEventPayload(event = {}) {
  const route = String(event.route || "").trim();
  const source = String(event.source || "").trim();
  const eventType = String(event.eventType || "").trim();
  const context = normalizeContext(event.context);

  return {
    eventType,
    occurredAt: event.occurredAt || new Date().toISOString(),
    sessionId: event.sessionId || getOrCreateSessionId(),
    anonymousId: event.anonymousId || getOrCreateAnonymousId(),
    source,
    route,
    context: {
      ...context,
      metadata: {
        ...(context.metadata || {}),
        viewport: getViewportType(),
      },
    },
  };
}

function buildPlacementContext(context = {}) {
  return normalizeContext(context);
}

export async function trackMarketplaceEvent(eventOrEvents) {
  try {
    const payload = Array.isArray(eventOrEvents)
      ? eventOrEvents.map((event) => buildEventPayload(event))
      : buildEventPayload(eventOrEvents);
    await marketplaceEventsApi.track(payload);
    return true;
  } catch {
    return false;
  }
}

export async function trackPageView({ eventType, source, route, context }) {
  return trackMarketplaceEvent({
    eventType,
    source,
    route,
    context,
  });
}

export async function trackPlacementImpression(context = {}, options = {}) {
  return trackMarketplaceEvent({
    eventType: "placement_impression",
    source: "web_homepage",
    route: "/",
    context: buildPlacementContext({
      ...context,
      metadata: {
        ...(context?.metadata || {}),
        impressionMethod: options.impressionMethod || "intersection",
      },
    }),
  });
}

export async function trackPlacementClick(context = {}) {
  return trackMarketplaceEvent({
    eventType: "placement_click",
    source: "web_homepage",
    route: "/",
    context: buildPlacementContext(context),
  });
}

export function usePlacementImpressionTracker(context = {}, enabled = true) {
  const ref = useRef(null);
  const firedRef = useRef(false);
  const contextSignature = useMemo(() => JSON.stringify(buildPlacementContext(context)), [context]);

  useEffect(() => {
    if (!enabled || firedRef.current) return undefined;
    const element = ref.current;
    if (!element) return undefined;

    const sendImpression = (impressionMethod = "intersection") => {
      if (firedRef.current) return;
      firedRef.current = true;
      void trackPlacementImpression(context, { impressionMethod });
    };

    if (typeof IntersectionObserver === "undefined") {
      const timeoutId = window.setTimeout(() => sendImpression("page_load"), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          sendImpression("intersection");
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [contextSignature, enabled, context]);

  return ref;
}
