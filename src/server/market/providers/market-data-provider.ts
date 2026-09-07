import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";

export interface MarketDataProvider {
  getEnvironment(): Promise<{ scenarioId: string; demoTimeTravel: boolean; generation: number }>;
  getHealth(): Promise<import("@/domain/trust/types").MarketProviderHealth>;
  getCurrentSnapshot(instrumentId: string): Promise<MarketSnapshotRecord | null>;
  getCurrentSnapshots(instrumentIds: string[]): Promise<MarketSnapshotRecord[]>;
  getSnapshots(instrumentId: string): Promise<MarketSnapshotRecord[]>;
  getSnapshotAtOrBefore(instrumentId: string, sequence: number): Promise<MarketSnapshotRecord | null>;
  getSnapshotsAtOrBefore(instrumentIds: string[], sequence: number): Promise<MarketSnapshotRecord[]>;
  getSnapshotsBetween(instrumentIds: string[], fromExclusive: number, toInclusive: number): Promise<MarketSnapshotRecord[]>;
  getSnapshotsForAnalysis(instrumentIds: string[], throughSequence: number): Promise<MarketSnapshotRecord[]>;
  getEventsSince(sequence: number): Promise<MarketEventRecord[]>;
  getEventsBetween(fromExclusive: number, toInclusive: number): Promise<MarketEventRecord[]>;
  getCurrentSequence(): Promise<number>;
}
