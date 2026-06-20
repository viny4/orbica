import { test, expect } from "@playwright/test";

// The mobile hamburger menu is the only way to navigate on phones, so it gets
// its own test. Runs only under the mobile project.
test("mobile menu opens and navigates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only test");

  await page.goto("/");
  // desktop nav links are hidden below md — the hamburger is the entry point
  await page.getByRole("button", { name: /open menu/i }).click();

  const rocketsLink = page.getByRole("link", { name: "Rockets", exact: true });
  await expect(rocketsLink).toBeVisible();
  await rocketsLink.click();
  await expect(page).toHaveURL(/\/rockets/);
});
