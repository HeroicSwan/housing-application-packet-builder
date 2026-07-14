# Architecture

## Boundaries

- `src/app`: route UI, server actions, and authenticated export handlers.
- `src/components`: shared product and shadcn/ui components.
- `src/features`: workflow-oriented UI such as the case header.
- `src/lib/auth`: revocable database sessions, account lockout, role permissions, password recovery, and durable rate limiting.
- `src/lib/document-processing`: provider interface plus mock and Anthropic PDF/photo extraction adapters.
- `src/lib/storage`: authenticated encryption plus local and private S3-compatible storage adapters.
- `src/lib/applications`: canonical mapping, income normalization, AcroForm inspection/filling, signatures, and generated output.
- `src/lib/submissions`: idempotent SMTP and provider HTTPS delivery adapters.
- `src/lib/requirements`: deterministic matching and inconsistency detection.
- `src/lib/packets`: approval policy and server-side PDF generation.
- `src/lib/audit`: security-safe audit-event creation.
- `prisma`: portable relational schema and synthetic seed data.

Pages read through Prisma on the server. Mutations cross server-action boundaries that re-check the role, validate input, write records, add meaningful audit events, and revalidate affected routes. Export handlers require a valid signed session and prevent shared caching.

## Data model

A `ClientCase` belongs to an assigned caseworker, may select one `HousingProgram`, and owns household members, uploads, packets, and audit events. Requirements belong to program templates. Each upload owns extracted fields with independent review state and source evidence. Every packet owns application fields, a validated immutable source snapshot, notes, targeted requirement overrides, workflow state, and an optional approver.

Status fields are strings to keep the local SQLite schema portable. Application code owns the allowed values. A production PostgreSQL migration may introduce database enums after compatibility review.

## Rule flow

1. A program requirement selects documents by category.
2. The engine checks applicability, explicit conflicts, presence, expiration, and field-review status in that order.
3. The UI displays the resulting state and reason.
4. Packet approval separately requires every required field approved, zero unresolved conflicts, and every mandatory requirement satisfied or covered by its own written reviewer override.

Packet transitions are centralized and enforced server-side: `DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED`, with `READY_FOR_REVIEW` or `IN_REVIEW` able to move to `NEEDS_CORRECTION`. Corrections are made in the live case and submitted as a new immutable version. Generic notes do not count as overrides; an override is keyed to one requirement and requires written rationale.

LLM output is outside this rule flow. Providers may suggest extracted fields; only reviewed records are considered supporting evidence.

## Storage and deployment

Uploads and template PDFs are encrypted with AES-256-GCM before reaching the local or S3-compatible storage adapter; S3 objects also request server-side encryption. The committed migration creates the complete relational model. The included production profile uses a persistent single-writer SQLite volume, daily encrypted snapshots, and private object storage. See `DEPLOYMENT.md` for the scale boundary and managed-service requirements.
