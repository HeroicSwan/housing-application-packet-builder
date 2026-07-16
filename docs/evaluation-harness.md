# Evaluation harness

`npm run evaluate` runs a 120-applicant deterministic synthetic workload without network access or paid provider calls. It writes timestamped JSON and HTML reports under ignored `output/evaluations/`, compares every mandatory metric with `evaluation/thresholds.json`, and exits nonzero on regression. The committed baseline describes expectations; generated reports contain aggregate synthetic metrics only.

The deterministic corpus cycles through English, approved multilingual, blurred/rotated/low-resolution scan contracts, multi-page content, handwriting, unusual layout, tables, complex households, multiple members and jobs, mixed income frequencies, conflicting dates and amounts, missing values, expired evidence, suspicious PDF handling, document prompt injection, template upgrades, duplicates, configured-size boundaries, and batch processing. Some are scenario contracts rather than claims about a live OCR engine. Live PDF/image quality remains an explicit provider gate.

## Metric definitions

- **Field exact accuracy:** exact expected values divided by all expected visible fields.
- **Normalized accuracy:** matches after Unicode normalization, case folding, and presentation punctuation removal.
- **Missing-value rate:** expected visible fields not returned divided by expected fields.
- **Hallucination rate:** returned field names absent from ground truth divided by returned fields.
- **Source grounding:** returned expected fields with both a source page and source text divided by returned expected fields.
- **Confidence calibration:** Brier score between reported confidence and normalized correctness; lower is better.
- **Conflict detection:** expected field conflicts detected divided by expected conflicts.
- **Human-correction rate:** returned expected values needing correction divided by expected fields.
- **Latency:** mean and 95th-percentile processing time per document.
- **Cost per document:** recorded provider cost divided by attempted documents; deterministic mode is zero.
- **Provider failure, retry, timeout, and invalid-output rates:** affected documents divided by attempted documents.

Live provider evaluation must be explicitly enabled only after key rotation, exact provider/model approval, retention review, and cost approval. Use the service-gated OCR and provider tests documented in `docs/live-test-matrix.md`; never reuse a credential found in repository history. A deterministic pass proves the harness and application regression contract, not live OCR quality.
