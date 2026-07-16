# Troubleshooting

Start with `npm run validate`. Its dated report is under `output/validation/`; each failed check has a separate log. Share only sanitized, synthetic logs.

- Setup or database errors: confirm Node.js 22+, run `npm ci`, then `npm run db:setup` for local synthetic SQLite. Production uses `npm run db:deploy` with PostgreSQL.
- Upload remains pending: confirm the worker is supervised and healthy. In production, confirm ClamAV is reachable; the app intentionally fails closed when scanning is unavailable.
- OCR has low confidence: correct the value in human review. Do not lower the threshold to bypass review.
- PDF cannot generate: verify every required field, a current signature matching the content digest, and an active template with valid AcroForm mappings.
- Approval was invalidated: applicant, household, income, evidence, or document selection changed. Review the new content and sign and approve again.
- Delivery is dead-lettered: inspect the sanitized destination/worker status, correct configuration, then use manual retry. Do not create a second destination to bypass idempotency.
- Expiring download fails: create a new link. Links are hash-only, one-use by default, and expire after 15 minutes.
- Production preflight fails: do not bypass it. Correct PostgreSQL roles/RLS, private object storage, TLS, scanner, worker, monitoring, SMTP, encryption, or acknowledgements.

Security incidents, exposed credentials, or possible applicant-data exposure follow `SECURITY.md` and `docs/incident-response.md`, not public support channels.
