import type { InstrumentRecord } from "@/domain/instrument/types";
import type { MarketSnapshotRecord } from "./types";
import { calculatePriceDeltaBps } from "@/domain/attention/significance";
import { canConfirmPrice } from "@/domain/trust/freshness";
import { CALM_MODE_BENCHMARK_THRESHOLD_BPS, CALM_MODE_BREADTH_THRESHOLD, CALM_MODE_MEDIAN_MOVE_BPS, PRIMARY_BENCHMARK } from "@/domain/trust/policy";

export interface MarketContext {
  calmModeActive: boolean;
  benchmark: { instrumentId: string; name: string; currentPricePaise: number };
  benchmarkDeltaBps: number;
  breadth: number;
  sameDirectionCount: number;
  equityCount: number;
  medianAbsMoveBps: number;
  summary: string;
  groupedInstrumentCount: number;
}
export function deriveMarketContext(instruments: InstrumentRecord[], snapshots: MarketSnapshotRecord[], fromSequence: number, throughSequence: number): MarketContext | null {
  const pair = (id: string) => {
    const rows = snapshots.filter((row) => row.instrumentId === id && row.sequence <= throughSequence && canConfirmPrice(row)).sort((a, b) => a.sequence - b.sequence);
    return { baseline: rows.filter((row) => row.sequence <= fromSequence).at(-1), current: rows.at(-1) };
  };
  const benchmark = pair(PRIMARY_BENCHMARK);
  if (!benchmark.baseline || !benchmark.current) return null;
  const benchmarkDeltaBps = calculatePriceDeltaBps(benchmark.baseline.pricePaise, benchmark.current.pricePaise);
  const equities = instruments.filter((instrument) => instrument.kind !== "INDEX");
  const deltas = equities.flatMap((instrument) => {
    const { baseline, current } = pair(instrument.id);
    return baseline && current ? [calculatePriceDeltaBps(baseline.pricePaise, current.pricePaise)] : [];
  });
  const sameDirectionCount = deltas.filter((delta) => benchmarkDeltaBps !== 0 && Math.sign(delta) === Math.sign(benchmarkDeltaBps)).length;
  const breadth = equities.length ? sameDirectionCount / equities.length : 0;
  const ordered = deltas.map(Math.abs).sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  const medianAbsMoveBps = ordered.length ? ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2 : 0;
  const calmModeActive = Math.abs(benchmarkDeltaBps) >= CALM_MODE_BENCHMARK_THRESHOLD_BPS || (breadth >= CALM_MODE_BREADTH_THRESHOLD && medianAbsMoveBps >= CALM_MODE_MEDIAN_MOVE_BPS);
  return { calmModeActive, benchmark: { instrumentId: PRIMARY_BENCHMARK, name: "Nifty 50", currentPricePaise: benchmark.current.pricePaise },
    benchmarkDeltaBps, breadth, sameDirectionCount, equityCount: equities.length, medianAbsMoveBps, groupedInstrumentCount: 0,
    summary: calmModeActive ? "Most of your watchlist is moving with the broader market, so Delta has grouped repetitive market-wide movement." : "Broad market movement is within the prototype's ordinary range." };
}
