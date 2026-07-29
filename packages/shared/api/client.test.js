import test, { after, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;
const originalWindow = globalThis.window;
const storage = new Map();
const memoryLocalStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => { storage.set(key, String(value)); },
  removeItem: (key) => { storage.delete(key); },
  clear: () => storage.clear(),
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memoryLocalStorage,
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: memoryLocalStorage },
});

const { authApi, driversApi } = await import("./client.js");
const { useAuthStore } = await import("../store/authStore.js");

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function parseBody(options = {}) {
  return JSON.parse(options.body || "{}");
}

beforeEach(() => {
  storage.clear();
  useAuthStore.getState().clearAuth();
});

afterEach(() => {
  useAuthStore.getState().clearAuth();
  globalThis.fetch = originalFetch;
});

after(() => {
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }

  if (originalWindow === undefined) {
    delete globalThis.window;
    return;
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

test("auth store can update access and refresh tokens together without changing setAuth", () => {
  const user = { id: "user-1", role: "customer" };
  useAuthStore.getState().setAuth(user, "access-1", "refresh-1");
  assert.deepEqual(useAuthStore.getState().user, user);
  assert.equal(useAuthStore.getState().accessToken, "access-1");
  assert.equal(useAuthStore.getState().refreshToken, "refresh-1");

  useAuthStore.getState().updateTokens("access-2", "refresh-2");
  assert.deepEqual(useAuthStore.getState().user, user);
  assert.equal(useAuthStore.getState().accessToken, "access-2");
  assert.equal(useAuthStore.getState().refreshToken, "refresh-2");
});

test("refresh stores rotated refresh token and retries with the new access token", async () => {
  useAuthStore.getState().setAuth({ id: "user-1", role: "customer" }, "access-1", "refresh-1");

  const meAuthHeaders = [];
  const refreshTokensUsed = [];

  globalThis.fetch = async (url, options = {}) => {
    if (url === "/api/auth/me") {
      meAuthHeaders.push(options.headers?.Authorization || "");
      if (meAuthHeaders.length === 1 || meAuthHeaders.length === 3) {
        return jsonResponse(401, { error: "Access expired." });
      }
      return jsonResponse(200, { data: { id: "user-1", role: "customer" } });
    }

    if (url === "/api/auth/refresh") {
      const body = parseBody(options);
      refreshTokensUsed.push(body.refreshToken);
      if (refreshTokensUsed.length === 1) {
        return jsonResponse(200, { data: { accessToken: "access-2", refreshToken: "refresh-2" } });
      }
      return jsonResponse(200, { data: { accessToken: "access-3", refreshToken: "refresh-3" } });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  await authApi.me();
  await authApi.me();

  assert.deepEqual(meAuthHeaders, [
    "Bearer access-1",
    "Bearer access-2",
    "Bearer access-2",
    "Bearer access-3",
  ]);
  assert.deepEqual(refreshTokensUsed, ["refresh-1", "refresh-2"]);
  assert.equal(useAuthStore.getState().accessToken, "access-3");
  assert.equal(useAuthStore.getState().refreshToken, "refresh-3");
});

test("failed refresh clears auth safely", async () => {
  useAuthStore.getState().setAuth({ id: "user-1", role: "customer" }, "access-1", "refresh-1");

  globalThis.fetch = async (url) => {
    if (url === "/api/auth/me") return jsonResponse(401, { error: "Access expired." });
    if (url === "/api/auth/refresh") return jsonResponse(401, { error: "Refresh token revoked." });
    throw new Error(`Unexpected URL: ${url}`);
  };

  await assert.rejects(() => authApi.me(), /Access expired/);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().accessToken, null);
  assert.equal(useAuthStore.getState().refreshToken, null);
});

test("malformed refresh response clears auth safely", async () => {
  useAuthStore.getState().setAuth({ id: "user-1", role: "customer" }, "access-1", "refresh-1");

  globalThis.fetch = async (url) => {
    if (url === "/api/auth/me") return jsonResponse(401, { error: "Access expired." });
    if (url === "/api/auth/refresh") return jsonResponse(200, { data: { accessToken: "access-2" } });
    throw new Error(`Unexpected URL: ${url}`);
  };

  await assert.rejects(() => authApi.me(), /Access expired/);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().accessToken, null);
  assert.equal(useAuthStore.getState().refreshToken, null);
});

test("driversApi uses admin driver-access approval endpoints", async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET", body: parseBody(options) });
    return jsonResponse(200, { data: [] });
  };

  await driversApi.listPendingAccess();
  await driversApi.approveAccess("dsa-123", { canReceiveBroadcasts: true });
  await driversApi.rejectAccess("dsa-456", { reason: "Incomplete documents" });

  assert.deepEqual(calls, [
    { url: "/api/drivers/access/pending", method: "GET", body: {} },
    { url: "/api/drivers/access/dsa-123/approve", method: "POST", body: { canReceiveBroadcasts: true } },
    { url: "/api/drivers/access/dsa-456/reject", method: "POST", body: { reason: "Incomplete documents" } },
  ]);
});
