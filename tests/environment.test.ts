import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/lib/env-schema";

const baseEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "file:./environment-test.db",
  SESSION_SECRET: "synthetic-test-session-secret-with-32-characters",
};

const productionEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://hapb_app:application-role@database.internal:5432/hapb",
  SYSTEM_DATABASE_URL: "postgresql://hapb_system:system-role@database.internal:5432/hapb",
  DATA_MODE: "production",
  PRODUCTION_DATA_ACKNOWLEDGEMENT: "I_UNDERSTAND_REAL_DATA_REQUIRES_ORGANIZATIONAL_APPROVAL",
  SESSION_SECRET: Buffer.from("7Kq!4pZ9vN2xR8mT5wY1cF6jL3sD0hB7uG4aE9iO2rU8nM5k").toString("utf8"),
  ENABLE_DEMO_LOGIN: "false",
  DEMO_BANNER: "false",
  SECURE_COOKIES: "true",
  APP_URL: "https://housing.nonprofit-services.org",
  DOCUMENT_PROCESSOR: "disabled",
  STORAGE_PROVIDER: "s3",
  S3_BUCKET: "housing-production-private",
  S3_REGION: "us-east-1",
  S3_ENDPOINT: "https://objects.nonprofit-services.org",
  S3_PRIVATE_BUCKET_ACKNOWLEDGEMENT: "I_CONFIRMED_THE_PRODUCTION_BUCKET_IS_PRIVATE",
  DATA_ENCRYPTION_KEY: Buffer.from("9fB2vQ7mK4xN8cR1sT6wY3aD0hJ5uLzE").toString("base64"),
  DATA_ENCRYPTION_KEY_ID: "2026-07-rotation-01",
  SMTP_HOST: "smtp.nonprofit-services.org",
  EMAIL_FROM: "housing@nonprofit-services.org",
  MALWARE_SCANNER: "clamav",
  MONITORING_TOKEN: Buffer.from("mN7!qP2xV9kR4tY8cD1fG6hJ3sL0wB5uA2eI7oZ9rT4vX8nC").toString("utf8"),
  CASE_RETENTION_DAYS: "2555",
  DOCUMENT_RETENTION_DAYS: "2555",
  AUDIT_RETENTION_DAYS: "3650",
  AUDIT_LOGGING_ENABLED: "true",
  BACKUP_ENABLED: "true",
  BACKUP_DESTINATION: "s3://housing-backups/production",
  BACKUP_RETENTION_DAYS: "35",
  WORKER_ENABLED: "true",
  WORKER_HEALTH_URL: "http://worker.internal:8787/health",
  MIGRATIONS_REQUIRED: "true",
  LOG_LEVEL: "info",
};

