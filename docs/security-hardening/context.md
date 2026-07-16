# Security hardening evidence context

This is a derived review of the current working tree. It is not a formal Codex Security scan and it is not a certification. Formal scan preflight could not establish the required worker capacity, so the claims below are limited to inspected source and executed repository tests.

- Baseline Git revision: `50fae62b6354a937d66ea9d3b298848611b97323`
- Source drift: present; the reviewed readiness work is intentionally uncommitted.
- Evidence collection SHA-256: `8f556335510d16af616ad77f8e62ea135dad92a25ed0ffbcb781548256da3109`
- Evidence artifacts: 14

| ID | Evidence | SHA-256 |
| --- | --- | --- |
| `E-TENANT-SESSION` | `src/lib/auth/session.ts` | `66d118bd4ba2d41df29ba2de481dfa2ec2579e8bc1009b6294d808a0169525bf` |
| `E-TENANT-DB` | `src/lib/tenant-database.ts` | `190d0ea396f394f23fd762cc2de897d8b48dc8111151aaa0e698802b92fee927` |
| `E-TENANT-SCOPE` | `src/lib/tenant-scope.ts` | `261f921192f37c4bdd5703e890260ace6c435ed515fae16584e5096cd7454d88` |
| `E-JOBS` | `src/lib/jobs/index.ts` | `81b9dbf684f161bf6789e6eb0ad0593a141324f7682f0653f90327ee0437a1fa` |
| `E-LIFECYCLE` | `src/lib/data-lifecycle/index.ts` | `7f3b50b6e8317c8451f17d77bfc3d9b9c1a247ae4dd84b907be7e0ebff7b003f` |
| `E-DOCUMENT-SAFETY` | `src/lib/validation/files.ts` | `bd3556035c93dba87d25226bb7f761b900cd1dc1f974613dd0c5a23c0b0c3bf5` |
| `E-AI-PROMPT` | `src/lib/document-processing/prompt.ts` | `7a922da11fefdc75e04c714f334ebb4cedb46a77877b0d304000b29bf946b9b5` |
| `E-ENV-POLICY` | `src/lib/env-schema.ts` | `0b6afebde73ca0f34d4e22022d8c3cfb582ef143e20d5b79b3d7f6450fae15e7` |
| `E-PG-MIGRATION` | `prisma/production/migrations/20260715014500_data_lifecycle_jobs/migration.sql` | `4fb625f942ac96fa90a45e49a7d058bc052a45cc3a99bd8e29bf874818cdafb4` |
| `E-TENANT-TEST` | `tests/tenant-isolation.test.ts` | `b33644512f693edf223c51c56cb636b52368580bce706bb8cda196eaa108c085` |
| `E-DOCUMENT-TEST` | `tests/document-safety.test.ts` | `c146b4100a1d5d725c6505d8466a5b66818468cbef6a05fbedfe1d93e5d2710d` |
| `E-PRIVACY-REVIEW` | `docs/privacy-data-flow-review.md` | `044701f0e74fba007ef969c2354d9828a420f5fbb532228a0336c840424481f0` |
| `E-AI-REVIEW` | `docs/ai-vendor-review.md` | `f80d6eb29d3fcb7edf0b1fd530162e67a24bdef21dad29fd63f82d3c1085c712` |
| `E-RESTORE` | `docs/backup-restore-evidence.md` | `87b3f143194dfc62d24478a0c2a1b1e75829d7591ce24d41e3031f82d7b9b213` |

The browser regression observed during this review is additionally covered by `tests/auth-context-boundary.test.ts` and the six-test Playwright run. Those files changed after the collection digest above, so they are treated as validation evidence rather than members of the frozen input collection.
