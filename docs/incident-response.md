# Incident response runbook

## Declare and contain

Treat suspected cross-organization access, leaked credentials or documents, malware bypass, unauthorized delivery, backup exposure, audit-chain failure, or sustained availability loss as an incident. Open a private incident record, assign an incident commander and scribe, preserve timestamps, and use synthetic identifiers in ordinary chat. Do not paste applicant values, session tokens, provider keys, database URLs, or decrypted files into tickets.

Contain according to the evidence: disable the affected organization or destination, revoke sessions, deactivate compromised staff, rotate provider/storage/database/encryption credentials, stop the worker if it is propagating an error, or isolate the deployment. Preserve encrypted backups and provider/security logs under the approved evidence policy. Do not delete suspected evidence through the normal retention worker.

## Investigate

1. Record detection time, reporter, affected environment, and observable symptoms.
2. Query append-only audit events, lifecycle requests, failed/stale jobs, submissions, authentication activity, object-store access, database audit logs, proxy logs, and provider records. Never enable raw prompt/document logging to investigate.
3. Determine organizations, records, people, data categories, destinations, and time range affected.
4. Validate the audit hash chain and compare application events with database/object-store evidence.
5. Determine the initial access vector and whether persistence or lateral movement remains.

## Eradicate, recover, notify

Patch the cause, rotate affected keys, invalidate sessions, validate RLS and least-privilege grants, restore only into a disposable target first, and run representative read/export/generation/delivery checks before reopening. Monitor failed jobs, document failures, backup age, and authentication anomalies closely after recovery.

The incident commander must engage the organization's privacy/legal and housing-program owners to decide notification content and deadlines. Vendor notices, regulator/client notices, law-enforcement contact, and public statements require authorized organizational owners; the repository does not define those legal conclusions.

## Secure communications

Use an approved restricted incident channel for coordination. Communications containing personal data must use the deploying organization's approved secure channel and minimum-necessary recipients. Do not send applicant documents, extracted values, credentials, or decrypted evidence through ordinary chat or unencrypted email. Record who approved each external communication and retain the final message under the incident evidence policy.

## Close

Record root cause, affected scope, timeline, actions, recovery validation, notifications, retained evidence, and follow-up owners. Add a regression test or monitoring control for the cause, schedule a blameless review, and verify every temporary credential and containment exception was removed.

Run a tabletop before launch and twice yearly. Minimum scenarios: cross-tenant query, compromised caseworker credential, malicious upload, AI-provider retention discovery, misdirected submission, unavailable worker, and failed restore.
