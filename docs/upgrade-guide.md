# Upgrade guide

1. Read the release notes and back up PostgreSQL and private object storage. Verify the encrypted database backup before continuing.
2. Stop intake and delivery workers, then deploy the new application artifact with the old artifact still available for rollback.
3. Run `npm ci`, `npm run db:validate:production`, and `npm run db:deploy` using the database-owner migration credential. The web and worker use restricted credentials and must not run migrations.
4. Start one worker and one web instance. Run `npm run production:check`, the health check, a synthetic application generation, and a synthetic delivery to a non-production destination.
5. Confirm migration level, worker heartbeat, queue depth, object reads, alerts, and audit-chain verification before restoring traffic.

Template versions are immutable after publication. Clone an active version for ordinary upgrades. Publishing runs compatibility checks. If a new version is unsafe, open the last known-good published version and create a rollback draft; inspect and publish that new version. Existing drafts remain pinned to their original version.

Application rollback does not reverse a database migration. If a migration is incompatible, keep traffic stopped and restore the verified pre-upgrade backup to a new database, point the old application artifact at it, verify row/object counts, and document the decision. Never edit or delete a published migration.
