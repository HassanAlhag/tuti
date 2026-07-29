import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Forces requireOwnedShop's Mongo-mode branch -- User.findById/Shop.findOne
// are mocked below, so no real database connection is ever made. Must be
// set before config/env.js is imported (transitively, via auth.js).
process.env.MONGO_URI = "mongodb://mock-host/mock-db";
process.env.JWT_SECRET = "requireownedshop-unit-test-secret-32-chars-x";

const { requireOwnedShop } = await import("./auth.js");
const { User } = await import("../models/User.js");
const { Shop } = await import("../models/Shop.js");

/**
 * A minimal thenable that mirrors the exact chains requireOwnedShop calls
 * against real Mongoose queries: `.select().lean().catch(fn)` for User,
 * and both `.lean()` alone and `.lean().catch(fn)` for Shop. Every chain
 * method returns the same object; awaiting it (or its .catch()) resolves
 * to `value` -- there is no real database involved anywhere in this file.
 */
function mockQuery(value) {
  const query = {
    select() { return query; },
    lean() { return query; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
    catch() { return Promise.resolve(value); },
  };
  return query;
}

let originalUserFindById;
let originalShopFindOne;

beforeEach(() => {
  originalUserFindById = User.findById;
  originalShopFindOne = Shop.findOne;
});

afterEach(() => {
  User.findById = originalUserFindById;
  Shop.findOne = originalShopFindOne;
});

function fakeReq(user) {
  return { user };
}

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function runMiddleware(user) {
  const req = fakeReq(user);
  const res = fakeRes();
  let nextCalled = false;
  let nextErr;
  await requireOwnedShop(req, res, (err) => { nextCalled = true; nextErr = err; });
  return { req, res, nextCalled, nextErr };
}

const SUB = "user-mongo-001";

test("1. seller with a valid User.shopId opens the dashboard", async () => {
  User.findById = () => mockQuery({ shopId: "shop-valid" });
  Shop.findOne = (filter) => {
    if (filter.id === "shop-valid") return mockQuery({ id: "shop-valid", ownerId: SUB });
    return mockQuery(null);
  };

  const { req, nextCalled, nextErr, res } = await runMiddleware({ sub: SUB, role: "seller", shopId: "shop-valid" });
  assert.equal(nextCalled, true);
  assert.equal(nextErr, undefined);
  assert.equal(res.statusCode, null);
  assert.equal(req.ownedShopId, "shop-valid");
});

test("2. seller with missing User.shopId but matching Shop.ownerId still resolves", async () => {
  User.findById = () => mockQuery({ shopId: null });
  Shop.findOne = (filter) => {
    if (filter.ownerId === SUB) return mockQuery({ id: "shop-owned-by-fallback", ownerId: SUB });
    return mockQuery(null);
  };

  const { req, nextCalled, res } = await runMiddleware({ sub: SUB, role: "seller", shopId: null });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
  assert.equal(req.ownedShopId, "shop-owned-by-fallback");
});

test("3. seller with a stale/wrong User.shopId but a matching owned Shop resolves safely", async () => {
  User.findById = () => mockQuery({ shopId: "shop-stale-wrong" });
  Shop.findOne = (filter) => {
    if (filter.id === "shop-stale-wrong") return mockQuery({ id: "shop-stale-wrong", ownerId: "someone-else" });
    if (filter.ownerId === SUB) return mockQuery({ id: "shop-real-owned", ownerId: SUB });
    return mockQuery(null);
  };

  const { req, nextCalled, res } = await runMiddleware({ sub: SUB, role: "seller", shopId: "shop-stale-wrong" });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
  // Resolves to the shop actually owned by this user, never the stale claim.
  assert.equal(req.ownedShopId, "shop-real-owned");
});

test("4. seller cannot claim another seller's shop", async () => {
  User.findById = () => mockQuery({ shopId: "shop-belongs-to-other-seller" });
  Shop.findOne = (filter) => {
    if (filter.id === "shop-belongs-to-other-seller") return mockQuery({ id: "shop-belongs-to-other-seller", ownerId: "other-seller-999" });
    // This user owns nothing themselves -- the fallback must not invent an owned shop.
    if (filter.ownerId === SUB) return mockQuery(null);
    return mockQuery(null);
  };

  const { req, res, nextCalled } = await runMiddleware({ sub: SUB, role: "seller", shopId: "shop-belongs-to-other-seller" });
  // A 403 response ends the request directly -- next() is never called,
  // exactly like a real Express middleware short-circuit.
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "Shop ownership could not be verified.");
  assert.equal(req.ownedShopId, undefined);
});

test("5. seller with no owned shop anywhere receives a controlled 403", async () => {
  User.findById = () => mockQuery(null);
  Shop.findOne = () => mockQuery(null);

  const { res, nextCalled } = await runMiddleware({ sub: SUB, role: "seller", shopId: null });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "Shop ownership could not be verified.");
});

test("6. non-seller roles (admin/driver/customer) bypass ownership resolution entirely -- no query is even made", async () => {
  let userFindByIdCalled = false;
  let shopFindOneCalled = false;
  User.findById = () => { userFindByIdCalled = true; return mockQuery(null); };
  Shop.findOne = () => { shopFindOneCalled = true; return mockQuery(null); };

  for (const role of ["admin", "driver", "customer"]) {
    userFindByIdCalled = false;
    shopFindOneCalled = false;
    const { nextCalled, res } = await runMiddleware({ sub: "someone", role });
    assert.equal(nextCalled, true, `${role} should pass through`);
    assert.equal(res.statusCode, null);
    assert.equal(userFindByIdCalled, false, `${role} should never trigger a User lookup`);
    assert.equal(shopFindOneCalled, false, `${role} should never trigger a Shop lookup`);
  }
});

test("a seller JWT with no sub at all is rejected with a controlled 403, not a crash", async () => {
  const { res, nextCalled } = await runMiddleware({ sub: null, role: "seller", shopId: "shop-anything" });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("a database error while resolving ownership is passed to next(err), never swallowed as a 403", async () => {
  User.findById = () => mockQuery({ shopId: "shop-x" });
  Shop.findOne = () => { throw new Error("simulated database outage"); };

  const { nextCalled, nextErr } = await runMiddleware({ sub: SUB, role: "seller", shopId: "shop-x" });
  assert.equal(nextCalled, true);
  assert.ok(nextErr instanceof Error);
  assert.match(nextErr.message, /simulated database outage/);
});
