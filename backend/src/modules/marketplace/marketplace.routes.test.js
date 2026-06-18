import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_SECRET = "marketplace-route-test-secret-at-least-32-chars";

const { marketplaceRouter } = await import("./marketplace.routes.js");
const {
  __injectSeedOrderForTests,
  __resetSeedOrdersForTests,
} = await import("../orders/orders.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");

const REVIEW_PRODUCT_ID = "prf-001";
const CUSTOMER_ID = "customer-route-review-001";

const initialProducts = seedRepository.getState().products.map((product) => structuredClone(product));
const initialReviews = seedRepository.getState().reviews.map((review) => structuredClone(review));

let server;
let baseUrl;

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function resetState() {
  const state = seedRepository.getState();
  state.products = initialProducts.map((product) => structuredClone(product));
  state.reviews = initialReviews.map((review) => structuredClone(review));
  __resetSeedOrdersForTests();
}

function injectDeliveredOrder(customerId = CUSTOMER_ID) {
  __injectSeedOrderForTests({
    orderId: "ORD-MARKETPLACE-REVIEW-ROUTE-001",
    customerId,
    status: "Delivered",
    items: [{ productId: REVIEW_PRODUCT_ID, bundledProductIds: [] }],
  });
}

async function postReview(body, user = null) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;

  const response = await fetch(`${baseUrl}/api/marketplace/reviews`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      productId: REVIEW_PRODUCT_ID,
      rating: 5,
      title: "Route review",
      body: "Submitted through the marketplace route.",
      ...body,
    }),
  });
  const payload = await response.json();
  return { response, payload };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/marketplace", marketplaceRouter);
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

test("marketplace review route keeps guest reviews unverified even when verified is supplied", async () => {
  injectDeliveredOrder();

  const { response, payload } = await postReview({ verified: true, customer: "Guest Reviewer" });

  assert.equal(response.status, 201);
  assert.equal(payload.data.review.customer, "Guest Reviewer");
  assert.equal(payload.data.review.customerId, null);
  assert.equal(payload.data.review.verified, false);
});

test("marketplace review route passes authenticated customer context for verified-purchase review", async () => {
  injectDeliveredOrder(CUSTOMER_ID);

  const { response, payload } = await postReview(
    { verified: false },
    { sub: CUSTOMER_ID, role: "customer", name: "Route Customer" }
  );

  assert.equal(response.status, 201);
  assert.equal(payload.data.review.customer, "Route Customer");
  assert.equal(payload.data.review.customerId, CUSTOMER_ID);
  assert.equal(payload.data.review.verified, true);
});
