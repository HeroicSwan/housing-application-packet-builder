# Responsible AI

Document processing is an assistive transcription step, not an authority. The default deterministic mock processor works without an API key. The optional Anthropic PDF adapter may propose structured fields with confidence and page/source references. Its output is schema-validated, every proposal begins pending, and a person can approve, edit, or reject it while the original proposal remains stored.

## Human review

Qualified staff must compare extracted values to the source, resolve inconsistencies, confirm program policy, and decide whether a packet is ready. A reviewed human value is never silently replaced by later AI output; retries are limited to failed processing records. Uncertainty is shown as a confidence percentage plus source evidence; low confidence is not converted into an eligibility score. Requirement matching and packet approval use deterministic code and immutable packet snapshots.

## Prohibited uses

Do not use this system to determine eligibility, rank or prioritize clients, infer protected traits, assess credibility, make legal conclusions, replace client consent, or submit a packet without human review. Do not train models on client documents without explicit authority and a reviewed agreement.

## Risks

Extraction can miss text, misread names and dates, confuse household members, omit signatures, invent structure, or lose page context. Errors can delay housing access or misrepresent a person. Deterministic inconsistency checks also have limits: they create review items, never accusations or automatic rejection.

## Before nonprofit deployment

Test on synthetic and consented representative documents; measure error rates by field and document type; include accessibility and language scenarios; define confidence and escalation policy; conduct staff usability studies; red-team prompt injection inside documents; review the provider’s retention and training terms; verify human override behavior; monitor errors without logging sensitive content; and obtain legal, privacy, security, program-policy, and frontline-staff approval.
