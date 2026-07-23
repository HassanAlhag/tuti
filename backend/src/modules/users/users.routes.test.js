import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "users-route-test-secret-at-least-32-chars";

const { usersRouter } = await import("./users.routes.js");
const { User } = await import("../../models/User.js");
const { Shop } = await import("../../models/Shop.js");

let server;
let baseUrl;
let fakeUsers;
let fakeShops;

function makeShopDoc(shop) {
  const doc = {
    ...shop,
    save: async () => {
      const index = fakeShops.findIndex((item) => item.id === doc.id);
      if (index >= 0) fakeShops[index] = doc;
      else fakeShops.push(doc);
      return doc;
    },
    toObject: () => ({ ...doc }),
  };
  return doc;
}

function makeUserDoc(user) {
  const doc = {
    _id: user._id,
    name: user.name,
    email: user.email,
    password: user.password || "password123",
    role: user.role,
    isActive: user.isActive !== false,
    permissions: user.permissions || [],
    shopId: user.shopId || null,
    shopCategory: user.shopCategory || null,
    shopCategories: user.shopCategories || [],
    save: async () => {
      fakeUsers.set(doc._id, doc);
      return doc;
    },
    toObject: () => ({
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      role: doc.role,
      isActive: doc.isActive,
      permissions: doc.permissions,
      shopId: doc.shopId,
      shopCategory: doc.shopCategory,
      shopCategories: doc.shopCategories,
    }),
  };
  return doc;
}

function cloneUser(user) {
  return user?.toObject ? user.toObject() : { ...user };
}

function queryFor(result) {
  return {
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    select() { return this; },
    lean() {
      return Promise.resolve(Array.isArray(result) ? result.map(cloneUser) : result);
    },
  };
}

function resetModelStubs() {
  fakeUsers = new Map([
    ["target-user-001", makeUserDoc({
      _id: "target-user-001",
      name: "Target User",
      email: "target@example.com",
      role: "customer",
      permissions: ["catalog.browse"],
    })],
  ]);
  fakeShops = [];

  User.findOne = async (filter = {}) => {
    if (!filter.email) return null;
    return [...fakeUsers.values()].find((user) => {
      if (user.email !== filter.email) return false;
      if (filter._id?.$ne && user._id === filter._id.$ne) return false;
      return true;
    }) || null;
  };
  User.create = async (payload) => {
    const id = `created-user-${fakeUsers.size + 1}`;
    const doc = makeUserDoc({ _id: id, ...payload });
    fakeUsers.set(id, doc);
    return doc;
  };
  User.findById = async (id) => fakeUsers.get(id) || null;
  User.find = (filter = {}) => {
    let users = [...fakeUsers.values()];
    if (filter.role) users = users.filter((user) => user.role === filter.role);
    if (Object.prototype.hasOwnProperty.call(filter, "isActive")) {
      users = users.filter((user) => user.isActive === filter.isActive);
    }
    return queryFor(users);
  };
  User.countDocuments = async (filter = {}) => {
    let users = [...fakeUsers.values()];
    if (filter.role) users = users.filter((user) => user.role === filter.role);
    if (Object.prototype.hasOwnProperty.call(filter, "isActive")) {
      users = users.filter((user) => user.isActive === filter.isActive);
    }
    return users.length;
  };

  Shop.find = () => ({
    lean: async () => fakeShops.map((shop) => ({ ...shop })),
  });
  Shop.findOne = async (filter = {}) => fakeShops.find((shop) => shop.id === filter.id) || null;
  Shop.create = async (payload) => {
    const shop = makeShopDoc(payload);
    fakeShops.push(shop);
    return shop;
  };
}

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

