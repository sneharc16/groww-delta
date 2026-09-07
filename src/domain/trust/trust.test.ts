import { describe, expect, it } from "vitest";
import { canConfirmPrice, assessData } from "./freshness";
import { normalizeEvents, resolveCorrections, seenCorrectionAncestor } from "./events";
import { correctionNotices } from "./notices";
import { inReplayEnvironment } from "@/domain/market/effective-sequence";
import { adjustedTarget } from "./corporate-actions";
import { matchIntents } from "@/domain/attention/intent-matchers";
import { analyzeInstrument } from "@/domain/attention/analyze-instrument";
import { deriveMarketContext } from "@/domain/market/context";
import { cursorRecord, intentRecord, testInstrument } from "../../../tests/helpers/in-memory";
import { resilienceSetup } from "../../../tests/helpers/resilience";
import type { MarketEventRecord, MarketQuality, MarketSnapshotRecord } from "@/domain/market/types";

const time = new Date("2025-08-14T04:30:00Z");
function snapshot(sequence: number, pricePaise: number, quality: MarketQuality = "FRESH", delay = 0): MarketSnapshotRecord {
  return { id: `snapshot-${sequence}`, instrumentId: "NSE:TCS", sequence, eventTime: new Date(time.getTime() + sequence * 60000),
    receivedTime: new Date(time.getTime() + sequence * 60000 + delay * 1000), pricePaise, openPaise: 158000, highPaise: 158000, lowPaise: 155000,
    cumulativeVolume: 100n, expectedCumulativeVolume: 100n, expectedStepMoveBps: 100, source: "test", quality };
}
function priceMatches(rows: MarketSnapshotRecord[], mode: "NEAR" | "ABOVE" | "BELOW" = "NEAR", events: MarketEventRecord[] = [], cursorSequence = 0) {
  return matchIntents({ intents: [intentRecord({ type: "PRICE_LEVEL", structuredPayload: { targetPricePaise: 155000, mode, proximityBps: 100 } })],
    snapshots: rows, events, cursorSequence, currentSequence: rows.at(-1)!.sequence });
}
const baseEvent: MarketEventRecord = { id: "original", sequence: 1, instrumentId: "NSE:TCS", type: "RESULTS_PUBLISHED",
  eventTime: time, receivedTime: time, quality: "FRESH", source: "test", subjectType: "EVENT_CATEGORY", subjectKey: "EARNINGS", tags: ["MARGINS"],
  payload: { quarterLabel: "Q2", focus: ["MARGINS"], operatingMarginBps: 2480 }, correctionOfId: null };

describe("trusted condition state", () => {
  it.each([["FRESH",0,true],["STALE",0,false],["CONFLICTING",0,false],["DELAYED",45,true],["DELAYED",60,true],["DELAYED",61,false],["CORRECTED",0,true]] as const)("%s delayed %i seconds confirms: %s", (quality, delay, allowed) => {
    const current = snapshot(1,156000,quality,delay);
    expect(canConfirmPrice(current)).toBe(allowed);
    expect(priceMatches([snapshot(0,158000), current]).length > 0).toBe(allowed);
  });
  it.each(["STALE","CONFLICTING"] as const)("%s intermediate values do not poison later fresh entry even after acknowledging the untrusted step", (quality) => {
    const rows = [snapshot(0,158000), snapshot(1,156000,quality), snapshot(2,155800)];
    expect(priceMatches(rows)).toHaveLength(1);
    expect(priceMatches(rows, "NEAR", [], 1)).toHaveLength(1);
  });
  it("does not retrigger after a trusted entry is acknowledged", () => {
    expect(priceMatches([snapshot(0,158000),snapshot(1,156000),snapshot(2,155800)], "NEAR", [], 1)).toHaveLength(0);
  });
  it("requires an explicit timestamp for delayed confirmation", () => {
    expect(canConfirmPrice({ ...snapshot(1,156000,"DELAYED"), receivedTime: null })).toBe(false);
  });
  it("retains actual observation and receipt timestamps with the delay label", () => {
    const current = snapshot(1,156000,"DELAYED",45);
    expect(assessData(current,current.receivedTime!)).toMatchObject({ label: "Delayed by 45 sec", delaySeconds: 45, eventTime: current.eventTime.toISOString() });
  });
});

