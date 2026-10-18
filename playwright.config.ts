import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3200);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "uz-UZ" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use a pre-installed Chromium when the bundled one isn't available (e.g. sandboxed CI).
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: {
    // Production server in demo mode with its own throwaway data directory.
    command: `rm -rf .data-e2e && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DEMO_DATA_DIR: ".data-e2e",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
    },
  },
});
