import { canUseEvent } from "./freshness";
import { z } from "zod";
import type { WatchIntentRecord } from "@/domain/intent/types";
import type { MarketEventRecord } from "@/domain/market/types";
import { priceLevelPayloadSchema } from "@/domain/intent/schemas";
import { AppError } from "@/lib/errors/app-error";
import { formatINRFromPaise } from "@/lib/format/market";
import type { CorporateActionReviewRecord, TrustNotice } from "./types";

export const splitSchema = z.object({ eventKind: z.literal("STOCK_SPLIT"), oldShares: z.number().int().positive().max(1000000), newShares: z.number().int().positive().max(1000000) });
export function splitRatio(event: MarketEventRecord) {
  if (event.type !== "CORPORATE_EVENT" || !event.payload || typeof event.payload !== "object" || !("eventKind" in event.payload) || event.payload.eventKind !== "STOCK_SPLIT") return null;
  const result = splitSchema.safeParse(event.payload);
  if (!result.success) throw new AppError("INVALID_CORPORATE_ACTION", "The stock split ratio is invalid.", 409);
  return result.data;
}
export function adjustedTarget(targetPaise: number, oldShares: number, newShares: number): number {
  const ratio = splitSchema.parse({ eventKind: "STOCK_SPLIT", oldShares, newShares });
  const numerator = BigInt(targetPaise) * BigInt(ratio.oldShares);
  const denominator = BigInt(ratio.newShares);
  const rounded = Number((numerator * 2n + denominator) / (denominator * 2n));
  if (!Number.isSafeInteger(rounded) || rounded < 1 || rounded > 2147483647) throw new AppError("INVALID_ADJUSTED_TARGET", "The adjusted level is outside supported paise values.", 409);
  return rounded;
}
export function corporateNotices(input: { intents: WatchIntentRecord[]; events: MarketEventRecord[]; decisions: CorporateActionReviewRecord[]; name: string }): TrustNotice[] {
  return input.events.flatMap((event) => {
    const split = splitRatio(event);
    if (!split || !canUseEvent(event)) return [];
    return input.intents.flatMap((intent) => {
      const parsed = priceLevelPayloadSchema.safeParse(intent.structuredPayload);
      if (intent.type !== "PRICE_LEVEL" || !parsed.success || event.instrumentId !== intent.instrumentId || event.sequence <= intent.effectiveFromSequence) return [];
      const decision = input.decisions.find((row) => row.logicalIntentId === intent.logicalIntentId && row.eventId === event.id);
      if (decision && decision.decision !== "LATER") return [];
      const equivalent = adjustedTarget(parsed.data.targetPricePaise, split.oldShares, split.newShares);
      return [{
        id: `corporate:${intent.logicalIntentId}:${event.id}`, type: "CORPORATE_ACTION_REVIEW" as const,
        instrumentId: intent.instrumentId, severity: "CAUTION" as const, title: "Corporate action affects your saved price level.",
        message: `${input.name}: your ${formatINRFromPaise(parsed.data.targetPricePaise)} watch level may need adjustment after a ${split.oldShares}:${split.newShares} stock split. Split-equivalent level: ${formatINRFromPaise(equivalent)}.`,
        reasonCodes: ["CORPORATE_ACTION_AFFECTS_REFERENCE_PRICE" as const], occurredAt: event.eventTime.toISOString(),
        metadata: { oldShares: split.oldShares, newShares: split.newShares },
        action: { logicalIntentId: intent.logicalIntentId, eventId: event.id, originalTargetPaise: parsed.data.targetPricePaise, adjustedTargetPaise: equivalent, decision: decision?.decision ?? null },
      }];
    });
  });
}
