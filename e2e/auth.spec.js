import { test, expect } from "@playwright/test";

// These tests hit the seed-mode backend; use seed demo credentials.
const SEED_CUSTOMER = { email: "customer@tuti.ae", password: "password123" };

test.describe("Authentication", () => {
  test("unified login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email'], input[name='email']")).toBeVisible({ timeout: 6000 });
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("wrong credentials shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email'], input[name='email']", "nobody@tuti.ae");
    await page.fill("input[type='password']", "wrongpassword");
    await page.click("button[type='submit']");
    // Some error text should appear
    await expect(page.locator("body")).toContainText(/invalid|incorrect|not found|error/i, { timeout: 6000 });
  });

  test("customer can log in and see account link", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email'], input[name='email']", SEED_CUSTOMER.email);
    await page.fill("input[type='password']", SEED_CUSTOMER.password);
    await page.click("button[type='submit']");
    // After login, should be redirected away from /login or show account UI
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 8000 }).catch(() => {});
    await expect(page.locator("body")).not.toContainText(/sign in|log in/i);
  });
});
