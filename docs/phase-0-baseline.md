# Phase 0 baseline

Recorded on 2026-07-14 before Phase 0 implementation changes.

## Repository state

- Branch: `master`
- Revision: `50fae62b6354a937d66ea9d3b298848611b97323`
- Package manager: npm with `package-lock.json`
- Runtime used for this baseline: Node.js `v24.16.0`, npm `11.13.0`
- The workflows currently select Node.js 22. The repository did not declare a Node.js engine range before Phase 0.
- The working tree was not clean before this work began. Existing user changes were present in `src/app/globals.css`, `src/app/page.tsx`, and `src/components/app-shell.tsx`. They were preserved and are not part of this baseline audit.

Database setup also regenerated five tracked synthetic PDF fixtures with different binary output. That behavior is a reproducibility concern; it did not indicate that real records were introduced.

## Architecture summary

The application is a Next.js 16 App Router application using React 19 and TypeScript. Server routes and server-side libraries implement credential/session authentication, role checks, case and household workflows, document upload and extraction review, template administration, application-draft population, PDF generation and AcroForm filling, consent and typed-signature capture, review, audit-event recording, and submission adapters.

Prisma is the persistence layer. The checked-in schema uses SQLite and one checked-in migration. Local development uses a database below `prisma/`. The seed process creates synthetic demonstration users, programs, cases, templates, documents, drafts, and workflow records.

Uploaded and generated files use a storage-adapter boundary. Local filesystem storage is the development default; an S3-compatible adapter is present but was not exercised in this baseline. Document processing has a deterministic mock default and optional external AI-provider adapters. No provider key is needed by the default tests.

## Existing scripts

| Script | Baseline responsibility |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a Next.js production build. |
| `npm start` | Start the built Next.js application. |
| `npm run lint` | Run ESLint over the repository. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm test` | Run the Vitest unit and integration suite. |
| `npm run test:e2e` | Run database setup and then the Playwright suite. At baseline this reused the normal development database and could reuse an already-running server. |
| `npm run db:generate` | Generate Prisma Client. |
| `npm run db:setup` | Ensure the local database exists, regenerate PDF fixtures, generate Prisma Client, push the schema, and seed synthetic data. |
| `npm run db:deploy` | Apply checked-in Prisma migrations. |
| `npm run backup` | Run the existing backup utility. |
| `npm run backup:verify` | Verify an existing backup using the repository utility. |

## Database and fixture layout

- Prisma schema: `prisma/schema.prisma`
- Checked-in migration: `prisma/migrations/20260713000100_initial_production_schema/migration.sql`
- Synthetic seed: `prisma/seed.mjs`
- Local database default: `prisma/dev.db`
- Database helper: `scripts/ensure-local-db.mjs`
- Synthetic PDF generator: `scripts/generate-pdf-fixtures.mjs`
- Retained synthetic fixture PDFs: `fixtures/`
- Local databases and journals are ignored by Git.

The baseline `db:setup` command used `prisma db push`, not the checked-in migration. It also regenerated tracked PDF binaries on every run.

## Configuration and safeguards

`src/lib/env.ts` uses Zod to validate server configuration. It defaults local development to SQLite, mock document processing, local storage, and demo login outside production. Provider keys remain server-side because they are not exposed through `NEXT_PUBLIC_` variables.

Existing safeguards before Phase 0 included:

- synthetic seed records and explicitly fictional housing programs;
- synthetic agency and supporting-document fixtures;
- mock document processing as the default;
- visible synthetic-demonstration warnings in the interface;
- production validation for session, encryption, malware-scanner, storage, and demo-login settings;
- no provider keys required for the ordinary local or CI test path.

There was no single server-side data-mode setting that rejected a non-synthetic mode. The interface warning also did not consistently use the explicit phrase that the application is not approved for real applicant information.

## Authentication, uploads, storage, and AI

Authentication uses database-backed hashed sessions, password hashing, account lockout/rate-limit controls, reset-token support, MFA-related models and utilities, and role authorization. The baseline is not an external security assessment, and these controls were not evaluated as production-ready.

Upload code includes file-size, type, filename, and document-handling checks. Stored documents can use local or S3-compatible storage, with encryption-related configuration. External malware scanning and provider-backed document processing are configuration-dependent. The local default remains synthetic, local, and mock-backed.

AI adapters are present for multiple providers. The tracked configuration uses empty or clearly non-usable example values. Previously pasted provider credentials must be treated as compromised and rotated in the relevant provider consoles; repository edits cannot rotate them.

## Test layout

- `tests/**/*.test.ts`: Vitest unit and integration coverage.
- `tests/e2e/**/*.spec.ts`: Playwright browser flows.
- Playwright uses Chromium, one worker, and serial file execution.
- Two Playwright specifications invoke `@axe-core/playwright` accessibility scans.
- The baseline Playwright server URL was `http://127.0.0.1:3000` and reused a non-CI development server.

