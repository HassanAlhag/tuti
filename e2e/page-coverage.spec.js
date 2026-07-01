import { test, expect } from "@playwright/test";

// Baseline smoke coverage for customer pages that had zero e2e tests
// before Phase 12 (foundation-cleanup-phase-12.md). Each page gets a
// "loads with its real heading, no console errors" test and a mobile
// overflow check -- not deep interaction coverage, just a safety net
// before these pages get a visual redesign pass.

test.describe("Product Detail", () => {
  test("reachable from Shop and shows product info", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/shop");
    await page.locator(".product-title-button").first().click();
    await expect(page).toHaveURL(/\/products\//);
    await expect(page.locator("h1")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("Support", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/support");
    await expect(page.locator("h1")).toContainText("Help & Support");
  });

  test("mobile viewport — no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/support");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});

test.describe("Legal", () => {
  test("index page loads with heading", async ({ page }) => {
    await page.goto("/legal");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("unknown slug shows not-found, not a stale page", async ({ page }) => {
    await page.goto("/legal/not-a-real-policy");
    await expect(page.locator("body")).toContainText(/couldn't find|not found|unavailable/i);
  });
});

test.describe("Journal", () => {
  test("index page loads with heading", async ({ page }) => {
    await page.goto("/journal");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("mobile viewport — no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/journal");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});

test.describe("Gifting", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/gifting");
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("Fragrance Finder", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/fragrance-finder");
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("Collection", () => {
  test("index page loads with heading", async ({ page }) => {
    await page.goto("/collections");
    await expect(page.locator("h1")).toContainText("Curated perfume edits");
  });

  test("unknown slug shows a graceful empty state, not a crash", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/collections/not-a-real-collection");
    await expect(page.locator("h1")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("Seller / Boutique", () => {
  test("seller recruitment page loads with heading", async ({ page }) => {
    await page.goto("/sell");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("seller brand page reachable from homepage boutique section", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    const sellerLink = page.locator("[class*='boutique'] button, [class*='seller-gallery'] button").first();
    await sellerLink.click();
    await expect(page).toHaveURL(/\/sellers\//);
    await expect(page.locator("h1")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
