import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {prisma} from "../src/lib/db/client";
import {createAnonymousSession} from "../src/server/repositories/session-repository";
import {sessionTransaction} from "../src/server/repositories/session-transaction";
import {transactionDatabase} from "../src/server/repositories/database";
import {createServices} from "../src/server/container";
import {measureDatabase} from "../src/server/observability/database-metrics";
import {executionIdentity} from "../research/execution";
const {session}=await createAnonymousSession();
const {id,userId,demoSessionId}=session;
const samples=[];
try {
  for(let i=0;i<23;i++){
    const measured=await measureDatabase(()=>sessionTransaction(id,false,tx=>createServices(transactionDatabase(tx),demoSessionId).catchUp.getCatchUp(userId)));
    if(i>=3)samples.push(measured.metrics);
  }
  const lifecycleRun = () => measureDatabase(()=>sessionTransaction(id,false,tx=>createServices(transactionDatabase(tx),demoSessionId).intentLifecycle.getInstrument(userId,"NSE:TCS")));
  const oneIntent = await lifecycleRun();
  const template = await prisma.watchIntent.findFirstOrThrow({where:{userId,instrumentId:"NSE:TCS"}});
  await prisma.watchIntent.createMany({data:Array.from({length:9},(_,i)=>({...template,id:randomUUID(),logicalIntentId:"benchmark-reason-"+i,type:"GENERAL",structuredPayload:{note:"Deterministic scale input"}}))});
  const tenIntents = await lifecycleRun();
  assert(tenIntents.metrics.queryCount <= oneIntent.metrics.queryCount + 2, "Graph history must be batch-loaded: queries grew from "+oneIntent.metrics.queryCount+" to "+tenIntents.metrics.queryCount);
  const latencies=samples.map(row=>row.latencyMs).sort((a,b)=>a-b);
  const report={...executionIdentity(),executionTimestamp:new Date().toISOString(),instrumentCount:5,sampleCount:samples.length,
    measured:"PostgreSQL-backed Catch Up including read transaction, queries, domain analysis and trace; no HTTP transport",
    lifecycle:{oneIntent:oneIntent.metrics,tenIntents:tenIntents.metrics},p50Ms:latencies[9],p95Ms:latencies[18],p99Ms:null,queryCounts:samples.map(row=>row.queryCount),samples};
  console.log(JSON.stringify(report));
  await mkdir("research/benchmarks/results",{recursive:true});
  await writeFile("research/benchmarks/results/database.json",JSON.stringify(report,null,2)+"\n");
} finally {
  await prisma.watchGraphEdge.deleteMany({where:{graph:{userId}}});
  await prisma.watchGraphNode.deleteMany({where:{graph:{userId}}});
  await prisma.watchGraph.deleteMany({where:{userId}});
  await prisma.watchIntent.deleteMany({where:{userId}});
  await prisma.knowledgeCursor.deleteMany({where:{userId}});
  await prisma.watchlistItem.deleteMany({where:{watchlist:{userId}}});
  await prisma.watchlist.deleteMany({where:{userId}});
  await prisma.anonymousSession.delete({where:{id}});
  await prisma.demoSession.delete({where:{id:demoSessionId}});
  await prisma.user.delete({where:{id:userId}});
  await prisma.$disconnect();
}
