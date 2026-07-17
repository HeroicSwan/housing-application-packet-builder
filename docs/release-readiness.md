# Release readiness record

Status reviewed July 15, 2026. Repository-controlled release engineering is complete and verified by the unified validator. Target-infrastructure, human, legal, vendor, agency-template, credential-rotation, and organizational-approval gates remain external. This is not approval to process real applicant data.

## Completed internal engineering

| Original blocker | Current evidence |
| --- | --- |
| Privacy and data-flow review | Data inventory, trust boundaries, purpose/retention controls, subprocessors, and residual owner decisions are documented in `privacy-data-flow-review.md`. |
| Retention, deletion, and export | Encrypted full-case export, admin-only download, retention scheduling, legal hold, grace period, second-admin deletion approval, storage deletion, durable evidence, and disposable-database acceptance test. |
| Organization isolation and production PostgreSQL | Required production organization IDs, tenant Prisma scopes, parent ownership checks, caller-bound authentication context, PostgreSQL RLS/FORCE RLS, least-privilege app/system roles, migrations, and SQLite/PostgreSQL CI coverage. |
| Durable production jobs and integrations | Encrypted database queue, atomic claim, dedupe, retry/backoff, stale-lock recovery, document/delivery/retention handlers, separate worker, and metrics. |
| OCR and malicious-document evaluation | Field-quality live-provider harness, active-PDF rejection, parser/page/dimension limits, prompt-injection defense, file-signature checks, and optional ClamAV EICAR integration gate. |
| Monitoring and incident response | Authenticated Prometheus metrics, health contract, critical/warning alert rules, runbooks, operational contract tests, browser endpoint test, and July 15 synthetic exercise. |
| AI-vendor review | Official-policy matrix, provider-specific dispositions, production allowlist, and OpenRouter ZDR routing requirement. |
| Tested backup restoration | Encrypted authenticated envelope, local SQLite restoration with row-count verification, destructive-target refusal, and PostgreSQL CI sentinel restore workflow. |
| Security hardening | Evidence-bound tenant-boundary portfolio, narrow privileged-client allowlist test, unsafe-raw-SQL prohibition, repository secret scan, dependency audit, and security workflows. |

## Current verification

- Unit/integration: 36 files passed, 5 service-gated files skipped; 204 tests passed, 5 skipped.
- Browser E2E: 11 passed across caseworker, reviewer, administrator, setup, application automation, downloads, axe checks, health, metrics, and authorization denial.
- TypeScript: passed.
- ESLint: passed.
- Production Next.js build: passed without warnings.
- Repository secret scan: passed with values redacted by design.
- Dependency audit: zero reported vulnerabilities.
- Production PostgreSQL schema validation: passed.
- Synthetic AcroForm acceptance: 8 discovered, mapped, and round-tripped fields.
- Worker acceptance: queued retention work processed.
- YAML parsing: production compose and all seven GitHub workflows parsed successfully.

Service-gated checks are enumerated by `npm run validate:live`: ClamAV, OCR quality, provider smoke tests, PostgreSQL RLS, production worker, backup restore, deployment health, caseworker sessions, manual accessibility, and external reviews. Local Ollama smoke and the synthetic OCR corpus pass; the remaining service gates must run in the approved target environment.

## External launch gates

| Gate | Why it cannot be completed from this repository alone |
| --- | --- |
| Real agency-template acceptance | An agency must supply and approve its actual form, mapping, submission rules, and output. The synthetic AcroForm path passes. |
| External penetration test | Independence, scope authorization, deployed target access, and remediation confirmation require a qualified outside assessor. |
| Manual accessibility testing | Keyboard, screen-reader, zoom/reflow, contrast, and assistive-technology testing requires human participants and target devices. Automated axe checks pass. |
| Caseworker usability testing | Moderated sessions require real caseworkers, organizational consent, and acceptance criteria. The protocol is provided. |
| Live OCR, ClamAV, and PostgreSQL gates | These require approved provider credentials and deployed service endpoints. No previously exposed key may be reused. |
| Managed deployment exercise | The organization must provision PostgreSQL, object storage, SMTP, TLS/proxy, malware scanning, monitoring/paging, backups, and on-call ownership, then run load, failover, alert, and timed restore exercises. |
| Organizational incident tabletop | Privacy/legal, communications, program, and incident owners must exercise notification and escalation decisions using their actual systems. The synthetic repository exercise is complete. |
| AI contracts and privacy approval | The organization must approve providers, contracts/DPAs, retention terms, eligible paid/ZDR tiers, and permitted data categories. |
| External credential rotation | The provider account owner must revoke every key previously pasted into chat, create replacements, and store them in an approved secret manager. The repository contains no usable copies. |
| Proprietary portal connectors | Email/API/portal-API delivery exists; each provider's proprietary authentication, schema, sandbox, and approval must be configured and accepted by that provider. |

## Launch decision

The codebase is ready for open-source review, synthetic demonstrations, and deployment preparation. It is not approved for real applicant data until every applicable external gate has dated evidence and the deploying organization signs off. No repository document is a compliance certification or eligibility determination.
