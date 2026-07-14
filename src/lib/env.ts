import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  DOCUMENT_PROCESSOR: z.enum(["mock", "anthropic", "gemini", "groq", "openrouter", "sambanova", "cerebras", "mistral"]).default("mock"),
  ANTHROPIC_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(20).optional()),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5"),
  GEMINI_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(20).optional()),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  GROQ_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(20).optional()),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  OPENROUTER_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(20).optional()),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  OPENROUTER_HTTP_REFERER: z.string().url().optional(),
  OPENROUTER_APP_TITLE: z.string().max(120).default("Housing Application Packet Builder"),
  SAMBANOVA_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(20).optional()),
  SAMBANOVA_MODEL: z.string().default("Meta-Llama-3.3-70B-Instruct"),
  CEREBRAS_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(20).optional()),
  CEREBRAS_MODEL: z.string().default("gpt-oss-120b"),
  MISTRAL_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(20).optional()),
  MISTRAL_MODEL: z.string().default("mistral-small-latest"),
  DOCUMENT_PROCESSOR_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(60000),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(25).default(8),
  ENABLE_DEMO_LOGIN: z.enum(["true", "false"]).default(process.env.NODE_ENV === "production" ? "false" : "true").transform((value) => value === "true"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_ROOT: z.string().default(".data/storage"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  DATA_ENCRYPTION_KEY: z.string().min(43).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().default("no-reply@example.org"),
  HEALTHCHECK_TOKEN: z.string().min(24).optional(),
  SUBMISSION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  ENFORCE_PRODUCTION_CONFIG: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  MALWARE_SCANNER: z.enum(["none", "clamav"]).default("none"),
  CLAMAV_HOST: z.string().default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
}).superRefine((value, context) => {
  if (value.DOCUMENT_PROCESSOR === "anthropic" && !value.ANTHROPIC_API_KEY) context.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "ANTHROPIC_API_KEY is required when DOCUMENT_PROCESSOR=anthropic." });
  const providerKeys = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", openrouter: "OPENROUTER_API_KEY", sambanova: "SAMBANOVA_API_KEY", cerebras: "CEREBRAS_API_KEY", mistral: "MISTRAL_API_KEY" } as const;
  const providerKey = providerKeys[value.DOCUMENT_PROCESSOR as keyof typeof providerKeys];
  if (providerKey && !value[providerKey]) context.addIssue({ code: "custom", path: [providerKey], message: `${providerKey} is required when DOCUMENT_PROCESSOR=${value.DOCUMENT_PROCESSOR}.` });
  if (value.STORAGE_PROVIDER === "s3" && !value.S3_BUCKET) context.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "S3_BUCKET is required when STORAGE_PROVIDER=s3." });
  if (value.ENFORCE_PRODUCTION_CONFIG && !value.DATA_ENCRYPTION_KEY) context.addIssue({ code: "custom", path: ["DATA_ENCRYPTION_KEY"], message: "DATA_ENCRYPTION_KEY is required in production." });
  if (value.ENFORCE_PRODUCTION_CONFIG && !value.SMTP_HOST) context.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST is required in production for password recovery and email submissions." });
  if (value.ENFORCE_PRODUCTION_CONFIG && value.MALWARE_SCANNER === "none") context.addIssue({ code: "custom", path: ["MALWARE_SCANNER"], message: "A malware scanner is required in production." });
});

export const env = envSchema.parse({ ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? (process.env.NODE_ENV === "production" ? undefined : "file:./dev.db"), SESSION_SECRET: process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "demo-only-session-secret-change-me-now") });
