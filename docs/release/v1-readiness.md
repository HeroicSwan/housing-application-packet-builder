# Version 1 local implementation checklist

Status reviewed July 15, 2026. This checklist tracks the attached nonprofit-readiness specification through local Phase 10. GitHub publishing, remote CI administration, tagging, and release creation are intentionally excluded by owner instruction.

| Area | Classification | Current evidence or remaining gate |
| --- | --- | --- |
| Repository architecture and baseline | Complete and locally verified | Next.js 16/React 19/Node 22+, npm, Prisma with SQLite demo and PostgreSQL production schema; the unified validator passes. |
| Current-tree secret scan | Complete and locally verified | `npm run security:secrets` reports only redacted path/line/category findings. |
| Full Git-history secret scan | Complete and locally verified | `npm run security:history` walks all commits and text blobs without printing values. |
| Previously exposed provider credentials | Blocked by external credentials | Account owner must complete `credential-rotation.md`; repository changes cannot revoke provider-issued credentials. |
| One-command local setup and demo safety | Complete and locally verified | Cross-platform setup/open/health/reset/validate commands, synthetic-only defaults, and persistent banners are implemented. |
| Fail-closed production validation | Complete and locally verified | Production validation rejects SQLite, demo credentials, weak secrets, HTTP, local/public storage, missing service ownership, debug logging, and unapproved AI configuration. |
| Administrator onboarding | Complete and locally verified | Resumable setup, encrypted/redacted secrets, connection tests, acknowledgement, readiness state, and audit evidence are implemented. |
| Core case, household, income, document, application, review, delivery, audit, lifecycle, and backup workflows | Complete for repository-controlled behavior | Rich review states, quarantine/deduplication/deletion, template compatibility and rollback, signature invalidation, immutable approvals, expiring one-use downloads, escalation, dead-letter handling, export limits, and expanded roles are implemented and tested. Real adapters and agency forms remain external gates. |
| Unified evaluation harness | Complete and locally verified | A 120-applicant adversarial replay emits thresholded machine-readable and HTML evidence and is included in `npm run validate`. |
| Live integration matrix | Complete as an executable gate matrix | `npm run validate:live` lists and explicitly runs only selected ClamAV, OCR, provider, PostgreSQL RLS, worker, backup/restore, deployment, and human-review gates. Passing them requires the target services. |
| Production deployment package | Complete as deployable instructions and artifacts | PostgreSQL/RLS, private object storage, worker supervision, TLS proxy, monitoring, alerts, encrypted backups, restore, rotation, rollback, and disaster-recovery procedures are supplied for native systemd and container operators. Target-environment evidence remains external. |
| Security engineering | Automated controls complete; independent review external | Authorization, MFA, tenant isolation, encryption, safe upload/outbound boundaries, immutable audit/integrity records, secret/dependency scans, and abuse-case tests are present. A deep local scan and an independent penetration test remain distinct gates. |
| Independent penetration test | Blocked by independent assessment | A qualified outside assessor needs an authorized deployed synthetic target. |
| Manual accessibility verification | Blocked by organizational approval | Automated axe checks pass; human keyboard, screen-reader, zoom, reflow, contrast, and target-device evidence remains required. |
| Moderated caseworker usability | Blocked by organizational approval | Repository protocol exists; real sessions and dated acceptance remain external. |
| Privacy, consent, retention, provider and legal approval | Blocked by organizational approval | Engineering controls and draft documentation are not legal or compliance approval. |
| Managed infrastructure and timed restore | Blocked by external infrastructure | Requires the deploying organization's PostgreSQL, object storage, SMTP, TLS, ClamAV, monitoring/paging, backups and on-call ownership. |
| Upgrade, troubleshooting, sample deployment and support | Complete | Versioned migrations, template compatibility/rollback guidance, synthetic deployment, troubleshooting, support boundaries, and operator runbooks are documented. |
| Single-command release validation | Complete and locally verified | `npm run validate` fails on mandatory regressions and writes JSON plus Markdown evidence under `output/validation/`. |

## Closed local findings

| Original severity | Finding | Resolution |
| --- | --- | --- |
| Critical | Production mode accepted unsafe defaults. | Production enforcement is automatic and table-tested against unsafe database, URL, storage, secret, service, and provider combinations. |
| Critical | Post-approval mutation could leave stale approval/signature state. | Signed content and approvals are digest-bound; covered mutations invalidate signatures and approvals, and delivery uses approved immutable content. |
| High | Administrator AcroForm uploads lacked the ordinary upload safety boundary. | Template uploads use signature, parser, active-content, size, and malware controls before acceptance. |
| High | Setup, evaluation, live-test, operations, upgrade, troubleshooting, and validation orchestration were missing. | These workflows and documents are implemented and linked from the root documentation. |

## Baseline evidence

- Unit/integration: 35 files passed, 5 service-gated files skipped; 246 tests passed and 5 skipped.
- Browser E2E and automated accessibility: 11 passed.
- TypeScript, ESLint, production build, dependency audit, current-tree secret scan, production schema validation, and synthetic eight-field AcroForm acceptance: passed.
- Encrypted SQLite backup creation, verification, and disposable restore: passed using a generated synthetic test key.
- Live ClamAV, live OCR/provider quality, live provider smoke, historical Groq replay, and PostgreSQL RLS remain explicitly service-gated.

| Command | Result | Measured duration or count |
| --- | --- | --- |
| `npm run validate` | Passed | Production schema, current/history secret scans, lint, typecheck, 246 unit/integration tests, 120-applicant evaluation, production build, 11 browser/axe tests, and dependency audit. |
| `npm test` | Passed | 35 files passed, 5 skipped; 246 tests passed, 5 skipped. |
| `npm run test:e2e` | Passed | 11 Chromium tests including axe checks. |
| `npm run lint` | Passed | No errors or warnings. |
| `npm run typecheck` | Passed | No type errors. |
| `npm run build` | Passed | Next.js production build completed. |
| `npm run security:dependencies` | Passed | Zero reported vulnerabilities. |
| `npm run security:secrets` | Passed | 281 files at baseline; values redacted by design. |
| `npm run security:history` | Passed | 1 commit and 172 text blobs; values redacted by design. |
| `npm run db:validate:production` | Passed | PostgreSQL Prisma schema valid. |
| `npm run templates:accept -- fixtures/family-pathways-agency-acroform.pdf fixtures/templates/family-pathways-acroform-acceptance.json` | Passed | 8 discovered, mapped, and round-tripped fields. |
| Encrypted backup create, verify, and disposable SQLite restore | Passed | 888,832 plaintext bytes restored from an authenticated encrypted envelope; temporary artifacts removed. |

This document is not a certification and must not be used to authorize real applicant data while mandatory external gates remain incomplete.