describe("data mode", () => {
  it("defaults to synthetic mode", () => {
    expect(parseEnvironment(baseEnvironment).DATA_MODE).toBe("synthetic");
  });

  it("rejects unknown modes and requires an explicit production acknowledgement", () => {
    expect(() => parseEnvironment({ ...baseEnvironment, DATA_MODE: "real" })).toThrow("Invalid option");
    expect(() => parseEnvironment({ ...baseEnvironment, DATA_MODE: "production" })).toThrow("Production data mode requires the documented operator acknowledgement.");
  });

  it("accepts an explicitly hardened production configuration", () => {
    expect(parseEnvironment(productionEnvironment).DATA_MODE).toBe("production");
  });

  it("cannot opt out of hardening when production enforcement is requested", () => {
    expect(() => parseEnvironment({ ...baseEnvironment, ENFORCE_PRODUCTION_CONFIG: "true" })).toThrow("Production enforcement requires DATA_MODE=production");
    expect(parseEnvironment({ ...productionEnvironment, ENFORCE_PRODUCTION_CONFIG: "true" }).ENFORCE_PRODUCTION_CONFIG).toBe(true);
  });

  it("accepts empty optional values from the example environment", () => {
    const parsed = parseEnvironment({
      ...baseEnvironment,
      OPENROUTER_HTTP_REFERER: "",
      S3_ENDPOINT: "",
      DATA_ENCRYPTION_KEY: "",
    });
    expect(parsed.OPENROUTER_HTTP_REFERER).toBeUndefined();
    expect(parsed.S3_ENDPOINT).toBeUndefined();
    expect(parsed.DATA_ENCRYPTION_KEY).toBeUndefined();
  });

  it("accepts only canonical Base64 for exactly 32 encryption-key bytes", () => {
    const validKey = Buffer.alloc(32, 1).toString("base64");
    expect(parseEnvironment({ ...baseEnvironment, DATA_ENCRYPTION_KEY: validKey }).DATA_ENCRYPTION_KEY).toBe(validKey);
    expect(() => parseEnvironment({ ...baseEnvironment, DATA_ENCRYPTION_KEY: Buffer.alloc(31, 1).toString("base64") })).toThrow(
      "DATA_ENCRYPTION_KEY must be canonical Base64 for exactly 32 bytes.",
    );
    expect(() => parseEnvironment({ ...baseEnvironment, DATA_ENCRYPTION_KEY: "replace-with-a-key" })).toThrow(
      "DATA_ENCRYPTION_KEY must be canonical Base64 for exactly 32 bytes.",
    );
  });
});

