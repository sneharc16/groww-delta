export interface OperationLog {
  requestId: string; operation: string; latencyMs: number; result: "OK" | "ERROR";
  queryCount?: number; researchSessionId?: string; scenarioId?: string; errorClass?: string; decisionIds?: string[];
}
/** Allowlist only. Never serialize Request, Error, environment, or cookies. */
export function safeLog(entry: OperationLog): string {
  return JSON.stringify({
    requestId: entry.requestId, operation: entry.operation, latencyMs: entry.latencyMs, result: entry.result,
    researchSessionId: entry.researchSessionId, scenarioId: entry.scenarioId, errorClass: entry.errorClass,
    decisionIds: entry.decisionIds, queryCount: entry.queryCount,
  });
}
