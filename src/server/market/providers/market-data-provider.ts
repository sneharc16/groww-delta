import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";

export interface MarketDataProvider {
  getCurrentSnapshot(instrumentId: string): Promise<MarketSnapshotRecord | null>;
  getCurrentSnapshots(instrumentIds: string[]): Promise<MarketSnapshotRecord[]>;
  getSnapshots(instrumentId: string): Promise<MarketSnapshotRecord[]>;
  getEventsSince(sequence: number): Promise<MarketEventRecord[]>;
  getCurrentSequence(): Promise<number>;
}
