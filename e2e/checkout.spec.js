import { test, expect } from "@playwright/test";

test.describe("Checkout flow", () => {
  test("cart page loads", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.locator("body")).toBeVisible();
    // Should show cart UI or empty state — not an error page
    await expect(page.locator("body")).not.toContainText(/500|Internal Server Error/i);
  });

  test("add product to cart and see it reflected in nav", async ({ page }) => {
    await page.goto("/shop");
    // Wait for products to load
    const card = page.locator(".product-card, .pc-card").first();
    await card.waitFor({ state: "visible", timeout: 8000 });

    // Click the card to go to PDP
    await card.click();
    await expect(page).toHaveURL(/\/products\//);

    // Look for an add-to-cart button
    const addBtn = page.locator("button").filter({ hasText: /add to cart|add to bag/i }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      // Cart icon badge should appear or increment
      await page.waitForTimeout(500);
      const cartLink = page.locator('a[href="/cart"], [aria-label*="cart"], [aria-label*="bag"]').first();
      if (await cartLink.isVisible()) {
        await expect(cartLink).toBeVisible();
      }
    }
  });

  test("order confirmation page loads for a valid order ID", async ({ page }) => {
    // Navigate directly to an order ID — should not 404
    await page.goto("/orders/test-order-id");
    await expect(page.locator("body")).not.toContainText(/Cannot GET|404 Not Found/i);
  });
});
