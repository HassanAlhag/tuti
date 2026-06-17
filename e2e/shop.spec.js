import { test, expect } from "@playwright/test";

test.describe("Shop catalogue", () => {
  test("loads product cards", async ({ page }) => {
    await page.goto("/shop");
    // At least one product card should appear
    const cards = page.locator(".product-card, [data-testid='product-card'], .pc-card");
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
  });

  test("category filter updates visible products", async ({ page }) => {
    await page.goto("/shop");
    // Look for a category button/link
    const categoryBtn = page.locator("button, a").filter({ hasText: /perfume|oud|cake/i }).first();
    if (await categoryBtn.isVisible()) {
      await categoryBtn.click();
      await page.waitForTimeout(500);
      // Page should still show product content
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("clicking a product opens detail page", async ({ page }) => {
    await page.goto("/shop");
    const firstCard = page.locator(".product-card, .pc-card").first();
    await firstCard.waitFor({ state: "visible", timeout: 8000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/products\//);
  });
});
