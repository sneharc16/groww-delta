import { describe, expect, it } from "vitest";
import { matchIntents } from "@/domain/attention/intent-matchers";
import { matchGraphEvents } from "@/domain/graph/traversal";
import { graphDraftFromTemplate, findDriverTemplate } from "@/domain/graph/templates";
import { graphRecord, intentRecord, MemoryKnowledgeCursorRepository, cursorRecord } from "../../../tests/helpers/in-memory";
import { buildWatchTimeline } from "./timeline";
import type { MarketEventRecord } from "@/domain/market/types";

const time = new Date("2025-08-14T05:30:00Z");
const event: MarketEventRecord = { id: "result-5", sequence: 5, instrumentId: "NSE:TCS", type: "RESULTS_PUBLISHED", eventTime: time,
  receivedTime: time, source: "test", quality: "FRESH", payload: { quarterLabel: "Q2", focus: ["MARGINS"] }, subjectType: "EVENT_CATEGORY", subjectKey: "EARNINGS", tags: [], correctionOfId: null };
const v1 = intentRecord({ id: "v1", effectiveFromSequence: 3, status: "SUPERSEDED" });
const v2 = intentRecord({ id: "v2", version: 2, supersedesId: "v1", effectiveFromSequence: 7, structuredPayload: { quarterLabel: "Q3", focus: ["MARGINS"] }, originalText: "Watching Q3 margins" });

describe("Phase A adversarial semantic audit", () => {
  it("does not reinterpret a sequence 5 event with an intent created at 7", () => {
    expect(matchIntents({ intents: [v2], snapshots: [], events: [event], cursorSequence: 0, currentSequence: 8 })).toEqual([]);
    const timeline = buildWatchTimeline({ intents: [v1, v2], graphs: [], acknowledgements: [], snapshots: [], events: [event], currentSequence: 8 });
    expect(timeline.find((entry) => entry.kind === "MARKET_EVENT")?.detail).toContain("Q2");
    expect(timeline.filter((entry) => entry.kind === "MARKET_EVENT")).toHaveLength(1);
  });
  it("does not use future price snapshots beyond the analysis end", () => {
    const priceIntent = intentRecord({ type: "PRICE_LEVEL", structuredPayload: { targetPricePaise: 10000, mode: "ABOVE", proximityBps: 100 } });
    const snapshot = { id: "s0", instrumentId: "NSE:TCS", sequence: 0, eventTime: time, pricePaise: 9000, openPaise: 9000, highPaise: 9000, lowPaise: 9000, cumulativeVolume: 1n, expectedCumulativeVolume: 1n, expectedStepMoveBps: 30, source: "test", quality: "FRESH" as const };
    expect(matchIntents({ intents: [priceIntent], snapshots: [snapshot, { ...snapshot, id: "future", sequence: 9, pricePaise: 11000 }], events: [], cursorSequence: 0, currentSequence: 1 })).toEqual([]);
  });
  it("preserves actual acknowledgement timestamps instead of replacing them with replay time", () => {
    const acknowledgedAt = new Date("2026-09-05T10:05:00Z");
    const timeline = buildWatchTimeline({ intents: [], graphs: [], snapshots: [], events: [], currentSequence: 5,
      acknowledgements: [{ id: "ack", userId: "demo-user", instrumentId: "NSE:TCS", fromSequence: 0, throughSequence: 5, scope: "INSTRUMENT", acknowledgedAt }] });
    expect(timeline[0].occurredAt).toEqual(acknowledgedAt);
  });
  it("uses the historical graph version and never restores a removed subject through its tag", () => {
    const template = findDriverTemplate("AIRLINE_FUEL_COST", "NSE:INDIGO");
    const old = graphRecord(graphDraftFromTemplate(template, ["FUEL_COST", "CRUDE"]), { status: "SUPERSEDED" });
    const next = graphRecord(graphDraftFromTemplate(template, ["FUEL_COST"]), { id: "graph2", version: 2, supersedesId: old.id, effectiveFromSequence: 7 });
    const intent = intentRecord({ instrumentId: "NSE:INDIGO", logicalIntentId: old.watchIntentLogicalId, type: "DRIVER", structuredPayload: { driverKey: "FUEL_COST", description: "Fuel" } });
    const crude = { ...event, instrumentId: null, type: "EXTERNAL_DRIVER" as const, subjectKey: "CRUDE", tags: ["FUEL_COST"], payload: { externalMetric: "CRUDE" } };
    expect(matchGraphEvents({ graph: next, intent, events: [{ ...crude, sequence: 8 }], cursorSequence: 0, currentSequence: 8 })).toEqual([]);
    const history = buildWatchTimeline({ intents: [intent], graphs: [old, next], snapshots: [], acknowledgements: [], events: [crude], currentSequence: 8 });
    expect(history.some((entry) => entry.detail === "IndiGo → Fuel cost → Crude")).toBe(true);
  });
  it("rejects persisted cycles and aliased node IDs before traversal", () => {
    const graph = graphRecord(graphDraftFromTemplate(findDriverTemplate("AIRLINE_FUEL_COST", "NSE:INDIGO"), ["FUEL_COST", "CRUDE"]));
    const run = () => matchGraphEvents({ graph, intent: intentRecord(), events: [{ ...event, subjectKey: "CRUDE" }], cursorSequence: 0, currentSequence: 5 });
    graph.edges.push({ ...graph.edges[0], id: "cycle", fromNodeId: graph.nodes.at(-1)!.id, toNodeId: graph.nodes[0].id });
    expect(run).toThrow();
    graph.edges.pop();
    graph.nodes[1].id = graph.nodes[0].id;
    expect(run).toThrowError(expect.objectContaining({ code: "DUPLICATE_GRAPH_NODE" }));
  });
  it("keeps acknowledgement and cursor changes coherent and rolls back failed history", async () => {
    const cursors = new MemoryKnowledgeCursorRepository([cursorRecord({ lastSeenSequence: 10 })]);
    const input = { instrumentId: "NSE:TCS", sequence: 12, eventTime: time, snapshotId: "s12" };
    cursors.failAcknowledgement = true;
    await expect(cursors.acknowledgeMany("demo-user", [input], "INSTRUMENT")).rejects.toThrow();
    expect(cursors.rows[0].lastSeenSequence).toBe(10);
    expect(cursors.acknowledgements).toHaveLength(0);
    cursors.failAcknowledgement = false;
    await cursors.acknowledgeMany("demo-user", [input], "INSTRUMENT");
    await cursors.acknowledgeMany("demo-user", [{ ...input, sequence: 11 }], "INSTRUMENT");
    expect(cursors.rows[0].lastSeenSequence).toBe(12);
    expect(cursors.rows[0].cursorVersion).toBe(2);
    expect(cursors.acknowledgements).toHaveLength(1);
  });
});
