import { defineConfig, devices } from "@playwright/test";
const port = process.env.PORT ?? "4180";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: `http://127.0.0.1:${port}/frontier-command/`,
    headless: true,
    launchOptions: { executablePath: process.env.FRONTIER_BROWSER },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node scripts/serve.mjs",
    url: `http://127.0.0.1:${port}/frontier-command/`,
    reuseExistingServer: true,
  },
});
