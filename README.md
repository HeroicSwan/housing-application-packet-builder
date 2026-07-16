# Housing Application Packet Builder

![status](https://img.shields.io/badge/status-work%20in%20progress-orange)
![version](https://img.shields.io/badge/version-v1.0.0--rc.2-yellow)
![production](https://img.shields.io/badge/production%20use-not%20certified-critical)
![use](https://img.shields.io/badge/real%20data-at%20your%20own%20risk-red)
![tests](https://img.shields.io/badge/tests-273%20passing-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

Applying for housing means writing the same information onto form after form, each one wanting it in a slightly different shape. This tool is for the caseworkers doing that: upload a household's documents once, have staff review what was pulled out of them, and map those reviewed values into whatever application the agency actually wants — with a full audit trail behind it.

**It assists people. It does not decide anything.**

---

## How far along it is

**Honest answer: it works, but it isn't finished.**

- **Version `v1.0.0-rc.2`** — a release candidate, not a production release.
- **What's done:** the full workflow runs end to end. 273 tests pass, plus browser and accessibility checks, a production build, and clean secret scans. All ten automated gates in `npm run validate` are green. You can start from a **completely blank installation** and enter your own data, and connect any of **17 AI providers** (or any OpenAI-compatible endpoint) for document extraction — or none at all.
- **What's not done:** the remaining work is mostly *not code*. It has not had an independent penetration test, live OCR accuracy thresholds, real agency form acceptance, manual screen-reader testing, moderated caseworker sessions, or privacy/legal sign-off.
- **The accurate label:** an open-source release candidate. If you deploy it for real work, you are accepting that list of gaps yourself — see Safety below. Passing automated checks is **not** legal or organizational approval.

Run `npm run validate` yourself — it reports the ten gates it can check *and* the blockers it can't, each with a named owner. Its verdict today is `SAFE_CHECKS_PASS_WITH_EXTERNAL_BLOCKERS`.

## Safety — read this before using real data

This software is **unfinished and provided as-is, without warranty (MIT).** It ships in a synthetic demo mode, and it also supports a blank installation where you enter real data. If you choose the second path, **you are using it at your own risk** — knowingly, and ideally after reading this whole section.

**What has NOT been done yet (you inherit these gaps):**

- No independent penetration test. A deep automated scan was **canceled before validation** — its 27 candidate findings were inspected and remediated, but that is not a pentest.
- No live OCR accuracy benchmark, no real agency form acceptance, no moderated caseworker usability sessions, no manual screen-reader audit.
- No privacy or legal review. If your jurisdiction or funders impose data rules (and for housing data, they usually do), that review is on you.

**What DOES protect the data:**

- **Encryption** — AES-256-GCM authenticated encryption for stored documents, templates, exports, and secrets. Local and S3 storage both encrypt *before* writing; unknown or unauthenticated envelopes **fail closed**.
- **Accounts** — bcrypt password hashing, TOTP MFA with recovery codes, secure HTTP-only sessions with idle timeout, login rate limiting and lockout, role-based permissions, organization scoping, and PostgreSQL row-level security with least-privilege roles for production.
- **Uploads** — PDFs are screened for active content (JavaScript, embedded files, launch actions, XFA, submit actions) with hex-escaped names normalized first; plus type/size/signature checks, page and dimension limits, and optional ClamAV scanning.
- **Integrity** — signatures invalidate when data changes, approvals are digest-verified and atomically claimed, delivery is idempotent with retries, and deletion requires two administrators and respects legal holds.
- **Fail-closed production profile** — `DATA_MODE=production` refuses demo credentials, SQLite, weak secrets, missing encryption keys, missing backups, and unapproved AI providers. These checks are kept strict on purpose; they protect the households whose paperwork this holds.

**Non-negotiables even in at-your-own-risk use:**

- The software never decides anything — no eligibility, ranking, credibility scoring, or legal decisions. Extracted values are *proposals*; a human approves every one.
- Any API key that was ever pasted into a chat window is compromised — rotate it at the provider.
- Never put real applicant information, keys, passwords, or document contents into GitHub issues, screenshots, or test output.

## How to run it

You need **Node.js 22+** and **npm 10+**. No Docker, no database to host, no AI account required.

### Option A — demo with synthetic data (recommended first)

```bash
npm run setup   # creates .env, local secrets, prisma/dev.db, seeds fictional records
npm run dev     # http://localhost:3000
```

Sign in with a demo account (local evaluation only — production config rejects them):

| Account | Role |
|---|---|
| `caseworker@example.org` | Caseworker |
| `reviewer@example.org` | Reviewer |
| `admin@example.org` | Administrator |

All three use the password `DemoHousing2026!`. Reset the demo anytime: `npm run demo:reset -- --yes`.

### Option B — blank installation for your own data (at your own risk)

```bash
npm run setup:blank   # empty database, no demo accounts, no seeded records
npm run dev
```

`setup:blank` prints a **one-time claim token** and writes only its SHA-256 hash into `.env`. Open `http://localhost:3000/setup`, create your organization and first administrator with that token, then remove `SETUP_BOOTSTRAP_TOKEN_HASH` from `.env` and restart. The token is shown once and never stored.

Notes on blank mode:

- It refuses to run against a database that already has records (nothing is ever deleted — point `DATABASE_URL` at a new file instead).
- The local profile (SQLite, single machine) has **not** completed the production hardening checklist. For a hardened deployment — PostgreSQL with row-level security, encrypted object storage, ClamAV, monitoring, backups — follow [production operations](./docs/production-operations.md) and `.env.production.example`.
- Both `setup` variants are safe to re-run and never overwrite an existing `.env`, database, or stored file.

Other useful commands:

```bash
npm run validate             # all ten gates + a dated readiness report
npm test                     # unit + integration
npm run test:e2e             # browser + accessibility
```

## AI extraction providers

Extraction is **optional** — the app is fully usable with manual entry (`DOCUMENT_PROCESSOR=disabled`) and the local demo uses a deterministic mock. When you do want AI-assisted extraction, set `DOCUMENT_PROCESSOR` and the matching key in `.env`:

| Provider | `DOCUMENT_PROCESSOR` | Key / settings |
|---|---|---|
| OpenAI | `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Google Gemini | `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Azure OpenAI | `azure-openai` | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` |
| Mistral | `mistral` | `MISTRAL_API_KEY`, `MISTRAL_MODEL` |
| Cohere | `cohere` | `COHERE_API_KEY`, `COHERE_MODEL` |
| xAI | `xai` | `XAI_API_KEY`, `XAI_MODEL` |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` |
| Perplexity | `perplexity` | `PERPLEXITY_API_KEY`, `PERPLEXITY_MODEL` |
| Groq | `groq` | `GROQ_API_KEY`, `GROQ_MODEL` |
| Together AI | `together` | `TOGETHER_API_KEY`, `TOGETHER_MODEL` |
| Fireworks AI | `fireworks` | `FIREWORKS_API_KEY`, `FIREWORKS_MODEL` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (ZDR routing requested) |
| SambaNova | `sambanova` | `SAMBANOVA_API_KEY`, `SAMBANOVA_MODEL` |
| Cerebras | `cerebras` | `CEREBRAS_API_KEY`, `CEREBRAS_MODEL` |
| Ollama (self-hosted) | `ollama` | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` (no key needed by default) |
| **Anything else** (vLLM, LiteLLM, a gateway, an unlisted vendor) | `custom` | `CUSTOM_OPENAI_BASE_URL`, `CUSTOM_OPENAI_MODEL`, optional `CUSTOM_OPENAI_API_KEY` |

Worth knowing:

- **Documents are images.** Scanned PDFs and photos need a vision-capable model; text-only models (for example DeepSeek chat) will only handle text documents and are instructed to return warnings rather than invent values.
- Keys stay server-side, are only validated for the provider you actually select, and never reach the browser. Stray provider variables on your machine for unselected providers are ignored.
- The admin setup wizard can live-test named vendors; Azure/Ollama/custom endpoints are configured through the environment, and the wizard honestly reports them as `UNSUPPORTED` for its connection test rather than simulating a pass.
- In production mode a provider must additionally be listed in `APPROVED_AI_PROVIDERS` with an `AI_PROVIDER_APPROVAL_ID` — the vendor-review record is your organization's, not the repository's. Production Ollama/custom/Azure endpoints must be HTTPS.

## How to use it

The whole product is one workflow. Signed in as a caseworker:

1. **Create a case** for a household.
2. **Upload their documents** — PDFs and photos.
3. **Review the extraction.** The app proposes values; you correct, approve, or reject each one. Nothing is trusted automatically — this is the step the whole design is built around.
4. **Pick an application template** and let the reviewed values map into it. Generated PDFs and real agency AcroForm PDFs both work.
5. **Fill the gaps** the app flags as missing, conflicting, or expired.
6. **Sign and consent** — typed electronic signature, versioned consent capture.
7. **Send it for review.** A reviewer approves or returns it.
8. **Deliver the packet** — the completed application plus supporting documents, over SMTP or an authenticated HTTPS API.

Everything leaves an audit trail: retention, legal holds, exports, deletion approvals, and download controls.

## How it was built

I built this with **GPT** and **Claude**, and I'd rather say so plainly than let anyone assume otherwise.

The process, honestly: I set the direction and the constraints, the models did a lot of the heavy lifting — code generation, test coverage, security review, documentation — and I reviewed the output and decided what actually shipped. Where they were useful, they were *very* useful. Where they were confidently wrong, that's exactly why every extracted value in this app needs a human to approve it. The irony isn't lost on me.

The scope, the judgement calls, and any mistakes are mine.

## Documentation

- [Local development](./docs/local-development.md) · [Environment variables](./docs/environment-variables.md) · [Architecture](./docs/architecture.md)
- [Production operations](./docs/production-operations.md) · [Administrator setup](./docs/administrator-setup.md)
- [Security policy](./SECURITY.md) · [Data handling](./docs/data-handling.md) · [Responsible AI](./RESPONSIBLE_AI.md)
- [Release readiness](./docs/release-readiness.md) · [Version 1 criteria](./docs/version-1-criteria.md) — the full gap list
- [Contributing](./CONTRIBUTING.md) · [Support](./SUPPORT.md)

## License

MIT — see [LICENSE](./LICENSE).
