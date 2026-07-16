# Live verification matrix

`npm run validate` is offline-safe and never spends provider credits or connects to production systems. Live checks are listed with `npm run validate:live` and run only when an operator explicitly selects an ID.

| Gate | Required evidence | Pass rule |
|---|---|---|
| ClamAV | EICAR upload, scanner-unavailable test, quarantine record, deletion audit | Infection is never processed; unavailable scanner fails closed |
| OCR | Approved synthetic image/PDF corpus, expected values, field/page provenance | Accuracy meets the organization threshold and every mismatch enters human review |
| AI providers | One minimal synthetic extraction per configured provider | Authentication works, response is schema-valid, and no applicant data or secret appears in logs |
| PostgreSQL RLS | Two organizations and restricted application role | Cross-organization reads/writes fail at both Prisma and database layers |
| Worker | Supervised web/worker pair with forced retry and dead letter | Lock recovery, backoff, dead-letter, manual retry, and cancellation are evidenced |
| Backup/restore | Encrypted backup restored to a disposable database | Checksum, row counts, representative PDF/object reads, and recovery time are recorded |
| Deployment | Public TLS endpoint, private object store, metrics endpoint | Health is green, TLS validates, bucket has no public access, alerts receive a test signal |

Store dated results outside the public repository when they contain hostnames, account identifiers, contracts, or sensitive operational details. A failed or unavailable live gate blocks real applicant data; it does not block local synthetic evaluation.
