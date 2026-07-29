import test from "node:test";
import assert from "node:assert/strict";
import { classifyLoadError } from "./loadErrorClassifier.js";

test("a 403 (ownership rejection) is classified as 'ownership', not a connection failure", () => {
  const error = new Error("Shop ownership could not be verified.");
  error.status = 403;
  assert.equal(classifyLoadError(error), "ownership");
});

test("a 401 (session invalid even after refresh) is classified as 'unauthenticated'", () => {
  const error = new Error("Authentication required.");
  error.status = 401;
  assert.equal(classifyLoadError(error), "unauthenticated");
});

// 9. backend outage shows a connection error, not an ownership error --
// a raw fetch() failure (server unreachable, DNS failure, CORS block) has
// no .status at all, since no HTTP response was ever received.
test("a network/connection failure (no .status at all) is classified as 'network', never 'ownership'", () => {
  const error = new Error("Failed to fetch");
  assert.equal(classifyLoadError(error), "network");
});

test("a 500 or other unexpected server error is classified as 'network' (generic connection-style messaging)", () => {
  const error = new Error("Unexpected server error.");
  error.status = 500;
  assert.equal(classifyLoadError(error), "network");
});
