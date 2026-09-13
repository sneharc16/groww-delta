import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/client";
import { createAnonymousSession } from "../src/server/repositories/session-repository";
import { sessionTransaction } from "../src/server/repositories/session-transaction";
import { database, transactionDatabase, type Database } from "../src/server/repositories/database";
import { PrismaMarketSnapshotRepository } from "../src/server/repositories/prisma-repositories";
import { createServices } from "../src/server/container";

const owned = await createAnonymousSession();
const { id, userId, demoSessionId } = owned.session;
const syntheticScenario = "build5-db-audit-" + randomUUID();
const failureDb = (db: Database): Database => new Proxy(db, {
  get(target,key) {
    if(key==="knowledgeCursor") return new Proxy(target.knowledgeCursor, {
      get(delegate,method) { if(method==="upsert") return async()=>{ throw new Error("Injected cursor persistence failure"); }; return Reflect.get(delegate,method); }
    });
    return Reflect.get(target,key);
  }
});
const run = <T>(write: boolean, operation: (services: ReturnType<typeof createServices>)=>Promise<T>) =>
  sessionTransaction(id,write,tx=>operation(createServices(transactionDatabase(tx),demoSessionId)));
try {
  const baseline = await prisma.marketSnapshot.findFirstOrThrow({where:{scenarioId:"groww-delta-default",instrumentId:"NSE:TCS",sequence:0}});
  for(const version of ["1.0.0","2.0.0"]) await prisma.marketSnapshot.create({data:{...baseline,id:randomUUID(),scenarioId:syntheticScenario,scenarioVersion:version}});
  const isolated = await new PrismaMarketSnapshotRepository().listThroughSequence("NSE:TCS",0,syntheticScenario);
  assert.equal(isolated.length,1,"A query must not combine immutable replay versions");
  console.log("PASS: replay dataset version isolation");
  await assert.rejects(()=>prisma.marketEvent.updateMany({where:{id:"event:2:tcs:results"},data:{payload:{changed:true}}}));
  await assert.rejects(()=>prisma.marketSnapshot.update({where:{id:baseline.id},data:{pricePaise:baseline.pricePaise+1}}));
  const first=await run(false,s=>s.catchUp.getCatchUp(userId));
  const before=await prisma.knowledgeCursor.findMany({where:{userId}});
  const historyBefore=await prisma.knowledgeAcknowledgement.count({where:{userId}});
  await run(false,s=>s.catchUp.getCatchUp(userId));
  assert.deepEqual(await prisma.knowledgeCursor.findMany({where:{userId}}),before);
  assert.equal(await prisma.knowledgeAcknowledgement.count({where:{userId}}),historyBefore);
  assert.deepEqual(first.counts,{relevant:0,significant:0,quiet:5});
  const list=await run(false,s=>s.watchlist.getDefault(userId));
  const item=list.items.find(row=>row.instrument.id==="NSE:TCS")!;
  await run(true,s=>s.watchlist.remove(userId,item.id));
  // Reproduce the pre-Build-5 partial mutation using the uncoordinated service.
  await assert.rejects(()=>createServices(failureDb(database),demoSessionId).watchlist.add(userId,"NSE:TCS"));
  const partial=await prisma.watchlistItem.findFirstOrThrow({where:{watchlist:{userId},instrumentId:"NSE:TCS",archivedAt:null}});
  await run(true,s=>s.watchlist.remove(userId,partial.id));
  // Identical injected failure at the request transaction boundary must roll back.
  await assert.rejects(()=>sessionTransaction(id,true,tx=>createServices(failureDb(transactionDatabase(tx)),demoSessionId).watchlist.add(userId,"NSE:TCS")));
  assert.equal(await prisma.watchlistItem.count({where:{watchlist:{userId},instrumentId:"NSE:TCS",archivedAt:null}}),0);
  await run(true,s=>s.watchlist.add(userId,"NSE:TCS"));
  await run(true,s=>s.demo.advance()); await run(true,s=>s.demo.advance());
  await Promise.all([
    run(true,s=>s.catchUp.acknowledge(userId,{scope:"ALL",throughSequence:2})),
    run(true,s=>s.catchUp.acknowledge(userId,{instrumentIds:["NSE:TCS"],throughSequence:2}))
  ]);
  // The stale request arrives after the concurrent newer commands have completed.
  await run(true,s=>s.catchUp.acknowledge(userId,{instrumentIds:["NSE:TCS"],throughSequence:1}));
  assert.equal(await prisma.knowledgeAcknowledgement.count({where:{userId}}),5);
  assert((await prisma.knowledgeCursor.findMany({where:{userId}})).every(row=>row.lastSeenSequence===2));
  // A failure after complete renewal must roll back old status and new version together.
  await assert.rejects(()=>run(true,async s=>{await s.intentLifecycle.renew(userId,"intent:tcs:earnings",{});throw new Error("Injected post-renewal failure");}));
  const intents=await prisma.watchIntent.findMany({where:{userId,logicalIntentId:"intent:tcs:earnings"}});
  assert.equal(intents.length,1);assert.equal(intents[0].status,"ACTIVE");
  console.log("PASS: immutable market rows, GET zero knowledge writes, command rollback, parallel Mark All/Seen, renewal rollback");
} finally {
  // Only the records provisioned by this verification are removed.
  await prisma.corporateActionReview.deleteMany({where:{userId}});
  await prisma.watchGraphEdge.deleteMany({where:{graph:{userId}}});
  await prisma.watchGraphNode.deleteMany({where:{graph:{userId}}});
  await prisma.watchGraph.deleteMany({where:{userId}});
  await prisma.watchIntent.deleteMany({where:{userId}});
  await prisma.knowledgeAcknowledgement.deleteMany({where:{userId}});
  await prisma.knowledgeCursor.deleteMany({where:{userId}});
  await prisma.watchlistItem.deleteMany({where:{watchlist:{userId}}});
  await prisma.watchlist.deleteMany({where:{userId}});
  await prisma.anonymousSession.delete({where:{id}});
  await prisma.demoSession.delete({where:{id:demoSessionId}});
  await prisma.user.delete({where:{id:userId}});
  await prisma.marketSnapshot.deleteMany({where:{scenarioId:syntheticScenario}});
  await prisma.$disconnect();
}
