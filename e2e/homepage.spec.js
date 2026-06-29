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
    // Shop navigation is a button (SPA history.pushState routing, not an
    // <a href>), so assert on visible behaviour rather than markup shape.
    // At narrow widths the category rail collapses into the hamburger
    // drawer, so the button has to be reached differently per viewport.
    const shopButton = page.getByRole("button", { name: "Shop", exact: true });
    if (!(await shopButton.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }
    await expect(shopButton.first()).toBeVisible();
    await shopButton.first().click();
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
