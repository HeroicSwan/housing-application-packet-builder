# Phase 0 completion report

Recorded on 2026-07-14 after the Phase 0 implementation and verification pass.

## Scope implemented

This change set completes the selected Phase 0 scope: public open-source cleanup, reproducible Node/npm and SQLite setup, explicit synthetic-only enforcement, isolated Windows-safe E2E execution, documentation, CI baseline, and repository hygiene. Existing caseworker, reviewer, administrator, document, extraction, PDF, AcroForm, signature, consent, submission-adapter, authentication, storage, and AI-provider code was preserved.

## Explicit non-goals

Phase 0 does not enable real applicant data, production PostgreSQL, multi-tenancy, organization-scoped RBAC, SSO/SAML/OIDC/SCIM, durable background jobs, real agency API or portal automation, high availability, horizontal scaling, compliance certification, or a production-readiness claim.

## Baseline status

The baseline is recorded in [phase-0-baseline.md](./phase-0-baseline.md). It was captured on branch `master` at revision `50fae62b6354a937d66ea9d3b298848611b97323` with Node.js 24.16.0 and npm 11.13.0. The working tree already contained user UI changes; those changes were preserved. Before this work, the browser suite failed on Windows when Prisma attempted to replace a loaded query-engine DLL and passed only after the development server was stopped.

## Files changed

The implementation changes configuration validation, database lifecycle wrappers, E2E orchestration, secret scanning, storage configuration, CI workflows, repository ignore rules, security headers/documentation, and the existing synthetic-demo warning. New tests cover environment validation, database-path isolation, all-schema-model data preservation, seed boundaries, and secret patterns. The existing UI files `src/app/globals.css`, `src/app/page.tsx`, and `src/components/app-shell.tsx` remain user-owned changes and were not replaced.

## Configuration changes

- `DATA_MODE` defaults to `synthetic` and rejects every other value before database access.
- `DOCUMENT_PROCESSOR=mock` remains the default and no provider key is needed for local setup, unit tests, or E2E.
- Server configuration is parsed through `src/lib/env-schema.ts`; `src/lib/env.ts` and the Prisma client are server-only.
- `DATA_ENCRYPTION_KEY`, when supplied, must be canonical Base64 encoding of exactly 32 bytes.
- Empty optional URL/key fields in the examples parse as absent values.
- `.env.production.example` is explicitly an unsupported synthetic container profile and intentionally fails production validation until real deployment controls are supplied.

## Synthetic-mode safeguard behavior

The server-side configuration boundary is authoritative. The seed and backup utilities also reject non-synthetic mode before opening a database or file. Ordinary `db:setup` preserves any row in any of the 27 Prisma models; destructive reseeding requires the explicit `db:reset` wrapper. Tests include an operational-record-only database containing a `BackupRun` and `RateLimitBucket` and verify both survive preserving setup. The UI warning states that the environment contains synthetic demonstration data and is not approved for real applicant information.

## Secret-hygiene findings without secret values

The local scan covers tracked and Git-visible untracked files, skips binary content, reports only path/line/category, and never prints values. It detects provider-shaped keys plus generic assignments for API keys, secrets, passwords, tokens, access keys, and encryption keys while allowing documented placeholders and environment references. The final scan passed for 224 repository files with no findings. Previously pasted provider credentials remain compromised and must be revoked or rotated through each provider's authorized interface; repository edits cannot perform that rotation.

## Windows Prisma/Playwright root cause

The baseline E2E wrapper regenerated Prisma Client while a running Next.js process still held Prisma's Windows query-engine DLL. Windows rejected the replacement rename with `EPERM`. The old runner could also reuse a manually running server and the normal development database.

## Windows Prisma/Playwright fix

`test:e2e` now creates a unique database directly under `prisma/.e2e`, validates that path and synthetic mode, generates Prisma before server startup when needed, applies the checked-in migration, seeds synthetic data, starts a dedicated Next server on port 3100, and lets Playwright own its lifecycle. The E2E dist directory is separate from the normal Next directory. Cleanup waits for child processes and is best effort without hiding test failures. Two consecutive runs completed without manually killing processes: 6/6 tests passed in each run, including both axe specifications in each run.

## Local setup verification

The non-Docker workflow was verified with npm and SQLite on Windows. `npm ci` installed 724 packages and audited 725 with zero vulnerabilities. Prisma generation passed. A fresh disposable synthetic database seeded successfully; a second `db:setup` preserved its data. No provider key, Docker daemon, hosted database, or paid API call was required.

