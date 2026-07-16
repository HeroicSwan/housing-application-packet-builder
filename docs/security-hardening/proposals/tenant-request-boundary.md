# Security Hardening Proposal: Make Tenant Request Authority Explicit

## Decision

We need to decide whether the current release should keep organization authority in a guarded request context or migrate every tenant service to an explicit organization-bound database capability.

## Executive Recommendation

The complete option set is **Option 1: Caller-bound activation with a static guard** and **Option 2: Capability-scoped organization database client**. I recommend Option 1 for the current release because it fixes the reproduced failure without weakening tenant enforcement or forcing a broad service rewrite. Option 2 should become the default before we add third-party extensions, independent application services, or requests that intentionally operate on several organizations.

## Evidence

I inspected the authentication, tenant Prisma extension, model-scope registry, production RLS migration, and browser failure path. The most influential evidence is the mismatch between correct fail-closed database behavior and an organization context that was entered on the wrong side of an `await` boundary.

| Evidence | Finding or document | What it establishes |
| --- | --- | --- |
| `E-TENANT-SESSION` | Awaited authentication and session validation | `src/lib/auth/session.ts` validates the session and organization before access. |
| `E-TENANT-DB` | Tenant Prisma enforcement | `src/lib/tenant-database.ts` refuses missing context, scopes reads and mutations, and validates tenant-owned parents. |
| `E-TENANT-TEST` | Cross-organization regression coverage | `tests/tenant-isolation.test.ts` proves isolation and fail-closed behavior in the local database. |
| `E-BROWSER-CONTEXT` | Authenticated dashboard failure | The pre-fix Playwright flow reached the safe workspace error because the caller did not retain context. |
| `E-CONTEXT-CONVENTION` | Request-boundary ownership inference | Source inspection shows that ambient activation is safe only when the actual caller owns it. |

The first four claims are observed in source or execution. The final claim is an inference from those observations: the security control itself was sound, but its ownership contract was implicit and therefore drift-prone.

## Current Design And Failure Mode

The application uses a tenant-aware Prisma extension for every ordinary data operation. It requires an organization identifier from `AsyncLocalStorage`, adds model-specific scope, rejects cross-tenant parent references, and establishes the same identifier for PostgreSQL RLS transactions. System operations use a separate client whose production database grants are intentionally narrower.

The failure came earlier. `getCurrentUser()` entered organization context inside an awaited helper. Node restores the awaiting caller's prior async context when the helper returns, so the page continued without the organization. The tenant client then did exactly what we want under uncertainty: it failed closed. The blast radius was availability, not cross-tenant disclosure, but the same ownership ambiguity could recur in a new route.

## Desired Invariants

- Every tenant query derives authority from a validated live session or an explicit worker organization iteration.
- The actual async caller activates or receives that authority before any tenant service executes.
- Missing authority fails closed and never falls back to a default organization.
- Application scope, parent ownership, and PostgreSQL RLS use the same organization identifier.
- CI rejects a newly added authenticated handler that omits the required boundary.

## Constraints And Non-Goals

We preserve local SQLite development, the existing Prisma service layer, and the production RLS backstop. We are not using this proposal to redesign authentication, introduce a tenant-routing service, or claim formal penetration-test coverage. No measured performance budget exists; both options must therefore retain the current single-process request path unless measurement justifies a new boundary.

## Before Architecture

The before view shows why a correctly protected database still produced an unusable authenticated page.

```mermaid
flowchart LR
  U["Authenticated user"] --> H["Awaited auth helper"]
  H -->|"validated organization"] A["Page / action / API route"]
  H -.->|"context entered inside callee; not preserved"] C["Ambient organization context"]
  A --> S["Application service"]
  S --> T["Tenant Prisma boundary"]
  C --> T
  T -->|"missing context: fail closed"] X["Workspace error"]
  T --> R["PostgreSQL RLS"]
```

The organization was validated, but authority did not cross the caller continuation. The dangerous response would have been to relax `requireOrganizationContext`; we instead keep the fail-closed sink and repair control ownership at the request boundary.

## Options

### Option 1: Caller-Bound Activation With A Static Guard

Each page, action, and API route synchronously calls `activateOrganizationContext()` around the result of its authentication await. Because the activation now runs in the caller continuation, downstream services inherit it. A repository test scans authenticated app handlers and fails if the activation wrapper is missing. Login and MFA flows explicitly reactivate after session creation before recording tenant audit events.

The attractive part of this option is that it fixes the observed ownership error without changing service interfaces. It adds no database hop, retains the local workflow, and keeps RLS parity. Its residual risk is that authority remains ambient once activated. The static guard substantially reduces omission risk, but it is still a convention enforced by tests rather than by service types.

```mermaid
flowchart LR
  U["Authenticated user"] --> H["Awaited auth helper"]
  H -->|"validated organization"] A["Page / action / API route"]
  A -->|"synchronous activation"] C["Request organization context"]
  A --> S["Application service"]
  C --> T["Tenant Prisma boundary"]
  S --> T
  T --> R["PostgreSQL RLS"]
  G["CI boundary guard"] -->|"reject omitted activation"] A
```

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Activation owner | Awaited auth helper | Actual request caller | Context survives into tenant services | Small caller edit |
| Omission control | Runtime failure only | CI source guard plus runtime failure | Drift is caught before deployment | Test maintenance |
| Database enforcement | Fail-closed scope and RLS | Unchanged | No security backstop is weakened | None |

