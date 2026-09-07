import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import { MAX_PRICE_TRIGGER_DELAY_SECONDS } from "./policy";
import type { DataTrust } from "./types";

type Observation = Pick<MarketSnapshotRecord, "quality" | "eventTime" | "receivedTime" | "source">;
export function delaySeconds(observation: Observation): number {
  return observation.receivedTime ? Math.max(0, Math.ceil((observation.receivedTime.getTime() - observation.eventTime.getTime()) / 1000)) : 0;
}
export function canConfirmPrice(observation: Observation): boolean {
  if (observation.quality === "STALE" || observation.quality === "CONFLICTING") return false;
  if (observation.quality === "DELAYED") return observation.receivedTime != null && delaySeconds(observation) <= MAX_PRICE_TRIGGER_DELAY_SECONDS;
  return true;
}
export function canUseEvent(event: MarketEventRecord): boolean {
  return event.quality !== "STALE" && event.quality !== "CONFLICTING";
}
export function assessData(observation: Observation, asOf: Date): DataTrust {
  const delay = delaySeconds(observation);
  const level = observation.quality === "FRESH" ? "CURRENT" : observation.quality === "CORRECTED" ? "CORRECTED" : observation.quality === "DELAYED" ? "DELAYED" : "UNRELIABLE";
  const code = observation.quality === "FRESH" ? "DATA_CURRENT" : observation.quality === "DELAYED" ? "DATA_DELAYED" : observation.quality === "STALE" ? "DATA_STALE" : observation.quality === "CONFLICTING" ? "DATA_CONFLICTING" : "DATA_CORRECTED";
  return {
    level, quality: observation.quality, source: observation.source, eventTime: observation.eventTime.toISOString(),
    receivedTime: observation.receivedTime?.toISOString() ?? null, delaySeconds: delay,
    ageSeconds: Math.max(0, Math.floor((asOf.getTime() - observation.eventTime.getTime()) / 1000)),
    label: level === "CURRENT" ? "Current data" : level === "DELAYED" ? `Delayed by ${delay} sec` : level === "CORRECTED" ? "Updated after a source correction" : observation.quality === "STALE" ? "Data is stale" : "Data is being checked",
    reasonCodes: [code],
  };
}
