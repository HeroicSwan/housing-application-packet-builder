# Agency template onboarding

This is self-service: each organization uploads and configures its own form. No agency PDF is bundled with the project and no organization can see another organization’s template. Real-agency templates are intentionally gated. A synthetic AcroForm can continue to support local QA, but a template marked **Use for real agency deployment** cannot be published until its external evidence is recorded.

## Bring your own template

From **Admin → Program → Create template**, choose **Agency fillable PDF**, upload the organization’s own PDF, and select **Use for real agency deployment** when the version is intended for live use. The builder discovers the AcroForm fields and opens the mapping editor; administrators then choose the canonical mapping, required/optional state, formatting, and validation rules for each field.

## Required evidence per version

1. **Approved PDF** — upload the exact agency-provided, fillable PDF through the administrator template wizard. The application inspects the AcroForm fields, rejects unsupported field types, and stores the encrypted source object.
2. **Field mapping** — map every agency field to a canonical application path or explicitly mark it for staff entry. Set required/optional, field type, formatting, and JSON validation rules (for example `{"minLength":2}` or `{"pattern":"^[A-Z]+$"}`).
3. **Compatibility report** — upgrades compare added, changed, and removed fields against the superseded version. Removed fields and unmapped required fields block publication.
4. **Sandbox test** — submit a synthetic approved application to the agency sandbox or portal, then record the provider receipt/ticket and a summary. The record is evidence; it does not fabricate provider acceptance.
5. **Signed acceptance** — upload the signed acceptance record with signer name, signer email, and signing date. An administrator must verify the record before the version can publish.

## Upgrades and rollback

Create a new draft version from the active version. Do not edit a published version. Resolve compatibility blockers, repeat the sandbox test, and obtain a new acceptance record for the new PDF/version. Rollback creates a new draft from the selected immutable version; publish it only after the same gates pass.

## External handoff

The repository does not contain an agency PDF, provider credentials, sandbox endpoint, or signed acceptance record. Those must be supplied and approved by the deploying organization. Until then, keep the template synthetic-only and do not represent the application as agency-certified.
