import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import sharp from "sharp";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "media-routes-test-secret-at-least-32-chars-long";
// Deterministic regardless of what's in the real .env, and isolates local
// disk writes to a throwaway tmp dir -- see the identical pattern (and
// rationale) in media.service.test.js. Must run before app.js (and
// therefore config/env.js) is ever imported.
process.env.UPLOAD_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "tuti-media-routes-test-"));
process.env.AWS_REGION = "";
process.env.AWS_S3_BUCKET = "";
process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_CLOUDFRONT_DOMAIN = "";

const { createApp } = await import("../../app.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

// A real, Sharp-decodable JPEG -- the upload pipeline now runs a genuine
// Sharp decode/resize/encode, so a hand-constructed header-only buffer (as
// used before Sharp replaced the hand-rolled parser) is no longer enough.
const REAL_JPEG = await sharp({ create: { width: 1600, height: 1600, channels: 3, background: { r: 150, g: 100, b: 50 } } }).jpeg().toBuffer();

const SELLER_A = { sub: "media-route-seller-a", role: "seller", shopId: "shop-media-route-a" };
const SELLER_B = { sub: "media-route-seller-b", role: "seller", shopId: "shop-media-route-b" };
const ADMIN = { sub: "media-route-admin", role: "admin" };
const DRIVER = { sub: "media-route-driver", role: "driver", driverId: "driver-media-route-001" };

let server;
let baseUrl;

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function resetState() {
  const state = seedRepository.getState();
  state.shops.length = 0;
  state.shops.push(
    { id: SELLER_A.shopId, name: "Media Route Shop A", ownerId: SELLER_A.sub, status: "Approved", category: "perfume", categories: ["perfume"] },
    { id: SELLER_B.shopId, name: "Media Route Shop B", ownerId: SELLER_B.sub, status: "Approved", category: "perfume", categories: ["perfume"] }
  );
  state.mediaAssets.length = 0;
  state.productMediaLinks.length = 0;
  state.products.length = 0;
}

before(async () => {
  const app = createApp();
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

beforeEach(resetState);

async function uploadImage(user, { filename = "photo.jpg", buffer = REAL_JPEG, type = "image/jpeg" } = {}) {
  const form = new FormData();
  form.append("image", new Blob([buffer], { type }), filename);
  const response = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
    body: form,
  });
  return { response, payload: await response.json() };
}

async function apiFetch(pathname, { method = "GET", user = null, body = null } = {}) {
  const headers = {};
  if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, payload: await response.json() };
}

// ── Upload endpoint ──────────────────────────────────────────────────────

test("upload endpoint: seller upload is namespaced to their verified shop", async () => {
  const { response, payload } = await uploadImage(SELLER_A);
  assert.equal(response.status, 200);
  assert.ok(payload.data.mediaAssetId);
  assert.ok(payload.data.url.includes(`shops/${SELLER_A.shopId}/media/`));
});

test("upload endpoint: forged shopId claim is rejected by requireOwnedShop before any file is processed", async () => {
  const forgedUser = { sub: "attacker-media", role: "seller", shopId: SELLER_A.shopId };
  const { response } = await uploadImage(forgedUser);
  assert.equal(response.status, 403);
});

test("upload endpoint: admin upload is namespaced under admin, not a shop", async () => {
  const { response, payload } = await uploadImage(ADMIN);
  assert.equal(response.status, 200);
  assert.ok(payload.data.url.includes("admin/media/"));
});

test("upload endpoint: driver proof-of-delivery upload now succeeds (previously 403)", async () => {
  const { response, payload } = await uploadImage(DRIVER);
  assert.equal(response.status, 200);
  assert.ok(payload.data.url.includes(`drivers/${DRIVER.driverId}/media/`));
});

test("upload endpoint: customer role is rejected", async () => {
  const { response } = await uploadImage({ sub: "customer-media", role: "customer" });
  assert.equal(response.status, 403);
});

test("upload endpoint: non-image content is rejected even with an image filename", async () => {
  const { response, payload } = await uploadImage(SELLER_A, { buffer: Buffer.from("not an image"), filename: "fake.jpg" });
  assert.equal(response.status, 400);
  assert.ok(payload.error);
});

test("upload endpoint: GIF is rejected for this phase", async () => {
  const { response, payload } = await uploadImage(SELLER_A, { buffer: Buffer.from("GIF89a"), filename: "animated.gif", type: "image/gif" });
  assert.equal(response.status, 400);
  assert.ok(payload.error);
});

