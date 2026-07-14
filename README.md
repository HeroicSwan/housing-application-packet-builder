# Housing Application Automation

A synthetic-data demonstration for nonprofit housing teams. The application extracts information from source documents, reuses reviewed canonical client information, maps it into a versioned housing application template, asks staff only for unresolved answers, generates a completed application PDF, and assembles selected supporting documents into a separate packet.

> Use synthetic data until your organization has completed deployment configuration, vendor/privacy review, penetration testing, retention policy, and caseworker acceptance testing.

## What the application automates

- Extracts proposed facts and source text from uploaded PDF, PNG, and JPEG documents with the configured Anthropic multimodal processor; the local mock processor remains available for deterministic tests.
- Preserves staff-reviewed values as reusable canonical client information.
- Deterministically maps canonical values into configured application-template fields.
- Prefers reviewed document values over unreviewed extraction proposals.
- Calculates household size, total monthly income, application date, and repeating household rows.
- Identifies missing, conflicting, invalid, expired, and consent-dependent answers.
- Presents unresolved questions before automatically completed fields.
- Generates a distinct completed housing application PDF.
- Builds a supporting packet with a cover sheet, document index, completed application, selected eligible documents, and a missing-document checklist.
- Maintains a separate immutable internal review summary for independent review and audit.
- Imports agency AcroForm PDFs, discovers their fields, maps them to canonical values, and fills the original PDF.
- Captures typed electronic signatures and versioned document-release consent with audit evidence.
- Delivers reviewer-approved applications by SMTP email or a provider-specific authenticated HTTPS endpoint.
- Encrypts files before local or S3-compatible object storage.

## What remains human-controlled

Staff remain responsible for correcting extracted information, resolving conflicts, answering genuinely missing questions, confirming that the applicant is the person signing, reviewing the completed form, selecting authorized supporting documents, and choosing the correct delivery destination. Reviewers approve or return completed applications and internal review summaries. The software does not determine eligibility, priority, credibility, or legal conclusions.

## Seeded demonstration

Use the Caseworker demo account and select **Continue Jordan Rivera application** from the dashboard.

The seeded workflow demonstrates:

1. A 32-field `Family Pathways Housing Application` template for the fictional `Family Pathways Rapid Rehousing` program.
2. Reviewed information from state identification, income, benefits, and homelessness-verification fixtures.
3. Automatically completed canonical, document-derived, calculated, and repeating fields.
4. A conflicting date of birth, expired identification, missing mailing address, missing preferred contact method, missing emergency contact, and explicit consent confirmation.
5. A guided `Complete remaining questions` flow.
6. An HTML application preview and multi-page completed application PDF.
7. Supporting-document selection and supporting packet download.
8. Caseworker submission followed by reviewer approval or return.
9. A working `Family Pathways Agency AcroForm` with text, checkbox, and electronic-signature mappings.
10. Multiple jobs/benefits normalized from monthly, weekly, biweekly, semimonthly, annual, hourly, or irregular periods.

No document upload is required to complete the seeded demonstration.

## Product records

- **Internal case record:** staff workspace for organizing a case and tracking work.
- **Canonical client profile:** reviewed reusable source of truth assembled from case data, documents, and staff confirmations.
- **Application template:** versioned field schema for a specific housing application.
- **Application draft:** mapped template instance with proposed values, final values, sources, validation, and review state.
- **Completed housing application:** generated copy of the selected application template populated from the draft.
- **Internal review summary:** immutable case snapshot used for field and requirement review; it is not the housing application.
- **Supporting packet:** cover sheet, completed application, selected eligible documents, missing-document checklist, and review context.

## Template architecture

`ApplicationTemplate` stores the program, version, status, template type, source path, and output filename pattern. `ApplicationTemplateField` stores each field’s key, label, type, requirement, canonical path, section, page, order, validation, conditions, formatting, PDF field name, position metadata, options, and staff guidance.

Supported field types include text, multiline text, date, number, currency, boolean, single select, multiple select, signature, household table, and repeating group. Template types are `GENERATED_PDF` and `ACROFORM`; the HTML preview is available for both.

To add a template as an administrator:

1. Open **Programs**, select a program, and choose **Create template**.
2. Upload an agency fillable PDF or choose a generated PDF.
3. Review every discovered field and select its canonical mapping, type, section, requirement, and staff guidance.
4. Publish the version. Published versions are immutable.
5. Use **Create new version** for changes; existing drafts retain their original template version.

Invalid canonical paths and missing AcroForm field names fail with explicit errors. Staff-entered draft overrides survive canonical recomputation.

## Family Pathways field map

