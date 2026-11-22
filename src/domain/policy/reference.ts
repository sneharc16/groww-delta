/** Frozen Build 4 semantics. Change version whenever scientific meaning changes. */
export const REFERENCE_POLICY = {
  version: "groww-delta-reference-1.0.0",
  weights: { significance: 0.30, relevance: 0.35, novelty: 0.15, urgency: 0.10, confidence: 0.10 },
  components: { cursor: true, graph: true, directIntent: true, significance: true, urgency: true, confidence: true, volume: true, events: true, calmMode: true },
  significance: {
    surpriseBounds: [1, 1.5, 2, 3], absoluteBpsBounds: [50, 100, 200, 400],
    volumeBounds: [1.3, 1.5, 2, 3], bucketScores: [0, 30, 50, 70, 90], multiSignalBonus: 10,
    events: { RESULTS_PUBLISHED: 90, CORPORATE_EVENT: 80, TECHNICAL_TRANSITION: 60, EXTERNAL_DRIVER: 60, NEWS_EVENT: 50, QUOTE_UPDATE: 0 },
  },
  significantLaneThreshold: 50,
  directRelevance: 100,
  novelty: { changedWindow: 100, acknowledgedWindow: 0, sequenceBased: true },
  urgency: { crossing: 100, near: 80, earnings: 70, technical: 70, driver: 60, dividend: 60, companyEvent: 60, graph: 60 },
  qualityConfidence: { FRESH: 100, DELAYED: 70, STALE: 30, CONFLICTING: 0, CORRECTED: 80 },
  graph: { maxDepth: 3, maxNodes: 25, minimumRelevance: 50, authoritativeSubject: true, pathCombination: "PRODUCT" },
  trust: { maxPriceDelaySeconds: 60, excludedQualities: ["STALE", "CONFLICTING"], lastTrustedConditionState: true },
  calm: { benchmark: "NSE:NIFTY50", benchmarkThresholdBps: 250, breadthThreshold: 0.70, medianMoveBps: 200, beta: 1 },
  corrections: "APPEND_ONLY_SEEN_NOTICE_UNSEEN_REPLACEMENT",
  corporateActions: "EXPLICIT_REVIEW_NEAREST_PAISE_HALF_UP",
  knowledge: "EXPLICIT_MONOTONIC_ACKNOWLEDGEMENT",
} as const;

export type AttentionPolicy = {
  version: string;
  weights: { -readonly [K in keyof typeof REFERENCE_POLICY.weights]: number };
  components: { -readonly [K in keyof typeof REFERENCE_POLICY.components]: boolean };
} & Omit<typeof REFERENCE_POLICY, "version" | "weights" | "components">;

function freeze(value: object): void {
  Object.values(value).forEach(child => { if (child && typeof child === "object") freeze(child); });
  Object.freeze(value);
}
freeze(REFERENCE_POLICY);