describe("fail-closed production configuration", () => {
  const unsafeConfigurations: Array<[string, Partial<NodeJS.ProcessEnv>, string]> = [
    ["non-production runtime", { NODE_ENV: "development" }, "NODE_ENV"],
    ["demo login", { ENABLE_DEMO_LOGIN: "true" }, "Demo login must be disabled"],
    ["demo banner", { DEMO_BANNER: "true" }, "synthetic demo banner"],
    ["synthetic seed context", { SYNTHETIC_SEED_CONTEXT: "seed" }, "Synthetic seed context"],
    ["default admin password", { DEFAULT_ADMIN_PASSWORD: "unsafe-default" }, "Default administrator passwords"],
    ["SQLite", { DATABASE_URL: "file:./production.db" }, "valid authenticated PostgreSQL"],
    ["shared database role", { SYSTEM_DATABASE_URL: productionEnvironment.DATABASE_URL }, "separate least-privilege roles"],
    ["same database principal with a different URL", { SYSTEM_DATABASE_URL: "postgresql://hapb_app:different-password@database.internal:5432/hapb?schema=system" }, "separate least-privilege roles"],
    ["malformed PostgreSQL URL", { SYSTEM_DATABASE_URL: "postgresql://" }, "valid authenticated PostgreSQL"],
    ["weak session secret", { SESSION_SECRET: Buffer.alloc(48, 97).toString("utf8") }, "SESSION_SECRET"],
    ["insecure cookies", { SECURE_COOKIES: "false" }, "Secure cookies"],
    ["HTTP application URL", { APP_URL: "http://housing.nonprofit-services.org" }, "HTTPS"],
    ["local storage", { STORAGE_PROVIDER: "local" }, "private object storage"],
    ["unconfirmed private bucket", { S3_PRIVATE_BUCKET_ACKNOWLEDGEMENT: undefined }, "bucket is private"],
    ["insecure storage endpoint", { S3_ENDPOINT: "http://objects.nonprofit-services.org" }, "endpoints must use HTTPS"],
    ["missing encryption key", { DATA_ENCRYPTION_KEY: undefined }, "non-development encryption key"],
    ["development encryption key ID", { DATA_ENCRYPTION_KEY_ID: "primary" }, "non-development encryption key"],
    ["low-diversity encryption key", { DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") }, "non-development encryption key"],
    ["disabled malware scanner", { MALWARE_SCANNER: "none" }, "ClamAV"],
    ["missing SMTP", { SMTP_HOST: undefined }, "SMTP_HOST"],
    ["missing monitoring", { MONITORING_TOKEN: undefined }, "MONITORING_TOKEN"],
    ["missing case retention", { CASE_RETENTION_DAYS: undefined }, "case-retention"],
    ["missing document retention", { DOCUMENT_RETENTION_DAYS: undefined }, "document-retention"],
    ["missing audit retention", { AUDIT_RETENTION_DAYS: undefined }, "audit-retention"],
    ["disabled audit logging", { AUDIT_LOGGING_ENABLED: "false" }, "Audit logging"],
    ["disabled backups", { BACKUP_ENABLED: "false" }, "backup destination"],
    ["missing backup destination", { BACKUP_DESTINATION: undefined }, "backup destination"],
    ["missing backup retention", { BACKUP_RETENTION_DAYS: undefined }, "backup destination"],
    ["disabled worker", { WORKER_ENABLED: "false" }, "durable worker"],
    ["missing worker health endpoint", { WORKER_HEALTH_URL: undefined }, "worker health endpoint"],
    ["unchecked migrations", { MIGRATIONS_REQUIRED: "false" }, "migration verification"],
    ["debug logging", { LOG_LEVEL: "debug" }, "Debug logging"],
    ["mock document processor", { DOCUMENT_PROCESSOR: "mock" }, "mock processor"],
    ["default sender domain", { EMAIL_FROM: "no-reply@example.org" }, "organization-controlled domain"],
  ];

  it.each(unsafeConfigurations)("rejects %s", (_name, override, expectedMessage) => {
    expect(() => parseEnvironment({ ...productionEnvironment, ...override })).toThrow(expectedMessage);
  });

  it("requires selected AI providers, credentials, and an approval record", () => {
    expect(() => parseEnvironment({
      ...productionEnvironment,
      DOCUMENT_PROCESSOR: "gemini",
      APPROVED_AI_PROVIDERS: "gemini",
      AI_PROVIDER_APPROVAL_ID: "vendor-review-2026-07",
    })).toThrow("GEMINI_API_KEY is required");

    expect(() => parseEnvironment({
      ...productionEnvironment,
      DOCUMENT_PROCESSOR: "gemini",
      GEMINI_API_KEY: Buffer.from("Gm9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8"),
      AI_PROVIDER_APPROVAL_ID: "vendor-review-2026-07",
    })).toThrow("documented vendor approval");

    expect(() => parseEnvironment({
      ...productionEnvironment,
      DOCUMENT_PROCESSOR: "gemini",
      APPROVED_AI_PROVIDERS: "gemini",
      GEMINI_API_KEY: Buffer.from("Gm9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8"),
    })).toThrow("provider approval record");
  });

  it("requires credentials for the expanded provider catalog", () => {
    expect(() => parseEnvironment({ ...baseEnvironment, DOCUMENT_PROCESSOR: "openai" })).toThrow("OPENAI_API_KEY is required");
    expect(() => parseEnvironment({ ...baseEnvironment, DOCUMENT_PROCESSOR: "xai" })).toThrow("XAI_API_KEY is required");
    expect(() => parseEnvironment({ ...baseEnvironment, DOCUMENT_PROCESSOR: "perplexity" })).toThrow("PERPLEXITY_API_KEY is required");
  });

  it("requires the Azure endpoint and deployment when Azure OpenAI is selected", () => {
    expect(() => parseEnvironment({
      ...baseEnvironment,
      DOCUMENT_PROCESSOR: "azure-openai",
      AZURE_OPENAI_API_KEY: Buffer.from("Az9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8"),
    })).toThrow("AZURE_OPENAI_ENDPOINT is required");
  });

  it("requires a base URL and model for the custom OpenAI-compatible provider", () => {
    expect(() => parseEnvironment({ ...baseEnvironment, DOCUMENT_PROCESSOR: "custom" })).toThrow("CUSTOM_OPENAI_BASE_URL is required");
    expect(() => parseEnvironment({
      ...baseEnvironment,
      DOCUMENT_PROCESSOR: "custom",
      CUSTOM_OPENAI_BASE_URL: "https://gateway.internal.example/v1",
    })).toThrow("CUSTOM_OPENAI_MODEL is required");
  });

  it("requires HTTPS for production Ollama and custom endpoints", () => {
    expect(() => parseEnvironment({
      ...productionEnvironment,
      DOCUMENT_PROCESSOR: "ollama",
      APPROVED_AI_PROVIDERS: "ollama",
      AI_PROVIDER_APPROVAL_ID: "vendor-review-2026-07",
      OLLAMA_BASE_URL: "http://ollama.internal:11434",
    })).toThrow("OLLAMA_BASE_URL must use HTTPS");

    expect(() => parseEnvironment({
      ...productionEnvironment,
      DOCUMENT_PROCESSOR: "custom",
      APPROVED_AI_PROVIDERS: "custom",
      AI_PROVIDER_APPROVAL_ID: "vendor-review-2026-07",
      CUSTOM_OPENAI_BASE_URL: "http://gateway.internal.example/v1",
      CUSTOM_OPENAI_MODEL: "internal-model",
    })).toThrow("CUSTOM_OPENAI_BASE_URL must use HTTPS");
  });

  it("accepts a selected AI provider only when all approval controls are present", () => {
    const parsed = parseEnvironment({
      ...productionEnvironment,
      DOCUMENT_PROCESSOR: "gemini",
      APPROVED_AI_PROVIDERS: "gemini",
      GEMINI_API_KEY: Buffer.from("Gm9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8"),
      AI_PROVIDER_APPROVAL_ID: "vendor-review-2026-07",
    });
    expect(parsed.DOCUMENT_PROCESSOR).toBe("gemini");
  });

  it.each([
    ["anthropic", "ANTHROPIC_API_KEY"],
    ["gemini", "GEMINI_API_KEY"],
    ["groq", "GROQ_API_KEY"],
    ["openrouter", "OPENROUTER_API_KEY"],
    ["sambanova", "SAMBANOVA_API_KEY"],
    ["cerebras", "CEREBRAS_API_KEY"],
    ["mistral", "MISTRAL_API_KEY"],
  ] as const)("requires a credential for %s", (provider, keyName) => {
    expect(() => parseEnvironment({
      ...productionEnvironment,
      DOCUMENT_PROCESSOR: provider,
      APPROVED_AI_PROVIDERS: provider,
      AI_PROVIDER_APPROVAL_ID: "vendor-review-2026-07",
    })).toThrow(`${keyName} is required`);
  });

  it("rejects placeholder provider credentials without exposing their values", () => {
    expect(() => parseEnvironment({
      ...productionEnvironment,
      DOCUMENT_PROCESSOR: "gemini",
      APPROVED_AI_PROVIDERS: "gemini",
      GEMINI_API_KEY: "replace-with-a-production-provider-key",
      AI_PROVIDER_APPROVAL_ID: "vendor-review-2026-07",
    })).toThrow("contains a placeholder");
  });

  it("validates paired object-storage and SMTP credentials", () => {
    expect(() => parseEnvironment({ ...baseEnvironment, S3_ACCESS_KEY_ID: "access-only" })).toThrow("Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
    expect(() => parseEnvironment({ ...baseEnvironment, SMTP_USER: "relay-user" })).toThrow("Set both SMTP_USER and SMTP_PASSWORD");
  });

  it("validates previous encryption-key rings before runtime use", () => {
    expect(() => parseEnvironment({ ...baseEnvironment, DATA_ENCRYPTION_PREVIOUS_KEYS: "not-json" })).toThrow("must be a JSON object");
    expect(() => parseEnvironment({ ...baseEnvironment, DATA_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify({ old: Buffer.alloc(31).toString("base64") }) })).toThrow("must be a JSON object");
    expect(() => parseEnvironment({ ...productionEnvironment, DATA_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify({ development: Buffer.from("8aK4qT2xV7mN9cR1sW5yD3fH6jL0uPzE").toString("base64") }) })).toThrow("Previous production encryption keys");
  });
});
