import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads and shows the brand name", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Tuti/i);
    // Brand mark or nav should be visible
    await expect(page.locator("body")).toBeVisible();
  });

  test("navigates to the shop", async ({ page }) => {
    await page.goto("/");
    // Find a link to /shop and click it
    const shopLink = page.locator('a[href="/shop"], a[href*="shop"]').first();
    await expect(shopLink).toBeVisible();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test("mobile viewport renders without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
  });
});
