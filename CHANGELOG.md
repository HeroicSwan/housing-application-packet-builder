# Changelog

Notable changes will be recorded here. This repository has no documented historical release, so earlier release entries are intentionally not inferred.

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
