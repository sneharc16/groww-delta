CREATE TYPE "InstrumentKind" AS ENUM ('EQUITY', 'INDEX');
CREATE TYPE "ProviderStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNAVAILABLE');
CREATE TYPE "CorporateActionDecision" AS ENUM ('ADJUST', 'KEEP', 'LATER');
ALTER TABLE "Instrument" ADD COLUMN "kind" "InstrumentKind" NOT NULL DEFAULT 'EQUITY', ADD COLUMN "isWatchlistEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketSnapshot" ADD COLUMN "scenarioId" TEXT NOT NULL DEFAULT 'groww-delta-default', ADD COLUMN "receivedTime" TIMESTAMPTZ(3);
DROP INDEX "MarketSnapshot_instrumentId_sequence_key";
CREATE UNIQUE INDEX "MarketSnapshot_scenarioId_instrumentId_sequence_key" ON "MarketSnapshot"("scenarioId", "instrumentId", "sequence");
ALTER TABLE "MarketEvent" ADD COLUMN "scenarioId" TEXT NOT NULL DEFAULT 'groww-delta-default';
ALTER TABLE "WatchIntent" ADD COLUMN "effectiveScenarioId" TEXT NOT NULL DEFAULT 'groww-delta-default';
ALTER TABLE "WatchGraph" ADD COLUMN "effectiveScenarioId" TEXT NOT NULL DEFAULT 'groww-delta-default';
ALTER TABLE "KnowledgeAcknowledgement" ADD COLUMN "scenarioId" TEXT NOT NULL DEFAULT 'groww-delta-default', ADD COLUMN "demoGeneration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DemoSession" ADD COLUMN "providerStatus" "ProviderStatus" NOT NULL DEFAULT 'HEALTHY', ADD COLUMN "lastHealthySequence" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0;
UPDATE "DemoSession" SET "lastHealthySequence" = "currentSequence";
CREATE TABLE "CorporateActionReview" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "logicalIntentId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL, "scenarioId" TEXT NOT NULL, "decision" "CorporateActionDecision" NOT NULL,
  "originalTargetPaise" INTEGER NOT NULL, "adjustedTargetPaise" INTEGER NOT NULL,
  "resultingIntentId" TEXT, "decidedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CorporateActionReview_userId_logicalIntentId_eventId_key" ON "CorporateActionReview"("userId", "logicalIntentId", "eventId");

ALTER TABLE "WatchIntent" ADD COLUMN "effectiveDemoGeneration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WatchGraph" ADD COLUMN "effectiveDemoGeneration" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CorporateActionReview" ADD COLUMN "demoGeneration" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "CorporateActionReview_userId_logicalIntentId_eventId_key";
CREATE UNIQUE INDEX "CorporateActionReview_identity_key" ON "CorporateActionReview"("userId","logicalIntentId","eventId","demoGeneration");
