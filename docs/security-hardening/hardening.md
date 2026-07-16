# Security Hardening Review: Housing Application Packet Builder

## Evidence Basis

This portfolio is based on inspected repository source, the privacy and AI reviews, tenant-isolation coverage, document-safety coverage, and the July 15 backup restoration exercise. It is an ordinary source-evidence review, not a formal penetration test or a sealed Codex Security scan. The evidence identity and limitation are recorded in [context.md](context.md).

During browser validation we reproduced a real tenant-context failure: authenticated pages could lose the organization scope when an awaited authentication helper returned. The application failed closed, but the failure showed that the tenant boundary depended on an async-context convention that was easy to apply incorrectly.

## Constraints

We preserve the local Node/npm/SQLite workflow, keep PostgreSQL row-level security as production defense in depth, and avoid adding another service to every request. No measured latency or memory budget was supplied, so this review uses a balanced security and operability profile.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Make authenticated tenant activation explicit and regression-checked | Awaited session boundary, tenant database enforcement, and browser failure (`E-TENANT-SESSION`, `E-TENANT-DB`, `E-TENANT-TEST`) | 1. Caller-bound activation and static guard; 2. Capability-scoped database client | Keep Option 1 for the current release; reconsider Option 2 when the application gains independent services or third-party extensions | [Tenant request boundary](proposals/tenant-request-boundary.md) |

The durable job, lifecycle, document-safety, AI-provider approval, audit, and backup boundaries were also reviewed. They already consolidate their privileged operations behind owned modules and have focused acceptance coverage, so this review does not manufacture additional architectural projects without a surviving source-backed failure.

## Recommendation Summary

I recommend the implemented caller-bound activation design for the current release. It keeps the existing Prisma service layer, activates the organization in the actual page/action/API caller after authentication returns, and adds a source guard that prevents new authenticated request handlers from omitting that step. PostgreSQL RLS and parent-ownership checks remain independent backstops.

The capability-scoped client is cleaner in the long term because organization authority becomes an explicit value rather than ambient state. Its cost is a broad service-interface migration with little immediate user benefit while this remains one web application plus one worker. It becomes the better option if we split services, accept plugins, or need concurrent multi-tenant operations inside a single request.

## Next Decisions

- Keep the caller-bound activation guard required in CI.
- Revisit capability-scoped clients before introducing plugins or additional application services.
- Treat external penetration testing and managed-infrastructure exercises as launch gates; this source review does not replace them.
