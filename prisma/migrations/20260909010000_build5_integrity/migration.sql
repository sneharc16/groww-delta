ALTER TABLE "MarketSnapshot" ADD COLUMN "scenarioVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "MarketEvent" ADD COLUMN "scenarioVersion" TEXT NOT NULL DEFAULT '1.0.0', ADD COLUMN "sourceEventId" TEXT, ADD COLUMN "eventVersion" INTEGER NOT NULL DEFAULT 1;
UPDATE "MarketEvent" SET "sourceEventId" = "id";
WITH RECURSIVE lineage AS (
 SELECT "id", 1 AS version FROM "MarketEvent" WHERE "correctionOfId" IS NULL
 UNION ALL SELECT e."id", l.version+1 FROM "MarketEvent" e JOIN lineage l ON e."correctionOfId"=l."id"
) UPDATE "MarketEvent" e SET "eventVersion"=l.version FROM lineage l WHERE e."id"=l."id";
DROP INDEX "MarketSnapshot_scenarioId_instrumentId_sequence_key";
CREATE UNIQUE INDEX "MarketSnapshot_scenario_version_instrument_sequence" ON "MarketSnapshot"("scenarioId","scenarioVersion","instrumentId","sequence");
CREATE UNIQUE INDEX "WatchIntent_one_active_version" ON "WatchIntent"("userId","logicalIntentId") WHERE "status"='ACTIVE';
CREATE UNIQUE INDEX "WatchGraph_one_active_per_intent" ON "WatchGraph"("userId","watchIntentLogicalId") WHERE "status"='ACTIVE';
ALTER TABLE "WatchGraphEdge" ADD CONSTRAINT "WatchGraphEdge_valid_weight" CHECK ("weight" BETWEEN 0 AND 100), ADD CONSTRAINT "WatchGraphEdge_no_self" CHECK ("fromNodeId"<>"toNodeId");
CREATE UNIQUE INDEX "WatchGraphNode_graphId_id_key" ON "WatchGraphNode"("graphId","id");
ALTER TABLE "WatchGraphEdge" ADD CONSTRAINT "WatchGraphEdge_same_graph_from" FOREIGN KEY ("graphId","fromNodeId") REFERENCES "WatchGraphNode"("graphId","id") ON DELETE CASCADE;
ALTER TABLE "WatchGraphEdge" ADD CONSTRAINT "WatchGraphEdge_same_graph_to" FOREIGN KEY ("graphId","toNodeId") REFERENCES "WatchGraphNode"("graphId","id") ON DELETE CASCADE;
CREATE FUNCTION reject_market_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Immutable market record: append a version/correction instead'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MarketEvent_immutable" BEFORE UPDATE ON "MarketEvent" FOR EACH ROW EXECUTE FUNCTION reject_market_rewrite();
CREATE TRIGGER "MarketSnapshot_immutable" BEFORE UPDATE ON "MarketSnapshot" FOR EACH ROW EXECUTE FUNCTION reject_market_rewrite();
CREATE TRIGGER "ReplayDataset_immutable" BEFORE UPDATE ON "ReplayDataset" FOR EACH ROW EXECUTE FUNCTION reject_market_rewrite();
