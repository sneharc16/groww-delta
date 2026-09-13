import { REFERENCE_POLICY } from "@/domain/policy/reference";
export const MAX_PRICE_TRIGGER_DELAY_SECONDS = REFERENCE_POLICY.trust.maxPriceDelaySeconds;
export const PRIMARY_BENCHMARK = REFERENCE_POLICY.calm.benchmark;
export const CALM_MODE_BENCHMARK_THRESHOLD_BPS = REFERENCE_POLICY.calm.benchmarkThresholdBps;
export const CALM_MODE_BREADTH_THRESHOLD = REFERENCE_POLICY.calm.breadthThreshold;
export const CALM_MODE_MEDIAN_MOVE_BPS = REFERENCE_POLICY.calm.medianMoveBps;
