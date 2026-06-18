import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";

const {
  redactHttpRequestForLogs,
  redactSensitiveRequestUrl,
} = await import("./app.js");

test("request logging redacts guest order token query values", () => {
  const redacted = redactSensitiveRequestUrl("/api/orders/ORD-123?token=guest-secret-token&view=confirmation");

  assert.equal(redacted.includes("guest-secret-token"), false);
  assert.equal(redacted, "/api/orders/ORD-123?token=REDACTED&view=confirmation");
});

test("request logging preserves URLs without token query values", () => {
  assert.equal(
    redactSensitiveRequestUrl("/api/orders/ORD-123?view=confirmation"),
    "/api/orders/ORD-123?view=confirmation"
  );
  assert.equal(redactSensitiveRequestUrl("/api/orders/ORD-123"), "/api/orders/ORD-123");
});

test("request logging redacts token on serialized pino-http request objects", () => {
  const serialized = redactHttpRequestForLogs({
    method: "GET",
    url: "/api/orders/ORD-123?token=guest-secret-token",
  });

  assert.equal(serialized.method, "GET");
  assert.equal(serialized.url, "/api/orders/ORD-123?token=REDACTED");
  assert.equal(JSON.stringify(serialized).includes("guest-secret-token"), false);
});
