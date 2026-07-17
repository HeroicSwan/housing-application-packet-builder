import { z } from "zod";

const encryptionKeySchema = z.string().refine((value) => {
  const decoded = Buffer.from(value, "base64");
  return decoded.length === 32 && decoded.toString("base64") === value;
}, "DATA_ENCRYPTION_KEY must be canonical Base64 for exactly 32 bytes.");

const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(1).optional());
const optionalBoolean = z.preprocess((value) => value === "" || value === undefined ? undefined : value, z.enum(["true", "false"]).transform((value) => value === "true").optional());
const productionAcknowledgement = "I_UNDERSTAND_REAL_DATA_REQUIRES_ORGANIZATIONAL_APPROVAL";
const privateStorageAcknowledgement = "I_CONFIRMED_THE_PRODUCTION_BUCKET_IS_PRIVATE";

function unsafeProductionSecret(value: string | undefined) {
  return !value || value.length < 48 || new Set(value).size < 12 || /replace|change.?me|demo|synthetic|example|password|not-a-secret/i.test(value);
}

function postgresUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return ["postgres:", "postgresql:"].includes(parsed.protocol) && parsed.hostname && parsed.username && parsed.pathname.length > 1 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function unsafeProductionEncryptionKey(value: string | undefined, keyId: string) {
  if (!value || /replace|change.?me|example|synthetic|development|demo|local|test|^dev$|^primary$/i.test(keyId)) return true;
  return new Set(Buffer.from(value, "base64")).size < 12;
}

function validPreviousKeyRing(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return false;
    return Object.entries(parsed).every(([keyId, key]) => /^[a-zA-Z0-9._-]{1,64}$/.test(keyId) && typeof key === "string" && encryptionKeySchema.safeParse(key).success);
  } catch {
    return false;
  }
}

function placeholderCredential(value: string | undefined) {
  return Boolean(value && /replace|change.?me|example|synthetic|test.?key|not.?a.?secret/i.test(value));
}

