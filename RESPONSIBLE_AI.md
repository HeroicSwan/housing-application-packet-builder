# Responsible AI

Document processing is assistive transcription, not an authority. Phase 0 permits synthetic demonstration documents only and is not approved for real applicant information.

## Current behavior

The default mock processor is deterministic and requires no provider account. Optional server-side adapters can send synthetic PDFs or images to configured Anthropic, Gemini, Groq, OpenRouter, SambaNova, Cerebras, or Mistral services. Provider output is schema-validated and begins as a proposal that staff can approve, correct, or reject.

Reviewed human values are not silently replaced by later provider output. Deterministic application and requirement rules remain separate from AI proposals.

## Human review

Staff must compare each proposal with its synthetic source, resolve conflicts, confirm program rules, review generated forms, and make submission decisions. Confidence values are review aids, not eligibility or credibility scores.

## Prohibited uses

Do not use the project to process real applicant information, determine eligibility, rank people, infer protected traits, assess credibility, make legal conclusions, replace consent, train on documents without authority, or submit an application without human review.

## Risks and missing evidence

Models can omit text, confuse people or periods, misread amounts and dates, invent structure, or lose page context. Documents may also contain prompt injection or malicious content. Phase 0 has no representative OCR benchmark, malicious-document evaluation, AI-vendor approval, or production monitoring evidence.

## Future evaluation

Any future proposal must evaluate field-level accuracy, document types, accessibility and language scenarios, prompt injection, provider retention and training terms, regional processing, human override behavior, incident escalation, and safe monitoring. See [docs/data-handling.md](./docs/data-handling.md) and [docs/version-1-criteria.md](./docs/version-1-criteria.md).