describe("event integrity and correction semantics", () => {
  it("deduplicates identical stable IDs", () => expect(normalizeEvents([baseEvent, structuredClone(baseEvent)])).toHaveLength(1));
  it("rejects conflicting immutable payloads for one ID", () => {
    expect(() => normalizeEvents([baseEvent,{...baseEvent,payload:{different:true}}])).toThrowError(expect.objectContaining({code:"EVENT_INTEGRITY_CONFLICT"}));
  });
  it("normalizes order by sequence, then actual time, then stable ID", () => {
    expect(normalizeEvents([{...baseEvent,id:"b",sequence:2},{...baseEvent,id:"a",sequence:2},baseEvent]).map((event)=>event.id)).toEqual(["original","a","b"]);
  });
  it("keeps late arrivals new by sequence and retains their earlier occurrence time", () => {
    const late = {...baseEvent, sequence:8, eventTime: time, receivedTime: new Date(time.getTime()+420000)};
    const item = analyzeInstrument({ instrument:testInstrument,cursor:cursorRecord({lastSeenSequence:7}),currentSequence:8,currentTime:late.receivedTime,
      snapshots:[snapshot(7,320000),snapshot(8,320000)], events:[late],activeIntents:[intentRecord()],activeGraphs:[] })!;
    expect(item.lane).toBe("RELEVANT");
    expect(item.eventSummaries[0].eventTime).toEqual(time);
  });
  it("replaces unseen original interpretation while preserving both immutable records", () => {
    const correction = {...baseEvent,id:"correction",sequence:2,quality:"CORRECTED" as const,correctionOfId:baseEvent.id,payload:{...baseEvent.payload as object,operatingMarginBps:2410}};
    const originalCopy=structuredClone(baseEvent);
    const resolved=resolveCorrections([correction,baseEvent]);
    expect(resolved.current).toEqual([correction]);
    expect(resolved.all).toHaveLength(2);
    expect(baseEvent).toEqual(originalCopy);
    expect(correction.correctionOfId).toBe(baseEvent.id);
  });
  it.each(["missing","self","later"])("rejects %s correction references", (kind) => {
    const correction={...baseEvent,id:"c",sequence:2,correctionOfId:kind==="self"?"c":kind==="later"?"future":"missing"};
    expect(()=>resolveCorrections([baseEvent,correction,{...baseEvent,id:"future",sequence:3}])).toThrowError(expect.objectContaining({code:"INVALID_CORRECTION_REFERENCE"}));
  });
  it("notices a corrected chain when the user saw the root but not the intermediate revision", () => {
    const middle = { ...baseEvent, id: "middle", sequence: 2, correctionOfId: baseEvent.id };
    const newest = { ...baseEvent, id: "newest", sequence: 3, correctionOfId: middle.id, payload: { operatingMarginBps: 2410 } };
    const resolved = resolveCorrections([newest, middle, baseEvent]);
    expect(seenCorrectionAncestor(newest, resolved.byId, 1)?.id).toBe(baseEvent.id);
    expect(correctionNotices(resolved.current, resolved.byId, 1, "Company")[0].message).toContain("2480 → 2410");
  });
  it("keeps intent/event and graph relevance active during Calm Mode", () => {
    const setup = resilienceSetup("groww-delta-default");
    for (const index of [0, 3]) {
      const instrument = setup.instruments[index];
      const rows = setup.snapshots.filter((row) => row.scenarioId === "groww-delta-default" && row.instrumentId === instrument.id);
      const item = analyzeInstrument({ instrument, cursor: cursorRecord({ instrumentId: instrument.id, lastSeenSequence: index === 0 ? 0 : 2 }),
        currentSequence: 4, currentTime: time, snapshots: rows, events: setup.events.filter((event) => event.scenarioId === "groww-delta-default" && (event.instrumentId === instrument.id || event.instrumentId === null)),
        activeIntents: [setup.intents.rows[index]], activeGraphs: index === 3 ? setup.graphs.rows : [],
        marketContext: { calmModeActive: true, benchmark: { instrumentId: "NSE:NIFTY50", name: "Nifty 50", currentPricePaise: 2400000 }, benchmarkDeltaBps: -400, breadth: 1, medianAbsMoveBps: 400, equityCount: 5, sameDirectionCount: 5, groupedInstrumentCount: 0, summary: "" },
      })!;
      expect(item.lane).toBe("RELEVANT");
      expect(item.relevance).toBe(index === 0 ? 100 : 85);
    }
  });
  it("does not reinterpret earlier events until an explicit replay reset creates a new run", () => {
    const record = intentRecord({ effectiveFromSequence: 4, effectiveScenarioId: "data-quality", effectiveDemoGeneration: 2 });
    expect(inReplayEnvironment(record, "data-quality", 2).effectiveFromSequence).toBe(4);
    expect(inReplayEnvironment(record, "data-quality", 3).effectiveFromSequence).toBe(0);
    expect(record.effectiveFromSequence).toBe(4);
  });
  it.each(["STALE","CONFLICTING"] as const)("withholds %s technical and graph events", (quality) => {
    const setup=resilienceSetup("groww-delta-default");
    const event={...setup.events.find((event)=>event.id==="event:4:external:crude")!,quality};
    const item=analyzeInstrument({instrument:setup.instruments[3],cursor:cursorRecord({instrumentId:"NSE:INDIGO",lastSeenSequence:2}),currentSequence:4,currentTime:new Date(), snapshots:setup.snapshots.filter((row)=>row.scenarioId==="groww-delta-default"&&row.instrumentId==="NSE:INDIGO"),events:[event],activeIntents:[setup.intents.rows[3]],activeGraphs:setup.graphs.rows})!;
    expect(item.relevance).toBe(0);
    expect(item.trustNotices.some(notice => notice.reasonCodes.includes("EVENT_WITHHELD_LOW_TRUST"))).toBe(true);
    expect(matchIntents({intents:[setup.intents.rows[2]], snapshots:[],events:[{...baseEvent,type:"TECHNICAL_TRANSITION",quality,payload:{setup:"BREAKOUT",referenceLevelPaise:100000}}],cursorSequence:0,currentSequence:1})).toHaveLength(0);
  });
  it("reduces confidence for delayed relevant events", () => {
    const item=analyzeInstrument({instrument:testInstrument,cursor:cursorRecord(),currentSequence:1,currentTime:time,snapshots:[snapshot(0,320000),snapshot(1,320000)],events:[{...baseEvent,quality:"DELAYED"}],activeIntents:[intentRecord()],activeGraphs:[]})!;
    expect(item.relevance).toBe(100); expect(item.confidence).toBe(70);
    expect(item.trust.level).toBe("DELAYED");
  });
});

