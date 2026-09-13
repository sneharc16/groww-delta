import { PRIMARY_BENCHMARK } from "@/domain/trust/policy";
import { deriveMarketContext } from "@/domain/market/context";
import { calculatePriceDeltaBps } from "@/domain/attention/significance";
import { inReplayEnvironment } from "@/domain/market/effective-sequence";
import { normalizeEvents, resolveCorrections } from "@/domain/trust/events";
import { analyzeInstrument } from "@/domain/attention/analyze-instrument";
import { AppError } from "@/lib/errors/app-error";
import { DEFAULT_DEMO_SESSION_ID } from "@/lib/constants";
import type { AcknowledgeInput } from "@/lib/validation/catch-up";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import type { CorporateActionReviewRepository, DemoSessionRepository, KnowledgeCursorRepository, WatchGraphRepository, WatchIntentRepository, WatchlistRepository } from "@/server/repositories/contracts";
import { toAttentionItemDto, toCursorDto, toIntentLifecycleDto } from "@/server/dto/mappers";
import type { AttentionItemDto, CatchUpDto } from "@/server/dto/types";
import { evaluateIntentLifecycle } from "@/domain/intent/lifecycle";

const scoreOrder = (a: AttentionItemDto, b: AttentionItemDto) => b.score - a.score || a.instrument.symbol.localeCompare(b.instrument.symbol);

export class CatchUpService {
  constructor(
    private readonly watchlists: WatchlistRepository,
    private readonly cursors: KnowledgeCursorRepository,
    private readonly intents: WatchIntentRepository,
    private readonly sessions: DemoSessionRepository,
    private readonly market: MarketDataProvider,
    private readonly graphs: WatchGraphRepository,
    private readonly corporateReviews?: CorporateActionReviewRepository,
    private readonly demoSessionId = DEFAULT_DEMO_SESSION_ID,
  ) {}

