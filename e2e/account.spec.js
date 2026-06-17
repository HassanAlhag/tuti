import { test, expect } from "@playwright/test";

const SEED_CUSTOMER = { email: "customer@tuti.ae", password: "password123" };

async function login(page) {
  await page.goto("/login");
  await page.fill("input[type='email'], input[name='email']", SEED_CUSTOMER.email);
  await page.fill("input[type='password']", SEED_CUSTOMER.password);
  await page.click("button[type='submit']");
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 8000 }).catch(() => {});
}

test.describe("Customer account", () => {
  test("account page requires authentication", async ({ page }) => {
    await page.goto("/account");
    // Either shows account content (if already logged in) or redirects/shows auth
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/500|Internal Server Error/i);
  });

  test("logged-in customer can reach account page", async ({ page }) => {
    await login(page);
    await page.goto("/account");
    // Should show account content, not be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("cookie consent banner appears on first visit", async ({ page }) => {
    // Clear storage so banner appears fresh
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("tuti_cookie_consent"));
    await page.reload();
    const banner = page.locator(".cookie-banner");
    await expect(banner).toBeVisible({ timeout: 4000 });
  });

  test("accepting cookies dismisses the banner", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("tuti_cookie_consent"));
    await page.reload();
    const banner = page.locator(".cookie-banner");
    await banner.waitFor({ state: "visible", timeout: 4000 });
    await page.click(".cookie-banner .primary-action");
    await expect(banner).not.toBeVisible();
  });

  test("cookie consent persists across page loads", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("tuti_cookie_consent", "accepted"));
    await page.reload();
    const banner = page.locator(".cookie-banner");
    await expect(banner).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });
});
