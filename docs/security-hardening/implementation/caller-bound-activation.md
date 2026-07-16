# Implementation Plan: Caller-Bound Activation With A Static Guard

## Selected Design And Constraints

The user explicitly requested implementation of every readiness control that does not require agency input. The selected current-release design activates the validated organization synchronously in each authenticated caller while retaining the tenant Prisma boundary and PostgreSQL RLS.

## Source Revision And Drift Check

Baseline revision: `50fae62b6354a937d66ea9d3b298848611b97323`. Source drift is present because this implementation is in the current uncommitted readiness worktree. The evidence collection is bound by SHA-256 `8f556335510d16af616ad77f8e62ea135dad92a25ed0ffbcb781548256da3109`.

## Affected Components

- `src/lib/auth/session.ts`
- Authenticated files under `src/app`
- `tests/auth-context-boundary.test.ts`
- Playwright role and accessibility workflows

## Ordered Work Packages

- Add a synchronous activation helper that rejects a non-null user without an organization.
- Activate every `requireUser`, `requireRole`, and tenant-using `getCurrentUser` result in its actual caller.
- Reactivate after login or MFA session creation before audit writes.
- Add a source-boundary regression test.
- Re-run tenant isolation and browser workflows.

## Compatibility And Migration

No database or session migration is required. Service APIs and the local SQLite workflow remain compatible.

## Tactical Protections During Migration

Missing context continues to fail closed. Production RLS, model scopes, tenant-parent checks, and narrow system-role grants remain active.

## Tests And Security Validation

- Auth-boundary test passes.
- Tenant-isolation tests pass.
- All six Playwright workflows pass.
- TypeScript and ESLint pass.

## Performance And Resource Benchmarks

No new I/O or process boundary was introduced. A formal request-latency budget was not supplied; measure p50/p95 latency and peak RSS before any move to capability-scoped clients.

## Rollout And Rollback

Deploy with the normal application release and worker. Do not roll back activation independently; restore the full prior release or introduce an equivalent organization-authority mechanism.

## Acceptance Criteria

- Every authenticated app boundary activates context after its authentication await.
- Missing context still fails closed.
- Cross-organization reads, writes, and parent references are rejected.
- Browser role workflows complete without a workspace context error.

## Open Decisions

Define the service-growth trigger for a future capability-scoped client migration.
