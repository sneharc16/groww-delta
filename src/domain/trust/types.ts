import type { MarketQuality } from "@/domain/market/types";

export const TRUST_REASON_CODES = [
  "DATA_CURRENT", "DATA_DELAYED", "DATA_STALE", "DATA_CONFLICTING", "DATA_CORRECTED",
  "PRICE_CONDITION_UNCONFIRMED_STALE_DATA", "PRICE_CONDITION_UNCONFIRMED_CONFLICTING_DATA",
  "PRICE_CONDITION_UNCONFIRMED_DELAYED_DATA", "EVENT_WITHHELD_LOW_TRUST",
  "PREVIOUSLY_SEEN_INFORMATION_CORRECTED", "CORPORATE_ACTION_AFFECTS_REFERENCE_PRICE",
  "MARKET_WIDE_MOVE_GROUPED", "MARKET_RELATIVE_MOVE", "PROVIDER_UNAVAILABLE",
] as const;
export type TrustReasonCode = (typeof TRUST_REASON_CODES)[number];
export interface MarketProviderHealth {
  status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  lastSuccessfulUpdate: string | null;
  message: string | null;
}
export interface DataTrust {
  level: "CURRENT" | "DELAYED" | "UNRELIABLE" | "CORRECTED";
  quality: MarketQuality;
  source: string;
  eventTime: string;
  receivedTime: string | null;
  delaySeconds: number;
  ageSeconds: number;
  label: string;
  reasonCodes: TrustReasonCode[];
}
export interface CorporateReviewAction {
  logicalIntentId: string;
  eventId: string;
  originalTargetPaise: number;
  adjustedTargetPaise: number;
  decision: "ADJUST" | "KEEP" | "LATER" | null;
}
export interface TrustNotice {
  id: string;
  type: "STALE_FEED" | "CONFLICTING_DATA" | "DELAYED_DATA" | "CORRECTED_INFORMATION" | "CORPORATE_ACTION_REVIEW" | "PROVIDER_UNAVAILABLE";
  instrumentId: string | null;
  severity: "INFO" | "CAUTION";
  title: string;
  message: string;
  reasonCodes: TrustReasonCode[];
  occurredAt: string;
  metadata: Record<string, string | number | null>;
  action?: CorporateReviewAction;
}
export interface CorporateActionReviewRecord {
  demoGeneration: number;
  id: string;
  userId: string;
  logicalIntentId: string;
  eventId: string;
  scenarioId: string;
  decision: "ADJUST" | "KEEP" | "LATER";
  originalTargetPaise: number;
  adjustedTargetPaise: number;
  resultingIntentId: string | null;
  decidedAt: Date;
}
