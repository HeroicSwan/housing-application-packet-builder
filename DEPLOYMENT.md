# Production deployment

The included production profile is a single-instance deployment with a migrated SQLite database on a persistent volume and private S3-compatible object storage. Use a managed container platform, TLS ingress, managed SMTP, and an external uptime monitor.

## Configure

1. Copy `.env.production.example` to `.env.production` outside source control.
2. Generate independent session and encryption secrets. `DATA_ENCRYPTION_KEY` must be a base64-encoded 32-byte value.
3. Set the public HTTPS `APP_URL`, Anthropic document-processing key, SMTP credentials, and private S3 credentials.
4. Keep `ENABLE_DEMO_LOGIN=false` and use a non-demonstration administrator account.

## Deploy

Run `docker compose --env-file .env.production -f compose.production.yml up --build -d`. Startup applies committed Prisma migrations before serving traffic. `/api/health` checks database availability and is used by the container health check.

The backup service creates an authenticated AES-256-GCM database snapshot every 24 hours and uploads it to the private object store. Test restore material regularly with `npm run backup:verify -- <local-backup-file>` and a disposable environment.

## Operational requirements

- Put the application behind TLS and restrict the MinIO/API consoles to an operations network.
- Configure external health checks and alerts for HTTP 503, container restarts, failed `BackupRun` records, and failed `ApplicationSubmission` records.
- Export container logs to a retention-controlled security log service. Application logs intentionally exclude document contents and extracted values.
- Rotate SMTP, S3, Anthropic, session, and data-encryption credentials under a documented key-rotation procedure.
- Run dependency/container scanning, penetration testing, privacy review, and an incident-response exercise before real client data is authorized.
- The bundled database profile is single-writer. Organizations needing horizontal scaling should migrate the same relational model to managed PostgreSQL before adding application replicas.
