ALTER TABLE "DemoSession" ADD COLUMN "scenarioVersion" TEXT NOT NULL DEFAULT '1.0.0';
CREATE INDEX "MarketEvent_scenario_version_sequence_idx" ON "MarketEvent"("scenarioId", "scenarioVersion", "sequence");
