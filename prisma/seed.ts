import { SCENARIO_IDENTITIES, scenarioIdentity, datasetRecordId } from "../data/replay/versioning";
import "dotenv/config";
import { seededIntents } from "../data/demo/initial-intents";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { defaultReplayScenario, replayInstruments } from "../data/replay/default-scenario";
import { replayScenarios } from "../data/replay/scenarios";
import { PRIMARY_BENCHMARK } from "../src/domain/trust/policy";
import { findDriverTemplate, graphDraftFromTemplate } from "../src/domain/graph/templates";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for seeding.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });



async function main() {
  await prisma.user.upsert({
    where: { id: "demo-user" },
    update: { displayName: "Demo Investor" },
    create: { id: "demo-user", displayName: "Demo Investor" },
  });

  for (const instrument of replayInstruments) {
    await prisma.instrument.upsert({
      where: { id: instrument.id },
      update: { symbol: instrument.symbol, exchange: instrument.exchange, name: instrument.name, sector: instrument.sector, currency: "INR", isActive: true },
      create: { ...instrument, currency: "INR", isActive: true },
    });
  }

  await prisma.watchlist.upsert({
    where: { id: "demo-watchlist" },
    update: { name: "My Watchlist" },
    create: { id: "demo-watchlist", userId: "demo-user", name: "My Watchlist" },
  });

  for (const instrument of replayInstruments) {
    await prisma.watchlistItem.upsert({
      where: { id: `watchlist-item:${instrument.symbol.toLowerCase()}` },
      update: {},
      create: {
        id: `watchlist-item:${instrument.symbol.toLowerCase()}`,
        watchlistId: "demo-watchlist",
        instrumentId: instrument.id,
        provenanceSource: "IMPORTED_DEMO",
        provenanceReference: "groww-delta-default",
      },
    });
  }

  for (const intent of seededIntents) {
    await prisma.watchIntent.upsert({
      where: { id: intent.id },
      update: {},
      create: {
        ...intent,
        userId: "demo-user",
        structuredPayload: intent.structuredPayload as Prisma.InputJsonValue,
        status: "ACTIVE",
        version: 1,
        effectiveFromSequence: 0,
      },
    });
  }

  const indigoGraphId = "watch-graph:indigo:fuel-cost:1";
  const indigoTemplate = findDriverTemplate("AIRLINE_FUEL_COST", "NSE:INDIGO");
  const indigoGraph = graphDraftFromTemplate(indigoTemplate, ["FUEL_COST", "CRUDE"]);
  await prisma.watchGraph.upsert({
    where: { id: indigoGraphId },
    update: {},
    create: {
      id: indigoGraphId,
      logicalGraphId: "watch-graph:indigo:fuel-cost",
      userId: "demo-user",
      instrumentId: "NSE:INDIGO",
      watchIntentLogicalId: "intent:indigo:driver",
      version: 1,
      status: "ACTIVE",
      provenance: "IMPORTED_DEMO",
      templateKey: indigoTemplate.key,
      effectiveFromSequence: 0,
      nodes: {
        create: indigoGraph.nodes.map((node) => ({
          id: `${indigoGraphId}:node:${node.nodeKey.toLowerCase()}`,
          nodeKey: node.nodeKey,
          type: node.type,
          label: node.label,
          metadata: (node.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      },
    },
  });
  const indigoNodeId = (nodeKey: string) => `${indigoGraphId}:node:${nodeKey.toLowerCase()}`;
  for (const [index, edge] of indigoGraph.edges.entries()) {
    await prisma.watchGraphEdge.upsert({
      where: { id: `${indigoGraphId}:edge:${index}` },
      update: {},
      create: {
        id: `${indigoGraphId}:edge:${index}`,
        graphId: indigoGraphId,
        fromNodeId: indigoNodeId(edge.fromKey),
        toNodeId: indigoNodeId(edge.toKey),
        relationship: edge.relationship,
        weight: edge.weight,
      },
    });
  }

  await prisma.instrument.upsert({ where: { id: PRIMARY_BENCHMARK }, update: { kind: "INDEX", isWatchlistEligible: false }, create: {
    id: PRIMARY_BENCHMARK, symbol: "NIFTY50", exchange: "NSE", name: "Nifty 50", sector: null, currency: "INR", kind: "INDEX", isWatchlistEligible: false,
  } });
  for (const identity of SCENARIO_IDENTITIES) {
    const existing = await prisma.replayDataset.findUnique({ where: { scenarioId_version: { scenarioId: identity.scenarioId, version: identity.scenarioVersion } } });
    if (existing && existing.contentHash !== identity.scenarioContentHash) throw new Error("Immutable replay dataset hash mismatch.");
    await prisma.replayDataset.upsert({ where: { scenarioId_version: { scenarioId: identity.scenarioId, version: identity.scenarioVersion } }, update: {}, create: { scenarioId: identity.scenarioId, version: identity.scenarioVersion, contentHash: identity.scenarioContentHash } });
  }
  for (const scenario of replayScenarios) {
  const { scenarioVersion } = scenarioIdentity(scenario);
  for (const step of scenario.steps) {
    for (const snapshot of step.snapshots) {
      const sourceId = scenario.id === "groww-delta-default" ? `snapshot:${step.sequence}:${snapshot.instrumentId}` : `snapshot:${scenario.id}:${step.sequence}:${snapshot.instrumentId}`;
      const id = datasetRecordId(sourceId, scenarioVersion);
      await prisma.marketSnapshot.upsert({
        where: { id },
        update: {},
        create: {
          id,
          instrumentId: snapshot.instrumentId,
          sequence: step.sequence,
          scenarioId: scenario.id, scenarioVersion,
          eventTime: new Date(Date.parse(step.eventTime) - (snapshot.delaySeconds ?? 0) * 1000),
          receivedTime: new Date(step.eventTime),
          pricePaise: snapshot.pricePaise,
          openPaise: snapshot.openPaise,
          highPaise: snapshot.highPaise,
          lowPaise: snapshot.lowPaise,
          cumulativeVolume: snapshot.cumulativeVolume,
          expectedCumulativeVolume: snapshot.expectedCumulativeVolume,
          expectedStepMoveBps: snapshot.expectedStepMoveBps,
          source: "ReplayMarketProvider",
          quality: snapshot.quality ?? "FRESH",
        },
      });
    }
  }

  const revisions = new Map<string, number>();
  for (const event of [...scenario.events].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))) {
    const previousRevision = event.correctionOfId ? revisions.get(event.correctionOfId) : 0;
    if (previousRevision === undefined) throw new Error("Correction must reference an earlier event in this dataset.");
    const eventVersion = previousRevision + 1;
    revisions.set(event.id, eventVersion);
    await prisma.marketEvent.upsert({
      where: { id: datasetRecordId(event.id, scenarioVersion) },
      update: {},
      create: {
        ...event,
        id: datasetRecordId(event.id, scenarioVersion),
        eventTime: new Date(event.eventTime),
        receivedTime: new Date(event.receivedTime ?? event.eventTime),
        scenarioId: scenario.id, scenarioVersion,
        correctionOfId: event.correctionOfId ? datasetRecordId(event.correctionOfId, scenarioVersion) : null,
        quality: event.quality ?? "FRESH",
        source: "ReplayMarketProvider",
        sourceEventId: event.id,
        eventVersion,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
  }

  }
  const initialStep = defaultReplayScenario.steps[0];
  for (const instrument of replayInstruments) {
    await prisma.knowledgeCursor.upsert({
      where: { userId_instrumentId: { userId: "demo-user", instrumentId: instrument.id } },
      update: {},
      create: {
        id: `cursor:${instrument.symbol.toLowerCase()}`,
        userId: "demo-user",
        instrumentId: instrument.id,
        lastSeenSequence: initialStep.sequence,
        lastSeenEventTime: new Date(initialStep.eventTime),
        lastObservedSnapshotId: `snapshot:${initialStep.sequence}:${instrument.id}`,
        cursorVersion: 1,
      },
    });
  }

  await prisma.demoSession.upsert({
    where: { id: "default-demo-session" },
    update: {},
    create: {
      id: "default-demo-session",
      scenarioId: defaultReplayScenario.id,
      currentStep: initialStep.step,
      currentSequence: initialStep.sequence,
      currentTime: new Date(initialStep.eventTime),
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
