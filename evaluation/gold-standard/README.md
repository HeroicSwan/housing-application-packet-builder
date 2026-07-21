# Synthetic gold-standard document set

This directory defines the regression corpus for document extraction. It contains references to repository-owned synthetic PDFs only; never add real applicant documents, screenshots containing personal information, production exports, or provider responses.

Each case in `manifest.json` must include:

- the fixture path and expected document category;
- every expected field and its exact normalized value;
- the 1-based source page and a short evidence snippet;
- a scenario label such as `rotated-scan`, `conflicting-amounts`, or `missing-values`.

When a new synthetic edge case is added, update the manifest, run `npm run evaluation:gold`, and add the scenario to the deterministic evaluation when it represents a new failure mode. The corpus is intentionally versioned so extraction changes can be compared against a stable baseline before a model or prompt is upgraded.
