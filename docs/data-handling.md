# Data handling

## Local-development rule

Local development, tests, fixtures, screenshots, issues, and support reports support synthetic demonstration data only.

Do not type, upload, paste, import, seed, log, screenshot, or attach real information in those environments. Production mode is separately fail-closed and requires explicit operator acknowledgement and organizational approvals.

## Information a production deployment could encounter

A production deployment could process identity and contact information, household relationships, housing history, income and benefit records, accessibility requests, identity documents, signatures, consents, case notes, application answers, source evidence, and submission history. These categories can create serious privacy, safety, financial, and fairness harms if collected or disclosed improperly.

Their description here is a risk inventory. Collection requires the deploying organization's documented purpose, authority, notice, and access policy.

## Data minimization expectations

- Collect only fields required for a documented program purpose.
- Separate application output, supporting documents, and internal review material.
- Avoid sensitive values in URLs, filenames, logs, analytics, traces, support tools, and audit metadata.
- Limit source-document access and supporting-packet selection to authorized staff.
- Do not retain provider prompts or responses longer than an approved purpose requires.
- Prefer deterministic derived values over duplicate manual copies where review remains possible.

## Current storage and transport

Local development uses SQLite and local encrypted object storage. The reference production profile uses PostgreSQL RLS, S3-compatible storage, SMTP/authenticated HTTPS delivery, malware scanning, durable jobs, monitoring, and encrypted backups. Each selected infrastructure service still requires deployment acceptance.

Generated output, uploads, databases, backups, test artifacts, and local environment files are excluded from ordinary source control. Required tracked fixtures are generated and synthetic.

## Lifecycle controls

Organizations configure retention and deletion grace. Legal holds block and cancel deletion, manual deletion uses two-person approval, secure exports include evidence and audit history, managed objects are deleted with the case, and lifecycle evidence remains. PostgreSQL audit events are hash-sealed and append-only. These controls implement a mechanism; the organization must supply the actual policy and legal schedule.

## AI-provider considerations

The mock processor is the local default and makes no external call. Production rejects an external processor not listed in the operator's approval allowlist. Each provider still requires independent review of retention, training use, subprocessors, regional processing, incident terms, deletion, access controls, and contractual obligations.

Provider keys must remain server-side and out of logs and client bundles. A previously exposed key is compromised until it is rotated through the provider; editing the repository is not rotation.

## Accidental exposure

If real or secret information is entered accidentally, stop further processing, do not copy it into a public issue, and follow [SECURITY.md](../SECURITY.md) through a private channel. Preserve only the minimum sanitized evidence necessary for response.
