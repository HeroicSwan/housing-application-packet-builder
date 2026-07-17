import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/lib/env-schema";

const baseEnvironment: NodeJS.ProcessEnv = { NODE_ENV: "test", DATABASE_URL: "file:./environment-test.db", SESSION_SECRET: "synthetic-test-session-secret-with-32-characters" };
const productionEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "production", DATABASE_URL: "postgresql://hapb_app:application-role@database.internal:5432/hapb", SYSTEM_DATABASE_URL: "postgresql://hapb_system:system-role@database.internal:5432/hapb", DATA_MODE: "production", PRODUCTION_DATA_ACKNOWLEDGEMENT: "I_UNDERSTAND_REAL_DATA_REQUIRES_ORGANIZATIONAL_APPROVAL", SESSION_SECRET: Buffer.from("7Kq!4pZ9vN2xR8mT5wY1cF6jL3sD0hB7uG4aE9iO2rU8nM5k").toString("utf8"), ENABLE_DEMO_LOGIN: "false", DEMO_BANNER: "false", SECURE_COOKIES: "true", APP_URL: "https://housing.nonprofit-services.org", DOCUMENT_PROCESSOR: "disabled", STORAGE_PROVIDER: "s3", S3_BUCKET: "housing-production-private", S3_REGION: "us-east-1", S3_ENDPOINT: "https://objects.nonprofit-services.org", S3_SERVER_SIDE_ENCRYPTION: "true", S3_PRIVATE_BUCKET_ACKNOWLEDGEMENT: "I_CONFIRMED_THE_PRODUCTION_BUCKET_IS_PRIVATE", DATA_ENCRYPTION_KEY: Buffer.from("9fB2vQ7mK4xN8cR1sT6wY3aD0hJ5uLzE").toString("base64"), DATA_ENCRYPTION_KEY_ID: "2026-07-rotation-01", SMTP_HOST: "smtp.nonprofit-services.org", EMAIL_FROM: "housing@nonprofit-services.org", MALWARE_SCANNER: "clamav", MONITORING_TOKEN: Buffer.from("mN7!qP2xV9kR4tY8cD1fG6hJ3sL0wB5uA2eI7oZ9rT4vX8nC").toString("utf8"), CASE_RETENTION_DAYS: "2555", DOCUMENT_RETENTION_DAYS: "2555", AUDIT_RETENTION_DAYS: "3650", AUDIT_LOGGING_ENABLED: "true", BACKUP_ENABLED: "true", BACKUP_DESTINATION: "s3://housing-backups/production", BACKUP_RETENTION_DAYS: "35", WORKER_ENABLED: "true", WORKER_HEALTH_URL: "http://worker.internal:8787/health", MIGRATIONS_REQUIRED: "true", LOG_LEVEL: "info",
};

describe("data mode", () => {
  it("defaults to synthetic mode", () => expect(parseEnvironment(baseEnvironment).DATA_MODE).toBe("synthetic"));
  it("requires an explicit production acknowledgement", () => expect(() => parseEnvironment({ ...baseEnvironment, DATA_MODE: "production" })).toThrow("Production data mode requires"));
  it("accepts the hardened production manual-processing profile", () => expect(parseEnvironment(productionEnvironment).DOCUMENT_PROCESSOR).toBe("disabled"));
  it("rejects cloud processors at startup", () => expect(() => parseEnvironment({ ...baseEnvironment, DOCUMENT_PROCESSOR: "openai" })).toThrow("Invalid option"));
  it("accepts the local Ollama processor", () => expect(parseEnvironment({ ...baseEnvironment, DOCUMENT_PROCESSOR: "ollama", OLLAMA_BASE_URL: "http://127.0.0.1:11434" }).DOCUMENT_PROCESSOR).toBe("ollama"));
  it("rejects a non-local Ollama endpoint", () => expect(() => parseEnvironment({ ...baseEnvironment, DOCUMENT_PROCESSOR: "ollama", OLLAMA_BASE_URL: "https://remote.example.test" })).toThrow("Local-only AI"));
});

describe("fail-closed production configuration", () => {
  const unsafe: Array<[Partial<NodeJS.ProcessEnv>, string]> = [
    [{ NODE_ENV: "development" }, "NODE_ENV"], [{ ENABLE_DEMO_LOGIN: "true" }, "Demo login"], [{ SECURE_COOKIES: "false" }, "Secure cookies"], [{ DATABASE_URL: "file:./production.db" }, "PostgreSQL"], [{ STORAGE_PROVIDER: "local" }, "private object storage"], [{ S3_SERVER_SIDE_ENCRYPTION: "false" }, "server-side encryption"], [{ DATA_ENCRYPTION_KEY: undefined }, "encryption key"], [{ MALWARE_SCANNER: "none" }, "ClamAV"], [{ SMTP_HOST: undefined }, "SMTP_HOST"], [{ MONITORING_TOKEN: undefined }, "MONITORING_TOKEN"], [{ WORKER_ENABLED: "false" }, "durable worker"], [{ MIGRATIONS_REQUIRED: "false" }, "migration verification"], [{ DOCUMENT_PROCESSOR: "mock" }, "mock processor"],
  ];
  it.each(unsafe)("rejects unsafe production override", (override, message) => expect(() => parseEnvironment({ ...productionEnvironment, ...override })).toThrow(message));
  it("rejects local AI in production", () => expect(() => parseEnvironment({ ...productionEnvironment, DOCUMENT_PROCESSOR: "ollama" })).toThrow("local AI is never enabled"));
  it("accepts canonical encryption keys", () => {
    const key = Buffer.alloc(32, 1).toString("base64");
    expect(parseEnvironment({ ...baseEnvironment, DATA_ENCRYPTION_KEY: key }).DATA_ENCRYPTION_KEY).toBe(key);
    expect(() => parseEnvironment({ ...baseEnvironment, DATA_ENCRYPTION_KEY: Buffer.alloc(31, 1).toString("base64") })).toThrow("exactly 32 bytes");
  });
});
