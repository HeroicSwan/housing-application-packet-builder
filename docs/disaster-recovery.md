# Disaster recovery and rollback evidence

The deploying organization must define RPO, RTO, incident authority, backup retention, off-site destination, and communication owners. Repository defaults are examples, not an approved policy.

## Recovery sequence

1. Stop web intake and workers; preserve logs and audit evidence.
2. Identify the last verified encrypted database backup and matching object-store version/snapshot. Do not restore over the damaged database.
3. Provision a clean PostgreSQL database and restricted roles, restore with the owner credential, reapply grants/RLS, and point a quarantined application instance at the restored database and private bucket snapshot.
4. Verify organization and case counts, audit-chain continuity, representative encrypted objects/PDFs, template versions, queued jobs, and secure-download revocation/expiry.
5. Rotate credentials when compromise is possible. Run production preflight, synthetic smoke tests, health, metrics, and alert delivery.
6. Obtain incident authority approval before DNS/traffic cutover. Resume one worker, observe the queue, then restore web traffic.

## Evidence record

Record date, participants, incident scenario, application revision, database/object snapshot identifiers, start/end time, achieved RPO/RTO, checksum results, row/object sampling, worker behavior, alert delivery, issues, corrective owners, and approval. Store the record in the organization’s private compliance/operations system, never in a public repository.

Run at least quarterly and after material database, storage, encryption, or deployment changes. Failed restore evidence blocks production readiness.
