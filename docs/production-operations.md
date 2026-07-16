# Production operations

Local development remains `npm` + SQLite and does not require Docker. `compose.production.yml` is a reference production profile using PostgreSQL, separate owner/application/system roles, a migration task, web app, durable worker, private object storage, ClamAV, and encrypted backup job.

Docker is optional. A native Linux deployment can use the web, worker, and backup systemd examples under `ops/systemd/` with TLS termination from `ops/Caddyfile.example`. Keep `/etc/hapb/hapb.env` readable only by the service account. The web and worker use restricted database roles; only the one-shot migration process receives the owner credential.

## Required secrets

Use a secrets manager, not an environment file in source control. Generate independent owner, application, and system database passwords; session secret; 32-byte canonical-Base64 encryption key and key ID; monitoring token; object-storage credentials; SMTP credentials; and any approved provider key. URL-encode passwords placed in PostgreSQL URLs. Previously shared provider keys must be revoked, not reused.

## Deploy

1. Complete the privacy, AI-vendor, template, penetration, accessibility, and caseworker gates documented in `docs/release-readiness.md`.
2. Populate the production variables and an external TLS/reverse-proxy configuration.
3. Start the database and role initializer, then run the one-shot migration service. It applies the production schema and grants least privilege.
4. Start the app and worker. Confirm `/api/health` returns 200.
5. Configure the monitoring system to scrape `/api/metrics` with `Authorization: Bearer <MONITORING_TOKEN>` and load `ops/prometheus-alerts.yml`.
6. Create synthetic smoke records only, verify tenant isolation, upload/review/generate/deliver to a non-production destination, then delete the smoke case through data governance.

## Routine controls

- Review terminal/stale jobs and failed documents/submissions daily.
- Verify a completed backup every day and alert at 36 hours.
- Restore to a disposable PostgreSQL target at least quarterly and after database/storage changes.
- Review staff, administrator count, MFA enrollment, destinations, active templates, legal holds, and provider approvals monthly.
- Patch high-severity dependencies and base images promptly; rotate external keys on the organizational schedule and after exposure.
- Re-run the OCR corpus and template acceptance for every model/template version.

## Key rotation

Set a new `DATA_ENCRYPTION_KEY` and `DATA_ENCRYPTION_KEY_ID`, place the old ID/key in `DATA_ENCRYPTION_PREVIOUS_KEYS`, stop writes or schedule a maintenance window, run `npm run encryption:rotate`, verify representative objects/MFA/destinations/jobs, create and restore a new backup, then remove the previous key only after confirming no old envelopes remain. Rotate database, object-store, SMTP, monitoring, and AI credentials in their own systems and restart all processes. A provider key exposed in chat or logs is compromised and must be revoked immediately.

## Rollback and disaster recovery

Keep the previous immutable application artifact and a verified pre-deployment encrypted backup. Application rollback is allowed only when the deployed schema remains compatible. Otherwise restore the backup into a new database and follow [disaster recovery](./disaster-recovery.md). Every restore drill must capture RPO/RTO, checksums, representative object reads, audit continuity, alert delivery, and the approving operator.
