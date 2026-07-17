# Production secret-manager runbook

This runbook is the operator handoff for production credentials. It deliberately does not prescribe one cloud vendor; the application accepts injected environment values and rejects unsafe production configuration before startup.

## Secret inventory

| Secret group | Names | Rotation owner | Repository action |
| --- | --- | --- | --- |
| Application session | `SESSION_SECRET` | platform/security | Generate a replacement and restart all web/worker processes together |
| Application data encryption | `DATA_ENCRYPTION_KEY`, `DATA_ENCRYPTION_KEY_ID`, temporary `DATA_ENCRYPTION_PREVIOUS_KEYS` | security/platform | Generate a new key, run authenticated re-encryption, then retire the old key |
| Monitoring | `MONITORING_TOKEN` | platform/observability | Generate a replacement and update the scraper atomically |
| PostgreSQL | owner, application, and system role passwords | database owner | Rotate in PostgreSQL/manager; update only the injected versions |
| Object storage | access key/secret or workload identity | infrastructure | Prefer workload identity; otherwise rotate the pair and verify private-bucket policy |
| SMTP and delivery | SMTP user/password and destination tokens | operations | Rotate in the mail/provider account and run synthetic delivery tests |
| External AI providers | none supported for customer data | security/vendor owner | Previously shared keys must be revoked externally; this release uses local Ollama only |

## Safe procedure

1. Create a change record with owner, scope, maintenance window, previous version identifier, rollback owner, and verification commands.
2. Create a new version in the secret manager. Never paste values into chat, tickets, terminal transcripts, screenshots, or GitHub.
3. Keep old and new application secret versions available only for the documented overlap window. Keep the previous data-encryption key until `npm run encryption:rotate` and the read-back checks succeed.
4. Deploy the migration task first, then web and worker processes, then backup and monitoring consumers. Do not expose secret-manager values in process listings or logs.
5. Verify with redacted commands:

   ```text
   npm run config:production
   npm run production:check
   npm run security:secrets
   npm run security:history
   npm run backup:verify
   ```

6. Capture only status, timestamps, key IDs, checksums, and result URLs in the private change record. Do not store values in this repository.
7. Revoke old versions after the overlap window and confirm access logs show the expected principals only.

## Recovery

If startup or decryption checks fail, restore the previous secret-manager version and application artifact, keep the previous data-encryption key available, and follow [disaster recovery](../disaster-recovery.md). Never delete the old encryption key as a first response to a failed deployment.
