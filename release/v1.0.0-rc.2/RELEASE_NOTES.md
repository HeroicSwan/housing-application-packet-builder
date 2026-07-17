# Housing Application Packet Builder 1.0.0

## Highlights

- Local-first, human-reviewed document extraction with Ollama and Qwen 7B.
- PDF-to-image extraction adapter for scanned and image-heavy documents.
- Safer review lifecycle: quarantine, duplicates, corrections, escalation, immutable approval, signature invalidation, and expiring downloads.
- Administrator template mapping with compatibility checks and rollback support.
- Production-oriented PostgreSQL, RLS, private object storage, ClamAV, worker, monitoring, backup, and restore workflows.
- Unified validation and a 120-applicant synthetic stress harness.

## Verification

The release was verified with lint, typecheck, production schema validation, secret/history scans, unit/integration tests, Playwright/axe tests, production build, dependency audit, live local service checks, local Ollama OCR, and synthetic applicant replay.

## Before production use

The following require an authorized deploying organization: revocation and replacement of previously exposed provider keys, approved agency PDF acceptance, production secret-manager injection, real deployment evidence, independent penetration testing, manual accessibility review, caseworker sessions, and privacy/legal approval.

## Breaking or operational changes

- Production mode rejects cloud AI processors; use `DOCUMENT_PROCESSOR=disabled` for real applicant data.
- Production requires PostgreSQL, private S3-compatible storage, ClamAV, encrypted backups, worker health, TLS, monitoring, and approved retention values.
- `DATA_ENCRYPTION_KEY` rotation requires retaining `DATA_ENCRYPTION_PREVIOUS_KEYS` until authenticated re-encryption completes.
