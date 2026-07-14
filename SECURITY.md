# Security

## Threat model

Relevant threats include unauthorized access to sensitive housing records, cross-role access, forged sessions, credential attacks, malicious or oversized uploads, path traversal, secrets reaching the browser, sensitive values entering logs, improper reviewer overrides, data retained past policy, and compromised infrastructure or backups.

## Current controls

- Opaque, revocable, expiring database sessions in secure HTTP-only same-site cookies, with record-level and role checks inside server actions and protected routes.
- Passwords hashed with bcrypt; account lockout, durable login throttling, generic password-reset responses, expiring one-use reset tokens, and global session revocation after password changes.
- Durable database-backed rate limiting that works across application restarts.
- Upload allowlist for PDF, PNG, and JPEG; extension/MIME consistency, configurable size cap, normalized filenames, random prefixes, and resolved-path containment.
- PDF, PNG, and JPEG magic-byte checks, processor-output schema validation, safe failed-processing records, and retry limited to failed local uploads.
- Production configuration requires malware scanning; the bundled profile streams every upload through ClamAV before encrypted storage.
- Uploaded bytes and AcroForm templates are authenticated-encrypted before local or S3 storage. Extracted sensitive values are not written to audit metadata or application logs.
- Anthropic credentials remain server-side and the provider is disabled by default.
- Requirement states and approval gates are deterministic; conflicts cannot be overridden by a note.
- Export routes require a session and send private, no-store cache directives.
- Important mutations create readable audit events.
- `.env`, local databases, and uploaded files are ignored by Git.
- Caseworkers receive record-level access only to assigned cases and their packets. Reviewer access is read/review scoped; administrator mutations re-check the administrator role.
- Next.js Server Action origin checks provide same-origin CSRF protection; the configured action body limit is slightly above the application upload limit for multipart overhead.
- Production configuration has no fallback session secret, and one-click demo role login is controlled by `ENABLE_DEMO_LOGIN`.

## Known limitations

The bundled local identity system provides TOTP MFA but not SSO, automated identity-provider provisioning, or organization tenancy. Organizations requiring those controls should replace local login with their reviewed identity provider. Audit records are not append-only. Demo credentials and one-click login must be disabled before any real deployment.

## Production hardening

Use a reviewed identity provider with MFA and lifecycle controls; managed secrets; TLS; PostgreSQL with least-privilege credentials; private object storage with signed URLs; malware and content scanning; centralized rate limiting; CSRF review; granular case assignment policy; security headers; dependency and container scanning; encrypted backups; immutable audit export; monitoring and alerting; incident response; penetration testing; privacy impact assessment; vendor review for any AI processor; and jurisdiction-appropriate consent and access procedures.

## Retention and encryption

Define retention by record and document category, legal obligations, program agreements, and client consent. Automate deletion and record defensible deletion events. Encrypt database, objects, backups, and transport. Where feasible, use per-tenant keys and rotation. Avoid placing client facts in analytics, traces, error reports, support tools, URLs, or filenames.

Synthetic data is used because the repository, screenshots, tests, logs, and portfolio deployments are not approved systems of record.

Report security concerns privately to the repository owner. Never include real client data in an issue.
