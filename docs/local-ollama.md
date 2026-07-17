# Local Ollama document processing

The only supported live AI runtime is Ollama on a machine controlled by the deploying organization. The exact model used by the project is:

```text
qwen2.5vl:7b
```

This is Qwen2.5-VL's 7B vision-language model. It accepts text and images, which is required for scanned housing documents. The model download is approximately 6 GB; keep additional disk space available for Ollama's runtime and temporary model files. Ollama's model page currently requires Ollama 0.7.0 or newer: <https://ollama.com/library/qwen2.5vl:7b>.

## Install Ollama

Install Ollama from <https://ollama.com/download> on Windows, macOS, or Linux. Confirm the CLI is available:

```text
ollama --version
```

On Linux, the official installer is:

```sh
curl -fsSL https://ollama.com/install.sh | sh
```

On Windows and macOS, install the official desktop application, then open a new terminal so the `ollama` command is available. Keep Ollama running while the application processes documents. If the desktop application is not running, start the service with:

```text
ollama serve
```

## Download the exact model

Run this once on every machine that will process documents:

```text
ollama pull qwen2.5vl:7b
ollama list
```

`ollama list` must show `qwen2.5vl:7b`. Do not substitute `qwen2.5vl:latest`, a 3B/32B/72B variant, or a cloud model without repeating the organization's model approval and evaluation.

## Configure the application

Run the normal local bootstrap first; it creates a safe `.env` without overwriting an existing one:

```text
npm ci
npm run setup
```

Then edit the local `.env` and set:

```dotenv
DOCUMENT_PROCESSOR=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5vl:7b
OLLAMA_API_KEY=
DOCUMENT_PROCESSOR_TIMEOUT_MS=120000
```

The endpoint must remain loopback (`127.0.0.1` or `localhost`) for the local-only policy. Do not expose Ollama's API to the public internet and do not put an Ollama key, applicant document, or model output in source control.

Restart the web process after changing `.env`:

```text
npm run dev
```

## Verify before uploading anything

First verify Ollama directly with synthetic text:

```text
ollama run qwen2.5vl:7b "Reply with exactly: OLLAMA_READY"
```

Then verify the application and its synthetic-only contract:

```text
npm run healthcheck
npm run evaluate
npm run validate
```

The application still requires human review of every extracted value. A model response is a suggestion with source and confidence metadata, not an automatically accepted housing eligibility decision.

## Real applicant data and production

The default production configuration is intentionally fail-closed with `DOCUMENT_PROCESSOR=disabled`. An organization may enable the local Ollama path only after approving the exact model, host access controls, logs, retention, backups, incident response, and caseworker review procedure. Until then, leave processing disabled and enter values manually.

Ollama itself does not make a deployment secure: protect the host, model files, process logs, backups, and network boundary. Keep PostgreSQL, private object storage, ClamAV, TLS, monitoring, and secret-manager controls enabled for production as described in [`production-operations.md`](./production-operations.md).
