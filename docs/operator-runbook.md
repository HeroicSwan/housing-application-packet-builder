# Operator runbook

## Scope

This runbook covers the supported local synthetic demonstration only. It is not a production operations guide and does not authorize real applicant information.

## Start the application

```text
npm ci
copy .env.example .env
npm run db:generate
npm run db:setup
npm run dev
```

Confirm that the interface shows the synthetic-demonstration warning and that `DATA_MODE=synthetic`. Stop the server with `Ctrl+C` in the terminal that started it.

## Seed and reset

`npm run db:setup` applies the local schema and seeds only an empty database. Use it for ordinary setup.

`npm run db:reset` deletes the configured disposable synthetic database contents, reapplies migrations, and reseeds. Before running it, inspect `DATABASE_URL` and confirm it points to the repository's local synthetic SQLite file. There is no approved real or production database target in Phase 0.

## Backup and verification

For disposable synthetic local data:

```text
npm run backup
npm run backup:verify -- <path-to-encrypted-backup>
```

The backup command creates an encrypted SQLite snapshot through the configured storage adapter. The verification command authenticates and validates a local encrypted backup. Restore only to a new disposable path:

```text
npm run backup:restore -- <path-to-encrypted-backup> --target tmp/restored.sqlite
```

The command refuses an existing target. Never overwrite `dev.db` while the application is running. PostgreSQL restoration is described in [production operations](./production-operations.md).

## E2E operation

```text
npm run test:e2e
```

The runner selects a dedicated test database, rejects normal development or production paths, prepares and seeds it before server startup, and lets Playwright own the server lifecycle. A failure should preserve sanitized diagnostics while cleanup remains best effort.

## Windows Prisma file locks

The previous failure occurred when `prisma generate` attempted to replace the Windows query-engine DLL while a Next.js process still had it open. The E2E lifecycle avoids that sequence and does not reuse a manually running development server.

If a manual Prisma generation still reports `EPERM`:

1. Stop the project server with `Ctrl+C` in the terminal that launched it.
2. Wait for that process to exit; do not delete Prisma engine files while it is running.
3. Run `npm run db:generate` again.
4. If the process did not exit, identify only the Node process launched for this repository and stop it through the same terminal or task manager. Do not kill unrelated Node processes.
5. Record the sanitized path and command if the lock recurs.

Normal E2E reruns should not require these recovery steps.

## Safe logs

Logs and support reports may include event names, timestamps, status codes, sanitized file categories, and internal record identifiers when necessary. They must not include document contents, extracted values, names, addresses, credentials, provider keys, session values, signatures, or complete request bodies.

Do not upload databases, PDFs, `.env` files, backups, screenshots, or Playwright traces until they have been verified synthetic and free of secrets.

## Known failure modes

- Local seed/reset utilities reject any non-synthetic data mode by design; production mode has separate fail-closed requirements.
- Missing or invalid session configuration prevents startup rather than enabling an unsafe fallback in production mode.
- Optional providers fail without their own key or network access; use the mock processor for supported local work.
- SQLite can be locked by an improperly stopped process; allow the owning process to exit before database maintenance.
- Local restore evidence does not replace the required timed managed-infrastructure exercise.

## Escalation

For ordinary bugs, follow [SUPPORT.md](../SUPPORT.md) with synthetic steps and sanitized output. For vulnerabilities, secrets, or accidental sensitive-data exposure, stop processing and follow [SECURITY.md](../SECURITY.md) privately.
