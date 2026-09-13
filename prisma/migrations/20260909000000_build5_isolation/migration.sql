-- Preserve all pre-existing demo data; sessions receive independent mutable copies.
DROP INDEX "WatchIntent_logicalIntentId_version_key";
CREATE UNIQUE INDEX "WatchIntent_userId_logicalIntentId_version_key" ON "WatchIntent"("userId","logicalIntentId","version");
DROP INDEX "WatchGraph_logicalGraphId_version_key";
CREATE UNIQUE INDEX "WatchGraph_userId_logicalGraphId_version_key" ON "WatchGraph"("userId","logicalGraphId","version");
CREATE TABLE "AnonymousSession" (
 "id" TEXT PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE, "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
 "demoSessionId" TEXT NOT NULL UNIQUE REFERENCES "DemoSession"("id") ON DELETE CASCADE,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMPTZ(3) NOT NULL, "showGroupedMoves" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "AnonymousSession_expiresAt_idx" ON "AnonymousSession"("expiresAt");
CREATE TABLE "MutationReceipt" (
 "id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL REFERENCES "AnonymousSession"("id") ON DELETE CASCADE,
 "key" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "status" INTEGER NOT NULL, "response" JSONB NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "MutationReceipt_sessionId_key_key" ON "MutationReceipt"("sessionId","key");
CREATE TABLE "ReplayDataset" ("scenarioId" TEXT NOT NULL, "version" TEXT NOT NULL, "contentHash" TEXT NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("scenarioId","version"));
CREATE INDEX "MarketEvent_scenarioId_sequence_idx" ON "MarketEvent"("scenarioId","sequence");
CREATE INDEX "MarketEvent_correctionOfId_idx" ON "MarketEvent"("correctionOfId");