describe("corporate action reference frame", () => {
  it("calculates a 1:2 split-equivalent target in integer paise",()=>expect(adjustedTarget(155000,1,2)).toBe(77500));
  it("rounds half-paise up explicitly",()=>expect(adjustedTarget(155001,1,2)).toBe(77501));
  it.each([0,-1,1.5])("rejects invalid split denominator %s",(ratio)=>expect(()=>adjustedTarget(155000,1,ratio)).toThrow());
  it.each(["NEAR","BELOW"] as const)("blocks mechanical %s crossings",mode=>{
    const split={...baseEvent,type:"CORPORATE_EVENT" as const,payload:{eventKind:"STOCK_SPLIT",oldShares:1,newShares:2}};
    expect(priceMatches([snapshot(0,158000),snapshot(1,79000)],mode,[split])).toHaveLength(0);
  });
});

describe("market breadth policy",()=>{
  const setup=resilienceSetup("market-shock");
  it("does not activate below the benchmark and breadth thresholds",()=>{
    expect(deriveMarketContext(setup.instruments,setup.snapshots.filter(row=>row.scenarioId==="market-shock"),0,0)?.calmModeActive).toBe(false);
  });
  it("activates at exactly 250 bps benchmark movement",()=>{
    const rows=[{...snapshot(0,2500000),instrumentId:"NSE:NIFTY50"},{...snapshot(1,2437500),instrumentId:"NSE:NIFTY50"}];
    expect(deriveMarketContext([],rows,0,1)?.calmModeActive).toBe(true);
  });
  it("activates on breadth and median fallback without a large index move",()=>{
    const rows=setup.snapshots.filter(row=>row.scenarioId==="market-shock"&&row.sequence<=1).map(row=>row.instrumentId==="NSE:NIFTY50"&&row.sequence===1?{...row,pricePaise:2490000}:row);
    expect(deriveMarketContext(setup.instruments,rows,0,1)).toMatchObject({calmModeActive:true,breadth:1,equityCount:5});
  });
  it("excludes index instruments from breadth",()=>{
    const rows=setup.snapshots.filter(row=>row.scenarioId==="market-shock");
    expect(deriveMarketContext([...setup.instruments,{...testInstrument,id:"NSE:NIFTY50",kind:"INDEX"}],rows,0,1)?.equityCount).toBe(5);
  });
});
