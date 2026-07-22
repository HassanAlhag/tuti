import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Forces the Mongo-mode branch of register(). No real MongoDB connection is
// made in this file -- every Mongoose model method register() touches is
// mocked below. This environment has no MongoDB replica set available (the
// project deliberately avoids adding a new test-only dependency such as
// mongodb-memory-server for this hotfix), so this test verifies what a unit
// test *can* verify without one: that a Shop-creation failure inside the
// transaction callback propagates out of register() as a rejection rather
// than silently succeeding, and that both User.create and Shop.create are
// invoked against the *same* session object (i.e. genuinely inside one
// transaction boundary, not two independent unguarded writes). The actual
// atomic-rollback guarantee itself is MongoDB's own well-tested transaction
// semantics -- this test's job is only to confirm register() drives that
// API correctly.
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/auth-hotfix-mock-only";

const mongoose = (await import("mongoose")).default;
const { register } = await import("./auth.service.js");
const { User } = await import("../../models/User.js");
const { Shop } = await import("../../models/Shop.js");

function fakeSession() {
  return {
    id: Symbol("fake-session"),
    async withTransaction(fn) {
      return fn();
    },
    async endSession() {},
  };
}

function mockShopExistsAlwaysFree() {
  mock.method(Shop, "exists", () => ({
    session: async () => false,
  }));
}

afterEach(() => {
  mock.restoreAll();
});

test("seller registration creates the User and Shop inside a single Mongo transaction", async () => {
  const session = fakeSession();
  mock.method(mongoose, "startSession", async () => session);
  mockShopExistsAlwaysFree();
  mock.method(User, "findOne", () => ({
    then: (resolve) => resolve(null),
  }));

  const sessionsSeenByUserCreate = [];
  const sessionsSeenByShopCreate = [];

  mock.method(User, "create", async (docs, opts) => {
    sessionsSeenByUserCreate.push(opts?.session);
    return [{ _id: "mock-user-id", ...docs[0], save: async () => {} }];
  });
  mock.method(Shop, "create", async (docs, opts) => {
    sessionsSeenByShopCreate.push(opts?.session);
    return [{ id: docs[0].id, name: docs[0].name }];
  });

  const { user } = await register({
    name: "Transactional Seller",
    email: "transactional-seller@example.com",
    password: "supersecret123",
    role: "seller",
    shopName: "Transactional Boutique",
    shopCategory: "perfume",
  });

  assert.equal(mongoose.startSession.mock.callCount(), 1);
  assert.equal(sessionsSeenByUserCreate.length, 1);
  assert.equal(sessionsSeenByShopCreate.length, 1);
  assert.equal(sessionsSeenByUserCreate[0], session, "User.create must run inside the transaction session");
  assert.equal(sessionsSeenByShopCreate[0], session, "Shop.create must run inside the same transaction session");
  assert.ok(user.shopId?.startsWith("shop-"));
});

test("a Shop-creation failure inside the transaction rejects register() -- no orphaned seller user is returned", async () => {
  const session = fakeSession();
  mock.method(mongoose, "startSession", async () => session);
  mockShopExistsAlwaysFree();
  mock.method(User, "findOne", () => ({
    then: (resolve) => resolve(null),
  }));

  let userCreateCalls = 0;
  mock.method(User, "create", async (docs) => {
    userCreateCalls += 1;
    return [{ _id: "mock-user-id", ...docs[0], save: async () => {} }];
  });
  mock.method(Shop, "create", async () => {
    throw new Error("simulated Shop.create failure");
  });

  await assert.rejects(
    register({
      name: "Doomed Seller",
      email: "doomed-seller@example.com",
      password: "supersecret123",
      role: "seller",
      shopName: "Doomed Boutique",
      shopCategory: "perfume",
    }),
    /simulated Shop\.create failure/
  );

  assert.equal(userCreateCalls, 1, "User.create was attempted inside the transaction");
});

test("registration never reads a client-supplied shopId, even in Mongo mode", async () => {
  const session = fakeSession();
  mock.method(mongoose, "startSession", async () => session);
  mockShopExistsAlwaysFree();
  mock.method(User, "findOne", () => ({
    then: (resolve) => resolve(null),
  }));

  let capturedUserPayload = null;
  mock.method(User, "create", async (docs) => {
    capturedUserPayload = docs[0];
    return [{ _id: "mock-user-id", ...docs[0], save: async () => {} }];
  });
  mock.method(Shop, "create", async (docs) => [{ id: docs[0].id, name: docs[0].name }]);

  const { user } = await register({
    name: "Claim Injector",
    email: "claim-injector@example.com",
    password: "supersecret123",
    role: "seller",
    shopName: "Injector Boutique",
    shopCategory: "perfume",
    shopId: "shop-oud-lane", // stripped by registerSchema before register() ever runs in production,
                             // but register() itself must also never read it defensively
  });

  assert.notEqual(capturedUserPayload.shopId, "shop-oud-lane");
  assert.notEqual(user.shopId, "shop-oud-lane");
});
