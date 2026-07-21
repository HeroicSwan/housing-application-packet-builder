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

- `npm run validate`: 11/11 safe checks passed.
- Unit/integration: 207 passed, 5 skipped.
- Browser and automated accessibility: 11 passed.
- Synthetic evaluation: 120 adversarial applicants passed.
- Local OCR corpus: passed with full expected-value recall and source coverage.
- Dependency audit: 0 high-severity vulnerabilities reported.

## Start from a blank PC

This is the complete local setup for a Windows, macOS, or Linux computer. Docker is not required.

### 1. Install prerequisites

- Git, so the repository can be cloned.
- Node.js 22 or newer (the installer includes npm; npm 10 or newer is recommended).
- Chromium only if you want to run browser tests; the project can run without it.
- Ollama only if you want local AI extraction. It is optional; the default mock processor is deterministic and needs no model download.

Download Git from [git-scm.com/downloads](https://git-scm.com/downloads), Node.js from [nodejs.org](https://nodejs.org/), and Ollama from [ollama.com/download](https://ollama.com/download). Open a new terminal after installing and verify:

```text
git --version
node --version
npm --version
```

### 2. Clone and install the project

```text
git clone https://github.com/HeroicSwan/housing-application-packet-builder.git
cd housing-application-packet-builder
npm run doctor
npm ci
npm run setup
```

`npm run setup` creates a disposable SQLite database, generates local-only secrets, prepares storage, generates Prisma, seeds synthetic demo accounts, and performs local health probes. It does not overwrite an existing `.env` or database.

### 3. Optional: enable local AI extraction

The exact supported model is `qwen2.5vl:7b`. Install Ollama, then run:

```text
ollama pull qwen2.5vl:7b
ollama list
```

Or let the project download and configure it during setup:

```text
npm run setup -- --ollama
```

Keep Ollama running with the desktop app or `ollama serve`. After `npm run setup`, edit `.env` to contain:

```dotenv
DOCUMENT_PROCESSOR=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5vl:7b
OLLAMA_API_KEY=
DOCUMENT_PROCESSOR_TIMEOUT_MS=120000
```

Verify the model with `ollama run qwen2.5vl:7b "Reply with exactly: OLLAMA_READY"`. Full AI setup and troubleshooting are in [`docs/local-ollama.md`](docs/local-ollama.md).

### 4. Start and use the application

```text
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The synthetic demo accounts are:

| Role | Email | Password |
| --- | --- | --- |
| Caseworker | `caseworker@example.org` | `DemoHousing2026!` |
| Reviewer | `reviewer@example.org` | `DemoHousing2026!` |
| Administrator | `admin@example.org` | `DemoHousing2026!` |

Use the caseworker flow to create a case, add household and income information, upload synthetic documents, review extracted values, generate a packet, and send it through the approval flow. Use the reviewer and administrator accounts to exercise correction, approval, template, role, and setup workflows. These credentials are public demo credentials and must never be enabled in production.

### 5. Run tests and evaluation

With the app stopped, run individual checks as needed:

```text
npm run healthcheck
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run evaluate
```

`npm run validate` runs the complete safe gate: production schema validation, secret and history scans, lint, typecheck, unit/integration tests, the 120-applicant synthetic evaluation, production build, browser/accessibility tests, and dependency audit.

### 6. Important risk statement

The software is functional and can be evaluated locally, but it has not received enough independent real-world testing to be recommended for production housing decisions. Do not use real applicant data, make eligibility decisions, or connect a live agency portal until your organization completes infrastructure deployment, penetration testing, manual accessibility and caseworker testing, privacy/legal approval, retention policy, credential rotation, backups, monitoring, and an approved agency PDF workflow. Anyone running it before those gates does so at their own risk; synthetic data is the only supported default.

### Optional local AI setup

The exact supported model is `qwen2.5vl:7b`. Install Ollama from [ollama.com/download](https://ollama.com/download), then run:

```text
ollama pull qwen2.5vl:7b
ollama list
```

After `npm run setup`, set these values in `.env` and restart the app:

```dotenv
DOCUMENT_PROCESSOR=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5vl:7b
OLLAMA_API_KEY=
DOCUMENT_PROCESSOR_TIMEOUT_MS=120000
```

Keep Ollama running locally (`ollama serve` when the desktop app is not already running), verify it with `ollama run qwen2.5vl:7b "Reply with exactly: OLLAMA_READY"`, and then run `npm run evaluate`. Full prerequisites, Windows/macOS/Linux installation, network boundaries, and production approval requirements are in [`docs/local-ollama.md`](docs/local-ollama.md). Extraction preprocessing, abstention rules, conflict detection, and the synthetic quality corpus are documented in [`docs/ai-extraction-quality.md`](docs/ai-extraction-quality.md).

## Upgrade and rollback

Read [`docs/upgrade-guide.md`](../../docs/upgrade-guide.md) before applying migrations. Keep a verified encrypted backup and the previous application artifact available. Do not roll back an application artifact across an incompatible schema.

## Security and support

Report vulnerabilities privately using [`SECURITY.md`](../../SECURITY.md). For operational questions, use [`SUPPORT.md`](../../SUPPORT.md). Never include applicant data, credentials, database dumps, or filled PDFs in an issue or support request.