Rollout is already compatible: callers can be migrated mechanically, type-checked, and exercised by role. Rollback must not remove activation without introducing another authority mechanism, because the correct fallback remains a closed failure.

### Option 2: Capability-Scoped Organization Database Client

This option makes organization authority an explicit object passed into services. Authentication constructs a bound client or capability for the validated organization; workers construct one while iterating active organizations. Tenant services no longer import a global ambient client, so a missing capability becomes a type or wiring error rather than a runtime context lookup.

This is the cleaner long-term ownership model. It makes reviews easier because the organization boundary is visible in signatures, and it supports future privilege narrowing. What gives me pause for the current release is migration breadth: application generation, packets, lifecycle, jobs, pages, actions, and downloads all share services. A partial migration needs the current activation path anyway, and accidental creation of separate Prisma pools per request could create a serious resource regression.

```mermaid
flowchart LR
  U["Authenticated user"] --> H["Awaited auth helper"]
  H -->|"validated organization"] B["Organization-bound DB capability"]
  B --> A["Page / action / API route"]
  A --> S["Capability-aware service"]
  S --> T["Tenant Prisma boundary"]
  T --> R["PostgreSQL RLS"]
  Y["System client"] -->|"narrow grants only"] R
```

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Authority | Ambient request value | Explicit bound capability | Removes async-context drift | Broad signature migration |
| Service access | Global tenant client import | Capability parameter | Enables narrower service authority | More plumbing |
| Pool ownership | One shared client | Must remain one shared underlying pool | Avoids per-request connection growth if designed correctly | Benchmark and review required |

We could introduce this one vertical slice at a time while retaining Option 1 as tactical protection. Rollback is credible as long as the activated-context implementation remains until the last global tenant-client import is removed.

## Comparison

| Dimension | Option 1: Caller activation | Option 2: Bound capability |
| --- | --- | --- |
| Security | Fixes observed failure; ambient authority remains | Makes authority explicit and narrowable |
| Performance | No new hop or client | Expected neutral if one pool is shared; unmeasured |
| Memory | One identifier in request context | Neutral only if wrappers do not create pools |
| Reliability | Six browser flows pass; guard catches omissions | Removes context loss but migration can introduce wiring errors |
| Operability | Existing runtime and logs | Clearer tracing; larger code ownership change |
| Migration | Completed, no data migration | Broad staged service refactor |

Option 2 wins on architectural clarity. Option 1 wins on current risk-adjusted delivery because it is tested, preserves every backstop, and leaves a reversible path to Option 2.

## Recommendation

I recommend Option 1 under the current single-web-app and single-worker constraints. We should keep the boundary guard and E2E role suite mandatory. Option 2 becomes preferable before plugins, independent application services, or intentional multi-organization work inside one request make ambient authority materially harder to reason about.

## Evidence Coverage And Residual Risk

| Evidence | Option 1 | Option 2 | Residual risk |
| --- | --- | --- | --- |
| `E-BROWSER-CONTEXT` — authenticated dashboard failure | Addressed and revalidated | Addressed by design after migration | Browser coverage must remain required |
| `E-CONTEXT-CONVENTION` — ambient ownership drift | Mitigated by guard | Addressed by explicit capability | System clients remain privileged |
| `E-TENANT-TEST` — cross-organization isolation | Preserved | Must be preserved | PostgreSQL integration still requires a live test database |

Neither option replaces independent penetration testing or the production RLS CI job. System operations still require narrow grants, and a validated organization identifier must never come from an untrusted request field.

## Migration And Rollout

Option 1 is implemented across authenticated pages, server actions, download APIs, login, logout, and MFA. CI should run the auth-boundary test, tenant isolation tests, and Playwright suite. If Option 2 is later selected, migrate one vertical slice, prove it shares the existing Prisma pool, retain Option 1 during dual operation, and remove ambient access only after import and RLS parity checks pass.

## Validation Plan

- Run `tests/auth-context-boundary.test.ts` and `tests/tenant-isolation.test.ts`.
- Run PostgreSQL RLS integration against the CI service database.
- Run all Playwright caseworker, reviewer, administrator, download, and axe workflows.
- Search authenticated app handlers for unactivated authentication awaits.
- If Option 2 is prototyped, compare p50/p95 latency, connection count, and peak RSS against Option 1 on the same PostgreSQL dataset.

## Implementation Work Packages

- Completed: add caller-synchronous activation and nullable-session fail-closed handling.
- Completed: migrate authenticated pages, actions, and APIs.
- Completed: reactivate login and MFA audit writes after session creation.
- Completed: add boundary and browser regression coverage.
- Future only if selected: introduce and migrate a capability-scoped client.

## Open Questions

- Should capability-scoped clients become mandatory when the first independent application service is introduced, or earlier when the service layer reaches a defined size?
- Which CI environment will own the required PostgreSQL RLS integration credentials for forks?
