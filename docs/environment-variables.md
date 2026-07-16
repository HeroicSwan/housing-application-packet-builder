# Environment variables

This reference describes application and operational configuration without including usable secrets. `.env.example` is the local template; `.env.production.example` is a placeholder checklist, not a deployable secret file.

Never commit `.env` or a filled production environment. Use an approved secret manager for production. Previously exposed provider credentials must be revoked or rotated externally; changing documentation or a local file is not credential rotation.

## Local safe defaults

The supported local demonstration uses:

```text
NODE_ENV=development
DATA_MODE=synthetic
DATABASE_URL=file:./dev.db
DOCUMENT_PROCESSOR=mock
ENABLE_DEMO_LOGIN=true
DEMO_BANNER=true
SECURE_COOKIES=false
APP_URL=http://localhost:3000
STORAGE_PROVIDER=local
MALWARE_SCANNER=none
ENFORCE_PRODUCTION_CONFIG=false
```

These settings are appropriate only for disposable synthetic local data. `npm run setup` generates non-placeholder local session and encryption values in a new `.env` and never prints or overwrites them.

## Administrator setup bootstrap and outbound hosts

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `SETUP_BOOTSTRAP_TOKEN_HASH` | SHA-256 hexadecimal digest of the one-time token accepted by `/setup` on an empty installation | Configure only for the initial claim; never store the token itself; remove the digest and restart after the first administrator is created |
| `INTERNAL_SERVICE_HOST_ALLOWLIST` | Comma-separated exact private hostnames allowed for production SMTP, ClamAV, and custom object-storage connection probes | Hostnames only, without ports or URLs; keep narrowly scoped; loopback, link-local, and metadata addresses remain prohibited |

The normal seeded demonstration is already claimed and uses `/admin/setup`. See [Administrator setup](./administrator-setup.md) for safe token generation, claim conditions, and access rules.

## Wizard settings, precedence, and restart behavior

`/admin/setup` stores validated organization configuration as a resumable draft. Secret replacements are encrypted separately; a blank secret field preserves the stored value and the browser receives no plaintext readback. Drafts do not change runtime behavior. Final sign-off copies the draft into separate active fields, and reopening keeps the prior active revision in use until the next sign-off.

With an organization context, active SMTP, storage, and malware settings take precedence over their environment fallbacks. Activated organization access, MFA, password, session, and retention policy is stored on the organization. Environment configuration remains authoritative for database URLs, session and master encryption secrets, data mode, secure cookies, application URL, AI runtime selection/model, provider allowlist, monitoring endpoint protection, backup and worker processes, migration requirements, and production preflight.

The wizard never writes `.env` or mutates a running process environment. Restart web and worker processes after changing environment or secret-manager values. Passing wizard review does not make an otherwise invalid production environment valid, and production startup validation does not replace wizard sign-off or organizational approval.

Connection-test statuses mean:

- `PASSED`: the implemented live check completed;
- `FAILED`: the safe check did not complete or meet its requirement;
- `SIMULATED`: no equivalent production service was exercised; and
- `UNSUPPORTED`: the service is disabled or has no supported automated adapter.

Only `PASSED` satisfies a required production connection test. Synthetic mode may retain `SIMULATED` as an explicit warning. See [Setup connection tests](./setup-connection-tests.md) for exact behavior, timeouts, artifacts, codes, and limitations.

## Core mode and application settings

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode: development, test, or production | Must be `production` for production data mode |
| `DATA_MODE` | Selects `synthetic` or `production` data boundary | Production requires the documented acknowledgement and every enforced control |
| `ENFORCE_PRODUCTION_CONFIG` | Forces full production validation even before startup | The supported production start command forces this to true; `DATA_MODE=production` is also always validated |
| `PRODUCTION_DATA_ACKNOWLEDGEMENT` | Records the operator's explicit acknowledgement | Must equal `I_UNDERSTAND_REAL_DATA_REQUIRES_ORGANIZATIONAL_APPROVAL`; not legal approval by itself |
| `APP_URL` | Canonical application URL and local open target | Must use HTTPS in production |
| `LOG_LEVEL` | Error, warning, information, or debug logging | Debug is rejected in production |

## Database, authentication, and demo controls

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `DATABASE_URL` | Local SQLite URL or least-privilege application PostgreSQL URL | PostgreSQL required; SQLite rejected |
| `SYSTEM_DATABASE_URL` | Narrow pre-authentication/system PostgreSQL connection | Required, PostgreSQL, and a different database principal from the application role |
| `SESSION_SECRET` | Session protection secret | At least 48 characters, high diversity, and non-placeholder |
| `ENABLE_DEMO_LOGIN` | Enables public synthetic one-click login | Must be false |
| `DEMO_BANNER` | Displays the persistent synthetic warning | Required for the local demo; rejected as a production substitute |
| `SECURE_COOKIES` | Restricts cookies to HTTPS transport | Must be true |
| `DEFAULT_ADMIN_PASSWORD` | Detects a configured default administrator password | Must be absent |
| `SYNTHETIC_SEED_CONTEXT` | Internal authorization for deterministic seed/reset utilities | Must be absent |

