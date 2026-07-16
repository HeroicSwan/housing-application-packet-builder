# Local development

The supported evaluator workflow uses Node.js, npm, SQLite, synthetic fixtures, and the deterministic mock document processor. It does not require Docker, WSL, a hosted database, provider credentials, or paid API calls.

> **Synthetic demonstration only:** do not enter, upload, paste, or import real applicant information. The demo credentials below are public test credentials and must never be enabled in production.

## Supported prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Windows, macOS, or Linux with write access to the repository
- Chromium only when running browser E2E tests

The setup command checks Node.js and npm before making application changes and exits nonzero with an actionable message when a version is unsupported.

## One-command setup

Open a terminal in the repository root and run the same command on every supported platform.

### Windows PowerShell

```powershell
npm run setup
npm run dev
```

### Windows Command Prompt

```bat
npm run setup
npm run dev
```

### macOS and Linux

```sh
npm run setup
npm run dev
```

Open `http://localhost:3000`, or in another terminal run:

```text
npm run open
```

`npm run open -- --start` starts the local development server when necessary and then opens the configured URL. Stop a server you started interactively with `Ctrl+C`.

## What setup does

`npm run setup` is safe to rerun. It:

1. checks the Node.js and npm versions;
2. creates `.env` from `.env.example` only when `.env` does not exist;
3. places new, random local-only session and encryption values only in a newly created `.env`;
4. never displays generated secret values;
5. validates an existing dependency installation or installs locked dependencies when they are absent;
6. generates the Prisma client;
7. creates or updates `prisma/dev.db` without erasing existing demo work;
8. seeds deterministic synthetic data only when the local database is empty;
9. verifies writable storage, PDF generation, and a synthetic upload path;
10. starts a temporary local server, checks application health, and shuts it down; and
11. prints the application URL, demo login instructions, start command, and reset command.

Setup never overwrites an existing `.env`, database, or stored file. If an existing `.env` lacks a newly required setting, setup reports the problem and leaves the file for the operator to review.

## Files created locally

| Path | Purpose | Source-control status |
| --- | --- | --- |
| `.env` | Local configuration and generated development-only secrets | Ignored; never commit |
| `node_modules/` | Locked npm dependencies | Ignored |
| `prisma/dev.db` | Disposable synthetic SQLite demonstration database | Ignored |
| `.data/storage/` | Local encrypted synthetic object storage | Ignored |
| `output/pdf/` | Writable generated-PDF output path used by local probes | Ignored |
| `.next/` | Next.js development/build output after starting or building | Ignored |

E2E runs create an isolated database under `prisma/.e2e/` and local storage under `.data/e2e/`. The runner cleans these up on a best-effort basis and never selects `prisma/dev.db`.

## Synthetic demo accounts

| Role | Email |
| --- | --- |
| Caseworker | `caseworker@example.org` |
| Reviewer | `reviewer@example.org` |
| Administrator | `admin@example.org` |

The synthetic password for all three accounts is `DemoHousing2026!`. One-click role login may also be available in demo mode. These credentials are intentionally public and production configuration rejects demo login, demo seed context, and default administrator credentials.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Idempotent first-run bootstrap and local acceptance probes |
| `npm run dev` | Start the supported local development server |
| `npm run open` | Open `APP_URL`, defaulting to `http://localhost:3000` |
| `npm run open -- --start` | Start the local server if needed, then open it |
| `npm run healthcheck` | Check an already running application's health endpoint |
| `npm run healthcheck -- --start` | Start a temporary local server, check health, then stop it |
| `npm run demo:reset -- --yes` | Destructively reset and reseed the disposable synthetic demo |
| `npm run db:setup` | Preserve existing local data while applying the schema and seeding an empty database |
| `npm run test:e2e` | Run Playwright and axe against an isolated database and server |
| `npm run build` | Build the application |
| `npm run start` | Start the hardened production build; not the local demo command |
| `npm run config:production` | Validate production variables without contacting production services |
| `npm run production:check` | Verify the build, migrations, demo-account boundary, and worker health without starting the app |

`npm run start` requires a completed build and valid production configuration. It fails closed when production requirements are absent; use `npm run dev` for local evaluation.

## Health verification

With the local server running:

```text
npm run healthcheck
```

A successful check confirms that the HTTP health route responds successfully and the configured database is reachable. It does not prove that optional providers, delivery destinations, or production infrastructure are approved or available.

For a self-contained probe that owns and cleans up its server process:

```text
npm run healthcheck -- --start
```

## Reset the demo

The reset command is intentionally explicit:

```text
npm run demo:reset -- --yes
```

It prints a destructive-operation warning, accepts only the guarded local `dev.db` or `synthetic-*.db` path, requires synthetic mode, recreates the schema, and reseeds deterministic demo records. Without `--yes`, it refuses to proceed. It cannot select PostgreSQL, the E2E database, an absolute path, or a production-mode configuration.

## Verification and browser tests

```text
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

If Chromium is missing:

```text
npx playwright install chromium
```

The E2E runner prepares its isolated database before starting a Playwright-owned server on port 3100. It stops the server before cleanup, so a normal second run should not require manually killing Node processes.

## Port inventory

| Port | Use | Exposure in the local workflow |
| --- | --- | --- |
| `3000` | Next.js local application and default `APP_URL` | User-facing loopback/local interface |
| `3100` | Temporary Playwright-owned E2E server | Loopback only during E2E |
| random loopback port | Temporary `healthcheck -- --start` server | Selected automatically and removed after the check |
| `5432` | PostgreSQL in the reference production architecture | Not required by local setup |
| `3310` | ClamAV in the reference production architecture | Not required by local setup |
| `8787` | Production worker health endpoint | Private service network only; not required by local setup |
| `9000` / `9001` | S3-compatible object API/console in the reference profile | Not required by local setup |
| `587` | Default outbound SMTP port | Optional external destination |

Production services should remain private behind the approved network and TLS/reverse-proxy design; a port number is not an authorization to publish a service.

## Failure recovery

- **Unsupported Node.js or npm:** install a supported version, open a new terminal, and rerun `npm run setup`.
- **Partial setup:** correct the reported cause and rerun `npm run setup`; it is idempotent and does not overwrite existing configuration or data.
- **Existing `.env`:** compare it with `.env.example` manually. Setup will not replace or merge it automatically.
- **Permission failure:** grant the current user write access only to this repository and its generated paths; do not run the application as an administrator to bypass filesystem policy.
- **Port 3000 already used:** stop the project server already using it, then rerun the health or development command.
- **Health returns an error:** review the sanitized server output, verify `DATA_MODE=synthetic`, the guarded SQLite URL, and local file permissions, then rerun `npm run db:setup` and the health check.
- **Missing Prisma client:** stop the project server and run `npm run db:generate`.
- **Windows Prisma `EPERM`:** stop the terminal that owns the project server, wait for it to exit, and rerun generation. Do not delete a loaded Prisma engine or kill unrelated Node processes. See [operator-runbook.md](./operator-runbook.md).
- **Provider error:** restore `DOCUMENT_PROCESSOR=mock`; local setup and default tests do not require provider keys.

## Remove the local demo

Stop every application and worker process for this repository. After confirming the absolute repository path, manually remove only `.env`, `prisma/dev.db` and its SQLite sidecars, and `.data/storage/`. `.next/` and `node_modules/` may also be removed to reclaim build/dependency space. Do not use a wildcard or recursive deletion outside these exact repository paths.

Removing the demo is destructive. It does not revoke any external provider credential; exposed credentials must be rotated through their providers.

See [environment-variables.md](./environment-variables.md) for configuration details and production fail-closed categories.
