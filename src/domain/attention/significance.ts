import { REFERENCE_POLICY } from "@/domain/policy/reference";
import type { MarketEventType, MarketSnapshotRecord } from "@/domain/market/types";

export const EVENT_SIGNIFICANCE: Record<MarketEventType, number> = REFERENCE_POLICY.significance.events;

export function calculatePriceDeltaBps(baselinePricePaise: number, currentPricePaise: number): number {
  if (baselinePricePaise <= 0) return 0;
  return ((currentPricePaise - baselinePricePaise) / baselinePricePaise) * 10_000;
}

export function calculateExpectedWindowMoveBps(snapshots: MarketSnapshotRecord[], fromExclusive: number, toInclusive: number): number | null {
  const intervalSnapshots = snapshots.filter((snapshot) => snapshot.sequence > fromExclusive && snapshot.sequence <= toInclusive);
  if (intervalSnapshots.length === 0 || intervalSnapshots.some((snapshot) => snapshot.expectedStepMoveBps === null)) return null;
  const variance = intervalSnapshots.reduce((sum, snapshot) => sum + (snapshot.expectedStepMoveBps ?? 0) ** 2, 0);
  return Math.sqrt(variance);
}

function bucket(value: number, bounds: readonly number[]): number {
  const index = bounds.findIndex(bound => value < bound);
  return REFERENCE_POLICY.significance.bucketScores[index < 0 ? bounds.length : index];
}
export function priceSignificanceFromSurprise(priceSurprise: number): number {
  return bucket(priceSurprise, REFERENCE_POLICY.significance.surpriseBounds);
}
export function priceSignificanceFromAbsoluteBps(absoluteDeltaBps: number): number {
  return bucket(absoluteDeltaBps, REFERENCE_POLICY.significance.absoluteBpsBounds);
}

export function calculatePriceSignificance(priceDeltaBps: number, expectedWindowMoveBps: number | null) {
  const surprise = expectedWindowMoveBps && expectedWindowMoveBps > 0
    ? Math.abs(priceDeltaBps) / expectedWindowMoveBps
    : null;
  return {
    priceSurprise: surprise,
    significance: surprise === null
      ? priceSignificanceFromAbsoluteBps(Math.abs(priceDeltaBps))
      : priceSignificanceFromSurprise(surprise),
  };
}

export function calculateVolumeRatio(snapshot: MarketSnapshotRecord): number | null {
  if (snapshot.expectedCumulativeVolume === null || snapshot.expectedCumulativeVolume <= 0n) return null;
  return Number(snapshot.cumulativeVolume) / Number(snapshot.expectedCumulativeVolume);
}

export function volumeSignificanceFromRatio(ratio: number | null): number {
  return ratio === null ? 0 : bucket(ratio, REFERENCE_POLICY.significance.volumeBounds);
}

export function combineSignificance(price: number, volume: number, event: number) {
  const nonZeroSignalCount = [price, volume, event].filter((value) => value > 0).length;
  const multipleSignals = nonZeroSignalCount >= 2;
  return {
    significance: Math.min(100, Math.max(price, volume, event) + (multipleSignals ? REFERENCE_POLICY.significance.multiSignalBonus : 0)),
    multipleSignals,
  };
}