function placeholderSetting(value: string | undefined) {
  return Boolean(value && /replace|change.?me|placeholder|example\.(?:com|net|org)|\.invalid(?:\/|$)|\.test(?:\/|$)/i.test(value));
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SYSTEM_DATABASE_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  DATA_MODE: z.enum(["synthetic", "production"]).default("synthetic"),
  PRODUCTION_DATA_ACKNOWLEDGEMENT: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  DOCUMENT_PROCESSOR: z.enum(["disabled", "mock", "ollama"]).default("mock"),
  OLLAMA_BASE_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().default("http://127.0.0.1:11434")),
  OLLAMA_MODEL: z.string().default("qwen2.5vl:7b"),
  OLLAMA_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(8).optional()),
  DOCUMENT_PROCESSOR_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(60000),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(25).default(8),
  ENABLE_DEMO_LOGIN: z.enum(["true", "false"]).transform((value) => value === "true"),
  DEMO_BANNER: z.enum(["true", "false"]).transform((value) => value === "true"),
  SECURE_COOKIES: z.enum(["true", "false"]).transform((value) => value === "true"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_ROOT: z.string().default(".data/storage"),
  S3_BUCKET: optionalString,
  S3_REGION: z.string().default("us-east-1"),
  S3_ENDPOINT: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  S3_ACCESS_KEY_ID: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  S3_SECRET_ACCESS_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  S3_SERVER_SIDE_ENCRYPTION: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  DATA_ENCRYPTION_KEY: z.preprocess((value) => value === "" ? undefined : value, encryptionKeySchema.optional()),
  DATA_ENCRYPTION_KEY_ID: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/).default("primary"),
  DATA_ENCRYPTION_PREVIOUS_KEYS: z.preprocess((value) => value === "" ? undefined : value, z.string().refine(validPreviousKeyRing, "DATA_ENCRYPTION_PREVIOUS_KEYS must be a JSON object of key IDs to canonical 32-byte Base64 keys.").optional()),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  SMTP_PASSWORD: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  EMAIL_FROM: z.string().email().default("no-reply@example.org"),
  SUBMISSION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  ENFORCE_PRODUCTION_CONFIG: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  MALWARE_SCANNER: z.enum(["none", "clamav"]).default("none"),
  CLAMAV_HOST: z.string().default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  MONITORING_TOKEN: z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional()),
  CASE_RETENTION_DAYS: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().min(1).max(36500).optional()),
  DOCUMENT_RETENTION_DAYS: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().min(1).max(36500).optional()),
  AUDIT_RETENTION_DAYS: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().min(1).max(36500).optional()),
  AUDIT_LOGGING_ENABLED: optionalBoolean,
  BACKUP_ENABLED: optionalBoolean,
  BACKUP_DESTINATION: optionalString,
  BACKUP_RETENTION_DAYS: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().min(1).max(3650).optional()),
  WORKER_ENABLED: optionalBoolean,
  WORKER_HEALTH_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  INTERNAL_SERVICE_HOST_ALLOWLIST: z.string().default("").transform((value) => value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)),
  MIGRATIONS_REQUIRED: optionalBoolean,
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  S3_PRIVATE_BUCKET_ACKNOWLEDGEMENT: optionalString,
  DEFAULT_ADMIN_PASSWORD: optionalString,
  SETUP_BOOTSTRAP_TOKEN_HASH: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^[a-f0-9]{64}$/i, "SETUP_BOOTSTRAP_TOKEN_HASH must be a SHA-256 hex digest.").optional()),
  SYNTHETIC_SEED_CONTEXT: optionalString,
}).superRefine((value, context) => {
  if (value.DATA_MODE === "production" && value.PRODUCTION_DATA_ACKNOWLEDGEMENT !== productionAcknowledgement) context.addIssue({ code: "custom", path: ["PRODUCTION_DATA_ACKNOWLEDGEMENT"], message: "Production data mode requires the documented operator acknowledgement." });
  if (value.ENFORCE_PRODUCTION_CONFIG && value.DATA_MODE !== "production") context.addIssue({ code: "custom", path: ["DATA_MODE"], message: "Production enforcement requires DATA_MODE=production." });
  if (value.STORAGE_PROVIDER === "s3" && !value.S3_BUCKET) context.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "S3_BUCKET is required when STORAGE_PROVIDER=s3." });
  if (Boolean(value.S3_ACCESS_KEY_ID) !== Boolean(value.S3_SECRET_ACCESS_KEY)) context.addIssue({ code: "custom", path: ["S3_ACCESS_KEY_ID"], message: "Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither when using workload identity." });
  if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) context.addIssue({ code: "custom", path: ["SMTP_USER"], message: "Set both SMTP_USER and SMTP_PASSWORD, or neither for an approved unauthenticated relay." });
  if (value.DOCUMENT_PROCESSOR === "ollama" && !["localhost", "127.0.0.1", "::1"].includes(new URL(value.OLLAMA_BASE_URL).hostname)) context.addIssue({ code: "custom", path: ["OLLAMA_BASE_URL"], message: "Local-only AI requires OLLAMA_BASE_URL to use localhost, 127.0.0.1, or ::1." });
  const productionBoundary = value.DATA_MODE === "production" || value.ENFORCE_PRODUCTION_CONFIG;
  if (!productionBoundary) return;

  const issue = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
  if (value.NODE_ENV !== "production") issue("NODE_ENV", "Production data mode requires NODE_ENV=production.");
  if (value.ENABLE_DEMO_LOGIN) issue("ENABLE_DEMO_LOGIN", "Demo login must be disabled in production.");
  if (value.DEMO_BANNER) issue("DEMO_BANNER", "The synthetic demo banner cannot be used as a production-mode substitute.");
  if (!value.SECURE_COOKIES) issue("SECURE_COOKIES", "Secure cookies are required in production.");
  const applicationDatabase = postgresUrl(value.DATABASE_URL);
  const systemDatabase = postgresUrl(value.SYSTEM_DATABASE_URL);
  if (!applicationDatabase) issue("DATABASE_URL", "Production requires a valid authenticated PostgreSQL URL; SQLite is not permitted.");
  if (!systemDatabase) issue("SYSTEM_DATABASE_URL", "Production requires a valid authenticated PostgreSQL system connection.");
  if (applicationDatabase && systemDatabase && applicationDatabase.username === systemDatabase.username) issue("SYSTEM_DATABASE_URL", "The system and application database URLs must use separate least-privilege roles.");
  if (applicationDatabase?.password && placeholderCredential(decodeURIComponent(applicationDatabase.password))) issue("DATABASE_URL", "Production database credentials cannot contain placeholder values.");
  if (systemDatabase?.password && placeholderCredential(decodeURIComponent(systemDatabase.password))) issue("SYSTEM_DATABASE_URL", "Production system-database credentials cannot contain placeholder values.");
  if (unsafeProductionSecret(value.SESSION_SECRET)) issue("SESSION_SECRET", "Production SESSION_SECRET must be at least 48 characters, non-placeholder, and high-diversity.");
  if (new URL(value.APP_URL).protocol !== "https:") issue("APP_URL", "Production APP_URL must use HTTPS.");
  if (placeholderSetting(value.APP_URL)) issue("APP_URL", "Production APP_URL cannot use a reserved example or placeholder domain.");
  if (value.STORAGE_PROVIDER !== "s3") issue("STORAGE_PROVIDER", "Production requires private object storage; local filesystem storage is not permitted.");
  if (!value.S3_SERVER_SIDE_ENCRYPTION) issue("S3_SERVER_SIDE_ENCRYPTION", "Production object storage must enable server-side encryption.");
  if (!value.S3_BUCKET) issue("S3_BUCKET", "Production object storage requires S3_BUCKET.");
  if (placeholderSetting(value.S3_BUCKET)) issue("S3_BUCKET", "Production S3_BUCKET cannot contain a placeholder value.");
  if (value.S3_ENDPOINT && new URL(value.S3_ENDPOINT).protocol !== "https:") issue("S3_ENDPOINT", "Production object-storage endpoints must use HTTPS.");
  if (placeholderSetting(value.S3_ENDPOINT)) issue("S3_ENDPOINT", "Production object-storage endpoints cannot use reserved example or placeholder domains.");
  if (value.S3_PRIVATE_BUCKET_ACKNOWLEDGEMENT !== privateStorageAcknowledgement) issue("S3_PRIVATE_BUCKET_ACKNOWLEDGEMENT", "Confirm that the production object-storage bucket is private.");
  if (unsafeProductionEncryptionKey(value.DATA_ENCRYPTION_KEY, value.DATA_ENCRYPTION_KEY_ID)) issue("DATA_ENCRYPTION_KEY", "Production requires a non-development encryption key and a unique rotation key ID.");
  if (value.DATA_ENCRYPTION_PREVIOUS_KEYS) {
    const previous = JSON.parse(value.DATA_ENCRYPTION_PREVIOUS_KEYS) as Record<string, string>;
    if (Object.entries(previous).some(([keyId, key]) => unsafeProductionEncryptionKey(key, keyId))) issue("DATA_ENCRYPTION_PREVIOUS_KEYS", "Previous production encryption keys must use non-development key IDs and high-diversity key material.");
  }
  if (!value.SMTP_HOST) issue("SMTP_HOST", "SMTP_HOST is required in production for password recovery and email submissions.");
  if (placeholderSetting(value.SMTP_HOST)) issue("SMTP_HOST", "Production SMTP_HOST cannot contain a placeholder value.");
  if (placeholderSetting(value.EMAIL_FROM)) issue("EMAIL_FROM", "Production EMAIL_FROM must use an organization-controlled domain.");
  if (value.MALWARE_SCANNER !== "clamav") issue("MALWARE_SCANNER", "ClamAV malware scanning is required in production.");
  if (unsafeProductionSecret(value.MONITORING_TOKEN)) issue("MONITORING_TOKEN", "Production MONITORING_TOKEN must be at least 48 characters, non-placeholder, and high-diversity.");
  if (!value.CASE_RETENTION_DAYS) issue("CASE_RETENTION_DAYS", "A case-retention period is required in production.");
  if (!value.DOCUMENT_RETENTION_DAYS) issue("DOCUMENT_RETENTION_DAYS", "A document-retention period is required in production.");
  if (!value.AUDIT_RETENTION_DAYS) issue("AUDIT_RETENTION_DAYS", "An audit-retention period is required in production.");
  if (value.AUDIT_LOGGING_ENABLED !== true) issue("AUDIT_LOGGING_ENABLED", "Audit logging must be explicitly enabled in production.");
  if (value.BACKUP_ENABLED !== true || !value.BACKUP_DESTINATION || !value.BACKUP_RETENTION_DAYS) issue("BACKUP_ENABLED", "Encrypted backup destination and retention must be configured in production.");
  if (placeholderSetting(value.BACKUP_DESTINATION)) issue("BACKUP_DESTINATION", "Production BACKUP_DESTINATION cannot contain a placeholder value.");
  if (value.WORKER_ENABLED !== true) issue("WORKER_ENABLED", "The durable worker must be explicitly enabled in production.");
  if (!value.WORKER_HEALTH_URL) issue("WORKER_HEALTH_URL", "A production worker health endpoint is required so startup can verify worker availability.");
  if (value.MIGRATIONS_REQUIRED !== true) issue("MIGRATIONS_REQUIRED", "Production startup must require migration verification.");
  if (value.LOG_LEVEL === "debug") issue("LOG_LEVEL", "Debug logging is not permitted in production.");
  if (value.DEFAULT_ADMIN_PASSWORD) issue("DEFAULT_ADMIN_PASSWORD", "Default administrator passwords are not permitted in production.");
  if (value.SYNTHETIC_SEED_CONTEXT) issue("SYNTHETIC_SEED_CONTEXT", "Synthetic seed context is not permitted in production.");
  if (value.DOCUMENT_PROCESSOR === "mock") issue("DOCUMENT_PROCESSOR", "The deterministic mock processor is not permitted in production.");
  if (value.DOCUMENT_PROCESSOR !== "disabled") issue("DOCUMENT_PROCESSOR", "Production customer data requires DOCUMENT_PROCESSOR=disabled; local AI is never enabled for applicant documents.");
  if (value.DOCUMENT_PROCESSOR === "ollama" && new URL(value.OLLAMA_BASE_URL).protocol !== "https:") issue("OLLAMA_BASE_URL", "Production OLLAMA_BASE_URL must use HTTPS; plaintext local endpoints are not permitted with real applicant data.");
});

export function parseEnvironment(input: NodeJS.ProcessEnv) {
  const dataMode = input.DATA_MODE ?? "synthetic";
  return envSchema.parse({
    ...input,
    DATABASE_URL: input.DATABASE_URL ?? (input.NODE_ENV === "production" ? undefined : "file:./dev.db"),
    ENABLE_DEMO_LOGIN: input.ENABLE_DEMO_LOGIN ?? (input.NODE_ENV === "production" ? "false" : "true"),
    DEMO_BANNER: input.DEMO_BANNER ?? (dataMode === "synthetic" ? "true" : "false"),
    SECURE_COOKIES: input.SECURE_COOKIES ?? (input.NODE_ENV === "production" ? "true" : "false"),
    SESSION_SECRET: input.SESSION_SECRET ?? (input.NODE_ENV === "production" ? undefined : "demo-only-session-secret-change-me-now"),
  });
}
