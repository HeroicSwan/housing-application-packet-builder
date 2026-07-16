import { defineConfig, devices } from "@playwright/test";
import { resolveE2eDatabaseUrl } from "./scripts/e2e-database.mjs";

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
if (!e2eDatabaseUrl || process.env.DATABASE_URL !== e2eDatabaseUrl) {
  throw new Error("Run Playwright through `npm run test:e2e` so it receives an isolated database.");
}
resolveE2eDatabaseUrl(process.cwd(), e2eDatabaseUrl);
const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: { baseURL, trace: "on-first-retry" },
  webServer: {
    command: "node scripts/start-e2e-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_MODE: "synthetic",
      DATA_ENCRYPTION_KEY: "",
      DATABASE_URL: e2eDatabaseUrl,
      DOCUMENT_PROCESSOR: "mock",
      E2E_DATABASE_URL: e2eDatabaseUrl,
      E2E_PORT: "3100",
      E2E_RUN_ID: process.env.E2E_RUN_ID ?? "",
      ENABLE_DEMO_LOGIN: "true",
      DEMO_BANNER: "true",
      ENFORCE_PRODUCTION_CONFIG: "false",
      LOCAL_STORAGE_ROOT: process.env.LOCAL_STORAGE_ROOT ?? ".data/e2e",
      MALWARE_SCANNER: "none",
      MONITORING_TOKEN: process.env.MONITORING_TOKEN ?? "synthetic-e2e-monitoring-token-with-32-characters",
      ANTHROPIC_API_KEY: "",
      CEREBRAS_API_KEY: "",
      GEMINI_API_KEY: "",
      GROQ_API_KEY: "",
      MISTRAL_API_KEY: "",
      OPENROUTER_API_KEY: "",
      SAMBANOVA_API_KEY: "",
      S3_ACCESS_KEY_ID: "",
      S3_BUCKET: "",
      S3_ENDPOINT: "",
      S3_SECRET_ACCESS_KEY: "",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "synthetic-e2e-session-secret-with-at-least-32-characters",
      SMTP_HOST: "",
      SMTP_PASSWORD: "",
      SMTP_USER: "",
      STORAGE_PROVIDER: "local",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
