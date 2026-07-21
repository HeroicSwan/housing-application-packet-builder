# AI extraction quality and safety

The supported local model is Ollama `qwen2.5vl:7b`. Extraction is a suggestion workflow, never an eligibility decision.

## Processing sequence

1. PDFs are rendered locally and image uploads are normalized with EXIF rotation, conservative deskewing, median denoising, contrast normalization, sharpening, whitespace cropping, and a bounded output size.
2. Pages are classified before extraction using the supplied category and visible filename/text heuristics. Ambiguous pages fall back to a model classification pass and are marked for review.
3. Category-specific prompts are selected for identity, income, benefits, leases, bank statements, tax documents, letters, residency, household, and homelessness verification documents.
4. Ollama receives a JSON-schema-constrained request. Every returned value must include a 1-based source page and a visible evidence snippet.
5. Values below the `0.75` confidence threshold, values without evidence, and conflicting duplicate values are abstained from instead of being silently accepted.
6. Documents with abstentions are stored as `COMPLETED_WITH_REVIEW`, surfaced in the document queue, and excluded from packet readiness until staff resolves the missing information.
7. Cross-document values are compared by canonical field name. Differences are marked `CONFLICTING` and require human review.

## Evaluation corpus

The versioned synthetic corpus is in [`evaluation/gold-standard/manifest.json`](../evaluation/gold-standard/manifest.json). Add only synthetic, consent-free fixtures. Run:

```text
npm run evaluation:gold
npm run evaluate
```

Every model, prompt, preprocessing, or threshold change should be evaluated against the corpus before release. A passing synthetic score does not prove live OCR quality; run the approved service-gated OCR evaluation on the target hardware before real data use.

## Safe failure behavior

The model is explicitly instructed to return an empty value and a warning when text is not visible, evidence is incomplete, pages conflict, or confidence is below threshold. Staff can enter a corrected value through the existing review workflow. No ungrounded model output is eligible for a generated packet.
