import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import { formatINRFromPaise, formatISTTime } from "@/lib/format/market";
import { assessData, canConfirmPrice } from "./freshness";
import { seenCorrectionAncestor } from "./events";
import type { TrustNotice } from "./types";

export function observationNotices(name: string, current: MarketSnapshotRecord, snapshots: MarketSnapshotRecord[], asOf: Date): TrustNotice[] {
  const trust = assessData(current, asOf);
  if (trust.level === "CURRENT" || trust.level === "CORRECTED") return [];
  const confirmed = [...snapshots].filter(canConfirmPrice).sort((a, b) => b.sequence - a.sequence)[0];
  const last = confirmed ? ` Latest confirmed value: ${formatINRFromPaise(confirmed.pricePaise)} at ${formatISTTime(confirmed.eventTime.toISOString())}.` : "";
  const conflicting = current.quality === "CONFLICTING";
  const stale = current.quality === "STALE";
  return [{
    id: `quality:${current.id}`, type: conflicting ? "CONFLICTING_DATA" : stale ? "STALE_FEED" : "DELAYED_DATA",
    instrumentId: current.instrumentId, severity: conflicting || stale ? "CAUTION" : "INFO",
    title: conflicting ? "Market data is being verified." : stale ? `${name} price data is stale.` : trust.label,
    message: (conflicting ? "The disputed update cannot confirm a saved condition." : stale ? "Your saved price condition has not been confirmed." : "This update carries a delay; its timestamp is shown.") + last,
    reasonCodes: [...trust.reasonCodes, ...(stale ? ["PRICE_CONDITION_UNCONFIRMED_STALE_DATA" as const] : conflicting ? ["PRICE_CONDITION_UNCONFIRMED_CONFLICTING_DATA" as const] : [])],
    occurredAt: current.eventTime.toISOString(), metadata: { source: current.source, eventTime: trust.eventTime, receivedTime: trust.receivedTime, delaySeconds: trust.delaySeconds, confirmedPricePaise: confirmed?.pricePaise ?? null },
  }];
}
export function correctionNotices(events: MarketEventRecord[], all: Map<string, MarketEventRecord>, cursorSequence: number, name: string): TrustNotice[] {
  return events.flatMap((event) => {
    const original = seenCorrectionAncestor(event, all, cursorSequence);
    if (!original || event.sequence <= cursorSequence || original.sequence > cursorSequence) return [];
    const before = original.payload && typeof original.payload === "object" ? original.payload as Record<string, unknown> : {};
    const after = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {};
    const changes = Object.keys(after).filter((key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]))
      .map((key) => `${key}: ${JSON.stringify(before[key]) ?? "not supplied"} → ${JSON.stringify(after[key])}`).join("; ");
    return [{ id: `correction:${event.id}`, type: "CORRECTED_INFORMATION" as const, instrumentId: event.instrumentId,
      severity: "CAUTION" as const, title: "Information you previously viewed was corrected.",
      message: `${name}: ${changes || "The source published an updated observation."}`,
      reasonCodes: ["PREVIOUSLY_SEEN_INFORMATION_CORRECTED" as const, "DATA_CORRECTED" as const], occurredAt: event.eventTime.toISOString(),
      metadata: { originalEventId: original.id, correctionEventId: event.id, originalEventTime: original.eventTime.toISOString(), correctionTime: event.eventTime.toISOString() } }];
  });
}

export function withheldEventNotices(events: MarketEventRecord[], name: string): TrustNotice[] {
  return events.filter((event) => event.quality === "STALE" || event.quality === "CONFLICTING").map((event) => ({
    id: `withheld:${event.id}`, type: event.quality === "STALE" ? "STALE_FEED" : "CONFLICTING_DATA",
    instrumentId: event.instrumentId, severity: "CAUTION",
    title: event.quality === "STALE" ? `${name} event data is stale.` : "Market data is being verified.",
    message: "This event has been withheld from normal attention until reliable information is available.",
    reasonCodes: ["EVENT_WITHHELD_LOW_TRUST", event.quality === "STALE" ? "DATA_STALE" : "DATA_CONFLICTING"],
    occurredAt: event.eventTime.toISOString(),
    metadata: { eventId: event.id, source: event.source, receivedTime: event.receivedTime.toISOString() },
  }));
}
