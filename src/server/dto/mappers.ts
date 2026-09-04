import type { InstrumentRecord } from "@/domain/instrument/types";
import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import type { WatchIntentRecord } from "@/domain/intent/types";
import type { KnowledgeCursorRecord } from "@/domain/market/types";
import type { AttentionItem } from "@/domain/attention/types";
import type { AttentionItemDto, InstrumentDto, KnowledgeCursorDto, MarketEventDto, MarketSnapshotDto, WatchIntentDto } from "./types";

export function toInstrumentDto(instrument: InstrumentRecord): InstrumentDto {
  return {
    id: instrument.id,
    symbol: instrument.symbol,
    exchange: instrument.exchange,
    name: instrument.name,
    sector: instrument.sector,
    currency: instrument.currency,
  };
}

export function toSnapshotDto(snapshot: MarketSnapshotRecord): MarketSnapshotDto {
  return {
    id: snapshot.id,
    instrumentId: snapshot.instrumentId,
    sequence: snapshot.sequence,
    eventTime: snapshot.eventTime.toISOString(),
    pricePaise: snapshot.pricePaise,
    openPaise: snapshot.openPaise,
    highPaise: snapshot.highPaise,
    lowPaise: snapshot.lowPaise,
    cumulativeVolume: Number(snapshot.cumulativeVolume),
    expectedCumulativeVolume: snapshot.expectedCumulativeVolume === null ? null : Number(snapshot.expectedCumulativeVolume),
    expectedStepMoveBps: snapshot.expectedStepMoveBps,
    source: snapshot.source,
    quality: snapshot.quality,
    dayChangePercent: ((snapshot.pricePaise - snapshot.openPaise) / snapshot.openPaise) * 100,
  };
}

export function toIntentDto(intent: WatchIntentRecord): WatchIntentDto {
  return {
    id: intent.id,
    logicalIntentId: intent.logicalIntentId,
    instrumentId: intent.instrumentId,
    type: intent.type,
    originalText: intent.originalText,
    structuredPayload: intent.structuredPayload,
    provenanceSource: intent.provenanceSource,
    provenanceReference: intent.provenanceReference,
    status: intent.status,
    version: intent.version,
    effectiveFromSequence: intent.effectiveFromSequence,
    supersedesId: intent.supersedesId,
    horizon: intent.horizon,
    expiresAt: intent.expiresAt?.toISOString() ?? null,
    createdAt: intent.createdAt.toISOString(),
    updatedAt: intent.updatedAt.toISOString(),
  };
}

export function toEventDto(event: MarketEventRecord): MarketEventDto {
  return {
    id: event.id,
    sequence: event.sequence,
    instrumentId: event.instrumentId,
    type: event.type,
    eventTime: event.eventTime.toISOString(),
    receivedTime: event.receivedTime.toISOString(),
    source: event.source,
    quality: event.quality,
    payload: event.payload,
    correctionOfId: event.correctionOfId,
  };
}

export function toCursorDto(cursor: KnowledgeCursorRecord): KnowledgeCursorDto {
  return {
    id: cursor.id,
    instrumentId: cursor.instrumentId,
    lastSeenSequence: cursor.lastSeenSequence,
    lastSeenEventTime: cursor.lastSeenEventTime?.toISOString() ?? null,
    lastObservedSnapshotId: cursor.lastObservedSnapshotId,
    cursorVersion: cursor.cursorVersion,
  };
}

export function toAttentionItemDto(item: AttentionItem): AttentionItemDto {
  return {
    instrument: toInstrumentDto(item.instrument),
    fromSequence: item.fromSequence,
    toSequence: item.toSequence,
    fromTime: item.fromTime.toISOString(),
    toTime: item.toTime.toISOString(),
    baselineSnapshot: toSnapshotDto(item.baselineSnapshot),
    currentSnapshot: toSnapshotDto(item.currentSnapshot),
    baselinePricePaise: item.baselinePricePaise,
    currentPricePaise: item.currentPricePaise,
    priceDeltaPaise: item.priceDeltaPaise,
    priceDeltaBps: item.priceDeltaBps,
    expectedWindowMoveBps: item.expectedWindowMoveBps,
    priceSurprise: item.priceSurprise,
    volumeRatio: item.volumeRatio,
    priceSignificance: item.priceSignificance,
    volumeSignificance: item.volumeSignificance,
    eventSignificance: item.eventSignificance,
    significance: item.significance,
    relevance: item.relevance,
    novelty: item.novelty,
    urgency: item.urgency,
    confidence: item.confidence,
    score: item.score,
    lane: item.lane,
    matchedIntents: item.matchedIntents,
    reasonCodes: item.reasonCodes,
    eventSummaries: item.eventSummaries.map((event) => ({ ...event, eventTime: event.eventTime.toISOString() })),
    display: item.display,
  };
}
