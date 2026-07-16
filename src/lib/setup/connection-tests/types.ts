export type ConnectionTestStatus = "PASSED" | "FAILED" | "SIMULATED" | "UNSUPPORTED";
export type ConnectionTestResult = { status: ConnectionTestStatus; code: string; durationMs: number; summary: string };

export async function timedConnectionTest(run: () => Promise<Omit<ConnectionTestResult, "durationMs">>): Promise<ConnectionTestResult> {
  const started = performance.now();
  try {
    const result = await run();
    return { ...result, durationMs: Math.max(0, Math.round(performance.now() - started)) };
  } catch {
    return { status: "FAILED", code: "CONNECTION_TEST_FAILED", summary: "The service could not be verified. Check the saved settings and service logs.", durationMs: Math.max(0, Math.round(performance.now() - started)) };
  }
}
