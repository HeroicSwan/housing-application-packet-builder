## Housing Application Packet Builder 1.0.0

Local-first housing application packet preparation for nonprofit teams.

### Highlights

- Caseworker workflows for households, income, documents, applications, review, approval, and delivery.
- Local Ollama/Qwen 7B document extraction with human review and sourced values.
- PDF-to-image extraction for scanned and image-heavy documents.
- Template mapping and AcroForm acceptance tooling.
- Encrypted storage, ClamAV quarantine, durable jobs, protected metrics, backups, and restore procedures.
- Synthetic 120-applicant evaluation and automated browser accessibility coverage.

### Install

```bash
npm ci
npm run setup
npm run dev
```

Open `http://localhost:3000`. Use synthetic data until the organization completes its production approvals and infrastructure gates.

### Verification

- `npm run validate`: all safe checks passed.
- 205 unit/integration tests passed.
- 11 browser and automated accessibility tests passed.
- 120 synthetic applicants evaluated successfully.
- Dependency audit reported no high-severity vulnerabilities.

### Security and privacy

- Customer documents are not sent to cloud AI providers.
- Production mode requires manual document processing, PostgreSQL, private object storage, ClamAV, encrypted backups, TLS, monitoring, and approved retention values.
- Do not upload real applicant data to an unapproved deployment.
- Report vulnerabilities privately through `SECURITY.md`; never include secrets or completed packets in issues.

### Upgrade

Read [`docs/upgrade-guide.md`](https://github.com/HeroicSwan/housing-application-packet-builder/blob/master/docs/upgrade-guide.md) and keep a verified encrypted backup before applying migrations.

### Known limitations

Independent penetration testing, manual accessibility review, moderated caseworker testing, privacy/legal approval, an approved agency PDF, and production credential/infrastructure setup remain organization-owned release gates.

> Maintainer note: this release was published in place using the existing `v1.0.0-rc.2` tag; the tag was not rewritten.
