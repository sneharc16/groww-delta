import { replayScenarios } from "../../data/replay/scenarios";
import { replayInstruments } from "../../data/replay/default-scenario";
import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import type { CorporateActionReviewRecord } from "@/domain/trust/types";
import type { CorporateActionReviewRepository } from "@/server/repositories/contracts";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import { CatchUpService } from "@/server/services/catch-up-service";
import { CorporateActionService } from "@/server/services/corporate-action-service";
import { findDriverTemplate, graphDraftFromTemplate } from "@/domain/graph/templates";
import { MemoryDemoSessionRepository, MemoryEventRepository, MemorySnapshotRepository, MemoryIntentRepository, MemoryKnowledgeCursorRepository,
  MemoryWatchlistRepository, MemoryWatchGraphRepository, cursorRecord, graphRecord, intentRecord, watchlistRecord } from "./in-memory";

export class MemoryCorporateReviews implements CorporateActionReviewRepository {
  rows: CorporateActionReviewRecord[] = [];
  constructor(private readonly intents: MemoryIntentRepository) {}
  async list(userId: string, scenarioId: string, demoGeneration = 0) { return this.rows.filter((row) => row.userId === userId && row.scenarioId === scenarioId && row.demoGeneration === demoGeneration); }
  async decide(input: Parameters<CorporateActionReviewRepository["decide"]>[0], previousId: string, next?: Parameters<CorporateActionReviewRepository["decide"]>[2]) {
    if (next) await this.intents.supersedeAndCreate(previousId, next);
    const old = this.rows.find((row) => row.userId === input.userId && row.logicalIntentId === input.logicalIntentId && row.eventId === input.eventId);
    if (old) { Object.assign(old, input); return old; }
    const row = { ...input, id: `review-${this.rows.length}`, decidedAt: new Date() };
    this.rows.push(row); return row;
  }
}
export function resilienceSetup(scenarioId: string) {
  const scenario = replayScenarios.find((row) => row.id === scenarioId)!;
  const snapshots: MarketSnapshotRecord[] = replayScenarios.flatMap((scenario) => scenario.steps.flatMap((step) => step.snapshots.map((snapshot) => ({
    ...snapshot, id: `${scenario.id}:${step.sequence}:${snapshot.instrumentId}`, scenarioId: scenario.id, sequence: step.sequence,
    eventTime: new Date(Date.parse(step.eventTime) - (snapshot.delaySeconds ?? 0) * 1000), receivedTime: new Date(step.eventTime),
    source: "ReplayMarketProvider", quality: snapshot.quality ?? "FRESH",
  }))));
  const events: MarketEventRecord[] = replayScenarios.flatMap((scenario) => scenario.events.map((event) => ({
    ...event, scenarioId: scenario.id, eventTime: new Date(event.eventTime), receivedTime: new Date(event.receivedTime ?? event.eventTime),
    quality: event.quality ?? "FRESH", source: "ReplayMarketProvider", correctionOfId: event.correctionOfId ?? null,
  })));
  const instruments = replayInstruments.map((row) => ({ ...row, kind: "EQUITY" as const, currency: "INR", isActive: true, isWatchlistEligible: true }));
  const sessions = new MemoryDemoSessionRepository({ id: "default-demo-session", scenarioId, currentStep: 0, currentSequence: 0, currentTime: new Date(scenario.steps[0].eventTime) });
  const cursors = new MemoryKnowledgeCursorRepository(instruments.map((instrument) => cursorRecord({ id: `cursor:${instrument.id}`, instrumentId: instrument.id, lastObservedSnapshotId: `${scenarioId}:0:${instrument.id}` })));
  const intents = new MemoryIntentRepository([
    intentRecord({ id: "tcs", logicalIntentId: "tcs" }),
    intentRecord({ id: "hdfc", logicalIntentId: "hdfc", instrumentId: "NSE:HDFCBANK", type: "PRICE_LEVEL", structuredPayload: { targetPricePaise: 155000, mode: "NEAR", proximityBps: 100 }, originalText: "Watching near ₹1,550" }),
    intentRecord({ id: "tata", logicalIntentId: "tata", instrumentId: "NSE:TATAMOTORS", type: "TECHNICAL", structuredPayload: { setup: "BREAKOUT", referenceLevelPaise: 100000 } }),
    intentRecord({ id: "indigo", logicalIntentId: "indigo-driver", instrumentId: "NSE:INDIGO", type: "DRIVER", structuredPayload: { driverKey: "FUEL_COST", description: "Fuel cost" } }),
  ]);
  const watchlists = new MemoryWatchlistRepository(watchlistRecord(instruments.map((instrument) => ({
    id: `item:${instrument.id}`, watchlistId: "demo-watchlist", instrumentId: instrument.id, instrument,
    addedAt: new Date(), archivedAt: null, provenanceSource: "IMPORTED_DEMO", provenanceReference: null,
  }))));
  const graphs = new MemoryWatchGraphRepository([graphRecord(graphDraftFromTemplate(findDriverTemplate("AIRLINE_FUEL_COST", "NSE:INDIGO"), ["FUEL_COST", "CRUDE"]))]);
  sessions.resetBaselines = async (userId, baselines) => { await cursors.resetMany(userId, baselines.filter((row) => instruments.some((instrument) => instrument.id === row.instrumentId))); };
  const provider = new ReplayMarketProvider(sessions, new MemorySnapshotRepository(snapshots), new MemoryEventRepository(events));
  const reviews = new MemoryCorporateReviews(intents);
  const catchUp = new CatchUpService(watchlists, cursors, intents, sessions, provider, graphs, reviews);
  const corporate = new CorporateActionService(reviews, intents, provider);
  async function advanceTo(step: number) { while (sessions.state.currentStep < step) await provider.advanceDemo(); }
  return { scenario, snapshots, events, instruments, sessions, cursors, intents, watchlists, graphs, provider, reviews, catchUp, corporate, advanceTo };
}
