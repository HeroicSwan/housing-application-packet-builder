# Experimental container profile

The repository retains a Dockerfile and Compose profile as implementation references. They are not part of the supported Phase 0 local workflow, have not been validated as a production platform, and do not authorize real applicant data.

Phase 0 development, database setup, seeding, tests, E2E, and builds use Node/npm and SQLite without Docker. Follow [docs/local-development.md](./docs/local-development.md).

## Observed profile

The retained Compose file describes a single application instance, SQLite volume, S3-compatible object storage, ClamAV service, and periodic encrypted backup process. The application container applies committed Prisma migrations before startup.

These components demonstrate adapters already present in the repository. Their presence does not establish availability, confidentiality, restoration, scaling, monitoring, retention, incident-response, or compliance guarantees.

## Current limitation

There is no supported production deployment in Phase 0. The profile remains synthetic-only and must keep `DATA_MODE=synthetic`. It has not completed external penetration testing, privacy review, real-template acceptance testing, recovery exercises, monitoring validation, or caseworker acceptance testing.

## Future consideration

Before any production or real-data proposal, complete every applicable gate in [docs/version-1-criteria.md](./docs/version-1-criteria.md), define accountable operators, and obtain independent legal, privacy, security, accessibility, and program approval. Those activities are outside Phase 0.
