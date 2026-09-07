import "dotenv/config";
import assert from "node:assert/strict";
import { services } from "../src/server/container";
import { prisma } from "../src/lib/db/client";
import type { CatchUpDto } from "../src/server/dto/types";

const user = "demo-user";
const observe = () => services.catchUp.getCatchUp(user);
const advance = async (count = 1) => { for (let i = 0; i < count; i++) await services.demo.advance(); };
function counts(label: string, result: CatchUpDto, expected: number[]) {
  const actual = [result.counts.relevant, result.counts.significant, result.counts.quiet];
  assert.deepEqual(actual, expected, label);
  console.log(label, actual.join("/"));
}
let restoreLevel = false;
try {
  await services.demo.switchScenario("groww-delta-default", user);
  counts("Default Step 0", await observe(), [0,0,5]);
  await advance(); counts("Default Step 1", await observe(), [0,0,5]);
  await advance(); counts("Default Step 2", await observe(), [4,1,0]);
  await services.catchUp.acknowledge(user, { scope: "ALL", throughSequence: 2 });
  counts("Default acknowledged", await observe(), [0,0,5]);
  await advance(); counts("Default Step 3", await observe(), [0,0,5]);
  await advance();
  const contextual = await observe();
  counts("Default Step 4", contextual, [1,0,4]);
  const indigo = contextual.relevant[0];
  assert.equal(indigo.relevance, 85); assert.equal(indigo.priceSignificance, 0);
  assert.equal(indigo.matchedIntents[0].matchType, "GRAPH");
  console.log("Step 4", { path: indigo.display.connectionPath, relevance: indigo.relevance, priceSignificance: indigo.priceSignificance, direct: indigo.matchedIntents.some(match => match.matchType === "DIRECT") });

  await services.demo.switchScenario("data-quality", user);
  await advance();
  const stale = await observe();
  assert.equal(stale.relevant.length, 0);
  assert(stale.trustNotices.some(notice => notice.type === "STALE_FEED"));
  await advance();
  assert((await observe()).relevant.some(item => item.instrument.symbol === "HDFCBANK"));
  await advance();
  assert((await observe()).trustNotices.some(notice => notice.type === "CONFLICTING_DATA"));
  await advance();
  const delayed = (await observe()).relevant.find(item => item.instrument.symbol === "HDFCBANK")!;
  assert.equal(delayed.trust.delaySeconds, 45); assert.equal(delayed.confidence, 70);
  await advance();
  await services.catchUp.acknowledge(user, { instrumentIds: ["NSE:TCS"], throughSequence: 5 });
  await advance();
  const corrected = await observe();
  assert(corrected.trustNotices.some(notice => notice.type === "CORRECTED_INFORMATION"));
  assert(!corrected.relevant.some(item => item.instrument.symbol === "TCS"));
  console.log("Data Quality: stale withheld; fresh HDFC confirmed; conflict withheld; delayed 45 sec/confidence 70; seen correction notice 2480 → 2410.");
  await services.demo.reset(user); await advance(6);
  const unseen = (await observe()).relevant.find(item => item.instrument.symbol === "TCS")!;
  assert.equal(unseen.eventSummaries.length, 1);
  assert.deepEqual((unseen.eventSummaries[0].payload as { operatingMarginBps: number }).operatingMarginBps, 2410);
  console.log("Unseen correction: one corrected interpretation.");

  await services.demo.switchScenario("market-shock", user); await advance();
  const shock = await observe();
  assert.equal(shock.marketContext?.benchmarkDeltaBps, -400);
  assert.equal(shock.marketContext?.breadth, 1);
  assert.equal(shock.groupedMarketMoves.length, 4);
  assert.deepEqual(shock.relevant.map(item => item.instrument.symbol), ["HDFCBANK"]);
  console.log("Shock Step 1", shock.marketContext);
  await advance();
  const residual = (await observe()).significant.find(item => item.instrument.symbol === "RELIANCE")!;
  assert(residual.marketAdjustedDeltaBps! >= 200);
  console.log("Shock Step 2: RELIANCE residual bps", residual.marketAdjustedDeltaBps);

  await services.demo.switchScenario("corporate-action", user); await advance();
  const split = await observe();
  assert(!split.relevant.some(item => item.instrument.symbol === "HDFCBANK"));
  const review = split.trustNotices.find(notice => notice.type === "CORPORATE_ACTION_REVIEW")!;
  assert.equal(review.action?.originalTargetPaise, 155000); assert.equal(review.action.adjustedTargetPaise, 77500);
  const previous = (await services.watchIntents.list(user, "NSE:HDFCBANK")).find(intent => intent.status === "ACTIVE")!;
  await services.corporateActions.decide(user, previous.logicalIntentId, { eventId: review.action.eventId, decision: "ADJUST" });
  restoreLevel = true;
  const next = (await services.watchIntents.list(user, "NSE:HDFCBANK")).find(intent => intent.status === "ACTIVE")!;
  assert.equal(next.version, previous.version + 1);
  assert.equal((next.structuredPayload as { targetPricePaise: number }).targetPricePaise, 77500);
  assert.equal((await observe()).relevant.length, 0);
  console.log("Corporate action: 155000 paise, 1:2, 77500 paise; no false hit; version", previous.version, "→", next.version);
} finally {
  await services.demo.switchScenario("groww-delta-default", user);
  if (restoreLevel) await services.watchIntents.edit(user, "intent:hdfcbank:price", {
    type: "PRICE_LEVEL", originalText: "Watching near ₹1,550",
    structuredPayload: { targetPricePaise: 155000, mode: "NEAR", proximityBps: 100 }, provenanceSource: "MANUAL",
  });
  await prisma.$disconnect();
}
