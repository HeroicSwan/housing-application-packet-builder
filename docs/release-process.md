# Proposed release process

This is a proposed reproducible process for future releases. It does not claim that any previous release followed these steps; the repository currently has no documented release.

## 1. Define scope

- Keep the change set focused and document non-goals.
- Update the `Unreleased` section of [CHANGELOG.md](../CHANGELOG.md).
- Confirm that documentation describes implemented behavior rather than future architecture.
- Confirm that all fixtures and demonstrations remain synthetic.

## 2. Prepare a clean checkout

```text
npm ci
copy .env.example .env
npm run db:generate
npm run db:setup
```

Use safe placeholders, `DATA_MODE=synthetic`, and the mock document processor. Do not supply production or provider secrets.

## 3. Verify

```text
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:e2e
npm run build
```

Record actual pass, fail, and skip counts. Do not summarize a skipped or environment-blocked command as passing. Run dependency, secret, code-scanning, and SBOM workflows configured for the revision and review their results without suppressing findings.

## 4. Review artifacts and risk

- Confirm no database, uploaded document, generated packet, environment file, backup, log, Playwright artifact, or secret is staged.
- Confirm retained PDFs and screenshots are explicitly synthetic.
- Review authorization, privacy, accessibility, consent, human-review, and data-mode effects.
- Confirm standard validation does not require Docker, a hosted database, or paid AI calls.
- Document known limitations and unresolved security findings.

## 5. Approve and publish

Require maintainer review of the exact commit and reproducibility evidence. Choose a version according to the project's adopted versioning policy, move reviewed changelog entries from `Unreleased` to that version, create an annotated tag, and publish source plus approved generated metadata such as an SBOM.

Do not publish databases, PDFs containing entered data, local configuration, test traces, or secrets. A release remains synthetic-only unless a later, separately approved scope completes the applicable gates in [version-1-criteria.md](./version-1-criteria.md).

## 6. Post-release

Verify the tag and checks, retain release evidence, monitor private security reports, and return new work to `Unreleased`. If a credential was exposed, rotate it through the provider and document the sanitized response; never claim repository edits performed rotation.
