import type { AttentionDecisionTrace } from "../../src/domain/attention/trace";
import { canonicalJson } from "../../src/domain/policy/hash";
export const TRACE_CSV_COLUMNS = ["decisionId","timestamp","policyVersion","policyConfigHash","scenarioId","scenarioVersion","scenarioContentHash","researchSessionId","instrumentId","throughSequence","significanceScore","relevanceScore","noveltyScore","urgencyScore","confidenceScore","finalAttentionScore","lane","directIntentMatch","contextualMatch","graphNodesVisited","cursorBefore","cursorAfter","matches","graphPaths","reasonCodes","trustReasonCodes","provenance","calmModeState","corporateActionState"] as const satisfies readonly (keyof AttentionDecisionTrace)[];
export const tracesJsonl=(traces:AttentionDecisionTrace[])=>traces.map(canonicalJson).join("\n")+"\n";
export function tracesCsv(traces:AttentionDecisionTrace[]):string {
  const cell=(value:unknown)=>'"'+(typeof value==="object"?canonicalJson(value):String(value??"")).replaceAll('"','""')+'"';
  return [TRACE_CSV_COLUMNS.join(","),...traces.map(trace=>TRACE_CSV_COLUMNS.map(key=>cell(trace[key])).join(","))].join("\n")+"\n";
}
