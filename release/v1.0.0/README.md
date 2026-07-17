# Housing Application Packet Builder 1.0.0

Release for nonprofit housing teams that need a local-first workflow for organizing applications, reviewing supporting documents, mapping agency templates, and producing a submission-ready packet.

This package is synthetic-data ready and locally validated. It is not an authorization to process real applicant information until the external gates in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) are signed off.

## What is included

- Case, household, income, document, application, review, approval, delivery, audit, export, and retention workflows.
- Local-only Ollama document processing with the Qwen 7B vision model; customer documents are not sent to cloud AI providers.
- PDF-to-image extraction, sourced values, review corrections, malware quarantine, duplicate detection, and human approval boundaries.
- Template administration, field mapping, AcroForm round-trip acceptance, version compatibility, and rollback guidance.
- Encrypted local storage for demonstrations and production PostgreSQL/S3-compatible deployment instructions.
- Durable worker, protected metrics, encrypted backups, restore procedures, and fail-closed production configuration.

## Validation snapshot

- `npm run validate`: 10/10 safe checks passed.
- Unit/integration: 205 passed, 5 skipped.
- Browser and automated accessibility: 11 passed.
- Synthetic evaluation: 120 adversarial applicants passed.
- Local OCR corpus: passed with full expected-value recall and source coverage.
- Dependency audit: 0 high-severity vulnerabilities reported.

## Install and run

```text
npm ci
copy .env.example .env
npm run setup
npm run dev
```

Open `http://localhost:3000`. Use synthetic fixtures only. Production operators should follow [`docs/synthetic-deployment.md`](../../docs/synthetic-deployment.md), [`docs/production-operations.md`](../../docs/production-operations.md), and [`docs/release/secret-manager-runbook.md`](../../docs/release/secret-manager-runbook.md).

## Upgrade and rollback

Read [`docs/upgrade-guide.md`](../../docs/upgrade-guide.md) before applying migrations. Keep a verified encrypted backup and the previous application artifact available. Do not roll back an application artifact across an incompatible schema.

## Security and support

Report vulnerabilities privately using [`SECURITY.md`](../../SECURITY.md). For operational questions, use [`SUPPORT.md`](../../SUPPORT.md). Never include applicant data, credentials, database dumps, or filled PDFs in an issue or support request.
