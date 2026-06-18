import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "sr-route-test-secret-at-least-32-chars";

const { srRouter } = await import("./sr.routes.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const PERIOD = "2026-06";
const REP_CODE = "DXB-REP-TEST";

let server;
let baseUrl;

function resetState() {
  const state = seedRepository.getState();
  state.salesReps = [{
    id: "rep-route-test-001",
    code: REP_CODE,
    name: "Route Test Rep",
    email: "route-rep@example.com",
    phone: "+971500000020",
    plan: "Standard",
    status: "Active",
  }];
}

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

async function srRequest(path, { method = "GET", user, body } = {}) {
  const headers = {};
  if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

function salesRepUser(overrides = {}) {
  return {
    sub: "sales-rep-user-001",
    role: "sales_rep",
    name: "Route Test Rep",
    ...overrides,
  };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/sr", srRouter);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ error: error.message || "Unexpected server error." });
  });

  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(resetState);

test("sales rep can read their targets", async () => {
  const { response, payload } = await srRequest(`/api/sr/targets?period=${PERIOD}`, {
    user: salesRepUser(),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(payload.data, {
    srCode: REP_CODE,
    period: PERIOD,
    gmvTarget: 0,
    referralTarget: 0,
  });
});

test("sales rep target mutation fails closed with 403", async () => {
  const { response, payload } = await srRequest("/api/sr/targets", {
    method: "PUT",
    user: salesRepUser(),
    body: { period: PERIOD, gmvTarget: 50000, referralTarget: 12 },
  });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Sales rep target updates are disabled pending an admin-owned target workflow.");
});

test("failed sales rep target mutation does not change target values", async () => {
  const before = await srRequest(`/api/sr/targets?period=${PERIOD}`, { user: salesRepUser() });
  assert.equal(before.response.status, 200);

  const put = await srRequest("/api/sr/targets", {
    method: "PUT",
    user: salesRepUser(),
    body: { period: PERIOD, gmvTarget: 50000, referralTarget: 12 },
  });
  assert.equal(put.response.status, 403);

  const after = await srRequest(`/api/sr/targets?period=${PERIOD}`, { user: salesRepUser() });
  assert.equal(after.response.status, 200);
  assert.deepEqual(after.payload.data, before.payload.data);
});

test("admin is not granted mutation through the sales rep targets route", async () => {
  const { response, payload } = await srRequest("/api/sr/targets", {
    method: "PUT",
    user: { sub: "admin-001", role: "admin", name: "Admin User" },
    body: { period: PERIOD, gmvTarget: 50000, referralTarget: 12 },
  });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Insufficient permissions.");

  const after = await srRequest(`/api/sr/targets?period=${PERIOD}`, { user: salesRepUser() });
  assert.equal(after.response.status, 200);
  assert.equal(after.payload.data.gmvTarget, 0);
  assert.equal(after.payload.data.referralTarget, 0);
});
