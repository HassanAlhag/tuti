import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "seller-applications-route-test-secret-at-least-32-chars";

const consoleErrors = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  consoleErrors.push(args.map((arg) => String(arg)).join(" "));
};

const { sellerApplicationsRouter } = await import("./seller-applications.routes.js");

console.error = originalConsoleError;

let server;
let baseUrl;

async function postInvalidApplication() {
  const response = await fetch(`${baseUrl}/api/seller-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = await response.json();
  return { response, payload };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/seller-applications", sellerApplicationsRouter);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ error: error.message || "Unexpected server error." });
  });

  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  console.error = originalConsoleError;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("seller applications route import does not emit IPv6 keyGenerator warning", () => {
  assert.equal(
    consoleErrors.some((message) => message.includes("ERR_ERL_KEY_GEN_IPV6")),
    false
  );
});

test("seller applications submit route still rate-limits after 10 submissions", async () => {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const { response } = await postInvalidApplication();
    assert.notEqual(response.status, 429, `request ${attempt} should not be rate-limited`);
  }

  const { response, payload } = await postInvalidApplication();

  assert.equal(response.status, 429);
  assert.deepEqual(payload, { error: "Too many application submissions. Please try again later." });
});
