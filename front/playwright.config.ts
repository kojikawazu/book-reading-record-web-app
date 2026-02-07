import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm build && pnpm exec next start -p 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_REPOSITORY_DRIVER: "local",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
