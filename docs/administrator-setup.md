# Administrator setup

The guided setup records one nonprofit's organization, access, governance, service, AI, operations, and submission decisions. It is resumable, administrator-only after the initial claim, and separate from the server-side production validator. Completing it does not authorize real applicant data or satisfy external legal, security, accessibility, provider, or operational approvals.

Use synthetic data until every applicable gate in [Version 1 readiness criteria](./version-1-criteria.md) is approved.

## Choose the correct entry point

- `/setup` is the one-time installation claim. It is available only when the database contains no organization or user and `SETUP_BOOTSTRAP_TOKEN_HASH` is configured.
- `/admin/setup` is the authenticated, organization-scoped wizard. Only an active administrator can open it.
- A normal local installation created by `npm run setup` already contains a fictional organization and synthetic administrator, so `/setup` is intentionally unavailable. Sign in as the synthetic administrator and open `/admin/setup` instead.
- After setup is completed, `/admin/setup` shows the active review. An administrator must explicitly choose **Reopen configuration** before editing another draft.

Caseworkers and reviewers are redirected to the restricted-area page if they try to open administrator setup.

## Create the first administrator on an empty installation

Run database migrations and configure the deployment's minimum startup secrets before exposing the application. Generate a one-time token locally; store the token in an approved password manager and put only its SHA-256 hexadecimal digest in the server secret manager:

```text
node -e "const c=require('node:crypto');const t=c.randomBytes(32).toString('base64url');console.log('One-time token (store securely): '+t);console.log('SHA-256 hash: '+c.createHash('sha256').update(t).digest('hex'))"
```

Set the 64-character digest as `SETUP_BOOTSTRAP_TOKEN_HASH`, restart the application, and give the one-time token to the intended first administrator through a separate approved channel. Do not put the token itself in an environment variable, command history, issue, chat, or log.

The administrator opens `/setup` and supplies:

- organization name;
- administrator name and email;
- the one-time token; and
- a new password of 12–128 characters containing lowercase, uppercase, and numeric characters.

The claim is limited to five attempts per source address in 15 minutes. A successful claim creates the organization and first administrator atomically, records `INSTALLATION_BOOTSTRAPPED` without the token, creates a session, and permanently closes the claim because the database is no longer empty. Remove `SETUP_BOOTSTRAP_TOKEN_HASH` from the deployment and restart even though the claimed-state check already prevents reuse.

Never reset or delete an existing production database to make `/setup` available again.

## Complete the guided sections

The wizard stores validated progress after each **Save and exit** or **Save and continue** action. Moving backward or signing out does not discard completed values.

| Section | Decisions recorded | Important effect |
| --- | --- | --- |
| Organization | Nonprofit name, jurisdiction, responsible contact, email, and optional phone | Activated labels and ownership information do not rewrite existing case records |
| Access & security | First administrator, additional staff and roles, MFA requirement, maximum and idle session limits, and password policy | Manage staff at `/admin/users` and individual TOTP enrollment at `/account/security`; activated session lifetime applies to newly created sessions |
| Data governance | Applicant-case, document, and audit retention; deletion approval window; legal-hold rule | The organization must supply legally approved periods; holds prevent covered deletion |
| Email, storage & scanning | SMTP, private S3-compatible or local demo storage, and ClamAV | SMTP may receive approved message data, storage receives encrypted objects, and ClamAV receives upload bytes in the controlled service network |
| AI processing | Disabled or one approved provider, exact model, approval reference, provider retention decision, DPA/region decision, and credential | External processing remains disabled unless selected; every extracted value still requires human review |
| Operations | Deployment encryption-key status, database-role check, monitoring receiver, alert contact, worker URL, backup schedule, destination, retention, and credentials | The wizard verifies or records these controls but does not replace deployment-owned master secrets or service processes |
| Submission | Manual download, email, provider API, or an organization-specific portal API adapter | A remote test uses only a synthetic marker; arbitrary third-party portals are not universally automated |
| Review & sign-off | Technical blockers, warnings, test results, and three organization acknowledgements | Activation is blocked until locally required sections and connection tests meet the current data-mode rules |