test("upload endpoint: a GIF mislabeled with an accepted Content-Type is still rejected by the real content sniff", async () => {
  const { response, payload } = await uploadImage(SELLER_A, { buffer: Buffer.from("GIF89a"), filename: "sneaky.jpg", type: "image/jpeg" });
  assert.equal(response.status, 400);
  assert.match(payload.error, /GIF/);
});

test("upload endpoint: a file over the 8MB cap is rejected with 413", async () => {
  const big = Buffer.alloc(8 * 1024 * 1024 + 1024, 0);
  big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff; // real-looking JPEG magic bytes, size is what matters here
  const { response, payload } = await uploadImage(SELLER_A, { buffer: big, filename: "huge.jpg" });
  assert.equal(response.status, 413);
  assert.match(payload.error, /8 MB/);
});

test("upload endpoint: response includes resolvable thumbnail/card/detail URLs, and mediaAssetId/width/height, but never a checksum", async () => {
  const { response, payload } = await uploadImage(SELLER_A);
  assert.equal(response.status, 200);
  assert.ok(payload.data.urls.thumbnail);
  assert.ok(payload.data.urls.card);
  assert.ok(payload.data.urls.detail);
  assert.equal(payload.data.width, 1600);
  assert.equal(payload.data.height, 1600);
  assert.equal(payload.data.checksum, undefined);
});

// ── Seller media routes ──────────────────────────────────────────────────

test("seller media routes: seller cannot list, open, edit, or delete another shop's media", async () => {
  const { payload: uploaded } = await uploadImage(SELLER_B);
  const mediaId = uploaded.data.mediaAssetId;

  const list = await apiFetch("/api/seller/media", { user: SELLER_A });
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.data.items.some((item) => item.id === mediaId), false);

  const detail = await apiFetch(`/api/seller/media/${mediaId}`, { user: SELLER_A });
  assert.equal(detail.response.status, 404);

  const edit = await apiFetch(`/api/seller/media/${mediaId}`, { method: "PATCH", user: SELLER_A, body: { altText: "hijack" } });
  assert.equal(edit.response.status, 404);

  const del = await apiFetch(`/api/seller/media/${mediaId}`, { method: "DELETE", user: SELLER_A });
  assert.equal(del.response.status, 404);
});

test("seller media routes: forged shopId in query is ignored -- listing is always scoped server-side", async () => {
  await uploadImage(SELLER_A);
  const { payload: otherUpload } = await uploadImage(SELLER_B);

  const { response, payload } = await apiFetch(`/api/seller/media?shopId=${SELLER_B.shopId}`, { user: SELLER_A });
  assert.equal(response.status, 200);
  // Even though a shopId query param for shop B was supplied, the seller
  // only ever sees their own (shop A) media -- the param is simply not
  // read by the route/service at all.
  assert.equal(payload.data.items.every((item) => item.shopId === SELLER_A.shopId), true);
  assert.equal(payload.data.items.some((item) => item.id === otherUpload.data.mediaAssetId), false);
});

test("seller media routes: legitimate owner can list, open, and edit their own media", async () => {
  const { payload: uploaded } = await uploadImage(SELLER_A);
  const mediaId = uploaded.data.mediaAssetId;

  const list = await apiFetch("/api/seller/media", { user: SELLER_A });
  assert.equal(list.payload.data.items.some((item) => item.id === mediaId), true);

  const detail = await apiFetch(`/api/seller/media/${mediaId}`, { user: SELLER_A });
  assert.equal(detail.response.status, 200);

  const edit = await apiFetch(`/api/seller/media/${mediaId}`, { method: "PATCH", user: SELLER_A, body: { altText: "Reserve oud bottle" } });
  assert.equal(edit.response.status, 200);
  assert.equal(edit.payload.data.altText, "Reserve oud bottle");
});

// ── Admin media routes ─────────────────────────────────────────────────────

test("admin media routes: admin lists media across every shop and can moderate", async () => {
  const { payload: a } = await uploadImage(SELLER_A);
  await uploadImage(SELLER_B);

  const list = await apiFetch("/api/admin/media", { user: ADMIN });
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.data.total, 2);

  const moderated = await apiFetch(`/api/admin/media/${a.data.mediaAssetId}/moderation`, { method: "PATCH", user: ADMIN, body: { action: "approve" } });
  assert.equal(moderated.response.status, 200);
  assert.equal(moderated.payload.data.moderationStatus, "approved");
});

test("admin media routes: non-admin cannot access admin media endpoints", async () => {
  const list = await apiFetch("/api/admin/media", { user: SELLER_A });
  assert.equal(list.response.status, 403);
});