async function usersRequest(path, { method = "GET", user, body } = {}) {
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

function adminUser(overrides = {}) {
  return {
    sub: "admin-001",
    role: "admin",
    name: "Admin User",
    ...overrides,
  };
}

function supportWithManage(overrides = {}) {
  return {
    sub: "support-001",
    role: "support",
    name: "Support User",
    permissions: ["users.read", "users.manage"],
    ...overrides,
  };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", usersRouter);
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

beforeEach(resetModelStubs);

test("authorized users with users.read can list users", async () => {
  const { response, payload } = await usersRequest("/api/users", {
    user: { ...supportWithManage(), permissions: ["users.read"] },
  });

  assert.equal(response.status, 200);
  assert.equal(payload.data.total, 1);
  assert.equal(payload.data.users[0].email, "target@example.com");
});

test("authorized users with users.read can read role definitions", async () => {
  const { response, payload } = await usersRequest("/api/users/roles", {
    user: { ...supportWithManage(), permissions: ["users.read"] },
  });

  assert.equal(response.status, 200);
  assert.ok(payload.data.roles.some((role) => role.id === "admin"));
  assert.ok(payload.data.permissions.some((permission) => permission.id === "users.manage"));
});

test("admin can create users", async () => {
  const { response, payload } = await usersRequest("/api/users", {
    method: "POST",
    user: adminUser(),
    body: {
      name: "Created Customer",
      email: "created@example.com",
      password: "password123",
      role: "customer",
    },
  });

  assert.equal(response.status, 201);
  assert.equal(payload.data.email, "created@example.com");
  assert.equal(payload.data.role, "customer");
});

test("admin can update users", async () => {
  const { response, payload } = await usersRequest("/api/users/target-user-001", {
    method: "PATCH",
    user: adminUser(),
    body: { name: "Updated Target" },
  });

  assert.equal(response.status, 200);
  assert.equal(payload.data.name, "Updated Target");
});

test("admin can update seller entitlements on the actual Shop categories", async () => {
  fakeUsers.set("seller-user-001", makeUserDoc({
    _id: "seller-user-001",
    name: "Seller User",
    email: "seller@example.com",
    role: "seller",
    shopId: "shop-seller-001",
    shopCategory: "perfume",
    shopCategories: ["perfume"],
  }));
  fakeShops.push(makeShopDoc({
    id: "shop-seller-001",
    name: "Seller Shop",
    owner: "Seller User",
    ownerId: "seller-user-001",
    city: "Dubai",
    category: "perfume",
    categories: ["perfume"],
  }));

  const { response, payload } = await usersRequest("/api/users/seller-user-001", {
    method: "PATCH",
    user: adminUser(),
    body: { shopCategories: ["cake", "dessert"] },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(payload.data.shopCategories, ["cake", "dessert"]);
  assert.equal(payload.data.shopCategory, "cake");
  const shop = fakeShops.find((item) => item.id === "shop-seller-001");
  assert.deepEqual(shop.categories, ["cake", "dessert"]);
  assert.equal(shop.category, "cake");
});

test("admin mixed entitlement synchronizes User and Shop compatibility fields", async () => {
  fakeUsers.set("seller-user-002", makeUserDoc({
    _id: "seller-user-002",
    name: "Mixed Seller",
    email: "mixed@example.com",
    role: "seller",
    shopId: "shop-mixed-001",
    shopCategory: "perfume",
    shopCategories: ["perfume"],
  }));
  fakeShops.push(makeShopDoc({
    id: "shop-mixed-001",
    name: "Mixed Shop",
    owner: "Mixed Seller",
    ownerId: "seller-user-002",
    city: "Dubai",
    category: "perfume",
    categories: ["perfume"],
  }));

  const { response, payload } = await usersRequest("/api/users/seller-user-002", {
    method: "PATCH",
    user: adminUser(),
    body: { shopCategories: ["perfume", "cake"] },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(payload.data.shopCategories, ["perfume", "cake"]);
  assert.equal(payload.data.shopCategory, "mixed");
  const shop = fakeShops.find((item) => item.id === "shop-mixed-001");
  assert.deepEqual(shop.categories, ["perfume", "cake"]);
  assert.equal(shop.category, "mixed");
});

test("admin can reset user password", async () => {
  const { response, payload } = await usersRequest("/api/users/target-user-001/password", {
    method: "PATCH",
    user: adminUser(),
    body: { password: "new-password-123" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(payload.data, { ok: true });
});

test("support with stale users.manage cannot create users", async () => {
  const { response, payload } = await usersRequest("/api/users", {
    method: "POST",
    user: supportWithManage(),
    body: {
      name: "Created Admin",
      email: "created-admin@example.com",
      password: "password123",
      role: "admin",
    },
  });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Insufficient permissions.");
  assert.equal(fakeUsers.size, 1);
});

test("support with stale users.manage cannot update users", async () => {
  const { response, payload } = await usersRequest("/api/users/target-user-001", {
    method: "PATCH",
    user: supportWithManage(),
    body: { role: "admin" },
  });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Insufficient permissions.");
  assert.equal(fakeUsers.get("target-user-001").role, "customer");
});

test("support with stale users.manage cannot reset user password", async () => {
  const originalPassword = fakeUsers.get("target-user-001").password;
  const { response, payload } = await usersRequest("/api/users/target-user-001/password", {
    method: "PATCH",
    user: supportWithManage(),
    body: { password: "new-password-123" },
  });

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Insufficient permissions.");
  assert.equal(fakeUsers.get("target-user-001").password, originalPassword);
});
