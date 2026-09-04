import type { IntentStatus, IntentType, ProvenanceSource } from "@/domain/intent/types";
import type { MarketEventType, MarketQuality } from "@/domain/market/types";
import type { AttentionLane, AttentionDisplay, IntentMatch } from "@/domain/attention/types";
import type { AttentionReasonCode } from "@/domain/attention/reason-codes";

export interface InstrumentDto {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string | null;
  currency: string;
}

export interface MarketSnapshotDto {
  id: string;
  instrumentId: string;
  sequence: number;
  eventTime: string;
  pricePaise: number;
  openPaise: number;
  highPaise: number;
  lowPaise: number;
  cumulativeVolume: number;
  expectedCumulativeVolume: number | null;
  expectedStepMoveBps: number | null;
  source: string;
  quality: MarketQuality;
  dayChangePercent: number;
}

export interface WatchIntentDto {
  id: string;
  logicalIntentId: string;
  instrumentId: string;
  type: IntentType;
  originalText: string | null;
  structuredPayload: unknown;
  provenanceSource: ProvenanceSource;
  provenanceReference: string | null;
  status: IntentStatus;
  version: number;
  effectiveFromSequence: number;
  supersedesId: string | null;
  horizon: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItemDto {
  id: string;
  addedAt: string;
  provenanceSource: ProvenanceSource;
  provenanceReference: string | null;
  instrument: InstrumentDto;
  snapshot: MarketSnapshotDto | null;
  activeIntents: WatchIntentDto[];
}

export interface WatchlistDto {
  watchlist: { id: string; name: string };
  items: WatchlistItemDto[];
}

export interface DemoStateDto {
  scenario: { id: string; name: string; totalSteps: number; timezone: string };
  currentStep: number;
  currentSequence: number;
  currentTime: string;
  atFinalStep: boolean;
}

export interface MarketEventDto {
  id: string;
  sequence: number;
  instrumentId: string | null;
  type: MarketEventType;
  eventTime: string;
  receivedTime: string;
  source: string;
  quality: MarketQuality;
  payload: unknown;
  correctionOfId: string | null;
}

export interface KnowledgeCursorDto {
  id: string;
  instrumentId: string;
  lastSeenSequence: number;
  lastSeenEventTime: string | null;
  lastObservedSnapshotId: string | null;
  cursorVersion: number;
}

export interface AttentionItemDto {
  instrument: InstrumentDto;
  fromSequence: number;
  toSequence: number;
  fromTime: string;
  toTime: string;
  baselineSnapshot: MarketSnapshotDto;
  currentSnapshot: MarketSnapshotDto;
  baselinePricePaise: number;
  currentPricePaise: number;
  priceDeltaPaise: number;
  priceDeltaBps: number;
  expectedWindowMoveBps: number | null;
  priceSurprise: number | null;
  volumeRatio: number | null;
  priceSignificance: number;
  volumeSignificance: number;
  eventSignificance: number;
  significance: number;
  relevance: number;
  novelty: number;
  urgency: number;
  confidence: number;
  score: number;
  lane: AttentionLane;
  matchedIntents: IntentMatch[];
  reasonCodes: AttentionReasonCode[];
  eventSummaries: Array<{
    id: string;
    type: MarketEventType;
    eventTime: string;
    quality: MarketQuality;
    payload: unknown;
  }>;
  display: AttentionDisplay;
}

export interface CatchUpDto {
  asOfSequence: number;
  asOfTime: string;
  cursorSummary: {
    allAtSameSequence: boolean;
    minimumSequence: number;
    maximumSequence: number;
    commonLastSeenTime: string | null;
  };
  relevant: AttentionItemDto[];
  significant: AttentionItemDto[];
  quiet: AttentionItemDto[];
  counts: { relevant: number; significant: number; quiet: number };
}