## CI changes

The blocking CI workflow uses lockfile installation, Prisma generation, synthetic database setup, lint, typecheck, Vitest, and build. Separate workflows cover Playwright/axe, CodeQL, dependency review, and pinned Gitleaks history scanning. Dependabot monitors npm and GitHub Actions. The standard path does not require Docker or provider credentials.

## Supply-chain changes

Dependency auditing and a production-only audit both passed with zero vulnerabilities. The CI SBOM job uses npm's CycloneDX output as its only artifact; the local SBOM validated as CycloneDX with 695 components and was removed after verification. All workflow and Dependabot YAML files parsed successfully with js-yaml. No database, PDF, environment file, upload, backup, log, or secret is uploaded by these workflows.

## Documentation created or updated

README, SECURITY, SUPPORT, CHANGELOG, architecture, local-development, operator-runbook, data-handling, release-process, version-1-criteria, deployment, responsible-AI, fixture, and caseworker-usability documents now describe observed behavior, limitations, safe local operations, and future gates without claiming production readiness.

## Exact commands executed

| Command | Result |
| --- | --- |
| `npm ci` | Passed — 149.9 s; 724 packages installed, 725 audited, 0 vulnerabilities. |
| `npm run db:generate` | Passed — 1.6 s. |
| `set DATA_MODE=synthetic && set DATABASE_URL=file:./synthetic-phase0-final.db && npm run db:setup` | Passed — fresh synthetic schema and seed. |
| Same `db:setup` command a second time | Passed — existing data preserved. |
| `npm run lint` | Passed — 17.6 s. |
| `npm run typecheck` | Passed — 7.9 s. |
| `npm test` | Passed — 87 passed, 2 skipped, 20 files (18 passed, 2 skipped). |
| Focused boundary tests | Passed — 14 passed. |
| `npm run build` | Passed — 24.3 s; one existing Turbopack NFT-tracing warning was reported. |
| `npm run test:e2e` | Passed — 6/6 tests, including axe checks. |
| `npm run test:e2e` (immediate second run) | Passed — 6/6 tests, including axe checks. |
| `npm run security:secrets` | Passed — 223 files, no values printed. |
| `npm run security:dependencies` | Passed — zero high-or-higher vulnerabilities. |
| `npm audit --omit=dev` | Passed — zero production vulnerabilities. |
| `npm sbom --sbom-format cyclonedx` | Passed — validated CycloneDX SBOM with 695 components; temporary file removed. |
| js-yaml parse of CI, E2E, CodeQL, dependency-review, secret-scan, and Dependabot files | Passed. |
| `git diff --check` | Passed. |

## Remaining blockers

The application remains synthetic-only and is not approved for real applicant data or company production use. Previously exposed provider keys require external rotation. Version 1 gates remain unmet for privacy review, retention/deletion, client export, tamper-evident auditing, production PostgreSQL, organization isolation, production job processing, OCR and malicious-document evaluation, real-template acceptance, monitoring/alerting, incident-response exercise, external penetration testing, accessibility and caseworker usability studies, AI vendor review, and backup restoration evidence. The local backup verifier does not constitute a tested restore procedure. The build still emits a non-fatal Turbopack NFT tracing warning around dynamic local storage paths.

## Known limitations

The default persistence and storage are SQLite/local filesystem, external provider adapters are optional and unexercised by the default suite, and the retained fixtures are synthetic. Automated axe checks are not a substitute for manual accessibility testing. No real agency template, destination, applicant record, or provider credential was used.

## Phase 1 prerequisites

Before any real-data work, complete an approved privacy/data-flow review, retention and deletion design, secure export, tamper-evident audit design, production database and organization isolation architecture, durable job and delivery controls, OCR/document security evaluation, real-template acceptance, monitoring and incident response, independent penetration testing, manual accessibility and caseworker testing, AI-vendor review, and timed backup restoration evidence. Revoke the previously exposed provider keys before any provider testing.

## Acceptance criteria

Phase 0 acceptance criteria are met for the applicable local scope: the repository was inspected, existing workflows remain covered, Node/npm and SQLite setup is reproducible without Docker or paid APIs, synthetic mode is enforced server-side, current files contain no known active secrets, E2E uses isolated databases and passes twice, lint/typecheck/unit/build/browser/axe checks pass, CI and supply-chain checks are configured, required documentation exists, and the completion evidence is recorded here. Production and real-data criteria are intentionally not claimed.

**This project remains synthetic-only and is not approved for real applicant data.**
