# Synthetic fixtures

Every PDF in this directory is a generated demonstration fixture. The people, organizations, programs, identifiers, documents, and AcroForm represented here are fictional and must not be replaced with real applicant or agency material.

The fixtures support deterministic seed, PDF, document-review, and E2E workflows. Generate them only with the repository fixture utility:

```text
npm run fixtures:generate
```

Regeneration overwrites the tracked fixture files. Review the resulting diff and retain the explicit synthetic markings. Never place downloaded agency forms, consented-but-real samples, production exports, or applicant documents in this directory.