  async getCatchUp(userId: string): Promise<CatchUpDto> {
    const [watchlist, state] = await Promise.all([
      this.watchlists.getDefaultForUser(userId),
      this.sessions.getById(this.demoSessionId),
    ]);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    if (!state) throw new AppError("INVALID_MARKET_STATE", "The demo market state is unavailable.", 409);
    const providerHealth = await this.market.getHealth();
    const environment = await this.market.getEnvironment();
    const instrumentIds = watchlist.items.map((item) => item.instrumentId);
    if (instrumentIds.length === 0) {
      return {
        replayPosition: state.scenarioId + ":" + (state.generation ?? 0) + ":" + state.currentSequence,
        replayEnvironment: state.scenarioId + ":" + (state.generation ?? 0),
        trustNotices: [], marketContext: null, providerHealth, groupedMarketMoves: [],
        asOfSequence: state.currentSequence,
        asOfTime: state.currentTime.toISOString(),
        cursorSummary: { allAtSameSequence: true, minimumSequence: state.currentSequence, maximumSequence: state.currentSequence, commonLastSeenTime: state.currentTime.toISOString() },
        relevant: [], significant: [], quiet: [], counts: { relevant: 0, significant: 0, quiet: 0 }, intentLifecycle: [], reviewReasons: [],
      };
    }
    const [cursorRows, storedIntents, snapshots] = await Promise.all([
      this.cursors.listForInstruments(userId, instrumentIds),
      this.intents.listActiveForInstruments(userId, instrumentIds),
      this.market.getSnapshotsForAnalysis([...instrumentIds, PRIMARY_BENCHMARK], state.currentSequence),
    ]);
    if (cursorRows.length !== instrumentIds.length) throw new AppError("CURSOR_NOT_FOUND", "A watched instrument is missing its knowledge cursor.", 409);
    const intentRows = storedIntents.map((intent) => inReplayEnvironment(intent, state.scenarioId, state.generation));
    const minimumCursor = Math.min(...cursorRows.map((cursor) => cursor.lastSeenSequence));
    const graphRows = (await this.graphs.listActiveForIntentLogicalIds(userId, intentRows.map((intent) => intent.logicalIntentId))).map((graph) => inReplayEnvironment(graph, state.scenarioId, state.generation));
    const corporateDecisions = await this.corporateReviews?.list(userId, state.scenarioId, state.generation) ?? [];
    const events = normalizeEvents(await this.market.getEventsBetween(-1, state.currentSequence));
    const marketContext = deriveMarketContext(watchlist.items.map((item) => item.instrument), snapshots, 0, state.currentSequence);
    if (providerHealth.status === "UNAVAILABLE" && marketContext) marketContext.calmModeActive = false;
    const cursorByInstrument = new Map(cursorRows.map((cursor) => [cursor.instrumentId, cursor]));
    const items = watchlist.items.map((watchlistItem) => {
      const cursor = cursorByInstrument.get(watchlistItem.instrumentId);
      if (!cursor) throw new AppError("CURSOR_NOT_FOUND", `No knowledge cursor exists for ${watchlistItem.instrument.symbol}.`, 409);
      const result = analyzeInstrument({
        traceContext: { scenarioId: state.scenarioId, scenarioVersion: environment.scenarioVersion ?? "unspecified", scenarioContentHash: environment.scenarioContentHash ?? "unspecified" },
        demoTimeTravel: true, providerHealth, marketContext, corporateDecisions,
        benchmarkDeltaBps: (() => {
          const benchmark = snapshots.filter((row) => row.instrumentId === PRIMARY_BENCHMARK).sort((a, b) => a.sequence - b.sequence);
          const baseline = benchmark.filter((row) => row.sequence <= cursor.lastSeenSequence).at(-1);
          const current = benchmark.at(-1);
          return baseline && current ? calculatePriceDeltaBps(baseline.pricePaise, current.pricePaise) : 0;
        })(),
        instrument: watchlistItem.instrument,
        cursor,
        currentSequence: state.currentSequence,
        currentTime: state.currentTime,
        snapshots: snapshots.filter((snapshot) => snapshot.instrumentId === watchlistItem.instrumentId),
        events: events.filter((event) => (event.instrumentId === watchlistItem.instrumentId || event.instrumentId === null)),
        activeIntents: intentRows.filter((intent) => intent.instrumentId === watchlistItem.instrumentId),
        activeGraphs: graphRows.filter((graph) => graph.instrumentId === watchlistItem.instrumentId),
      });
      if (!result) throw new AppError("INVALID_MARKET_STATE", `Market snapshots are incomplete for ${watchlistItem.instrument.symbol}.`, 409);
      return toAttentionItemDto(result);
    });
    const groupedMarketMoves = items.filter((item) => item.groupedMarketMove);
    if (marketContext) marketContext.groupedInstrumentCount = groupedMarketMoves.length;
    const trustNotices = [...new Map(items.flatMap((item) => item.trustNotices).map((notice) => [notice.id, notice])).values()];
    if (providerHealth.status !== "HEALTHY") trustNotices.unshift({
      id: "provider-status", type: "PROVIDER_UNAVAILABLE", instrumentId: null, severity: "CAUTION",
      title: providerHealth.message ?? "Market data is temporarily unavailable.",
      message: "Last confirmed data remains visible. New price conditions are not confirmed while the provider is unavailable.",
      reasonCodes: ["PROVIDER_UNAVAILABLE"], occurredAt: state.currentTime.toISOString(),
      metadata: { lastSuccessfulUpdate: providerHealth.lastSuccessfulUpdate },
    });
    const relevant = items.filter((item) => item.lane === "RELEVANT").sort(scoreOrder);
    const significant = items.filter((item) => item.lane === "SIGNIFICANT").sort(scoreOrder);
    const quiet = items.filter((item) => item.lane === "QUIET").sort((a, b) => a.instrument.symbol.localeCompare(b.instrument.symbol));
    const intentLifecycle = intentRows.map((intent) => {
      const cursor = cursorByInstrument.get(intent.instrumentId);
      if (!cursor) throw new AppError("CURSOR_NOT_FOUND", "A watched instrument is missing its knowledge cursor.", 409);
      return toIntentLifecycleDto(evaluateIntentLifecycle({
        intent,
        cursor,
        snapshots: snapshots.filter((snapshot) => snapshot.instrumentId === intent.instrumentId),
        events: resolveCorrections(events).current.filter((event) => event.instrumentId === intent.instrumentId),
        currentSequence: state.currentSequence,
        currentTime: state.currentTime,
      }));
    }).sort((a, b) => a.instrumentId.localeCompare(b.instrumentId) || a.logicalIntentId.localeCompare(b.logicalIntentId));
    const reviewReasons = intentLifecycle.filter((intent) => intent.state === "RESOLUTION_ELIGIBLE" || intent.state === "STALE_CANDIDATE");
    const allAtSameSequence = cursorRows.every((cursor) => cursor.lastSeenSequence === cursorRows[0]?.lastSeenSequence);
    const commonTimes = new Set(cursorRows.map((cursor) => cursor.lastSeenEventTime?.toISOString() ?? null));
    return {
      replayPosition: state.scenarioId + ":" + (state.generation ?? 0) + ":" + state.currentSequence,
      replayEnvironment: state.scenarioId + ":" + (state.generation ?? 0),
      trustNotices, marketContext, providerHealth, groupedMarketMoves,
      asOfSequence: state.currentSequence,
      asOfTime: state.currentTime.toISOString(),
      cursorSummary: {
        allAtSameSequence,
        minimumSequence: minimumCursor,
        maximumSequence: Math.max(...cursorRows.map((cursor) => cursor.lastSeenSequence)),
        commonLastSeenTime: allAtSameSequence && commonTimes.size === 1 ? [...commonTimes][0] : null,
      },
      relevant,
      significant,
      quiet,
      counts: { relevant: relevant.length, significant: significant.length, quiet: quiet.length },
      intentLifecycle,
      reviewReasons,
    };
  }

