# Changelog

Notable changes will be recorded here. This repository has no documented historical release, so earlier release entries are intentionally not inferred.

## v1.0.0-rc.2 — 2026-07-16

Blank installations and an expanded AI-provider catalog. **Still a release candidate: unfinished, provided as-is, real-data use is at the deploying organization's own risk.**

- Added `npm run setup:blank`: an empty installation with no demo accounts, no synthetic records, and no seeded data. It prints a one-time `/setup` claim token (only its SHA-256 hash is stored), disables the demo banner and demo login, and refuses to run against a database that already contains records.
- Clarified every local-tooling guard message: synthetic seeding and SQLite helpers never run outside the synthetic profile; production databases start blank and are claimed once through `/setup`.
- Expanded document-extraction support from 7 providers to 17 named providers plus any custom OpenAI-compatible endpoint: added OpenAI, Azure OpenAI, xAI, DeepSeek, Together AI, Fireworks AI, Cohere, Perplexity, self-hosted Ollama, and `custom` (base URL + model). Azure uses its `api-key` header and deployment-scoped URL; Ollama may run keyless; Perplexity/custom omit `response_format` while keeping the JSON extraction contract.
- The setup wizard lists the full catalog and honestly reports environment-configured endpoints (Azure/Ollama/custom) as `UNSUPPORTED` for its connection probe instead of simulating a pass; new named vendors probe with a one-token inference call.
- Provider key material is now validated only for the selected provider, so unrelated provider variables present on a machine can no longer block startup. Selected-provider keys still require minimum length and non-placeholder values, and production still requires `APPROVED_AI_PROVIDERS` plus `AI_PROVIDER_APPROVAL_ID` and HTTPS endpoints.
- 25 new unit tests (273 total passing): provider routing/auth headers, Azure URL construction, keyless Ollama, custom endpoints, probe behavior, env-schema requirements, and blank-database detection.
- Documented the catalog, blank installation, and at-your-own-risk positioning in the README, environment-variable reference, and AI vendor review (expanded catalog is block-by-default pending each organization's own vendor review).

## v1.0.0-rc.1 — 2026-07-16

First tagged release candidate. **Synthetic data only — not certified for real applicant data.**

Status: `SAFE_CHECKS_PASS_WITH_EXTERNAL_BLOCKERS`. All ten automated gates in `npm run validate` pass (248 unit/integration tests, 11 browser/accessibility checks, production build, repository and git-history secret scans, dependency audit, production schema validation, synthetic evaluation). The ten remaining blockers are live/organizational and are listed in [Version 1 criteria](./docs/version-1-criteria.md).

- Completed the document → review → map → sign → review → deliver workflow on synthetic data.
- AES-256-GCM encryption for stored documents, templates, exports, and secrets, with key IDs, auth tags, and fail-closed envelopes.
- Authentication hardening: bcrypt, TOTP MFA with recovery codes, session expiry/idle timeout, atomic rate limiting and lockout, role-based permissions, and organization scoping.
- PDF/upload safety: active-content rejection, hex-escaped action normalization, signature/size/dimension limits, and optional ClamAV scanning.
- Workflow integrity: signature invalidation on data change, approval digests, atomic approval claims, delivery idempotency and retries, legal holds, and two-administrator deletion approval.
- Outbound protection: HTTPS-only production endpoints, host/port allowlists, blocked metadata/loopback targets, and address pinning.
- PostgreSQL production schema, row-level security, and least-privilege role scripts.
- Secret-scanning tooling for the repository and full git history, plus CI workflows.

Known limitation: the deep security scan was canceled before centralized validation. Its 27 candidate clusters were never confirmed, were inspected and remediated anyway, and do **not** constitute a penetration test.

## Unreleased

- Added a fail-closed synthetic-only server configuration boundary.
- Isolated Playwright from the development database, server, and Next.js work directory.
- Made ordinary local database setup preserving and destructive reseeding explicit.
- Added public project, security, contributor, support, architecture, operations, data-handling, and release documentation.
- Added dependency, code, secret, and SBOM automation for the Phase 0 supply-chain baseline.
