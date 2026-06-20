import { defineConfig, devices } from "@playwright/test";

// E2E config. Runs against a running web app (reuses one if already up locally;
// starts `npm run start` otherwise). Point E2E_BASE_URL at a deployed URL to
// smoke-test production. The live tracker needs the Go API on :8090 too.
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Pixel 5 is Chromium-based, so no extra browser download is needed.
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  // Skip auto-starting a server when E2E_BASE_URL is set (e.g. prod smoke test).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
