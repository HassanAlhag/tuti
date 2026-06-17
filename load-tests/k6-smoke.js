/**
 * Tuti load test — smoke + load scenarios
 *
 * Run:   k6 run load-tests/k6-smoke.js
 * Load:  k6 run --vus 100 --duration 60s load-tests/k6-smoke.js
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

const BASE = __ENV.API_URL || "http://localhost:5055/api";

export const options = {
  scenarios: {
    // Smoke test — verify the system works at 1 VU
    smoke: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      tags: { scenario: "smoke" },
    },
    // Ramp up to 100 concurrent users
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "60s", target: 100 },
        { duration: "30s", target: 0 },
      ],
      tags: { scenario: "load" },
      startTime: "35s", // run after smoke
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],   // 95% of requests under 500ms
    http_req_failed: ["rate<0.01"],     // <1% errors
    errors: ["rate<0.01"],
  },
};

export default function () {
  // Health check
  const health = http.get(`${BASE}/health`);
  check(health, { "health ok": (r) => r.status === 200 });
  errorRate.add(health.status !== 200);

  // Public storefront
  const storefront = http.get(`${BASE}/public/storefront`);
  check(storefront, { "storefront ok": (r) => r.status === 200 });
  errorRate.add(storefront.status !== 200);

  // Featured sellers
  const sellers = http.get(`${BASE}/public/featured-sellers`);
  check(sellers, { "featured sellers ok": (r) => r.status === 200 });
  errorRate.add(sellers.status !== 200);

  sleep(1);
}

export function checkoutScenario() {
  const payload = JSON.stringify({
    items: [{ productId: "seed-prod-1", quantity: 1 }],
    deliveryAddress: {
      name: "Load Test User",
      phone: "+971500000000",
      line1: "Test Street 1",
      city: "Dubai",
      country: "AE",
    },
    paymentMethod: "cod",
    customerEmail: "loadtest@tuti.ae",
  });

  const res = http.post(`${BASE}/orders`, payload, {
    headers: { "Content-Type": "application/json", "Idempotency-Key": `lt-${__VU}-${__ITER}` },
  });
  check(res, { "checkout 201": (r) => r.status === 201 });
  errorRate.add(res.status !== 201);
  sleep(2);
}
