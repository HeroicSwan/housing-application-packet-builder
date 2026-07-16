# Security policy

## Supported release status

| Release | Status |
| --- | --- |
| Unreleased source | Best-effort maintenance; no compatibility guarantee |
| Organization-approved deployment | Self-supported; external gates still apply |

No repository release is itself approval for real applicant information or evidence of regulatory compliance. A deploying organization owns the approvals and controls listed in `docs/version-1-criteria.md`.

## Reporting a vulnerability

Use the repository host's private vulnerability-reporting feature when it is available. If it is not available, contact the repository owner through a private channel exposed by the repository host. Do not open a public issue containing exploit details, secrets, document contents, or applicant information.

Include the affected revision, component, synthetic reproduction steps, impact, and any safe mitigation. Redact tokens and sensitive values; report only the provider or variable category.

## Secrets and exposed keys

Never commit API keys, passwords, encryption keys, session secrets, access tokens, or filled environment files. `.env.example` contains placeholders only.

Any provider key previously pasted into a chat, issue, log, screenshot, or repository copy must be treated as compromised. Revoke or rotate it through that provider's authorized interface, remove it from local configuration, and review provider usage records. Deleting a value from the current tree is not key rotation and does not remove it from prior copies. Do not rewrite shared Git history as part of ordinary Phase 0 remediation.

## Applicant data

Never use real applicant information in local development, tests, issues, screenshots, or support artifacts. A production deployment must use the enforced production profile and complete the external launch gates. Report accidental exposure privately and follow the affected organization's incident process.

## Observed controls

The repository includes server-side role and record checks, revocable database sessions, password hashing, optional TOTP, throttling, upload type and size validation, encrypted object storage adapters, private export responses, human review of extraction proposals, and application audit events. These are implementation details, not a warranty that the application is secure for production.

## Known limitations

- Local mode is intentionally synthetic/SQLite and is not a production architecture.
- Optional AI and delivery providers require separate privacy, security, contractual, destination, and operational approval.
- Real agency templates and destinations still require owner acceptance.
- No external penetration test, security audit, privacy certification, or compliance certification has been completed.
- Manual accessibility and caseworker studies, an incident tabletop, and a timed managed-PostgreSQL restore remain external launch gates.

See [docs/version-1-criteria.md](./docs/version-1-criteria.md) for the outstanding gates.
