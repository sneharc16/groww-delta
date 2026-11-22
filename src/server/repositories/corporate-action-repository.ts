import { Prisma } from "@/generated/prisma/client";
import { database, type Database } from "./database";
import { AppError } from "@/lib/errors/app-error";
import type { CorporateActionReviewRepository } from "./contracts";

export class PrismaCorporateActionReviewRepository implements CorporateActionReviewRepository {
  constructor(private readonly db: Database = database) {}
  list(userId: string, scenarioId: string, demoGeneration = 0) { return this.db.corporateActionReview.findMany({ where: { userId, scenarioId, demoGeneration }, orderBy: { decidedAt: "asc" } }); }
  decide(input: Parameters<CorporateActionReviewRepository["decide"]>[0], previousIntentId: string, nextIntent?: Parameters<CorporateActionReviewRepository["decide"]>[2]) {
    return this.db.$transaction(async (transaction) => {
      const existing = await transaction.corporateActionReview.findUnique({ where: { userId_logicalIntentId_eventId_demoGeneration: { userId: input.userId, logicalIntentId: input.logicalIntentId, eventId: input.eventId, demoGeneration: input.demoGeneration } } });
      if (existing && existing.decision !== "LATER") return existing;
      if (nextIntent) {
        const changed = await transaction.watchIntent.updateMany({ where: { id: previousIntentId, userId: input.userId, status: "ACTIVE" }, data: { status: "SUPERSEDED" } });
        if (changed.count !== 1) throw new AppError("INTENT_VERSION_CONFLICT", "This watch reason changed. Refresh before adjusting it.", 409);
        await transaction.watchIntent.create({ data: { ...nextIntent, structuredPayload: nextIntent.structuredPayload as Prisma.InputJsonValue } });
      }
      return transaction.corporateActionReview.upsert({
        where: { userId_logicalIntentId_eventId_demoGeneration: { userId: input.userId, logicalIntentId: input.logicalIntentId, eventId: input.eventId, demoGeneration: input.demoGeneration } },
        create: input, update: { ...input, decidedAt: new Date() },
      });
    });
  }
}
