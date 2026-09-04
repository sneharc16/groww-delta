import type { InstrumentRecord } from "@/domain/instrument/types";
import type { DemoStateRecord, MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import type { WatchIntentDraft, WatchIntentRecord } from "@/domain/intent/types";

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
  supersedesId: string | null;
}

export interface WatchIntentRepository {
  listForInstrument(userId: string, instrumentId: string): Promise<WatchIntentRecord[]>;
  findCurrent(userId: string, logicalIntentId: string): Promise<WatchIntentRecord | null>;
  create(input: CreateIntentRecordInput): Promise<WatchIntentRecord>;
  supersedeAndCreate(previousId: string, input: CreateIntentRecordInput): Promise<WatchIntentRecord>;
  archiveCurrent(id: string): Promise<WatchIntentRecord>;
}

export interface DemoSessionRepository {
  getById(id: string): Promise<DemoStateRecord | null>;
  setPosition(id: string, step: number, sequence: number, time: Date): Promise<DemoStateRecord>;
}

export interface MarketSnapshotRepository {
  findCurrent(instrumentId: string, currentSequence: number): Promise<MarketSnapshotRecord | null>;
  findCurrentMany(instrumentIds: string[], currentSequence: number): Promise<MarketSnapshotRecord[]>;
  listThroughSequence(instrumentId: string, currentSequence: number): Promise<MarketSnapshotRecord[]>;
}

export interface MarketEventRepository {
  listBetweenSequences(exclusiveStart: number, inclusiveEnd: number): Promise<MarketEventRecord[]>;
}
