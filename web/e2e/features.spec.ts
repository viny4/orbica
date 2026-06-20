import { test, expect } from "@playwright/test";

// The interactive features — 3D rocket viewer, the live WebGL tracker, the live
// WebSocket stream, search-to-track, and the command palette. These are the
// parts most likely to break silently, so they get real assertions.

test("rocket detail renders specs and an interactive 3D model", async ({ page }) => {
  await page.goto("/rockets");
  // open the first rocket (card links to /rockets/<slug>, not the nav /rockets)
  await page.locator('a[href^="/rockets/"]').first().click();
  await expect(page).toHaveURL(/\/rockets\/.+/);
  await expect(page.getByText(/Specifications/i)).toBeVisible();

  // switch to the 3D model → a WebGL canvas must mount
  await page.getByRole("button", { name: /3D Model/i }).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });
});

test("live tracker renders the globe and connects to the WebSocket stream", async ({ page }) => {
  await page.goto("/track");
  await expect(page.getByRole("heading", { name: /Live Tracker/i })).toBeVisible();
  // the 3D globe
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  // WS connected → the sidebar shows "<N> live"
  await expect(page.getByText(/\d[\d,]*\s*live/i).first()).toBeVisible({ timeout: 30_000 });
});

test("search-to-track finds a satellite and enables Ride Along", async ({ page }) => {
  await page.goto("/track");
  await page.getByText(/\d[\d,]*\s*live/i).first().waitFor({ timeout: 30_000 });

  await page.getByPlaceholder(/Track a satellite/i).fill("STARLINK");
  const firstResult = page.locator("ul li button").first();
  await expect(firstResult).toBeVisible({ timeout: 15_000 });
  await firstResult.click();

  // tracking a satellite unlocks the ride-along view
  await expect(page.getByRole("button", { name: /Ride Along/i })).toBeVisible({ timeout: 15_000 });
});

test("command palette searches the catalog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^search/i }).first().click();
  const input = page.getByPlaceholder(/Search rockets, satellites/i);
  await expect(input).toBeVisible();
  await input.fill("falcon");
  // a matching result row appears inside the palette
  await expect(page.locator("li button").filter({ hasText: /falcon/i }).first()).toBeVisible({
    timeout: 15_000,
  });
});
