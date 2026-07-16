# Contributing

Thank you for improving Housing Application Packet Builder. Contributions must preserve the Phase 0 synthetic-only boundary and the existing human-review controls.

## Safety rules

- Use synthetic data only. The project is not approved for real applicant information.
- Never commit secrets, environment files, databases, uploads, logs, backups, exports, or screenshots containing sensitive information.
- Do not include document contents or usable provider keys in issues, pull requests, fixtures, tests, or error messages.
- Do not weaken authorization, validation, audit, accessibility, test, or synthetic-mode checks to make a change pass.
- Do not imply eligibility decisions, production readiness, compliance, certification, or completed external review.

## Set up the repository

Use Node.js 22 or newer and npm:

```text
npm ci
copy .env.example .env
npm run db:generate
npm run db:setup
```

Keep `DATA_MODE=synthetic` and use the mock document processor unless a change specifically tests an optional provider with synthetic input. Paid provider calls must not be part of the default test suite.

## Make a focused change

1. Create a focused branch.
2. Follow the existing Next.js, TypeScript, Prisma, and component conventions.
3. Keep domain and authorization rules on the server rather than relying on UI restrictions.
4. Add tests for changed rules or workflows.
5. Update project-specific documentation when behavior or commands change.
6. Preserve required synthetic fixtures and unrelated local changes.

Use `npm run db:setup` for a preserving setup. `npm run db:reset` intentionally destroys and reseeds the configured disposable synthetic database; do not use it casually.

## Verify before requesting review

```text
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Describe the commands actually run and any skipped or environment-blocked checks. For user-facing changes, include accessibility and keyboard review. For workflow changes, explain privacy, authorization, audit, consent, and human-review effects.

## Issues and pull requests

Provide the smallest synthetic reproduction that demonstrates the problem. Do not attach real records or secrets. Security vulnerabilities belong in the private process described in [SECURITY.md](./SECURITY.md), not a public issue.

Participation is governed by [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). General help is described in [SUPPORT.md](./SUPPORT.md).