  async acknowledge(userId: string, input: AcknowledgeInput) {
    const [watchlist, state] = await Promise.all([
      this.watchlists.getDefaultForUser(userId),
      this.sessions.getById(this.demoSessionId),
    ]);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    if (!state) throw new AppError("INVALID_MARKET_STATE", "The demo market state is unavailable.", 409);
    if (input.throughSequence > state.currentSequence) {
      throw new AppError("INVALID_ACK_SEQUENCE", "Cannot acknowledge beyond the current market sequence.", 409);
    }
    const health = await this.market.getHealth();
    if (health.status === "UNAVAILABLE" && input.throughSequence > (state.lastHealthySequence ?? 0)) throw new AppError("PROVIDER_UNAVAILABLE", "Cannot acknowledge unavailable market information.", 409);
    const activeIds = new Set(watchlist.items.map((item) => item.instrumentId));
    const requestedIds = "scope" in input ? [...activeIds] : [...new Set(input.instrumentIds)];
    const invalid = requestedIds.find((id) => !activeIds.has(id));
    if (invalid) throw new AppError("INSTRUMENT_NOT_WATCHED", "Acknowledgement is limited to active watchlist instruments.", 404);
    const snapshots = await this.market.getSnapshotsAtOrBefore(requestedIds, input.throughSequence);
    const snapshotByInstrument = new Map(snapshots.map((snapshot) => [snapshot.instrumentId, snapshot]));
    const baselines = requestedIds.map((instrumentId) => {
      const snapshot = snapshotByInstrument.get(instrumentId);
      if (!snapshot) throw new AppError("INVALID_MARKET_STATE", "No snapshot exists through the requested sequence.", 409);
      return { instrumentId, sequence: input.throughSequence, eventTime: snapshot.eventTime, snapshotId: snapshot.id, expectedScenarioId: state.scenarioId, expectedGeneration: state.generation ?? 0 };
    });
    const updated = await this.cursors.acknowledgeMany(userId, baselines, "scope" in input ? "WATCHLIST" : "INSTRUMENT");
    return { throughSequence: input.throughSequence, cursors: updated.map(toCursorDto) };
  }
}