| Field key | Application label | Canonical mapping | Method |
| --- | --- | --- | --- |
| `applicant_legal_name` | Legal name | `client.legalName` | Canonical/document |
| `applicant_preferred_name` | Preferred name | `client.preferredName` | Canonical |
| `applicant_date_of_birth` | Date of birth | `client.dateOfBirth` | Document/conflict resolution |
| `phone_number` | Phone | `client.phone` | Canonical |
| `email_address` | Email | `client.email` | Canonical |
| `mailing_address` | Current mailing address | `client.mailingAddress` | Staff when missing |
| `previous_address` | Previous address | `client.previousAddress` | Canonical |
| `preferred_contact_method` | Preferred contact method | `client.preferredContactMethod` | Staff when missing |
| `current_living_situation` | Current living situation | `client.currentLivingSituation` | Canonical |
| `homelessness_verification_date` | Homelessness-verification date | `documents.homelessnessVerificationDate` | Reviewed document |
| `desired_move_in_date` | Desired move-in date | `client.desiredMoveInDate` | Staff when supplied |
| `household_size` | Household size | `derived.householdSize` | Derived |
| `household_members` | Household members | `derived.householdTable` | Repeating derived group |
| `monthly_earned_income` | Monthly earned income | `finances.monthlyEarnedIncome` | Reviewed document |
| `monthly_benefits_income` | Monthly benefits income | `finances.monthlyBenefitsIncome` | Reviewed document |
| `other_income` | Other monthly income | `finances.otherIncome` | Canonical |
| `total_household_income` | Total monthly household income | `derived.totalMonthlyIncome` | Derived |
| `benefit_programs` | Benefit programs | `client.benefitPrograms` | Reviewed document |
| `accessibility_accommodations` | Accessibility accommodations | `client.accessibilityNeeds` | Canonical |
| `transportation_needs` | Transportation needs | `client.transportationNeeds` | Staff when supplied |
| `veteran_status` | Veteran status | `client.veteranStatus` | Canonical |
| `eviction_history` | Prior eviction history | `client.evictionHistory` | Staff when supplied |
| `rental_arrears` | Outstanding rental arrears | `client.rentalArrears` | Staff when supplied |
| `preferred_language` | Preferred language | `client.preferredLanguage` | Canonical |
| `emergency_contact` | Emergency contact | `client.emergencyContact` | Staff when missing |
| `identification_type` | Identification type | `documents.identificationType` | Reviewed document |
| `identification_expiration_date` | Identification expiration date | `documents.identificationExpirationDate` | Reviewed document/expiration resolution |
| `contact_permission` | Permission to contact applicant | `client.contactPermission` | Staff confirmation |
| `consent_acknowledgment` | Applicant consent confirmed | `client.consentConfirmed` | Explicit staff confirmation |
| `applicant_signature` | Applicant signature | Signature line | Human signature |
| `caseworker_name` | Caseworker name | `assignedCaseworker.name` | Canonical |
| `application_date` | Application date | `application.applicationDate` | Default at generation |

## PDF support

- `GENERATED_PDF`: sections, repeating household table, visible blanks, electronic signature, application reference, and page numbers.
- `ACROFORM`: imported agency text, checkbox, radio, dropdown, and option-list fields; exact-name validation; mapped values; preserved fillable output; electronic signature text.
- HTML preview: the same mapped draft, source status, signature, documents, review state, delivery destinations, and attempt history.

## Screenshots

Generated screenshots are stored under `screenshots/application-automation/`:

- `prepare-application.png`
- `remaining-question.png`
- `application-preview.png`
- `supporting-packet-selection.png`

## Architecture

Next.js App Router pages and server actions form the application boundary. Prisma stores relational records with committed migrations. Deterministic mapping, income normalization, readiness, AcroForm population, generated PDF layout, and packet assembly live in `src/lib/applications`. Encrypted local/S3 storage, revocable sessions, password recovery, optional TOTP MFA, durable throttling, audited signatures/consents, and idempotent delivery attempts remain server-side.

```text
Source documents -> reviewed extraction -> canonical profile
                                         -> template mapping
                                         -> application draft
                                         -> unresolved questions
                                         -> completed application PDF
                                         -> selected supporting documents
                                         -> supporting packet -> reviewer decision
                                                              -> email/provider API
```

## Local setup

Requirements: Node.js 22 or newer and npm.

```bash
npm install
copy .env.example .env
npm run db:setup
npm run dev
```

Document extraction can be selected with `DOCUMENT_PROCESSOR`: `mock`, `anthropic`, `gemini`, `groq`, `openrouter`, `sambanova`, `cerebras`, or `mistral`. Each hosted provider reads its own API key/model environment variables from `.env`; never commit those keys. Gemini uses its native multimodal `generateContent` endpoint. Groq, OpenRouter, SambaNova Cloud, Cerebras Inference, and Mistral use their OpenAI-compatible chat endpoints for text/images and model-dependent file inputs.

Open `http://localhost:3000`. Demo accounts use password `DemoHousing2026!` and one-click sign-in is available for caseworker, reviewer, and administrator roles.

## Verification commands

```bash
npm run db:setup
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run backup
```

Production container deployment, required secrets, health monitoring, encrypted backup scheduling, and restore verification are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Remaining external validation and provider work

- Real OCR requires a configured Anthropic key and an approved data-processing agreement; mock mode does not OCR arbitrary files.
- Each housing provider must supply a permitted email address or HTTPS API contract and credentials. Generic portal screen scraping is intentionally not used.
- The included AcroForm is synthetic. Import each real agency form through the administrator workflow and verify it against that agency’s current version.
- Automated WCAG 2.1 AA checks pass, but the caseworker study in `docs/CASEWORKER_USABILITY_TEST.md` still requires actual participants before real-user testing can be claimed complete.
- File signatures and MIME types are validated and the production profile streams uploads through ClamAV before storage. Organizations that require content disarm/reconstruction should replace or supplement that scanner under their security policy.
- The bundled production database profile is single-writer. Horizontal application scaling requires a managed multi-user relational database migration.

## License

MIT. See [LICENSE](./LICENSE).
