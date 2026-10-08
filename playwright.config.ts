import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the Expo web build, signed out, on a freshly
// seeded database. Runs its own API (:8090, beatboxd_e2e DB — see
// scripts/e2e-api.sh) and Metro (:8091) so it never touches the dev stack on
// :8080/:8081 or its data. Needs Docker (for the compose Postgres) and Go.
const API_PORT = 8090;
const WEB_PORT = 8091;

export default defineConfig({
  testDir: "e2e",
  // First load waits on Metro bundling the whole app.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "bash scripts/e2e-api.sh",
      env: { E2E_API_PORT: String(API_PORT) },
      url: `http://localhost:${API_PORT}/healthz`,
      // Always reset: reusing a server would mean reusing whatever state a
      // previous run left in its DB.
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `npx expo start --web --port ${WEB_PORT}`,
      env: { CI: "1", BROWSER: "none", EXPO_PUBLIC_DEV_API_PORT: String(API_PORT) },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
