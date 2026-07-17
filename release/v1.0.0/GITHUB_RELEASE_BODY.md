## Housing Application Packet Builder v1.0.0

Housing Application Packet Builder is a local-first workflow for nonprofit housing teams that need to turn messy applicant documents into reviewable, auditable application packets. It keeps caseworker judgment in the loop while providing a clear path from intake to an approved, downloadable packet.

### What this release includes

- Household and case management for applicants, members, income, employment, and supporting documents.
- Upload handling for PDFs and photos, including PDF-to-image conversion for scanned or image-heavy pages.
- Local document extraction through Ollama with a Qwen 7B-class model, confidence and source-page metadata, and a human review step before values are accepted.
- Application templates, field mapping, packet generation, and fillable AcroForm support.
- Review, approval, electronic-consent, delivery, and audit workflows with lifecycle controls for quarantine, duplicates, exports, expiring downloads, escalation, and delivery dead letters.
- Operations tooling for health checks, protected metrics, durable jobs, encrypted backups, restore procedures, and deployment validation.
- A single `npm run validate` command that runs the safe repository checks and reports blockers clearly.

### Privacy and AI boundary

Customer data is not sent to hosted AI providers by this release. The supported extraction path is a locally hosted Ollama model running on infrastructure controlled by the deploying organization. For a production deployment, set `DOCUMENT_PROCESSOR=disabled` until the organization has approved and monitored its local model runtime; caseworkers can still complete packets with manual review.

The application is designed to pair with PostgreSQL row-level security, private S3-compatible object storage, ClamAV quarantine, TLS, encrypted backups, and organization-managed secrets. These controls must be configured and verified in the deployment environment; they are not a substitute for organizational policy or legal approval.

### Quick start

```bash
npm ci
npm run setup
npm run dev
```

Open `http://localhost:3000`. Use synthetic data while evaluating the product. Do not upload real applicant information until the deployment has approved retention, access, encryption, backup, and incident-response procedures.

### Local Ollama setup (optional AI extraction)

The exact supported model is `qwen2.5vl:7b` (Qwen2.5-VL 7B). Install Ollama from [ollama.com/download](https://ollama.com/download), then download the model:

```bash
ollama --version
ollama pull qwen2.5vl:7b
ollama list
```

On Linux, the official installer is `curl -fsSL https://ollama.com/install.sh | sh`. On Windows and macOS, install the official desktop app and open a new terminal. Keep the app running, or start the service with `ollama serve`.

After `npm run setup`, edit `.env` and restart the app with this exact local configuration:

```dotenv
DOCUMENT_PROCESSOR=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5vl:7b
OLLAMA_API_KEY=
DOCUMENT_PROCESSOR_TIMEOUT_MS=120000
```

Verify the model before using the app:

```bash
ollama run qwen2.5vl:7b "Reply with exactly: OLLAMA_READY"
npm run healthcheck
npm run evaluate
```

The model must remain on loopback and Ollama's API must not be exposed to the public internet. The application keeps human review mandatory for every extracted value. For the complete Windows/macOS/Linux setup, hardware notes, troubleshooting, and production approval boundary, read [`docs/local-ollama.md`](https://github.com/HeroicSwan/housing-application-packet-builder/blob/master/docs/local-ollama.md).

### Verification completed for this release

- 205 unit and integration tests passed (5 intentionally skipped where live infrastructure is required).
- 11 browser and automated accessibility checks passed.
- 120 synthetic applicants completed the stress/evaluation workflow.
- Production build, lint, typecheck, secret scans, and dependency audit completed with zero high-severity dependency findings.
- OCR, ClamAV, PostgreSQL/RLS, object-storage, backup/restore, worker, TLS, and monitoring checks are available as integration gates for a deployed environment.

### Production-readiness gates

This is a stable software release, not a claim that every organization is production-ready on first install. Before handling real cases, each deploying organization still needs an approved agency PDF template, real service credentials, production PostgreSQL and object storage, worker supervision, TLS and monitoring, backup/restore evidence, credential rotation, and organizational approval. Independent penetration testing, manual accessibility review, moderated caseworker testing, privacy/legal review, and an AI-vendor review remain explicit release gates.

### Upgrade and support

Read [`docs/upgrade-guide.md`](https://github.com/HeroicSwan/housing-application-packet-builder/blob/master/docs/upgrade-guide.md) before upgrading. Take and verify an encrypted backup first, apply migrations during a maintenance window, and keep the previous release available for rollback. Secret-manager setup and credential rotation are documented in [`docs/release/secret-manager-runbook.md`](https://github.com/HeroicSwan/housing-application-packet-builder/blob/master/docs/release/secret-manager-runbook.md). See [`SECURITY.md`](https://github.com/HeroicSwan/housing-application-packet-builder/blob/master/SECURITY.md) for private vulnerability reporting.

### Release contents

The attached release bundle contains documentation and deployment guidance only. It intentionally excludes screenshots, databases, uploads, backups, logs, production secrets, and real applicant data.