## Document processing and AI providers

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `DOCUMENT_PROCESSOR` | `disabled`, `mock`, or one configured provider | Mock is rejected; external providers need approval and a key |
| `APPROVED_AI_PROVIDERS` | Comma-separated organization-approved provider IDs | Selected external provider must be listed |
| `AI_PROVIDER_APPROVAL_ID` | Links the selection to an organization-owned approval record | Required for an external production processor |
| `DOCUMENT_PROCESSOR_TIMEOUT_MS` | Provider request timeout | 5,000–120,000 milliseconds |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Anthropic credential and model ID | Key required only when selected |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini credential and model ID | Key required only when selected |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq credential and model ID | Key required only when selected |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | OpenRouter credential and model ID | Key required only when selected |
| `OPENROUTER_HTTP_REFERER` | Optional valid referer URL sent to OpenRouter | Review disclosure before use |
| `OPENROUTER_APP_TITLE` | Optional application title sent to OpenRouter | Must not contain applicant information |
| `SAMBANOVA_API_KEY` / `SAMBANOVA_MODEL` | SambaNova credential and model ID | Key required only when selected |
| `CEREBRAS_API_KEY` / `CEREBRAS_MODEL` | Cerebras credential and model ID | Key required only when selected |
| `MISTRAL_API_KEY` / `MISTRAL_MODEL` | Mistral credential and model ID | Key required only when selected |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI credential and model ID | Key required only when selected |
| `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT` / `AZURE_OPENAI_API_VERSION` | Azure OpenAI credential, resource endpoint, deployment name, API version | Key, HTTPS endpoint, and deployment required when selected |
| `XAI_API_KEY` / `XAI_MODEL` | xAI credential and model ID | Key required only when selected |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | DeepSeek credential and model ID | Key required only when selected; text-only models cannot read scans |
| `TOGETHER_API_KEY` / `TOGETHER_MODEL` | Together AI credential and model ID | Key required only when selected |
| `FIREWORKS_API_KEY` / `FIREWORKS_MODEL` | Fireworks AI credential and model ID | Key required only when selected |
| `COHERE_API_KEY` / `COHERE_MODEL` | Cohere credential and model ID (compatibility API) | Key required only when selected |
| `PERPLEXITY_API_KEY` / `PERPLEXITY_MODEL` | Perplexity credential and model ID | Key required only when selected |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` / `OLLAMA_API_KEY` | Self-hosted Ollama endpoint, model, optional key | HTTPS required in production |
| `CUSTOM_OPENAI_BASE_URL` / `CUSTOM_OPENAI_MODEL` / `CUSTOM_OPENAI_API_KEY` / `CUSTOM_OPENAI_PROVIDER_NAME` | Any other OpenAI-compatible endpoint (gateway, vLLM, LiteLLM, unlisted vendor) | Base URL and model required when selected; HTTPS required in production |

Credential material is validated only for the selected provider, so unrelated provider variables that happen to exist on a machine never block startup. Production should use `DOCUMENT_PROCESSOR=disabled` until an administrator has approved the exact provider, model, account tier, retention behavior, region, contract/DPA, and data categories. Provider configuration never bypasses human review.

## Upload and malware controls

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `MAX_UPLOAD_MB` | Maximum accepted upload size | Positive, maximum 25 MB; organization must choose its limit |
| `MALWARE_SCANNER` | `none` or `clamav` | ClamAV required |
| `CLAMAV_HOST` / `CLAMAV_PORT` | ClamAV service address | Must identify the approved private scanner |

## Storage and encryption

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `STORAGE_PROVIDER` | Local filesystem or S3-compatible private storage | Must be `s3`; local storage rejected |
| `LOCAL_STORAGE_ROOT` | Local synthetic encrypted-object directory | Local demonstration only |
| `S3_BUCKET` | Object-storage bucket | Required |
| `S3_REGION` | Object-storage region | Must match the approved deployment |
| `S3_ENDPOINT` | Optional S3-compatible endpoint | HTTPS required when set |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object-storage credentials | Set both, or neither when using an approved workload identity; keep credentials in a secret manager |
| `S3_PRIVATE_BUCKET_ACKNOWLEDGEMENT` | Records confirmation that the bucket is private | Must equal `I_CONFIRMED_THE_PRODUCTION_BUCKET_IS_PRIVATE` |
| `DATA_ENCRYPTION_KEY` | Current authenticated-encryption key | Required canonical Base64 for exactly 32 random bytes |
| `DATA_ENCRYPTION_KEY_ID` | Non-secret identifier stored with encrypted envelopes | Required unique rotation identifier; local/development/default identifiers are rejected |
| `DATA_ENCRYPTION_PREVIOUS_KEYS` | JSON key-ID map used temporarily during rotation | Secret; remove after verified re-encryption |

Never reuse the session secret as the production data-encryption key. Keep encryption keys separate from encrypted backups and storage credentials.

## Email and submission

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `SMTP_HOST` / `SMTP_PORT` | SMTP service and port | Host required; default port is 587 |
| `SMTP_SECURE` | Enables implicit SMTP TLS where required | Must match the approved provider configuration |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP credentials | Set both, or neither only for an approved unauthenticated relay; keep credentials in a secret manager |
| `EMAIL_FROM` | Sender address | Must be verified and organization-approved |
| `SUBMISSION_TIMEOUT_MS` | Email/API delivery timeout | 1,000–60,000 milliseconds |

## Retention, audit, backup, worker, and monitoring

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `CASE_RETENTION_DAYS` | Case retention period | Required organization-approved value |
| `DOCUMENT_RETENTION_DAYS` | Source-document retention period | Required organization-approved value |
| `AUDIT_RETENTION_DAYS` | Audit-evidence retention period | Required organization-approved value |
| `AUDIT_LOGGING_ENABLED` | Explicitly enables application audit recording | Must be true |
| `BACKUP_ENABLED` | Explicitly enables encrypted backups | Must be true |
| `BACKUP_DESTINATION` | Approved backup destination identifier | Required |
| `BACKUP_RETENTION_DAYS` | Backup retention period | Required organization-approved value |
| `WORKER_ENABLED` | Confirms the durable worker is deployed | Must be true |
| `WORKER_HEALTH_URL` | Private worker readiness endpoint | Required and must return a fresh successful sweep before application startup |
| `MIGRATIONS_REQUIRED` | Requires migration verification before startup | Must be true |
| `MONITORING_TOKEN` | Protects the metrics endpoint | At least 48 characters, high diversity, and non-placeholder |

## Tooling-only variables

These variables support isolated tests, migration, worker, or restore utilities. Do not add them to ordinary local configuration unless running the named tool.

| Variable | Tooling use |
| --- | --- |
| `E2E_DATABASE_URL`, `E2E_RUN_ID`, `E2E_PORT` | Guarded Playwright database, run identifier, and temporary port |
| `POSTGRES_TEST_ADMIN_URL`, `POSTGRES_TEST_APP_URL` | Disposable PostgreSQL/RLS integration test roles |
| `PRODUCTION_DATABASE_URL` | Production-schema generation/validation utility input |
| `RESTORE_DATABASE_URL`, `RESTORE_CONFIRMATION` | Guarded disposable PostgreSQL restoration target and confirmation |
| `WORKER_ONCE`, `WORKER_POLL_MS`, `WORKER_HEALTH_PORT`, `WORKER_EXIT_AFTER_HEALTH_RESPONSE` | Worker acceptance mode, polling, private health port, and synthetic-only graceful-exit test hook |
| `NEXT_TEMP_DIST_DIR` | Guarded temporary Next.js output used internally by local health/open commands |
| `APP_ENV_FILE` | Compose path to an external production environment file |
| `POSTGRES_OWNER_PASSWORD`, `HAPB_APP_PASSWORD`, `HAPB_SYSTEM_PASSWORD` | Compose role bootstrap credentials |

## Fail-closed production categories

Production parsing returns redacted, actionable validation errors and refuses startup when any category is unsafe:

- production mode or acknowledgement is missing;
- demo login, banner-as-substitute, synthetic seed context, or a default administrator password remains enabled;
- SQLite is selected, PostgreSQL URLs are malformed, or app/system URLs use the same database principal;
- the session secret, encryption key, secure cookies, HTTPS URL, or monitoring token is unsafe;
- local/public/placeholder object storage is selected, private-bucket confirmation is absent, or partial credentials are configured;
- SMTP, ClamAV, retention, audit, backup, worker, migration, or monitoring configuration is absent;
- debug logging is enabled;
- the mock AI processor is selected; or
- an external provider lacks its key, allowlist entry, or organization-owned approval record.

`npm start` adds live preflight checks after configuration parsing. It verifies the production build, Prisma migration status, absence of seeded `@example.org` demo accounts, and a fresh `WORKER_HEALTH_URL` response before the HTTP server can start. Use `npm run config:production` for redacted configuration-only validation and `npm run production:check` for the complete preflight without starting the server.

Passing configuration validation does not prove legal approval, provider contractual approval, deployment security, accessibility, penetration testing, or readiness for real applicant data. See [version-1-criteria.md](./version-1-criteria.md).

## Safe troubleshooting

Do not paste complete environment output into an issue. Report only the variable name, validation category, and redacted error. Never use `printenv`, `set`, or an environment dump in public support artifacts. Follow [SECURITY.md](../SECURITY.md) for accidental disclosure.
