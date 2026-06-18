import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "audit-route-test-secret-at-least-32-chars";

const { auditRouter } = await import("./audit.routes.js");

let server;
let baseUrl;

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

async function getAudit(path, user) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { response, payload };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/audit", auditRouter);
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

test("support cannot read admin audit route even with stale audit.read permission", async () => {
  const { response, payload } = await getAudit("/api/admin/audit", {
    sub: "support-001",
    role: "support",
    permissions: ["users.read", "audit.read"],
  });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Insufficient permissions.");
});

test("support cannot export admin audit CSV even with stale audit.read permission", async () => {
  const { response, payload } = await getAudit("/api/admin/audit/export.csv", {
    sub: "support-001",
    role: "support",
    permissions: ["users.read", "audit.read"],
  });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Insufficient permissions.");
});

test("admin can read admin audit route", async () => {
  const { response, payload } = await getAudit("/api/admin/audit", {
    sub: "admin-001",
    role: "admin",
    permissions: ["audit.read"],
  });

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(payload.data.events), true);
});
