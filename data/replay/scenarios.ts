import { defaultReplayScenario, replayInstruments, type ReplayEventFixture, type ReplaySnapshotFixture, type ReplayStep } from "./default-scenario";
import { PRIMARY_BENCHMARK } from "../../src/domain/trust/policy";

export interface ReplayScenario {
  id: string;
  name: string;
  timezone: string;
  steps: ReplayStep[];
  events: ReplayEventFixture[];
}
const stamp = (step: number) => new Date(Date.parse("2025-08-14T10:00:00+05:30") + step * 30 * 60000).toISOString();
function steps(prices: number[][], overrides: Record<string, Partial<ReplaySnapshotFixture>> = {}): ReplayStep[] {
  return prices.map((row, step) => ({
    step, sequence: step, eventTime: stamp(step),
    snapshots: [...replayInstruments.map((instrument, index) => ({
      instrumentId: instrument.id, pricePaise: row[index], openPaise: prices[0][index], highPaise: Math.max(prices[0][index], row[index]) + 200,
      lowPaise: Math.min(prices[0][index], row[index]) - 200,
      cumulativeVolume: BigInt((step + 1) * 500000), expectedCumulativeVolume: BigInt((step + 1) * 500000),
      expectedStepMoveBps: 100, ...overrides[`${step}:${instrument.id}`],
    })), { instrumentId: PRIMARY_BENCHMARK, pricePaise: row[5] ?? 2500000, openPaise: prices[0][5] ?? 2500000,
      highPaise: 2501000, lowPaise: row[5] ?? 2500000, cumulativeVolume: 0n, expectedCumulativeVolume: 0n, expectedStepMoveBps: 80 }],
  }));
}
export const replayScenarios: ReplayScenario[] = [
  { ...defaultReplayScenario, steps: defaultReplayScenario.steps.map((step) => ({ ...step, snapshots: [...step.snapshots,
    { instrumentId: PRIMARY_BENCHMARK, pricePaise: 2500000, openPaise: 2500000, highPaise: 2500000, lowPaise: 2500000, cumulativeVolume: 0n, expectedCumulativeVolume: 0n, expectedStepMoveBps: 80 }] })), events: [...defaultReplayScenario.events] },
  { id: "data-quality", name: "Data Quality", timezone: "Asia/Kolkata",
    steps: steps([
      [320000,158000,99500,518000,141000], [320000,156000,99500,518000,141000],
      [320000,155800,99500,518000,141000], [320000,158000,100500,518000,141000],
      [320000,155800,99500,518000,141000], [320000,155700,99500,518000,141000],
      [320000,155600,99500,518000,141000],
    ], { "1:NSE:HDFCBANK": { quality: "STALE" }, "3:NSE:TATAMOTORS": { quality: "CONFLICTING" }, "4:NSE:HDFCBANK": { quality: "DELAYED", delaySeconds: 45 } }),
    events: [
      { id: "data-quality:technical:3", sequence: 3, instrumentId: "NSE:TATAMOTORS", type: "TECHNICAL_TRANSITION", quality: "CONFLICTING", eventTime: stamp(3), subjectType: "METRIC", subjectKey: "TECHNICAL_BREAKOUT", tags: ["BREAKOUT"], payload: { setup: "BREAKOUT", referenceLevelPaise: 100000, direction: "CROSSED_ABOVE" } },
      { id: "data-quality:results:5", sequence: 5, instrumentId: "NSE:TCS", type: "RESULTS_PUBLISHED", eventTime: stamp(5), subjectType: "EVENT_CATEGORY", subjectKey: "EARNINGS", tags: ["MARGINS", "Q2"], payload: { quarterLabel: "Q2", focus: ["MARGINS"], operatingMarginBps: 2480 } },
      { id: "data-quality:correction:6", sequence: 6, instrumentId: "NSE:TCS", type: "RESULTS_PUBLISHED", quality: "CORRECTED", correctionOfId: "data-quality:results:5", eventTime: stamp(6), subjectType: "EVENT_CATEGORY", subjectKey: "EARNINGS", tags: ["MARGINS", "Q2"], payload: { quarterLabel: "Q2", focus: ["MARGINS"], operatingMarginBps: 2410 } },
    ] },
  { id: "market-shock", name: "Market Shock", timezone: "Asia/Kolkata",
    steps: steps([
      [320000,161000,99500,518000,141000,2500000],
      [307200,154800,95520,497280,135360,2400000],
      [307200,154700,95520,497280,140000,2400000],
    ]), events: [] },
  { id: "corporate-action", name: "Corporate Action", timezone: "Asia/Kolkata",
    steps: steps([[320000,158000,99500,518000,141000], [320000,79000,99500,518000,141000]]),
    events: [{ id: "corporate-action:split:1", sequence: 1, instrumentId: "NSE:HDFCBANK", type: "CORPORATE_EVENT", eventTime: stamp(1), subjectType: "INSTRUMENT", subjectKey: "NSE:HDFCBANK", tags: ["STOCK_SPLIT"], payload: { eventKind: "STOCK_SPLIT", oldShares: 1, newShares: 2 } }] },
];
export function findReplayScenario(id: string): ReplayScenario | undefined { return replayScenarios.find((scenario) => scenario.id === id); }
