import type { InstrumentRecord } from "@/domain/instrument/types";
import type { DemoStateRecord, KnowledgeAcknowledgementRecord, KnowledgeCursorRecord, MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import type { WatchIntentDraft, WatchIntentRecord } from "@/domain/intent/types";
import type { GraphEdgeDraft, GraphNodeDraft, GraphProvenance, WatchGraphRecord } from "@/domain/graph/types";

export interface WatchlistItemRecord {
  id: string;
  watchlistId: string;
  instrumentId: string;
  addedAt: Date;
  archivedAt: Date | null;
  provenanceSource: "MANUAL" | "STOCK_DETAIL" | "SCREENER_NEAR_BREAKOUT" | "RESULTS_CALENDAR" | "DIVIDEND_SCREEN" | "NEWS_CONTEXT" | "IMPORTED_DEMO";
  provenanceReference: string | null;
  instrument: InstrumentRecord;
}

export interface WatchlistRecord {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  items: WatchlistItemRecord[];
}

export interface InstrumentRepository {
  listActive(): Promise<InstrumentRecord[]>;
  findById(id: string): Promise<InstrumentRecord | null>;
}

export interface WatchlistRepository {
  getDefaultForUser(userId: string): Promise<WatchlistRecord | null>;
  findActiveItem(watchlistId: string, instrumentId: string): Promise<WatchlistItemRecord | null>;
  addItem(watchlistId: string, instrumentId: string): Promise<WatchlistItemRecord>;
  archiveItem(itemId: string, watchlistId: string, archivedAt: Date): Promise<boolean>;
}

export interface CreateIntentRecordInput extends WatchIntentDraft {
  id: string;
  logicalIntentId: string;
  userId: string;
  instrumentId: string;
  version: number;
  effectiveFromSequence: number;
  effectiveScenarioId?: string;
  effectiveDemoGeneration?: number;
  supersedesId: string | null;
}

export interface WatchIntentRepository {
  listForInstrument(userId: string, instrumentId: string): Promise<WatchIntentRecord[]>;
  listActiveForInstruments(userId: string, instrumentIds: string[]): Promise<WatchIntentRecord[]>;
  findCurrent(userId: string, logicalIntentId: string): Promise<WatchIntentRecord | null>;
  findLatest(userId: string, logicalIntentId: string): Promise<WatchIntentRecord | null>;
  create(input: CreateIntentRecordInput): Promise<WatchIntentRecord>;
  supersedeAndCreate(previousId: string, input: CreateIntentRecordInput): Promise<WatchIntentRecord>;
  archiveCurrent(id: string): Promise<WatchIntentRecord>;
  resolveCurrent(id: string, resolvedAt: Date, resolvedAtSequence: number): Promise<WatchIntentRecord>;
  keepWatching(id: string, throughSequence: number): Promise<WatchIntentRecord>;
  renew(previousId: string, input: CreateIntentRecordInput): Promise<WatchIntentRecord>;
}

export interface DemoSessionRepository {
  getById(id: string): Promise<DemoStateRecord | null>;
  setPosition(id: string, step: number, sequence: number, time: Date): Promise<DemoStateRecord>;
  resetScenario(id: string, scenarioId: string, time: Date, userId: string, baselines: CursorBaselineInput[]): Promise<DemoStateRecord>;
  setProviderStatus(id: string, status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE"): Promise<DemoStateRecord>;
}

export interface MarketSnapshotRepository {
  findCurrent(instrumentId: string, currentSequence: number, scenarioId?: string): Promise<MarketSnapshotRecord | null>;
  findCurrentMany(instrumentIds: string[], currentSequence: number, scenarioId?: string): Promise<MarketSnapshotRecord[]>;
  listThroughSequence(instrumentId: string, currentSequence: number, scenarioId?: string): Promise<MarketSnapshotRecord[]>;
  listForInstrumentsThrough(instrumentIds: string[], currentSequence: number, scenarioId?: string): Promise<MarketSnapshotRecord[]>;
}

export interface MarketEventRepository {
  listBetweenSequences(exclusiveStart: number, inclusiveEnd: number, scenarioId?: string): Promise<MarketEventRecord[]>;
}

export interface CursorBaselineInput {
  expectedScenarioId?: string;
  expectedGeneration?: number;
  instrumentId: string;
  sequence: number;
  eventTime: Date;
  snapshotId: string;
}

export interface KnowledgeCursorRepository {
  listForInstruments(userId: string, instrumentIds: string[]): Promise<KnowledgeCursorRecord[]>;
  setBaseline(userId: string, input: CursorBaselineInput): Promise<KnowledgeCursorRecord>;
  advanceMonotonic(userId: string, input: CursorBaselineInput): Promise<KnowledgeCursorRecord | null>;
  acknowledgeMany(userId: string, inputs: CursorBaselineInput[], scope: "INSTRUMENT" | "WATCHLIST"): Promise<KnowledgeCursorRecord[]>;
  resetMany(userId: string, inputs: CursorBaselineInput[]): Promise<KnowledgeCursorRecord[]>;
}

export interface KnowledgeAcknowledgementRepository {
  create(input: {
    userId: string;
    instrumentId: string;
    fromSequence: number;
    throughSequence: number;
    scope: "INSTRUMENT" | "WATCHLIST";
    acknowledgedAt: Date;
  }): Promise<KnowledgeAcknowledgementRecord>;
  listForInstrument(userId: string, instrumentId: string): Promise<KnowledgeAcknowledgementRecord[]>;
}

export interface CreateWatchGraphInput {
  effectiveScenarioId?: string;
  effectiveDemoGeneration?: number;
  id: string;
  logicalGraphId: string;
  userId: string;
  instrumentId: string;
  watchIntentLogicalId: string;
  version: number;
  provenance: GraphProvenance;
  templateKey: string | null;
  effectiveFromSequence: number;
  supersedesId: string | null;
  nodes: Array<GraphNodeDraft & { id: string }>;
  edges: Array<GraphEdgeDraft & { id: string; fromNodeId: string; toNodeId: string }>;
}

export interface WatchGraphRepository {
  listActiveForIntentLogicalIds(userId: string, logicalIntentIds: string[]): Promise<WatchGraphRecord[]>;
  listForIntent(userId: string, logicalIntentId: string): Promise<WatchGraphRecord[]>;
  findActive(userId: string, logicalIntentId: string): Promise<WatchGraphRecord | null>;
  createVersion(previousId: string | null, input: CreateWatchGraphInput): Promise<WatchGraphRecord>;
  archiveActiveForIntent(userId: string, logicalIntentId: string): Promise<number>;
}

export interface CorporateActionReviewRepository {
  list(userId: string, scenarioId: string, demoGeneration?: number): Promise<import("@/domain/trust/types").CorporateActionReviewRecord[]>;
  decide(input: Omit<import("@/domain/trust/types").CorporateActionReviewRecord, "id" | "decidedAt">, previousIntentId: string, nextIntent?: CreateIntentRecordInput): Promise<import("@/domain/trust/types").CorporateActionReviewRecord>;
}
