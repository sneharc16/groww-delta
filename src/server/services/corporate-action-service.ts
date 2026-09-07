import { canUseEvent } from "@/domain/trust/freshness";
import { inReplayEnvironment } from "@/domain/market/effective-sequence";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { priceLevelPayloadSchema } from "@/domain/intent/schemas";
import { adjustedTarget, splitRatio } from "@/domain/trust/corporate-actions";
import { AppError } from "@/lib/errors/app-error";
import type { CorporateActionReviewRepository, WatchIntentRepository, CreateIntentRecordInput } from "@/server/repositories/contracts";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import { formatINRLevelFromPaise } from "@/lib/format/market";

export const corporateDecisionSchema = z.object({ eventId: z.string().min(1), decision: z.enum(["ADJUST", "KEEP", "LATER"]) }).strict();
export class CorporateActionService {
  constructor(private readonly reviews: CorporateActionReviewRepository, private readonly intents: WatchIntentRepository, private readonly market: MarketDataProvider) {}
  async decide(userId: string, logicalIntentId: string, untrusted: unknown) {
    const input = corporateDecisionSchema.parse(untrusted);
    const [intent, sequence, environment] = await Promise.all([this.intents.findCurrent(userId, logicalIntentId), this.market.getCurrentSequence(), this.market.getEnvironment()]);
    if (!intent) throw new AppError("WATCH_INTENT_NOT_FOUND", "No active watch reason was found.", 404);
    const existing = (await this.reviews.list(userId, environment.scenarioId, environment.generation)).find((row) => row.logicalIntentId === logicalIntentId && row.eventId === input.eventId);
    if (existing && existing.decision !== "LATER") return { review: existing, alreadyDecided: true };
    const event = (await this.market.getEventsBetween(-1, sequence)).find((row) => row.id === input.eventId && row.instrumentId === intent.instrumentId);
    const split = event ? splitRatio(event) : null;
    const target = priceLevelPayloadSchema.safeParse(intent.structuredPayload);
    const effective = inReplayEnvironment(intent, environment.scenarioId, environment.generation).effectiveFromSequence;
    if (!event || !canUseEvent(event) || !split || !target.success || intent.type !== "PRICE_LEVEL" || event.sequence <= effective) throw new AppError("CORPORATE_ACTION_REVIEW_REQUIRED", "No applicable corporate action affects this saved level.", 409);
    const adjusted = adjustedTarget(target.data.targetPricePaise, split.oldShares, split.newShares);
    const nextId = input.decision === "ADJUST" ? randomUUID() : null;
    const next: CreateIntentRecordInput | undefined = nextId ? {
      id: nextId, logicalIntentId, userId, instrumentId: intent.instrumentId, type: "PRICE_LEVEL",
      originalText: `Watching ${target.data.mode.toLowerCase()} ${formatINRLevelFromPaise(adjusted)}`,
      structuredPayload: { ...target.data, targetPricePaise: adjusted }, provenanceSource: "STOCK_DETAIL", provenanceReference: event.id,
      version: intent.version + 1, supersedesId: intent.id, effectiveFromSequence: sequence, effectiveScenarioId: environment.scenarioId, effectiveDemoGeneration: environment.generation,
      horizon: intent.horizon, expiresAt: intent.expiresAt,
    } : undefined;
    const review = await this.reviews.decide({ userId, logicalIntentId, eventId: event.id, scenarioId: environment.scenarioId, demoGeneration: environment.generation,
      decision: input.decision, originalTargetPaise: target.data.targetPricePaise, adjustedTargetPaise: adjusted, resultingIntentId: nextId }, intent.id, next);
    return { review: { ...review, decidedAt: review.decidedAt.toISOString() }, alreadyDecided: false };
  }
}
