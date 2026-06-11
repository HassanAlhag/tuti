import assert from "node:assert/strict";
import test from "node:test";

process.env.MONGO_URI = "";

const { seedRepository } = await import("../../repositories/seedRepository.js");
const { trackMarketplaceEvents } = await import("./events.service.js");

function resetEvents() {
  seedRepository.__resetMarketplaceEventsForTests();
}

function baseEvent(overrides = {}) {
  return {
    eventType: "product_view",
    occurredAt: "2026-06-06T08:15:30.000Z",
    sessionId: "sess_123",
    anonymousId: "anon_456",
    source: "web_product_page",
    route: "/products/oud-lane-no-8",
    context: {
      productId: "prd_1",
      shopId: "shop_1",
      sellerShopId: "shop_1",
      collectionId: null,
      placementId: null,
      placementType: null,
      placementKey: null,
      metadata: {
        viewport: "desktop",
        productSlug: "oud-lane-no-8",
      },
    },
    ...overrides,
  };
}

test("valid single event accepted", async () => {
  resetEvents();
  const result = await trackMarketplaceEvents(baseEvent());
  assert.deepEqual(result, { receivedCount: 1, acceptedCount: 1, rejectedCount: 0 });
  assert.equal(seedRepository.getState().marketplaceEvents.length, 1);
});

test("valid batch accepted", async () => {
  resetEvents();
  const result = await trackMarketplaceEvents({
    events: [
      baseEvent(),
      baseEvent({
        eventType: "placement_impression",
        source: "web_homepage",
        route: "/",
        context: {
          productId: null,
          shopId: "shop_1",
          sellerShopId: "shop_1",
          collectionId: null,
          placementId: "plc_1",
          placementType: "homepage_rail",
          placementKey: "luxury_picks",
          metadata: {
            cardIndex: 0,
            listPosition: 1,
            impressionMethod: "intersection",
          },
        },
      }),
    ],
  });
  assert.deepEqual(result, { receivedCount: 2, acceptedCount: 2, rejectedCount: 0 });
  assert.equal(seedRepository.getState().marketplaceEvents.length, 2);
});

test("invalid event type rejected", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents(baseEvent({ eventType: "not_real" })),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Validation failed.");
      assert.ok(error.details.some((item) => item.field === "eventType"));
      return true;
    }
  );
});

test("missing required fields rejected", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents({
      eventType: "product_view",
      source: "web_product_page",
      route: "/products/oud-lane-no-8",
      context: {
        shopId: "shop_1",
        metadata: {},
      },
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.some((item) => item.field === "occurredAt"));
      assert.ok(error.details.some((item) => item.field === "sessionId"));
      assert.ok(error.details.some((item) => item.field === "context.productId"));
      return true;
    }
  );
});

test("invalid occurredAt rejected", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents(baseEvent({ occurredAt: "not-a-date" })),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.some((item) => item.field === "occurredAt"));
      return true;
    }
  );
});

test("oversized metadata rejected", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents(baseEvent({
      context: {
        productId: "prd_1",
        shopId: "shop_1",
        sellerShopId: "shop_1",
        metadata: {
          viewport: "desktop",
          placementLabel: "x".repeat(1100),
        },
      },
    })),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.some((item) => item.field === "context.metadata"));
      return true;
    }
  );
});

test("unknown metadata key rejected", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents(baseEvent({
      context: {
        productId: "prd_1",
        shopId: "shop_1",
        sellerShopId: "shop_1",
        metadata: {
          viewport: "desktop",
          email: "seller@example.com",
        },
      },
    })),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.some((item) => item.field === "context.metadata.email"));
      return true;
    }
  );
});

test("unknown top-level and context fields rejected", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents({
      ...baseEvent(),
      extraField: "nope",
      context: {
        ...baseEvent().context,
        unexpected: "nope",
      },
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.some((item) => item.field === "extraField"));
      assert.ok(error.details.some((item) => item.field === "context.unexpected"));
      return true;
    }
  );
});

test("privacy-sensitive metadata rejected", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents(baseEvent({
      context: {
        productId: "prd_1",
        shopId: "shop_1",
        sellerShopId: "shop_1",
        metadata: {
          note: "call me",
        },
      },
    })),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.some((item) => item.field === "context.metadata.note"));
      return true;
    }
  );
});

test("client-supplied userId and userRole rejected", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents({
      ...baseEvent(),
      userId: "user-1",
      userRole: "seller",
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.some((item) => item.field === "userId"));
      assert.ok(error.details.some((item) => item.field === "userRole"));
      return true;
    }
  );
});

test("unauthenticated public event accepted", async () => {
  resetEvents();
  const result = await trackMarketplaceEvents(baseEvent(), null);
  assert.deepEqual(result, { receivedCount: 1, acceptedCount: 1, rejectedCount: 0 });
  const stored = seedRepository.getState().marketplaceEvents[0];
  assert.equal(stored.userId, null);
  assert.equal(stored.userRole, null);
});

test("authenticated event attaches user context if available", async () => {
  resetEvents();
  await trackMarketplaceEvents(baseEvent({
    context: {
      productId: "prd_1",
      shopId: null,
      sellerShopId: null,
      collectionId: null,
      placementId: null,
      placementType: null,
      placementKey: null,
      metadata: {
        viewport: "desktop",
        productSlug: "oud-lane-no-8",
      },
    },
  }), { sub: "user-abc", role: "seller", shopId: "shop-auth" });
  const stored = seedRepository.getState().marketplaceEvents[0];
  assert.equal(stored.userId, "user-abc");
  assert.equal(stored.userRole, "seller");
  assert.equal(stored.shopId, "shop-auth");
  assert.equal(stored.sellerShopId, "shop-auth");
});

test("no raw payload echo in response", async () => {
  resetEvents();
  const result = await trackMarketplaceEvents(baseEvent());
  assert.deepEqual(Object.keys(result).sort(), ["acceptedCount", "receivedCount", "rejectedCount"]);
});

test("batch is all-or-nothing", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents({
      events: [
        baseEvent(),
        baseEvent({ eventType: "invalid_type" }),
      ],
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(seedRepository.getState().marketplaceEvents.length, 0);
      return true;
    }
  );
});

test("max batch size enforced", async () => {
  resetEvents();
  await assert.rejects(
    () => trackMarketplaceEvents({
      events: Array.from({ length: 21 }, (_, index) => baseEvent({
        sessionId: `sess_${index}`,
        anonymousId: `anon_${index}`,
        route: `/products/${index}`,
        context: {
          productId: `prd_${index}`,
          shopId: "shop_1",
          sellerShopId: "shop_1",
          metadata: { viewport: "desktop", productSlug: `product-${index}` },
        },
      })),
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.some((item) => item.field === "events"));
      return true;
    }
  );
});

test("placementKey normalized", async () => {
  resetEvents();
  await trackMarketplaceEvents(baseEvent({
    eventType: "placement_click",
    source: "web_homepage",
    route: "/",
    context: {
      productId: null,
      shopId: "shop_1",
      sellerShopId: "shop_1",
      placementId: "plc_1",
      placementType: "homepage_rail",
      placementKey: "Luxury_Picks",
      metadata: {
        cardIndex: 0,
        listPosition: 0,
        impressionMethod: "manual",
      },
    },
  }));
  const stored = seedRepository.getState().marketplaceEvents[0];
  assert.equal(stored.placementKey, "luxury_picks");
});
