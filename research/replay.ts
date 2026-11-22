import { findReplayScenario } from "../data/replay/scenarios";
import { scenarioIdentity } from "../data/replay/versioning";
import { replayInstruments } from "../data/replay/default-scenario";
import { seededIntents } from "../data/demo/initial-intents";
import { graphDraftFromTemplate, findDriverTemplate } from "../src/domain/graph/templates";
import { analyzeInstrument } from "../src/domain/attention/analyze-instrument";
import { deriveMarketContext } from "../src/domain/market/context";
import type { AttentionAnalysisInput, AttentionItem } from "../src/domain/attention/types";
import type { WatchGraphRecord } from "../src/domain/graph/types";
import type { WatchIntentRecord } from "../src/domain/intent/types";
import { REFERENCE_POLICY, type AttentionPolicy } from "../src/domain/policy/reference";
import { calculatePriceDeltaBps } from "../src/domain/attention/significance";
import { PRIMARY_BENCHMARK } from "../src/domain/trust/policy";

export function replayInputs(scenarioId: string, step: number, cursorSequence = 0): AttentionAnalysisInput[] {
  const scenario = findReplayScenario(scenarioId);
  if (!scenario || !Number.isInteger(step) || !scenario.steps[step]) throw new Error("Invalid replay scenario/step.");
  if (!Number.isInteger(cursorSequence) || cursorSequence < 0 || cursorSequence > step) throw new Error("Invalid starting knowledge.");
  const position=scenario.steps[step], baseline=scenario.steps[0], time=new Date(baseline.eventTime);
  // Materialize ONLY information available by this ingestion sequence.
  const snapshots=scenario.steps.filter(row=>row.sequence<=position.sequence).flatMap(row=>row.snapshots.map(snapshot=>({
    ...snapshot,id: scenarioId==="groww-delta-default" ? `snapshot:${row.sequence}:${snapshot.instrumentId}` : `snapshot:${scenarioId}:${row.sequence}:${snapshot.instrumentId}`,
    scenarioId,sequence:row.sequence,eventTime:new Date(Date.parse(row.eventTime)-(snapshot.delaySeconds??0)*1000),
    receivedTime:new Date(row.eventTime),source:"ReplayMarketProvider",quality:snapshot.quality??"FRESH" as const,
  })));
  const events=scenario.events.filter(event=>event.sequence<=position.sequence).map(event=>({...event,scenarioId,eventTime:new Date(event.eventTime),receivedTime:new Date(event.receivedTime??event.eventTime),source:"ReplayMarketProvider",quality:event.quality??"FRESH" as const,correctionOfId:event.correctionOfId??null}));
  const instruments=replayInstruments.map(instrument=>({...instrument,currency:"INR",isActive:true,kind:"EQUITY" as const,isWatchlistEligible:true}));
  const intents:WatchIntentRecord[]=seededIntents.map(intent=>({...intent,userId:"offline-reference",status:"ACTIVE",provenanceReference:null,version:1,effectiveFromSequence:0,resolvedAt:null,resolvedAtSequence:null,lifecycleReviewedThroughSequence:null,supersedesId:null,horizon:null,expiresAt:null,createdAt:time,updatedAt:time}));
  const draft=graphDraftFromTemplate(findDriverTemplate("AIRLINE_FUEL_COST","NSE:INDIGO"),["FUEL_COST","CRUDE"]);
  const graphId="offline:airline:1";
  const graph:WatchGraphRecord={id:graphId,logicalGraphId:"offline:airline",userId:"offline-reference",instrumentId:"NSE:INDIGO",watchIntentLogicalId:"intent:indigo:driver",version:1,status:"ACTIVE",provenance:"IMPORTED_DEMO",templateKey:"AIRLINE_FUEL_COST",effectiveFromSequence:0,supersedesId:null,createdAt:time,updatedAt:time,
    nodes:draft.nodes.map(node=>({...node,id:graphId+":"+node.nodeKey,graphId,metadata:node.metadata??{},createdAt:time})),
    edges:draft.edges.map((edge,index)=>({...edge,id:graphId+":"+index,graphId,fromNodeId:graphId+":"+edge.fromKey,toNodeId:graphId+":"+edge.toKey,createdAt:time})),
  };
  const context=deriveMarketContext(instruments,snapshots,0,position.sequence);
  const benchmark=snapshots.filter(row=>row.instrumentId===PRIMARY_BENCHMARK);
  const benchmarkBase=benchmark.filter(row=>row.sequence<=cursorSequence).at(-1)!;
  const benchmarkCurrent=benchmark.at(-1)!;
  return instruments.map(instrument=>({
    instrument,traceContext:{...scenarioIdentity(scenario),researchSessionId:"offline-reference"},
    cursor:{id:"offline:"+instrument.id,userId:"offline-reference",instrumentId:instrument.id,lastSeenSequence:cursorSequence,lastSeenEventTime:new Date(scenario.steps[cursorSequence].eventTime),lastObservedSnapshotId:snapshots.find(row=>row.sequence===cursorSequence&&row.instrumentId===instrument.id)?.id??null,cursorVersion:cursorSequence?2:1,createdAt:time,updatedAt:time},
    currentSequence:position.sequence,currentTime:new Date(position.eventTime),
    snapshots:snapshots.filter(row=>row.instrumentId===instrument.id),events:events.filter(event=>event.instrumentId===instrument.id||event.instrumentId===null),
    activeIntents:intents.filter(intent=>intent.instrumentId===instrument.id),activeGraphs:instrument.id===graph.instrumentId?[graph]:[],
    marketContext:context,benchmarkDeltaBps:calculatePriceDeltaBps(benchmarkBase.pricePaise,benchmarkCurrent.pricePaise),
  }));
}
export function replayStep(scenarioId:string, step:number, cursorSequence=0, policy:AttentionPolicy=REFERENCE_POLICY):AttentionItem[] {
  return replayInputs(scenarioId,step,cursorSequence).map(input=>{
    const result=analyzeInstrument(input,policy);
    if(!result) throw new Error("Analysis failed: missing baseline/current snapshots; this is not Quiet.");
    return result;
  }).sort((a,b)=>b.score-a.score||a.instrument.symbol.localeCompare(b.instrument.symbol));
}
