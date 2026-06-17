import { test, expect } from "@playwright/test";

test.describe("Build a Box", () => {
  test("page loads and shows the builder", async ({ page }) => {
    await page.goto("/build-a-box");
    await expect(page.locator("body")).toBeVisible();
    // Should show some builder UI — step indicator or product selection
    const builderContent = page.locator("[class*='bab'], [class*='builder'], h1, h2").first();
    await expect(builderContent).toBeVisible({ timeout: 8000 });
  });

  test("mobile viewport — no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/build-a-box");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
