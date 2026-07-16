# Setup connection tests

Administrator setup provides bounded, synthetic tests for saved draft configuration. Tests are server-side, administrator-only, rate-limited to eight attempts per organization, test kind, and minute, and recorded in the organization audit history. They do not bypass production startup validation or replace live operational, legal, contractual, restore, or acceptance exercises.

Save the section before testing it. A test uses the saved draft and encrypted draft secret, not unsaved browser fields. Any later configuration change or secret replacement clears the prior result.

## Status meanings

| Status | Meaning |
| --- | --- |
| `PASSED` | The implemented live check completed against the saved target. It proves only the behavior described for that check. |
| `FAILED` | The target was blocked, unavailable, rejected the request, timed out, returned an invalid result, or did not meet the security check. Review the fixed code and safe summary. |
| `SIMULATED` | No equivalent production service was exercised. Synthetic mode may accept this as a warning, but it is never evidence of a live production check. |
| `UNSUPPORTED` | The service is intentionally disabled or the selected workflow has no supported automated adapter. It must not be described as passed. |

The stored result contains only the status, an allowlisted code, duration, safe summary, timestamp, and administrator. Audit metadata excludes credentials, prompts, provider response bodies, document contents, and test payloads.

## Readiness behavior

Every setup requires completed organization, access, governance, SMTP, storage, malware, AI, operations, and delivery sections. The review also evaluates these connection tests:

- SMTP;
- storage;
- malware scanning;
- database permissions;
- monitoring; and
- backup storage.

AI provider and exact-model results are additionally required when AI is enabled. A delivery result is additionally required for API and portal-API destinations.

In synthetic mode, a required `SIMULATED` result is shown as a warning and does not block local demonstration sign-off. In production mode, only `PASSED` satisfies a required test. `FAILED`, `SIMULATED`, `UNSUPPORTED`, or no current result blocks required production sign-off.

Manual-download and email destinations do not require a separate delivery test: manual handling remains an organizational procedure, and email uses the separately tested SMTP service. Disabling AI removes the AI/model test requirement and keeps document processing manual.

## What each test does

| Test | Implemented behavior | Timeout and artifacts |
| --- | --- | --- |
| SMTP | Resolves the approved host and verifies SMTP transport, TLS mode, and authentication without sending an email | 15-second transport bounds; no message or recipient is created |
| Storage | Writes 48 random bytes through the encrypted storage adapter, reads and checksum-verifies them, deletes the object, then confirms it is gone | 15-second round trip; best-effort five-second cleanup if an earlier step fails |
| Malware | Sends harmless synthetic text, then the standard EICAR test signature, and requires ClamAV to accept the first and detect the second | 15-second socket bounds per scan; EICAR can appear in scanner security alerts |
| AI provider/model | Retrieves the exact configured model, then makes one minimal synthetic inference using the selected provider | One overall 20-second deadline, no retries; no raw response, key, or prompt is returned or stored |
| Database | On PostgreSQL, verifies distinct application/system roles, rejects administrative or application `BYPASSRLS` privileges, and confirms forced RLS on tenant tables | SQLite returns `SIMULATED`; no case or applicant row is created |
| Monitoring | Collects local metrics and, when configured, posts one synthetic alert event to the HTTPS receiver | Five-second external request; no endpoint returns `SIMULATED` |
| Backup | Performs the encrypted storage round trip under a temporary `setup-tests/backups` prefix | This validates configured storage access only; it does not run a backup, use the operations page's destination text as a separate adapter, or prove restore capability |
| Delivery | For an acknowledged API/portal adapter, posts one idempotent synthetic marker such as `SYNTHETIC-SETUP-TEST` | Ten-second request; the remote system may retain the clearly marked test record |

The delivery test never sends an applicant, household member, document, signature, completed application, or real destination payload. A portal selection without an approved adapter returns `UNSUPPORTED`; the application does not pretend arbitrary portals can be automated.

## Network target policy

Production SMTP, ClamAV, and custom object-storage probe hosts are validated before connection. Public targets must resolve only to public addresses. Private service hosts require exact, comma-separated hostnames in `INTERNAL_SERVICE_HOST_ALLOWLIST`:

```text
INTERNAL_SERVICE_HOST_ALLOWLIST="smtp.internal.example,clamav.internal.example,storage.internal.example"
```

Entries are hostnames only—no schemes, paths, credentials, or ports. Changing the allowlist requires a process restart. The allowlist does not permit loopback, link-local, multicast, unspecified, cloud metadata, or malformed addresses.

Monitoring and delivery use the safe HTTPS client and currently require a public HTTPS destination. It rejects URL credentials, unsafe DNS results, private and metadata addresses, oversized responses, and DNS rebinding between validation and connection. Do not weaken these checks to make an internal test pass; expose an approved safe receiver or extend the reviewed outbound policy deliberately.

## Codes and safe interpretation

Codes are fixed so provider or network error text cannot be reflected into the UI or audit log.

| Area | Representative codes |
| --- | --- |
| SMTP | `SMTP_CONNECTION_OK`, `SMTP_CONNECTION_FAILED`, `SMTP_NOT_CONFIGURED`, `SMTP_TARGET_BLOCKED` |
| Storage/backup | `STORAGE_ROUND_TRIP_OK`, `STORAGE_UNAVAILABLE`, `STORAGE_TIMEOUT`, `STORAGE_CONTENT_MISMATCH`, `STORAGE_DELETE_NOT_CONFIRMED`, `STORAGE_TARGET_BLOCKED` |
| ClamAV | `CLAMAV_PROBE_OK`, `CLAMAV_DISABLED`, `CLAMAV_UNAVAILABLE`, `CLAMAV_TIMEOUT`, `CLAMAV_INVALID_RESPONSE`, `CLAMAV_CLEAN_SAMPLE_REJECTED`, `CLAMAV_EICAR_NOT_DETECTED`, `CLAMAV_TARGET_BLOCKED` |
| AI | `AI_PROVIDER_MODEL_OK`, `AI_PROVIDER_DISABLED`, `AI_CONFIGURATION_INVALID`, `AI_AUTHENTICATION_FAILED`, `AI_MODEL_UNAVAILABLE`, `AI_RATE_LIMITED`, `AI_MODEL_CHECK_FAILED`, `AI_INFERENCE_FAILED`, `AI_PROBE_TIMEOUT` |
| Database | `DATABASE_PERMISSIONS_OK`, `DATABASE_SQLITE_DEMO`, `DATABASE_ROLES_NOT_SEPARATE`, `DATABASE_ROLE_OVERPRIVILEGED`, `DATABASE_RLS_INCOMPLETE`, `DATABASE_PERMISSION_TEST_FAILED` |
| Monitoring | `MONITORING_RECEIVER_OK`, `MONITORING_COLLECTOR_ONLY`, `MONITORING_RECEIVER_REJECTED`, `MONITORING_RECEIVER_UNAVAILABLE` |
| Delivery | `DELIVERY_TEST_ACCEPTED`, `DELIVERY_MANUAL_WORKFLOW`, `DELIVERY_USES_SMTP`, `DELIVERY_TEST_NOT_ACKNOWLEDGED`, `DELIVERY_TEST_REJECTED`, `DELIVERY_TEST_UNAVAILABLE`, `PORTAL_ADAPTER_REQUIRED` |
| Generic | `CONNECTION_TEST_FAILED` when an unexpected failure is safely contained |

An authentication, quota, provider approval, or remote-retention problem must be resolved at the service and in the organization's approval records. Do not paste the provider's raw response or a credential into an issue.

## What a pass does not prove

A connection-test pass does not prove:

- the service's contract, DPA, retention, training, region, subprocessors, or breach terms are approved;
- real agency forms or destinations are accepted;
- end-to-end delivery is accepted rather than merely transported;
- production alert paging reaches a named on-call owner;
- a complete encrypted backup can be restored within the organization's RTO/RPO;
- security, privacy, accessibility, or electronic-signature legal sufficiency; or
- readiness for real applicant information.

Record those decisions and exercises separately. See [Administrator setup](./administrator-setup.md), [AI vendor review](./ai-vendor-review.md), [Production operations](./production-operations.md), and [Version 1 criteria](./version-1-criteria.md).
