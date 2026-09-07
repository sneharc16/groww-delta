import { matchIntents } from "@/domain/attention/intent-matchers";
import type { AttentionAnalysisInput, IntentMatch } from "@/domain/attention/types";
import type { TrustReasonCode } from "./types";
import { canConfirmPrice } from "./freshness";
import { splitRatio } from "./corporate-actions";

export interface PriceConditionAssessment {
  logicalIntentId: string;
  conditionCandidate: boolean;
  conditionConfirmed: boolean;
  reasonCodes: TrustReasonCode[];
}

/** Candidate diagnostics never enter normal relevance or the trusted state machine. */
export function assessPriceConditions(input: AttentionAnalysisInput, confirmed: IntentMatch[]): PriceConditionAssessment[] {
  return input.activeIntents.filter((intent) => intent.type === "PRICE_LEVEL").map((intent) => {
    const candidate = matchIntents({ intents: [intent], snapshots: input.snapshots.map((row) => ({ ...row, quality: "FRESH" })),
      events: input.events, cursorSequence: input.cursor.lastSeenSequence, currentSequence: input.currentSequence,
      demoTimeTravel: input.demoTimeTravel }).length > 0;
    const conditionConfirmed = confirmed.some((match) => match.logicalIntentId === intent.logicalIntentId);
    const reasonCodes: TrustReasonCode[] = [];
    if (!conditionConfirmed && candidate) {
      for (const row of input.snapshots.filter((row) => row.sequence > input.cursor.lastSeenSequence && row.sequence <= input.currentSequence && !canConfirmPrice(row))) {
        reasonCodes.push(row.quality === "STALE" ? "PRICE_CONDITION_UNCONFIRMED_STALE_DATA" : row.quality === "CONFLICTING" ? "PRICE_CONDITION_UNCONFIRMED_CONFLICTING_DATA" : "PRICE_CONDITION_UNCONFIRMED_DELAYED_DATA");
      }
      if (input.providerHealth?.status === "UNAVAILABLE") reasonCodes.push("PROVIDER_UNAVAILABLE");
    }
    if (input.events.some((event) => event.instrumentId === intent.instrumentId && event.sequence > intent.effectiveFromSequence && event.sequence <= input.currentSequence && splitRatio(event))) reasonCodes.push("CORPORATE_ACTION_AFFECTS_REFERENCE_PRICE");
    return { logicalIntentId: intent.logicalIntentId, conditionCandidate: candidate, conditionConfirmed, reasonCodes: [...new Set(reasonCodes)] };
  });
}
