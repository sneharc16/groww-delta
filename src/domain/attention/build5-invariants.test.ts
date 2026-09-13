import { expect, it } from "vitest";
import { analyzeInstrument } from "./analyze-instrument";
import { resilienceSetup } from "../../../tests/helpers/resilience";
import { cursorRecord } from "../../../tests/helpers/in-memory";
import { contentHash } from "@/domain/policy/hash";
import { REFERENCE_POLICY } from "@/domain/policy/reference";

function inputAt(sequence: number) {
  const setup = resilienceSetup("groww-delta-default");
  return { instrument: setup.instruments[3], cursor: cursorRecord({ instrumentId: "NSE:INDIGO", lastSeenSequence: 2 }),
    currentSequence: sequence, currentTime: new Date(setup.scenario.steps[sequence].eventTime),
    snapshots: setup.snapshots.filter(row=>row.scenarioId===setup.scenario.id && row.instrumentId==="NSE:INDIGO"),
    events: setup.events.filter(event=>event.scenarioId===setup.scenario.id && (event.instrumentId==="NSE:INDIGO" || !event.instrumentId)),
    activeIntents: [setup.intents.rows[3]], activeGraphs: setup.graphs.rows };
}
it("canonical hashing ignores object insertion order and preserves array order",()=>{
  expect(contentHash({a:1,b:2})).toBe(contentHash({b:2,a:1}));
  expect(contentHash([1,2])).not.toBe(contentHash([2,1]));
});
it("reference weights and graph/trust bounds are frozen",()=>{
  expect(REFERENCE_POLICY.weights).toEqual({ significance:0.30,relevance:0.35,novelty:0.15,urgency:0.10,confidence:0.10 });
  expect(Object.isFrozen(REFERENCE_POLICY.graph)).toBe(true);
  expect(REFERENCE_POLICY.graph).toMatchObject({maxDepth:3,maxNodes:25,minimumRelevance:50});
  expect(REFERENCE_POLICY.trust.maxPriceDelaySeconds).toBe(60);
});
it("future snapshots, events and corrections cannot affect current trace",()=>{
  const input=inputAt(3);
  const bounded={...input,snapshots:input.snapshots.filter(row=>row.sequence<=3),events:input.events.filter(row=>row.sequence<=3)};
  expect(analyzeInstrument(input)?.decisionTrace).toEqual(analyzeInstrument(bounded)?.decisionTrace);
});
it("future intent and graph versions cannot enter current trace",()=>{
  const input=inputAt(4);
  const withFuture={...input,
    activeIntents:[...input.activeIntents,{...input.activeIntents[0],id:"future-intent",logicalIntentId:"future",version:2,effectiveFromSequence:5}],
    activeGraphs:[...input.activeGraphs,{...input.activeGraphs[0],id:"future-graph",logicalGraphId:"future",watchIntentLogicalId:"future",version:2,effectiveFromSequence:5}]};
  expect(analyzeInstrument(withFuture)?.decisionTrace).toEqual(analyzeInstrument(input)?.decisionTrace);
});
it("duplicate observations cannot change decision identity",()=>{
  const input=inputAt(4);
  expect(analyzeInstrument({...input,events:[...input.events,...input.events]})?.decisionTrace).toEqual(analyzeInstrument(input)?.decisionTrace);
});
it("offline graph ablation cannot mutate production policy or direct-match semantics",()=>{
  const input=inputAt(4), before=contentHash(REFERENCE_POLICY);
  const offline={...REFERENCE_POLICY,version:"offline-no-graph",components:{...REFERENCE_POLICY.components,graph:false}};
  expect(analyzeInstrument(input,offline)?.relevance).toBe(0);
  expect(analyzeInstrument(input)?.relevance).toBe(85);
  expect(contentHash(REFERENCE_POLICY)).toBe(before);
});
it("repeat evaluation has exactly reproducible traces",()=>{
  const input=inputAt(4);
  expect(contentHash(analyzeInstrument(input)?.decisionTrace)).toBe(contentHash(analyzeInstrument(structuredClone(input))?.decisionTrace));
});

it("unknown runtime event categories fail explicitly rather than producing NaN or Quiet",()=>{
  const input=inputAt(4);
  const invalid={...input.events.at(-1)!,type:"UNRECOGNIZED",instrumentId:input.instrument.id} as unknown as typeof input.events[number];
  expect(()=>analyzeInstrument({...input,events:[invalid]})).toThrow(/event/i);
});
