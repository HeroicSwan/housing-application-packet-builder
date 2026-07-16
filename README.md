# Housing Application Packet Builder

![status](https://img.shields.io/badge/status-release%20candidate-orange)
![data](https://img.shields.io/badge/data-synthetic%20only-red)
![tests](https://img.shields.io/badge/tests-248%20passing-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![license](https://img.shields.io/badge/license-MIT-blue)

Applying for housing means filling out the same information over and over, across forms that all want it in a slightly different shape. This tool is for the caseworkers doing that work: upload a household's documents once, review what was pulled out of them, and let the app map those reviewed values into whatever application form the agency actually wants.

**It assists people. It does not decide anything.**

> ### ⚠️ Read this first
>
> This is a **release candidate for synthetic demos, local evaluation, and deployment prep** — *not* production-certified software.
>
> **Do not put real applicant data in it yet.** A number of gates are still open, and most of them can't be closed by writing code — they need real infrastructure, a penetration test, legal/privacy sign-off, and an actual organization saying yes. See [Before it can handle real data](#before-it-can-handle-real-data).
>
> Out of the box it runs entirely on synthetic data, SQLite, and a mock extractor. No cloud account, no API keys, no Docker.

---

## Contents

- [What it does](#what-it-does)
- [What it deliberately doesn't do](#what-it-deliberately-doesnt-do)
- [Where the project stands](#where-the-project-stands)
- [Quick start](#quick-start)
- [How it protects data](#how-it-protects-data)
- [Testing](#testing)
- [About the security scan](#about-the-security-scan)
- [Before it can handle real data](#before-it-can-handle-real-data)
- [Documentation](#documentation)
- [Credits](#credits)
- [License](#license)

---

## What it does

The whole thing is one workflow, start to finish:

1. **Create a case** — a client case and household profile.
2. **Upload documents** — PDFs, photos, and supporting paperwork.
3. **Extract proposed values** — using a mock processor locally, or a configured AI/OCR provider.
4. **Staff review** — a human corrects, approves, or rejects every extracted value. Nothing is trusted automatically.
5. **Map into templates** — reviewed values flow into application forms.
6. **Fill the gaps** — guided completion of missing, conflicting, or expired fields.
7. **Generate the form** — both generated PDFs and real agency AcroForm PDFs are supported.
8. **Sign & consent** — typed electronic signatures and versioned consent capture.
9. **Submit for review** — a reviewer approves or returns it.
10. **Build the packet** — the completed application plus its supporting documents.
11. **Deliver** — over SMTP or an authenticated HTTPS API.
12. **Keep the record** — audit history, retention, legal holds, exports, deletion approvals, and download controls.

The key design rule: **extracted values are proposals, never facts.** A human confirms everything before it counts.

## What it deliberately doesn't do

This matters more than the feature list, so it's stated plainly:

- ❌ It does **not** determine eligibility.
- ❌ It does **not** rank or score applicants.
- ❌ It does **not** assess credibility.
- ❌ It does **not** make legal decisions.

Caseworkers and reviewers remain responsible for every consequential decision. The software's job is to remove retyping and transcription errors — not judgement.

## Where the project stands

| | |
|---|---|
| **Version** | `0.1.0` (untagged) |
| **Honest label** | Open-source release candidate for synthetic demonstrations, local nonprofit evaluation, and deployment preparation |
| **Ready for** | Local/synthetic demos, evaluation by a nonprofit, deployment preparation |
| **Not ready for** | Real applicant data, production nonprofit use |
| **Suggested release tag** | `v1.0.0-rc.1` or `v1.0.0-beta` — **not** a production-certified `v1.0.0` |

The code is functional and well covered by tests. What's missing isn't mostly code — it's the external gates: infrastructure, an independent penetration test, human accessibility and usability testing, and organizational/legal approval.

---

## Quick start

**You need:** Node.js 22+ and npm 10+. That's it — no Docker, no hosted database, no paid AI account.

```bash
npm run setup   # creates .env, local secrets, prisma/dev.db, and seeds synthetic records
npm run dev     # http://localhost:3000
```

`npm run setup` is safe to re-run: it never overwrites an existing `.env`, database, or stored file.

**Synthetic demo accounts** (local evaluation only — production config rejects these):

| Account | Role |
|---|---|
| `caseworker@example.org` | Caseworker |
| `reviewer@example.org` | Reviewer |
| `admin@example.org` | Administrator |

All three use the demo password `DemoHousing2026!`.

Useful extras:

```bash
npm run healthcheck          # check a running server
npm run demo:reset -- --yes  # destructive: wipe & reseed the guarded local demo DB only
npm run validate             # full readiness report (dated Markdown + machine-readable)
```

`npm run validate` is the one to run before any release conversation — it separates what's automatically verifiable from what still needs a human or real infrastructure.

---

## How it protects data

This app is built to hold sensitive household information, so the defenses are the point — not an afterthought.

### Accounts and access

- **bcrypt** password hashing.
- **MFA via TOTP**, with one-time recovery codes and enforced enrollment for organizations that require it.
- HTTP-only, secure session cookies with expiry and idle timeout.
- Password-reset tokens are hashed, single-use, expiring, and revoke their siblings.
- Atomic login rate limiting plus failed-login counting and lockout.
- Role-based permissions (administrator, supervisor, reviewer, caseworker, auditor, applicant) and organization/tenant scoping.
- Reviewer-assignment enforcement on field reviews, notes, overrides, returns, and approvals.
- **PostgreSQL row-level security** and separate least-privilege database roles for production.

### Encryption

- **AES-256-GCM authenticated encryption** for stored documents, templates, exports, setup secrets, and encrypted configuration.
- Both local and S3 storage encrypt **before** writing — data is never written in the clear.
- Encryption envelopes carry key IDs and auth tags; **unknown or unauthenticated envelopes fail closed**.
- Old keys can stay configured during rotation, so rotating doesn't strand existing data.
- Passwords are bcrypt-hashed; session, reset, and MFA tokens are stored only as hashes.
- Provider credentials stay server-side and are never returned to the browser.
- Production demands a real `DATA_ENCRYPTION_KEY`, a key ID, and managed secret storage.

### Documents and PDFs

Uploads are a genuine attack surface, so they're treated like one:

- Type, extension, size, and binary-signature checks; PDF/PNG/JPEG validation.
- **Active content is rejected** — embedded files, JavaScript, launch actions, XFA, and form-submission actions. Hex-escaped action names are normalized first so they can't sneak past.
- Page-count and image-dimension limits, plus raw object/stream complexity checks *before* full parsing.
- Optional **ClamAV** malware scanning.
- Documents can be quarantined, reviewed, deleted, and marked unavailable.

### Workflow integrity

- Versioned packets and templates, with compatibility checks.
- **Signatures invalidate when the underlying data changes.**
- Approval digest verification and atomic approval claims (no stale approvals).
- Delivery idempotency keys, deterministic SMTP message IDs, retry/backoff/dead-letter, and stale-worker recovery.
- Expiring secure download links and atomic export download limits.
- Legal holds and **two-administrator** deletion approval.
- Setup revision checks so untested configuration can't be activated.

### Outbound connections

- HTTPS-only production endpoints; host/port allowlists for internal services.
- Metadata and loopback targets blocked.
- SMTP, S3, and ClamAV connections pin their resolved address in production.
- A safe outbound HTTP helper with timeout, response-size, header, and DNS controls.

---

## Testing

Everything below was verified on the current build:

| Check | Result |
|---|---|
| Unit + integration tests | **248 passed**, 5 service-gated skipped (35 files passed, 5 skipped) |
| Browser / E2E / accessibility | **11 passed** |
| Production build | passed |
| ESLint + TypeScript | passed |
| Repository + git-history secret scans | passed (360 files scanned, no values printed) |
| Dependency audit | no high-severity vulnerabilities |
| PostgreSQL production schema validation | passed |
| Synthetic evaluation harness | passed — includes a 120-applicant synthetic run |
| Synthetic AcroForm acceptance | round-tripped 8 discovered/mapped fields |
| Focused remediation tests | 20/20 |

That's all ten automated gates in `npm run validate` green.

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build

npm run security:secrets       # repository secret scan
npm run security:dependencies  # dependency audit
```

The E2E run builds its own dedicated SQLite database and Playwright-owned server — it never touches your development data.

## About the security scan

Worth being straight about this, because the numbers look alarming out of context.

A deep security scan ran with 6 independent discovery workers over 1,485 scoped worklist rows each. It produced **63 raw observations**, which deduplicated into **27 candidate clusters** — and then **the scan was canceled before centralized validation.**

So, honestly:

- Those 27 items were **never confirmed as vulnerabilities**. They're candidates, not findings.
- Their source paths were inspected anyway, and code-level remediations were applied.
- The focused remediation tests (20/20) and the full safe validator pass.
- **A canceled scan is not a penetration test.** An independent pentest is still an open blocker.

## Before it can handle real data

These are the real gates. Most need infrastructure, authorized people, or an organizational decision — not more code.

**Infrastructure & operations**
- [ ] ClamAV EICAR quarantine test
- [ ] PostgreSQL RLS testing against disposable production-like databases
- [ ] Production worker supervision and retry testing
- [ ] Backup and restore drill using PostgreSQL tooling
- [ ] TLS deployment health and authenticated monitoring
- [ ] Incident-response and disaster-recovery exercises

**AI / extraction quality**
- [ ] Live OCR-quality corpus and an agreed accuracy threshold
- [ ] Live AI-provider smoke tests
- [ ] AI-vendor contract and data-retention approval

**Real-world fit**
- [ ] Real agency AcroForm template acceptance and mapping
- [ ] Real submission portal/API approval and configuration

**Human testing**
- [ ] Manual accessibility testing — keyboard, screen reader, zoom, contrast
- [ ] Moderated caseworker usability testing

**Security, legal & organizational**
- [ ] Independent penetration test
- [ ] Privacy, legal, retention, consent, and data-processing approval
- [ ] **Rotation of every API key previously pasted into chat**
- [ ] Organizational approval to process real applicant data

> On that key-rotation item: removing a key from the current checkout does **not** rotate it. Any provider key that was ever exposed should be treated as compromised and rotated at the provider.

**Ground rule for contributors and evaluators:** never enter, upload, seed, paste, log, screenshot, or attach real applicant information. Never put provider keys, passwords, session values, or document contents into issues or test output.

---

## Documentation

**Start here**
- [Local development](./docs/local-development.md) · [Environment variables](./docs/environment-variables.md) · [Architecture](./docs/architecture.md)

**Setup & operations**
- [Administrator setup](./docs/administrator-setup.md) · [Setup connection tests](./docs/setup-connection-tests.md)
- [Operator runbook](./docs/operator-runbook.md) · [Production operations](./docs/production-operations.md)
- [Backup & restore evidence](./docs/backup-restore-evidence.md) · [Troubleshooting](./docs/troubleshooting.md)

**Security, privacy & AI**
- [Security policy](./SECURITY.md) · [Data handling](./docs/data-handling.md) · [Responsible AI](./RESPONSIBLE_AI.md)
- [Security hardening review](./docs/security-hardening/hardening.md) · [Privacy/data-flow review](./docs/privacy-data-flow-review.md)
- [AI vendor review](./docs/ai-vendor-review.md) · [Incident response](./docs/incident-response.md)

**Release**
- [Release readiness record](./docs/release-readiness.md) · [Version 1 criteria](./docs/version-1-criteria.md)
- [Release process](./docs/release-process.md) · [Changelog](./CHANGELOG.md)

**Community**
- [Contributing](./CONTRIBUTING.md) · [Support](./SUPPORT.md) · [Code of conduct](./CODE_OF_CONDUCT.md)

## Credits

I built this with **GPT** and **Claude**. They did a lot of the heavy lifting — code generation, test coverage, security review, and documentation — while I set the direction, reviewed the output, and decided what actually shipped. It's been a genuinely collaborative way to build, and I'd rather say so up front than pretend otherwise.

The judgement calls, the scope, and any mistakes are mine.

## License

MIT — see [LICENSE](./LICENSE).
