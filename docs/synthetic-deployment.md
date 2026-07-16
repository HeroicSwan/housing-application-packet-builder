# Synthetic deployment exercise

This exercise proves installation mechanics without authorizing real applicant data. Use an isolated host, synthetic credentials, synthetic PDFs, `DATA_MODE=synthetic`, mock extraction, and a non-production email/API sink.

Install Node.js 22+, PostgreSQL 16+, ClamAV, and a private S3-compatible bucket. Configure `.env.production.example` with test-only values, restricted database roles, a random encryption key, and an authenticated metrics token. Terminate TLS with the example Caddy configuration in `ops/Caddyfile.example`. Run migrations with the owner role, start the web and worker under the supplied systemd units, and run `npm run production:check`.

Complete the 120-applicant evaluation, browser suite, one EICAR quarantine, OCR corpus, RLS integration, worker retry/dead-letter exercise, encrypted backup and disposable restore, and alert test. Capture timestamps, versions, results, recovery time, and reviewer names in a private evidence record.

Destroy the synthetic database, bucket objects, credentials, and host after the exercise. A successful exercise does not satisfy privacy/legal review, agency-template acceptance, real-service contracts, caseworker testing, penetration testing, or organizational approval.
