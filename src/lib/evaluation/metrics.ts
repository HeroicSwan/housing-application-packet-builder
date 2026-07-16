export type EvaluationField = { name: string; value: string; confidence?: number; sourcePage?: number | null; sourceText?: string | null };
export type EvaluationCase = { id: string; expected: Record<string, string>; actual: EvaluationField[]; expectedConflicts?: string[]; detectedConflicts?: string[]; latencyMs: number; costUsd?: number; retries?: number; timedOut?: boolean; failed?: boolean; invalidOutput?: boolean; scenario: string };

function normalize(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[$,\s.()/-]/g, ""); }
function percentile(values: number[], percentileValue: number) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)]; }
function ratio(numerator: number, denominator: number) { return denominator ? numerator / denominator : 0; }

export function calculateEvaluationMetrics(cases: EvaluationCase[]) {
  let expectedFields = 0, returnedFields = 0, exact = 0, normalized = 0, missing = 0, hallucinated = 0, grounded = 0, corrections = 0, confidenceSamples = 0, brierTotal = 0, expectedConflicts = 0, detectedConflicts = 0;
  for (const item of cases) {
    const actual = new Map(item.actual.map((field) => [field.name, field]));
    expectedFields += Object.keys(item.expected).length;
    returnedFields += item.actual.length;
    for (const [name, value] of Object.entries(item.expected)) {
      const field = actual.get(name);
      if (!field) { missing += 1; continue; }
      const exactMatch = field.value === value;
      const normalizedMatch = normalize(field.value) === normalize(value);
      if (exactMatch) exact += 1;
      if (normalizedMatch) normalized += 1; else corrections += 1;
      if (field.sourcePage && field.sourceText) grounded += 1;
      if (typeof field.confidence === "number") { confidenceSamples += 1; brierTotal += (field.confidence - (normalizedMatch ? 1 : 0)) ** 2; }
    }
    hallucinated += item.actual.filter((field) => !(field.name in item.expected)).length;
    expectedConflicts += item.expectedConflicts?.length ?? 0;
    detectedConflicts += (item.expectedConflicts ?? []).filter((name) => item.detectedConflicts?.includes(name)).length;
  }
  const successful = cases.filter((item) => !item.failed);
  return {
    documents: cases.length,
    expectedFields,
    fieldExactAccuracy: ratio(exact, expectedFields),
    normalizedAccuracy: ratio(normalized, expectedFields),
    missingValueRate: ratio(missing, expectedFields),
    hallucinationRate: ratio(hallucinated, returnedFields),
    sourceGroundingRate: ratio(grounded, expectedFields - missing),
    confidenceBrierScore: ratio(brierTotal, confidenceSamples),
    conflictDetectionRecall: ratio(detectedConflicts, expectedConflicts),
    humanCorrectionRate: ratio(corrections, expectedFields),
    averageLatencyMs: ratio(successful.reduce((sum, item) => sum + item.latencyMs, 0), successful.length),
    p95LatencyMs: percentile(successful.map((item) => item.latencyMs), 0.95),
    costPerDocumentUsd: ratio(cases.reduce((sum, item) => sum + (item.costUsd ?? 0), 0), cases.length),
    providerFailureRate: ratio(cases.filter((item) => item.failed).length, cases.length),
    retryRate: ratio(cases.filter((item) => (item.retries ?? 0) > 0).length, cases.length),
    timeoutRate: ratio(cases.filter((item) => item.timedOut).length, cases.length),
    invalidOutputRate: ratio(cases.filter((item) => item.invalidOutput).length, cases.length),
  };
}

export type EvaluationMetrics = ReturnType<typeof calculateEvaluationMetrics>;
