# External credential rotation checklist

Repository scans can detect and remove credential-shaped values, but they cannot revoke credentials issued by an external provider. Every credential previously pasted into chat or another uncontrolled channel must be treated as compromised even when it never entered Git history.

## Owner actions required

- [ ] Revoke the previously shared Groq API key in the Groq account.
- [ ] Revoke the previously shared SambaNova Cloud API key in the SambaNova account.
- [ ] Revoke the previously shared Google Gemini credential in the Google account and verify that the value was an API credential for the intended project.
- [ ] Revoke the previously shared Cerebras API key in the Cerebras account.
- [ ] Revoke the previously shared Mistral API key in the Mistral account.
- [ ] Review provider access logs and billing for use after the exposure time.
- [ ] Create replacements only after revocation and store them in an approved secret manager.
- [ ] Never paste replacement values into chat, issues, documentation, fixtures, screenshots, logs, or commits.

Record the provider, credential identifier, revocation time, replacement owner, and evidence location in the deploying organization's private security system. Do not store live values or private revocation evidence in this repository.

## Repository verification

Run both redacted scans:

```text
npm run security:secrets
npm run security:history
```

The current-tree scan covers tracked and non-ignored untracked files. The history scan walks every local commit and text blob. Binary screenshots and PDFs still require human review because text scanners do not perform OCR.
