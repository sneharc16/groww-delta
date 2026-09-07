import { describe, expect, it } from "vitest";
import { resilienceSetup } from "../../../tests/helpers/resilience";
import { InstrumentService } from "./instrument-service";
import { WatchlistService } from "./watchlist-service";
import { MemoryInstrumentRepository, testInstrument } from "../../../tests/helpers/in-memory";

const user="demo-user";
describe("Build 4 deterministic resilience scenarios",()=>{
  it("preserves the entire default regression including graph-only Step 4",async()=>{
    const s=resilienceSetup("groww-delta-default");
    expect((await s.catchUp.getCatchUp(user)).counts).toEqual({relevant:0,significant:0,quiet:5});
    await s.advanceTo(1); expect((await s.catchUp.getCatchUp(user)).counts).toEqual({relevant:0,significant:0,quiet:5});
    await s.advanceTo(2); expect((await s.catchUp.getCatchUp(user)).counts).toEqual({relevant:4,significant:1,quiet:0});
    await s.catchUp.acknowledge(user,{scope:"ALL",throughSequence:2});
    expect((await s.catchUp.getCatchUp(user)).counts).toEqual({relevant:0,significant:0,quiet:5});
    await s.advanceTo(3); expect((await s.catchUp.getCatchUp(user)).counts).toEqual({relevant:0,significant:0,quiet:5});
    await s.advanceTo(4);
    const result=await s.catchUp.getCatchUp(user);
    expect(result.counts).toEqual({relevant:1,significant:0,quiet:4});
    expect(result.relevant[0]).toMatchObject({relevance:85,priceSignificance:0});
    expect(result.relevant[0].matchedIntents[0].matchType).toBe("GRAPH");
  });
  it("shows stale notice without relevance, then confirms fresh HDFC from the last trusted baseline",async()=>{
    const s=resilienceSetup("data-quality");
    await s.advanceTo(1);
    const stale=await s.catchUp.getCatchUp(user);
    expect(stale.relevant.find(item=>item.instrument.symbol==="HDFCBANK")).toBeUndefined();
    expect(stale.trustNotices.some(notice=>notice.type==="STALE_FEED")).toBe(true);
    expect(stale.quiet.find(item=>item.instrument.symbol==="HDFCBANK")?.conditionAssessments[0]).toMatchObject({conditionCandidate:true,conditionConfirmed:false,reasonCodes:["PRICE_CONDITION_UNCONFIRMED_STALE_DATA"]});
    await s.advanceTo(2);
    const fresh=await s.catchUp.getCatchUp(user);
    expect(fresh.relevant.find(item=>item.instrument.symbol==="HDFCBANK")?.reasonCodes).toContain("PRICE_TARGET_NEAR_ENTERED");
  });
  it("withholds conflicting Tata data and preserves its last confirmed display value",async()=>{
    const s=resilienceSetup("data-quality"); await s.advanceTo(3);
    const result=await s.catchUp.getCatchUp(user);
    expect(result.relevant.find(item=>item.instrument.symbol==="TATAMOTORS")).toBeUndefined();
    expect(result.significant.find(item=>item.instrument.symbol==="TATAMOTORS")).toBeUndefined();
    expect(result.trustNotices.find(notice=>notice.type==="CONFLICTING_DATA")?.metadata.confirmedPricePaise).toBe(99500);
  });
  it("shows a 45-second delayed quote and reduced confidence",async()=>{
    const s=resilienceSetup("data-quality"); await s.advanceTo(4);
    const result=await s.catchUp.getCatchUp(user);
    const hdfc=result.relevant.find(item=>item.instrument.symbol==="HDFCBANK")!;
    expect(hdfc.trust.label).toBe("Delayed by 45 sec"); expect(hdfc.confidence).toBe(70);
  });
  it("shows a seen correction as a Trust Notice without repeating the original card",async()=>{
    const s=resilienceSetup("data-quality"); await s.advanceTo(5);
    await s.catchUp.acknowledge(user,{instrumentIds:["NSE:TCS"],throughSequence:5});
    await s.advanceTo(6);
    const result=await s.catchUp.getCatchUp(user);
    const notice=result.trustNotices.find(notice=>notice.type==="CORRECTED_INFORMATION")!;
    expect(notice.message).toContain("2480 → 2410");
    expect(result.relevant.find(item=>item.instrument.symbol==="TCS")).toBeUndefined();
    expect(s.cursors.rows.find(row=>row.instrumentId==="NSE:TCS")?.lastSeenSequence).toBe(5);
    await s.catchUp.acknowledge(user,{instrumentIds:["NSE:TCS"],throughSequence:6});
    expect((await s.catchUp.getCatchUp(user)).trustNotices.some(notice=>notice.type==="CORRECTED_INFORMATION")).toBe(false);
  });
  it("shows only corrected interpretation when the original was never acknowledged",async()=>{
    const s=resilienceSetup("data-quality"); await s.advanceTo(6);
    const result=await s.catchUp.getCatchUp(user);
    const tcs=result.relevant.find(item=>item.instrument.symbol==="TCS")!;
    expect(tcs.eventSummaries).toHaveLength(1);
    expect(tcs.eventSummaries[0].payload).toMatchObject({operatingMarginBps:2410});
    expect(result.trustNotices.some(notice=>notice.type==="CORRECTED_INFORMATION")).toBe(false);
  });
  it("groups four broad market moves while preserving HDFC's explicit price watch",async()=>{
    const s=resilienceSetup("market-shock"); await s.advanceTo(1);
    const result=await s.catchUp.getCatchUp(user);
    expect(result.marketContext).toMatchObject({calmModeActive:true,benchmarkDeltaBps:-400,breadth:1,groupedInstrumentCount:4});
    expect(result.relevant.map(item=>item.instrument.symbol)).toEqual(["HDFCBANK"]);
    expect(result.significant).toHaveLength(0);
    expect(result.groupedMarketMoves).toHaveLength(4);
  });
  it("surfaces Reliance's idiosyncratic benchmark residual during Calm Mode",async()=>{
    const s=resilienceSetup("market-shock"); await s.advanceTo(2);
    const result=await s.catchUp.getCatchUp(user);
    const reliance=result.significant.find(item=>item.instrument.symbol==="RELIANCE")!;
    expect(reliance.marketAdjustedDeltaBps).toBeGreaterThan(200);
    expect(reliance.reasonCodes).toContain("MARKET_RELATIVE_MOVE");
    expect(result.marketContext?.calmModeActive).toBe(true);
  });
  it("creates split review with no false target event or mechanical price significance",async()=>{
    const s=resilienceSetup("corporate-action"); await s.advanceTo(1);
    const result=await s.catchUp.getCatchUp(user);
    expect(result.relevant.find(item=>item.instrument.symbol==="HDFCBANK")).toBeUndefined();
    const hdfc=[...result.quiet,...result.significant].find(item=>item.instrument.symbol==="HDFCBANK")!;
    expect(hdfc.priceSignificance).toBe(0);
    expect(hdfc.reasonCodes).not.toContain("PRICE_TARGET_CROSSED_BELOW");
    expect(result.trustNotices[0].action).toMatchObject({originalTargetPaise:155000,adjustedTargetPaise:77500});
  });
  it("does not recommend a level adjustment from an untrusted split or score its mechanical jump", async () => {
    const s=resilienceSetup("corporate-action");
    s.events.find(event=>event.id==="corporate-action:split:1")!.quality="CONFLICTING";
    await s.advanceTo(1);
    const result=await s.catchUp.getCatchUp(user);
    expect(result.trustNotices.some(notice=>notice.type==="CORPORATE_ACTION_REVIEW")).toBe(false);
    expect(result.significant).toHaveLength(0);
    await expect(s.corporate.decide(user,"hdfc",{eventId:"corporate-action:split:1",decision:"ADJUST"})).rejects.toMatchObject({code:"CORPORATE_ACTION_REVIEW_REQUIRED"});
  });
  it("adjusts through a new intent version, preserves old meaning, and cannot retro-trigger",async()=>{
    const s=resilienceSetup("corporate-action"); await s.advanceTo(1);
    await s.corporate.decide(user,"hdfc",{eventId:"corporate-action:split:1",decision:"ADJUST"});
    expect(s.intents.rows.find(row=>row.id==="hdfc")).toMatchObject({status:"SUPERSEDED",structuredPayload:{targetPricePaise:155000}});
    const active=await s.intents.findCurrent(user,"hdfc");
    expect(active).toMatchObject({version:2,effectiveFromSequence:1,structuredPayload:{targetPricePaise:77500}});
    expect((await s.catchUp.getCatchUp(user)).relevant.find(item=>item.instrument.symbol==="HDFCBANK")).toBeUndefined();
    expect(s.reviews.rows[0].resultingIntentId).toBe(active?.id);
    expect(s.intents.rows.find(row=>row.id==="tcs")?.status).toBe("ACTIVE");
  });
  it("keeping the original level prevents repeat review without changing the threshold",async()=>{
    const s=resilienceSetup("corporate-action"); await s.advanceTo(1);
    await s.corporate.decide(user,"hdfc",{eventId:"corporate-action:split:1",decision:"KEEP"});
    expect((await s.catchUp.getCatchUp(user)).trustNotices.filter(notice=>notice.type==="CORPORATE_ACTION_REVIEW")).toHaveLength(0);
    expect((await s.intents.findCurrent(user,"hdfc"))?.structuredPayload).toMatchObject({targetPricePaise:155000});
  });
  it("review later remains advisory and can subsequently be adjusted",async()=>{
    const s=resilienceSetup("corporate-action"); await s.advanceTo(1);
    await s.corporate.decide(user,"hdfc",{eventId:"corporate-action:split:1",decision:"LATER"});
    expect((await s.catchUp.getCatchUp(user)).trustNotices[0].action?.decision).toBe("LATER");
    await s.corporate.decide(user,"hdfc",{eventId:"corporate-action:split:1",decision:"ADJUST"});
    expect(s.reviews.rows).toHaveLength(1);
    expect(s.reviews.rows[0].decision).toBe("ADJUST");
  });
  it("rejects unowned intents and arbitrary corporate event references",async()=>{
    const s=resilienceSetup("corporate-action"); await s.advanceTo(1);
    await expect(s.corporate.decide("other-user","hdfc",{eventId:"corporate-action:split:1",decision:"ADJUST"})).rejects.toMatchObject({code:"WATCH_INTENT_NOT_FOUND"});
    await expect(s.corporate.decide(user,"hdfc",{eventId:"forged",decision:"ADJUST"})).rejects.toMatchObject({code:"CORPORATE_ACTION_REVIEW_REQUIRED"});
  });
  it("preserves last available data and prevents unseen sequence acknowledgement during an outage",async()=>{
    const s=resilienceSetup("data-quality"); await s.advanceTo(1);
    await s.provider.setProviderStatus("UNAVAILABLE"); await s.advanceTo(2);
    const result=await s.catchUp.getCatchUp(user);
    expect(result.providerHealth.status).toBe("UNAVAILABLE");
    expect(result.trustNotices.some(notice=>notice.type==="PROVIDER_UNAVAILABLE")).toBe(true);
    expect((await s.provider.getCurrentSnapshot("NSE:TCS"))?.sequence).toBe(1);
    expect(result.relevant).toHaveLength(0);
    await expect(s.catchUp.acknowledge(user,{scope:"ALL",throughSequence:2})).rejects.toMatchObject({code:"PROVIDER_UNAVAILABLE"});
    await s.provider.setProviderStatus("HEALTHY");
    expect((await s.catchUp.getCatchUp(user)).relevant.some(item=>item.instrument.symbol==="HDFCBANK")).toBe(true);
  });
  it("switches scenario persistently and preserves user configuration",async()=>{
    const s=resilienceSetup("groww-delta-default");
    const before=structuredClone(s.intents.rows);
    await s.advanceTo(2);
    await s.catchUp.acknowledge(user,{scope:"ALL",throughSequence:2});
    await s.provider.switchScenario("market-shock",user);
    expect((await s.provider.getDemoState())?.position.scenarioId).toBe("market-shock");
    expect(s.intents.rows).toEqual(before);
    expect(s.cursors.rows.every(row=>row.lastSeenSequence===0)).toBe(true);
    expect(s.graphs.rows).toHaveLength(1);
    await expect(s.provider.switchScenario("../../etc/passwd",user)).rejects.toMatchObject({code:"INVALID_SCENARIO"});
  });
  it("excludes Nifty from add-stock choices and rejects index additions",async()=>{
    const s=resilienceSetup("market-shock");
    const instruments=new MemoryInstrumentRepository([testInstrument,{...testInstrument,id:"NSE:NIFTY50",kind:"INDEX",isWatchlistEligible:false}]);
    expect((await new InstrumentService(instruments).listAvailable()).map(row=>row.id)).toEqual(["NSE:TCS"]);
    const watchlist=new WatchlistService(s.watchlists,instruments,s.intents,s.provider,s.cursors);
    await expect(watchlist.add(user,"NSE:NIFTY50")).rejects.toMatchObject({code:"INSTRUMENT_NOT_FOUND"});
  });
});
