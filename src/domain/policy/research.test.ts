import {expect,it} from "vitest";
import {replayStep,replayInputs} from "../../../research/replay";
import {REFERENCE_POLICY} from "./reference";
import {contentHash} from "./hash";
import {SCENARIO_IDENTITIES} from "../../../data/replay/versioning";
import manifest from "../../../data/replay/manifest.json";
import {tracesCsv,tracesJsonl,TRACE_CSV_COLUMNS} from "../../../research/schemas/export";
import {syntheticInputs,percentile} from "../../../research/benchmarks/runner";
import {safeLog} from "@/server/observability/log";
import {validateEnvironment} from "@/lib/validation/environment";
import {analyzeInstrument} from "@/domain/attention/analyze-instrument";
const counts=(items:ReturnType<typeof replayStep>)=>["RELEVANT","SIGNIFICANT","QUIET"].map(lane=>items.filter(item=>item.lane===lane).length);
it("freezes the reference policy configuration hash",()=>expect(contentHash(REFERENCE_POLICY)).toBe("6def3e3af65c5f762db078a450a00c6f7fb55ce02d6b2028f11cd016ba85d967"));
it("freezes every versioned replay content hash",()=>{for(const identity of SCENARIO_IDENTITIES)expect(identity.scenarioContentHash).toBe(manifest[identity.scenarioId as keyof typeof manifest].hash);});
it("offline canonical evaluation exactly preserves Build 4",()=>{
  expect(counts(replayStep("groww-delta-default",0))).toEqual([0,0,5]);
  expect(counts(replayStep("groww-delta-default",1))).toEqual([0,0,5]);
  expect(counts(replayStep("groww-delta-default",2))).toEqual([4,1,0]);
  expect(counts(replayStep("groww-delta-default",2,2))).toEqual([0,0,5]);
  expect(counts(replayStep("groww-delta-default",3,2))).toEqual([0,0,5]);
  const fourth=replayStep("groww-delta-default",4,2);
  expect(counts(fourth)).toEqual([1,0,4]);
  expect(fourth[0]).toMatchObject({relevance:85,priceSignificance:0,decisionTrace:{directIntentMatch:false,contextualMatch:true}});
});
it("repeated replay exports match byte-for-byte",()=>{
  const run=()=>replayStep("groww-delta-default",4,2).map(item=>item.decisionTrace);
  expect(tracesJsonl(run())).toBe(tracesJsonl(run()));
  expect(tracesCsv(run())).toBe(tracesCsv(run()));
  expect(tracesCsv(run()).split("\n")[0]).toBe(TRACE_CSV_COLUMNS.join(","));
  expect(tracesJsonl(run()).trim().split("\n").map(line=>JSON.parse(line))).toHaveLength(5);
});
it("each replay boundary excludes future evidence and keeps bounded scores",()=>{
  for(let step=0;step<=4;step++)for(const input of replayInputs("groww-delta-default",step)) {
    expect(input.snapshots.every(row=>row.sequence<=step)).toBe(true);
    expect(input.events.every(event=>event.sequence<=step)).toBe(true);
    const result=analyzeInstrument(input)!;
    expect(result.score).toBeGreaterThanOrEqual(0); expect(result.score).toBeLessThanOrEqual(100);
  }
});
it("synthetic scale preserves unique instruments and configured graph bounds",()=>{
  const inputs=syntheticInputs(50); expect(new Set(inputs.map(input=>input.instrument.id)).size).toBe(50);
  for(const input of inputs)expect(analyzeInstrument(input)!.decisionTrace.graphNodesVisited).toBeLessThanOrEqual(25);
  expect(()=>syntheticInputs(5001)).toThrow();
  expect(percentile([1,2,3,4,5],.95)).toBe(5);
});
it("structured logs are allowlisted and environment errors redact values",()=>{
  const entry={requestId:"test",operation:"GET catch-up",latencyMs:1,result:"OK" as const,cookie:"secret",DATABASE_URL:"secret"};
  expect(safeLog(entry)).not.toContain("secret");
  expect(()=>validateEnvironment({DATABASE_URL:"secret"})).toThrow("DATABASE_URL");
  try{validateEnvironment({DATABASE_URL:"secret"});}catch(error){expect(String(error)).not.toContain("secret");}
});
