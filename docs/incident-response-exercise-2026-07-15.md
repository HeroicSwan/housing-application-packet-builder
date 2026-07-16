# Synthetic incident-response exercise — July 15, 2026

## Scope and limitations

This repository exercise uses synthetic records and test-only credentials. It validates technical detection, containment guidance, recovery tooling, and evidence preservation that can be exercised without a deploying organization. It does not replace an organizational tabletop, legal notification decision, provider credential revocation, managed-infrastructure restore, or paging drill.

## Scenario

A caseworker reports a document-processing failure shortly after an AI-provider credential is suspected to have been exposed. At the same time, the worker has a stale job and the latest verified backup is older than policy. No cross-organization access is initially observed.

## Injects and response decisions

| Inject | Expected response | Repository evidence |
| --- | --- | --- |
| Metrics request without a bearer token | Reject and do not disclose operational state | `/api/metrics` E2E contract returns 401 and `no-store` |
| Failed or stale durable work | Alert, inspect the encrypted job payload only through the worker, stop propagation if needed | `hapb_jobs_failed` and `hapb_jobs_stale` alerts; retry/backoff/stale-lock recovery in `src/lib/jobs/index.ts` |
| Failed submission or document processing | Alert and route to operator review without logging applicant contents | `hapb_submissions_failed` and `hapb_documents_failed` alerts |
| Suspected provider-key exposure | Disable the provider, remove it from `APPROVED_AI_PROVIDERS`, preserve provider/audit evidence, and have the account owner revoke it externally | Production allowlist validation and `docs/ai-vendor-review.md`; external revocation remains an owner action |
| Malicious PDF | Reject active content before extraction and retain only minimum failure metadata | `tests/document-safety.test.ts` and upload safety boundary |
| Stale or absent backup | Page the operator, create a new encrypted backup, verify it, and restore only to a disposable target | Backup-age alert and July 15 restore evidence |
| Possible tenant exposure | Disable affected access, preserve evidence, validate audit chain and RLS, and engage privacy/legal owners | Tenant tests, append-only audit controls, and incident runbook |

## Technical exercise results

- Durable worker sweep processed a queued retention job successfully.
- Encrypted SQLite backup verification and disposable restoration succeeded; restored row counts were queried before cleanup.
- Secret scanning passed without printing values, and dependency audit reported no vulnerabilities.
- Tenant-context regression coverage, cross-organization isolation, document-safety tests, and production schema validation passed.
- Authenticated metrics, health, alert rules, and full browser-role workflows are part of the final release gate.

## Findings

The exercise found and corrected two internal gaps: submission/document failure metrics lacked alert rules, and the incident runbook lacked an explicit secure-communications rule for personal data. The earlier browser exercise also found and corrected caller-side organization-context loss.

## External follow-up

Before real applicant data, the deploying organization must name the incident commander and paging owner, run this scenario with its actual monitoring and managed services, time the restore, exercise provider revocation, decide notification responsibilities, and retain the signed exercise record outside the repository.
