import { test, expect } from "@playwright/test";

// Smoke tests: every primary page must render without a server error and show
// its main heading. Catches build/route/SSR regressions across the whole app.
test.describe("core pages", () => {
  test("homepage shows the cinematic hero + stats", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Orbica/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Every Rocket/i);
    await expect(page.getByText(/Satellites tracked/i).first()).toBeVisible();
  });

  for (const path of ["/rockets", "/satellites", "/agencies", "/timeline", "/upcoming", "/intel"]) {
    test(`page ${path} loads`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should not error`).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});
