# Version 1 readiness criteria

Status reviewed July 14, 2026. “Implemented” means repository code and local/CI evidence exist; it is not a compliance claim. “External gate” requires a deploying organization or independent party.

| Gate | Status | Evidence / remaining work |
| --- | --- | --- |
| Privacy and data-flow engineering review | Implemented | `privacy-data-flow-review.md`; organization privacy/legal sign-off remains external |
| Retention, legal hold, deletion | Implemented | Policy settings, worker scheduling, grace period, two-person approval, storage deletion, lifecycle evidence, integration test |
| Client-data export | Implemented | Encrypted full-case/document export, integrity check, admin-only download, integration test |
| Tamper-evident auditing | Implemented | Local hash chain; PostgreSQL sealing/advisory lock and append-only triggers; tests |
| Production PostgreSQL | Implemented foundation | Required organization IDs, migrations, least-privilege roles, RLS, CI isolation; managed-service load/HA exercise is deployment-specific |
| Organization isolation | Implemented | Request context, model scopes, parent-FK validation, RLS, adversarial SQLite and PostgreSQL tests |
| Production job processing | Implemented | Encrypted durable queue, dedupe, atomic claim, retry/backoff, stale recovery, worker, metrics, integration test |
| OCR evaluation | Harness implemented | Synthetic field-level live-provider gate exists; run it for the exact approved provider/model before launch |
| Malicious-document evaluation | Partially exercised | Active PDF, embedded content, parser, dimension bomb, prompt injection, signature checks pass; ClamAV EICAR gate requires deployed scanner |
| Real-template acceptance | External gate | Generic round-trip tool passes synthetic 8-field form; agency-owned form/mapping/sign-off required |
| Monitoring and alerting | Internally exercised / external deployment gate | Authenticated metrics, health, alert rules, operational tests, and browser contract pass; target paging owner and exercised managed alert remain deployment-specific |
| Incident response | Synthetic exercise complete / external organization gate | Runbook and July 15 repository tabletop implemented; organization-owned tabletop and findings remain required |
| External penetration testing | External gate | Independent scoped assessment and remediation required |
| Accessibility | Automated pass / external manual gate | Axe browser suite exists; manual keyboard, screen-reader, contrast, zoom, and reflow study required |
| Caseworker usability | External gate | Protocol exists; moderated caseworker sessions and dated acceptance required |
| AI vendor review | Engineering review complete / external contract gate | Current official-policy matrix and production allowlist exist; organization contract/DPA approval required per provider |
| Backup restoration | Implemented foundation | Local encrypted restore exercised and PostgreSQL restore CI added; timed managed-infrastructure exercise required |
| External key rotation | Implemented | Versioned encryption envelopes, previous-key ring, re-encryption command, runbook; external credentials still rotate at their providers |

No item in this document is a certification. Launch approval belongs to the deploying organization.
