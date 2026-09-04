export type MarketQuality = "FRESH" | "DELAYED" | "STALE" | "CONFLICTING" | "CORRECTED";
export type MarketEventType = "QUOTE_UPDATE" | "RESULTS_PUBLISHED" | "TECHNICAL_TRANSITION" | "CORPORATE_EVENT" | "EXTERNAL_DRIVER" | "NEWS_EVENT";

export interface MarketSnapshotRecord {
  id: string;
  instrumentId: string;
  sequence: number;
  eventTime: Date;
  pricePaise: number;
  openPaise: number;
  highPaise: number;
  lowPaise: number;
  cumulativeVolume: bigint;
  expectedCumulativeVolume: bigint | null;
  source: string;
  quality: MarketQuality;
}

export interface MarketEventRecord {
  id: string;
  sequence: number;
  instrumentId: string | null;
  type: MarketEventType;
  eventTime: Date;
  receivedTime: Date;
  source: string;
  quality: MarketQuality;
  payload: unknown;
  correctionOfId: string | null;
}

export interface DemoStateRecord {
  id: string;
  scenarioId: string;
  currentStep: number;
  currentSequence: number;
  currentTime: Date;
}