## Existing CI

Two GitHub Actions workflows existed:

- `.github/workflows/ci.yml`: checkout, Node.js 22 setup, `npm ci`, database setup, lint, typecheck, Vitest, and build.
- `.github/workflows/e2e.yml`: checkout, Node.js 22 setup, `npm ci`, Chromium installation, and Playwright E2E.

Both used synthetic CI configuration, but both selected `file:./dev.db`. The standard workflow did not have explicit code scanning, dependency reporting, secret scanning, or SBOM artifact generation. Dependabot configuration was absent.

## Baseline command results

Commands were executed from the repository root. Durations are wall-clock observations where retained.

| Command | Result | Duration / count |
| --- | --- | --- |
| `npm ci` | Passed | 67.9 s; 724 packages installed, 725 audited, 0 vulnerabilities reported. |
| `npm run db:generate` | Passed | 1.7 s. |
| `$env:DATABASE_URL='file:./phase0-baseline.db'; npm run db:setup` | Passed | 5.8 s; SQLite schema push and synthetic seed completed. |
| `npm run lint` | Passed | 43.5 s. |
| `npm run typecheck` | Passed | 30.7 s. |
| `npm test` | Passed | 36.26 s; 52 passed, 2 skipped across 14 files (12 passed, 2 skipped). |
| `npm run build` | Passed | 54.6 s. |
| `npm run test:e2e` while the development server was running | Failed during setup | Prisma Client generation failed before browser tests with a Windows `EPERM` rename of the query-engine DLL. Duration was not retained. |
| `npm run test:e2e` after stopping the development server | Passed | 80.4 s; 6 passed, including both axe specifications. |

## Baseline E2E failure

The failing command called `db:setup`, which called `prisma generate` while the active Next.js process had loaded Prisma's Windows query-engine DLL. Windows would not replace that loaded DLL, so Prisma failed during its temporary-file rename. Playwright could also reuse the already-running development server and the normal development database. Stopping the server allowed the same suite to pass, confirming that the browser assertions were not the source of the baseline failure.

## Known limitations

- Synthetic demonstration data only; the application is not approved for real applicant information.
- SQLite and local filesystem defaults are suitable for this reproducible demonstration, not evidence of production durability or scaling.
- No organization isolation or multi-tenant authorization boundary.
- No verified production background-job system or reliable unattended delivery mechanism.
- External provider behavior, real agency templates, real submission destinations, and malicious-document handling have not been independently evaluated.
- Retention, deletion, client export, tamper-evident audit, incident-response, monitoring, and restoration evidence remain incomplete.
- No external penetration test, privacy review, compliance certification, caseworker usability study, or independent accessibility study has been completed.
- The tracked PDF generation step is not byte-for-byte deterministic.

## Areas not verified in the baseline

Docker and the production Compose profile were inspected but not executed. Live AI-provider calls, S3-compatible storage, malware-scanner integration, email/API destinations, production deployment, password-delivery infrastructure, and backup restoration against an independently retained backup were not exercised. No real applicant or real agency data was used.
