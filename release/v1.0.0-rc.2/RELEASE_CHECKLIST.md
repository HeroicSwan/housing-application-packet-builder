# Release checklist

## Repository and artifact checks

- [x] Version and release notes identify this as `1.0.0-rc.2`.
- [x] Screenshot assets were intentionally excluded from the public release bundle.
- [x] No `.env`, database, upload, backup, log, or secret bundle is included.
- [x] `npm run validate` passes all safe checks.
- [x] `npm run security:secrets` and `npm run security:history` pass.
- [x] `npm run security:dependencies` reports no high-severity vulnerabilities.

## Organization-owned gates before real data

- [ ] Revoke previously exposed Groq, SambaNova, Gemini, Cerebras, and Mistral credentials; review provider logs and billing.
- [ ] Generate replacement application secrets and inject them through the approved secret manager.
- [ ] Obtain and accept the real agency AcroForm template.
- [ ] Deploy PostgreSQL, private object storage, ClamAV, worker supervision, TLS, monitoring, and encrypted backups.
- [ ] Complete an independent penetration test on an authorized synthetic deployment.
- [ ] Complete manual keyboard, screen-reader, zoom, contrast, and reflow testing.
- [ ] Run moderated caseworker sessions and record acceptance.
- [ ] Obtain privacy, retention, consent, legal, and AI-vendor approvals.

## Publication handoff

1. Review this folder from a clean checkout.
2. Attach approved binaries or source archives only; never attach databases, filled documents, secrets, or private evidence.
3. Create the GitHub release from `GITHUB_RELEASE_BODY.md` after organizational approval.
4. Publish the tag and retain the final validation report privately.
