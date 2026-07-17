# External credential rotation checklist

Repository scans can detect and remove credential-shaped values, but they cannot revoke credentials issued by an external provider. Every credential previously pasted into chat or another uncontrolled channel must be treated as compromised even when it never entered Git history.

## Owner actions required

- [ ] Revoke the previously shared Groq API key in the Groq account.
- [ ] Revoke the previously shared SambaNova Cloud API key in the SambaNova account.
- [ ] Revoke the previously shared Google Gemini credential in the Google account and verify that the value was an API credential for the intended project.
- [ ] Revoke the previously shared Cerebras API key in the Cerebras account.
- [ ] Revoke the previously shared Mistral API key in the Mistral account.
- [ ] Review provider access logs and billing for use after the exposure time.
- [ ] Create replacements only after revocation and store them in an approved secret manager.
- [ ] Never paste replacement values into chat, issues, documentation, fixtures, screenshots, logs, or commits.

Record the provider, credential identifier, revocation time, replacement owner, and evidence location in the deploying organization's private security system. Do not store live values or private revocation evidence in this repository.

## Repository verification

Run both redacted scans:

```text
npm run security:secrets
npm run security:history
```

The current-tree scan covers tracked and non-ignored untracked files. The history scan walks every local commit and text blob. Binary screenshots and PDFs still require human review because text scanners do not perform OCR.

## Application-owned secret generation

The repository-side generator creates fresh values for the application-owned session, monitoring, and data-encryption secrets. It refuses to write inside the repository, refuses to overwrite an existing bundle unless `--force` is explicit, sets restrictive file permissions where supported, and never prints secret values:

```text
npm run secrets:generate -- --output /secure/secret-manager-staging/hapb-production.json
```

Import that file into the deploying organization's approved secret manager, inject the values into the web, worker, migration, and backup processes, and delete the staging file. Do not commit the bundle or copy it into `.env.production.example`. The generated `DATA_ENCRYPTION_KEY_ID` is an identifier, not a secret.

## Rotation order

1. Freeze or schedule a maintenance window and record the change owner in the organization's private change system.
2. Revoke every previously exposed external provider key, review access and billing logs, and create replacements in the provider account. Do not reuse a pasted key.
3. Generate or create replacement application secrets in the approved manager. Keep the current data-encryption key as `DATA_ENCRYPTION_PREVIOUS_KEYS` until re-encryption is verified.
4. Deploy the new secret version to the migration task, web, worker, and backup job; restart all processes together.
5. Run `npm run config:production`, `npm run production:check`, health/metrics checks, a synthetic upload/review/generation smoke test, and a backup verification.
6. Run `npm run encryption:rotate` while the previous key remains available, then verify representative MFA, destination, job, document, template, export, and backup reads.
7. Remove the previous encryption key only after an inventory confirms no old envelopes remain. Revoke the prior application secret versions and retain only redacted evidence.

The generator handles application-owned values only. Database passwords, object-storage credentials, SMTP credentials, and provider credentials must be rotated in their respective systems or secret-manager integrations.
