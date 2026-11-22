import { performance } from "node:perf_hooks";
import { replayInputs } from "../replay";
import { analyzeInstrument } from "../../src/domain/attention/analyze-instrument";
import type { AttentionAnalysisInput } from "../../src/domain/attention/types";
export function syntheticInputs(count:number):AttentionAnalysisInput[] {
  if(!Number.isInteger(count)||count<1||count>5000)throw new Error("Scale must be an integer from 1 to 5000.");
  const templates=replayInputs("groww-delta-default",4,2);
  return Array.from({length:count},(_,index)=>{
    const original=templates[index%templates.length],id="SYNTH:"+String(index).padStart(5,"0");
    const intentIds=new Map(original.activeIntents.map(intent=>[intent.logicalIntentId,id+":"+intent.logicalIntentId]));
    return {...original,instrument:{...original.instrument,id,symbol:id,name:"Synthetic "+index},
      cursor:{...original.cursor,instrumentId:id},
      snapshots:original.snapshots.map(snapshot=>({...snapshot,id:id+":"+snapshot.sequence,instrumentId:id})),
      events:original.events.map(event=>({...event,id:id+":"+event.id,instrumentId:event.instrumentId?id:null,correctionOfId:event.correctionOfId?id+":"+event.correctionOfId:null})),
      activeIntents:original.activeIntents.map(intent=>({...intent,instrumentId:id,logicalIntentId:intentIds.get(intent.logicalIntentId)!})),
      activeGraphs:original.activeGraphs.map(graph=>({...graph,instrumentId:id,watchIntentLogicalId:intentIds.get(graph.watchIntentLogicalId)!,
        nodes:graph.nodes.map(node=>node.type==="INSTRUMENT"?{...node,nodeKey:id,label:"Synthetic "+index}:node)})),
    };
  });
}
export function percentile(sorted:number[],fraction:number) {
  if(!sorted.length)throw new Error("No samples.");
  return sorted[Math.min(sorted.length-1,Math.ceil(fraction*sorted.length)-1)];
}
export function benchmark(count:number,samples=20) {
  const inputs=syntheticInputs(count);
  for(let warmup=0;warmup<3;warmup++) inputs.forEach(input=>analyzeInstrument(input));
  const durations:number[]=[], heapBefore=process.memoryUsage();
  let graphNodesVisited=0,eventObservations=0;
  for(let sample=0;sample<samples;sample++) {
    const start=performance.now();
    const results=inputs.map(input=>analyzeInstrument(input));
    durations.push(performance.now()-start);
    if(results.some(item=>!item))throw new Error("Benchmark analysis failed.");
    graphNodesVisited=results.reduce((sum,item)=>sum+(item?.decisionTrace.graphNodesVisited??0),0);
    eventObservations=inputs.reduce((sum,input)=>sum+input.events.length,0);
  }
  durations.sort((a,b)=>a-b);
  const memory=process.memoryUsage(),p50=percentile(durations,.5);
  return {instruments:count,samples,eventObservations,snapshotObservations:inputs.reduce((sum,input)=>sum+input.snapshots.length,0),
    p50Ms:p50,p95Ms:percentile(durations,.95),p99Ms:samples>=100?percentile(durations,.99):null,perInstrumentP50Ms:p50/count,
    eventsPerSecond:eventObservations/(p50/1000),graphNodesVisited,databaseQueries:0,
    rssBytes:memory.rss,heapUsedBytes:memory.heapUsed,heapDeltaBytes:memory.heapUsed-heapBefore.heapUsed,
    rawSamplesMs:durations};
}
