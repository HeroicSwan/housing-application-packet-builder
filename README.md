# Housing Application Packet Builder

![status](https://img.shields.io/badge/status-work%20in%20progress-orange)
![version](https://img.shields.io/badge/version-v1.0.0--rc.1-yellow)
![data](https://img.shields.io/badge/data-synthetic%20only-red)
![production](https://img.shields.io/badge/production%20use-not%20certified-critical)
![tests](https://img.shields.io/badge/tests-248%20passing-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

Applying for housing means writing the same information onto form after form, each one wanting it in a slightly different shape. This tool is for the caseworkers doing that: upload a household's documents once, have staff review what was pulled out of them, and map those reviewed values into whatever application the agency actually wants — with a full audit trail behind it.

**It assists people. It does not decide anything.**

---

## How far along it is

**Honest answer: it works, but it isn't finished, and it hasn't earned real data yet.**

- **Version `v1.0.0-rc.1`** — a release candidate, not a production release.
- **What's done:** the full workflow runs end to end on synthetic data. 248 tests pass, plus browser and accessibility checks, a production build, and clean secret scans. All ten automated gates in `npm run validate` are green.
- **What's not done:** the remaining work is mostly *not code*. It needs an independent penetration test, live OCR accuracy thresholds, real agency form acceptance, manual screen-reader testing, moderated caseworker sessions, and privacy/legal sign-off.
- **The accurate label:** an open-source release candidate for synthetic demonstrations, local nonprofit evaluation, and deployment preparation. Passing automated checks is **not** legal or organizational approval.

Run `npm run validate` yourself — it reports the ten gates it can check *and* the ten blockers it can't, each with a named owner. Its verdict today is `SAFE_CHECKS_PASS_WITH_EXTERNAL_BLOCKERS`.

## Safety

**Do not put real applicant data in this yet.** Not in a demo, not "just to try it." It ships in synthetic mode on purpose — SQLite, seeded fake households, a mock extractor, no external services. Real housing applications hold some of the most sensitive information a person has, and this project hasn't earned the right to hold it.

**What protects the data:**

- **Encryption** — AES-256-GCM authenticated encryption for stored documents, templates, exports, and secrets. Local and S3 storage both encrypt *before* writing. Envelopes carry key IDs and auth tags, and anything unknown or unauthenticated **fails closed**.
- **Accounts** — bcrypt password hashing, TOTP MFA with recovery codes, secure HTTP-only sessions with idle timeout, login rate limiting and lockout, role-based permissions, and organization scoping. PostgreSQL row-level security and least-privilege roles for production.
- **Uploads** — uploads are an attack surface, so PDFs are screened for active content (JavaScript, embedded files, launch actions, XFA, submit actions), with hex-escaped names normalized first so nothing sneaks past. Plus type/size/signature checks, page and dimension limits, and optional ClamAV scanning.
- **Integrity** — signatures invalidate when the underlying data changes, approvals are digest-verified and atomically claimed, delivery is idempotent with retries, and deletion requires two administrators and respects legal holds.

**What you should be skeptical about:**

- **The deep security scan was canceled before it finished.** It surfaced 27 candidate clusters that were **never validated**. They were inspected and remediated anyway — but a canceled scan is **not** a penetration test, and an independent pentest is still outstanding.
- **Any API key that ever touched a chat window must be rotated.** Deleting a key from the checkout does not rotate it. Treat every previously exposed key as compromised.
- **The software never decides anything** — no eligibility, no ranking, no credibility scoring, no legal decisions. Extracted values are *proposals*; a human confirms every one before it counts. Caseworkers and reviewers stay responsible for every consequential decision.

**Ground rule:** never enter, upload, seed, paste, log, or screenshot real applicant information. Never put keys, passwords, or document contents into issues or test output.

## How to run it

You need **Node.js 22+** and **npm 10+**. No Docker, no database to host, no paid AI account.

```bash
npm run setup   # creates .env, local secrets, prisma/dev.db, and seeds synthetic data
npm run dev     # http://localhost:3000
```

`npm run setup` is safe to re-run — it never overwrites an existing `.env`, database, or stored file.

Sign in with any of the synthetic demo accounts (local evaluation only — production config rejects them):

| Account | Role |
|---|---|
| `caseworker@example.org` | Caseworker |
| `reviewer@example.org` | Reviewer |
| `admin@example.org` | Administrator |

All three use the password `DemoHousing2026!`.

Other useful commands:

```bash
npm run validate             # all ten gates + a dated readiness report
npm test                     # unit + integration
npm run test:e2e             # browser + accessibility
npm run demo:reset -- --yes  # destructive: wipe & reseed the local demo DB only
```

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

Locally, extraction runs on a deterministic **mock processor**, so you can walk the entire flow with zero API keys. Optional server-side adapters exist for Anthropic, Gemini, Groq, OpenRouter, SambaNova, Cerebras, and Mistral if you configure one.

## How it was built

I built this with **GPT** and **Claude**, and I'd rather say so plainly than let anyone assume otherwise.

The process, honestly: I set the direction and the constraints, the models did a lot of the heavy lifting — code generation, test coverage, security review, documentation — and I reviewed the output and decided what actually shipped. Where they were useful, they were *very* useful. Where they were confidently wrong, that's exactly why every extracted value in this app needs a human to approve it. The irony isn't lost on me.

The scope, the judgement calls, and any mistakes are mine.

## Documentation

- [Local development](./docs/local-development.md) · [Environment variables](./docs/environment-variables.md) · [Architecture](./docs/architecture.md)
- [Security policy](./SECURITY.md) · [Data handling](./docs/data-handling.md) · [Responsible AI](./RESPONSIBLE_AI.md)
- [Release readiness](./docs/release-readiness.md) · [Version 1 criteria](./docs/version-1-criteria.md) — the full blocker list
- [Contributing](./CONTRIBUTING.md) · [Support](./SUPPORT.md)

## License

MIT — see [LICENSE](./LICENSE).
