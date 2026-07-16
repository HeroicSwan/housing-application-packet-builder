# Backup and restoration evidence

## Latest local acceptance run

On July 15, 2026, the encrypted backup path was exercised again against the repository's synthetic SQLite database after the tenant-context and storage-boundary hardening:

- Authenticated envelope verification succeeded.
- SHA-256: `d1d77d5c8ee66d48b1baa8455505e7e4539b3691f91797ea3bf8908183b95c10`.
- Decrypted size: 557,056 bytes.
- Restoration wrote a new disposable target and refused to overwrite an existing target by design.
- The restored database opened successfully and contained 2 synthetic organizations, 4 staff users, 6 cases, and 5 backup-run records.
- The temporary plaintext restore and encrypted test backup were deleted after verification.

This proves the local implementation path, not a production recovery-time objective.

## PostgreSQL acceptance automation

`.github/workflows/backup-restore.yml` creates a PostgreSQL 17 database, migrates it, inserts a synthetic sentinel, creates an encrypted custom-format dump, verifies the envelope, restores into a separate disposable database, and queries the sentinel. No database or backup is uploaded as an artifact.

Before a live launch, an operator must also complete a timed restoration using the selected managed database and object-storage service, record recovery point and recovery time, validate application login and representative packet access, and retain the signed exercise record outside this repository.