Every screen also states why the setting matters, what data leaves the application, failure behavior, and the effect on existing cases. See [Setup connection tests](./setup-connection-tests.md) before running a test against an external service.

## Drafts, active settings, and secrets

Each saved section has a draft configuration. Secret replacements are encrypted separately from non-secret JSON using the server-side data-encryption key. Secret fields are always blank when a page renders:

- leave a blank secret field to keep the saved encrypted value;
- enter a value only to replace it;
- the browser receives only a **Configured** indication, never the stored value; and
- changing non-secret configuration or replacing a secret clears that section's prior connection-test result.

Concurrent edits use a revision number. If another administrator saves first, reload the page and review the newer draft rather than overwriting it.

Saving a draft does not activate it. Final completion copies draft configuration and encrypted secrets to separate active fields, applies organization/access/governance values, records the acknowledgement version and `SETUP_COMPLETED`, and locks editing. Reopening records `SETUP_REOPENED`, copies the last active values into a new draft, and leaves the previous active values in use until another successful sign-off.

Do not place a master encryption key, database URL, session secret, or other process bootstrap credential into a wizard secret field. Those remain deployment-owned settings.

## Configuration precedence and restarts

Environment values provide initial defaults and the safe fallback when no active organization section exists. For organization-scoped runtime operations after activation:

- active SMTP, storage, and malware settings take precedence over their environment equivalents;
- organization access, password, MFA, and retention policies come from activated organization fields; and
- saving an unactivated draft does not change runtime behavior.

The process environment remains authoritative for database connections, the session secret, the master data-encryption key and key ring, production data mode, secure cookies, application URL, AI document-processor selection and runtime model, provider allowlist, monitoring endpoint protection, backup process, worker process, migrations, and production preflight. The wizard records approvals and exercises connections; it never edits `.env`, a secret manager, or a running process environment.

Restart the web and worker processes after changing environment or secret-manager values. Database-backed active organization settings are read at runtime and do not require an application restart after sign-off. Production environment validation can still reject startup even when the wizard is complete; satisfy both layers and ensure the environment-selected AI provider/model matches the active organization approval.

## Complete or reopen setup

The review page requires three explicit acknowledgements:

1. saved technical information is accurate;
2. privacy, retention, consent, signature, and submission rules require organization-specific legal review; and
3. wizard completion alone does not authorize real applicant data or prove external gates are complete.

Production sign-off also requires MFA for every active administrator. If the organization selected mandatory MFA for all staff, every active staff account must enroll before sign-off.

Completion does not prove or replace:

- jurisdiction-specific privacy, retention, consent, signature, or submission approval;
- AI-provider contract, DPA, retention, training-use, subprocessor, and regional-processing approval;
- acceptance of real agency forms and destinations;
- independent penetration testing;
- manual keyboard, screen-reader, zoom, and high-contrast testing;
- moderated caseworker usability testing;
- named incident and on-call owners;
- incident-response tabletop exercises; or
- a timed production-equivalent backup restore.

## Troubleshooting

| Symptom | Safe action |
| --- | --- |
| `/setup` says the claim is unavailable | Confirm whether an organization or user already exists. If the installation is genuinely empty, configure a valid SHA-256 digest and restart. Never delete real records to reopen the claim. |
| Setup reports another administrator changed it | Reload, review the newer draft, and reapply only the intended change. |
| A configured secret field is blank | This is expected. Blank retains the encrypted value; use the field only to replace it. |
| A prior test disappeared after saving | Changing configuration or a secret intentionally invalidates the old result. Run the test again against the saved draft. |
| A private SMTP, storage, or ClamAV host is blocked | Add only the exact approved hostname to `INTERNAL_SERVICE_HOST_ALLOWLIST`, restart, and retest. Do not allowlist localhost or cloud metadata addresses. |
| Production startup still fails after sign-off | Run `npm run config:production` and `npm run production:check`. The wizard cannot supply required deployment environment settings or external infrastructure. |

Never include environment dumps, credentials, applicant information, provider responses, or uploaded documents in troubleshooting output.
