# Architecture

This document describes code present in the repository. It does not claim compliance, certification, or external organizational approval.

## System flow

```text
Synthetic source documents -> extraction proposals -> staff review
                                               -> canonical profile
                                               -> template mapping
                                               -> unresolved questions
                                               -> application PDF
                                               -> supporting packet
                                               -> reviewer decision
                                               -> configured synthetic delivery
```

## Observed implementation

### Application boundary

`src/app` contains Next.js App Router pages, route handlers, and server actions. `src/components` and `src/features` contain shared and workflow-specific UI. Pages read through Prisma on the server; protected mutations re-check session, role, and record access.

### Data and workflow

`prisma/schema.prisma` defines the relational model for organizations, users, sessions, cases, household information, documents, extracted fields, requirements, packets, templates, drafts, signatures, consents, submissions, lifecycle requests, jobs, audit events, and backup records. SQLite remains the no-Docker local database. `prisma/production` contains the required-tenant PostgreSQL schema, migrations, and RLS policies.

Caseworker, reviewer, and administrator workflows share a reviewed canonical profile. Application templates map canonical paths into generated-PDF or AcroForm fields. Draft readiness and requirement states are deterministic; AI output does not decide eligibility or approval.

### Authentication and authorization

`src/lib/auth` implements local credentials, hashed passwords, revocable database sessions, password recovery, optional TOTP, throttling, role permissions, and record checks. Authenticated database access establishes an organization context; the application client scopes every model and PostgreSQL independently enforces RLS. Demo login is separately configurable and disabled in production.

### Document processing

`src/lib/document-processing` exposes a provider interface. The mock provider is the supported default. Optional server-side adapters exist for Anthropic, Gemini, Groq, OpenRouter, SambaNova, Cerebras, and Mistral. Proposed fields require staff review before they become reusable evidence.

### PDFs and application templates

`src/lib/applications` contains canonical mapping, validation, income normalization, template versioning, AcroForm inspection/filling, signature rendering, and generated-PDF output. `src/lib/packets` assembles the application and selected synthetic supporting documents into a separate packet.

### Storage and delivery

`src/lib/storage` provides local and S3-compatible adapters and versioned authenticated encryption. `src/lib/submissions` contains idempotent SMTP and authenticated HTTPS delivery adapters. Upload processing and delivery execute through encrypted durable jobs with retry/backoff and stale-lock recovery.

### Audit and backup

Important mutations create limited-metadata audit events. Local events form a hash chain; PostgreSQL serializes per-organization sealing and rejects update/delete at the database boundary. Backup tools support encrypted SQLite snapshots and PostgreSQL custom dumps, verification, and guarded disposable-target restoration.

### Tests and automation

Vitest covers domain and integration behavior. Playwright exercises browser workflows and axe accessibility checks. E2E uses a separate SQLite database and a Playwright-coordinated server. GitHub Actions provides repository validation without requiring Docker or provider keys.

## Current limitations

- SQLite is a local, single-writer development database, not a production organization-isolated store.
- Local `DATA_MODE=synthetic` is the safe default; production mode requires explicit enforced configuration and organizational approval.
- Local authentication is not SSO, SAML, OIDC, or SCIM.
- Optional AI, SMTP, HTTPS, S3, malware-scanning, and managed-infrastructure paths require deployment acceptance.
- Included PDFs and program definitions are synthetic, not accepted real-agency templates.
- No external penetration test, compliance certification, or completed caseworker study exists.

## Future considerations

SSO/SCIM, real-agency integration, high availability, horizontal scaling, and jurisdiction-specific compliance remain deployment work. See [version-1-criteria.md](./version-1-criteria.md).

## Data-mode boundary

Environment validation defaults to synthetic mode. Production mode requires an explicit acknowledgement and enforced database, encryption, SMTP, monitoring, malware-scanner, and provider-approval settings. Local seed, fixtures, tests, and E2E remain synthetic.
