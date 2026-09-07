import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type {
  CreateIntentRecordInput,
  DemoSessionRepository,
  InstrumentRepository,
  MarketEventRepository,
  MarketSnapshotRepository,
  KnowledgeCursorRepository,
  KnowledgeAcknowledgementRepository,
  WatchGraphRepository,
  WatchIntentRepository,
  WatchlistRepository,
} from "./contracts";

const instrumentSelect = {
  id: true,
  symbol: true,
  exchange: true,
  name: true,
  sector: true,
  currency: true,
  isActive: true,
  kind: true,
  isWatchlistEligible: true,
} as const;

const graphInclude = { nodes: { orderBy: { nodeKey: "asc" as const } }, edges: { orderBy: { id: "asc" as const } } } as const;

export class PrismaInstrumentRepository implements InstrumentRepository {
  listActive() {
    return prisma.instrument.findMany({ where: { isActive: true }, select: instrumentSelect, orderBy: { symbol: "asc" } });
  }

  findById(id: string) {
    return prisma.instrument.findUnique({ where: { id }, select: instrumentSelect });
  }
}

export class PrismaWatchlistRepository implements WatchlistRepository {
  getDefaultForUser(userId: string) {
    return prisma.watchlist.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        items: {
          where: { archivedAt: null },
          orderBy: { addedAt: "asc" },
          include: { instrument: { select: instrumentSelect } },
        },
      },
    });
  }

  findActiveItem(watchlistId: string, instrumentId: string) {
    return prisma.watchlistItem.findFirst({
      where: { watchlistId, instrumentId, archivedAt: null },
      include: { instrument: { select: instrumentSelect } },
    });
  }

  addItem(watchlistId: string, instrumentId: string) {
    return prisma.watchlistItem.create({
      data: { watchlistId, instrumentId, provenanceSource: "MANUAL" },
      include: { instrument: { select: instrumentSelect } },
    });
  }

  async archiveItem(itemId: string, watchlistId: string, archivedAt: Date) {
    const result = await prisma.watchlistItem.updateMany({
      where: { id: itemId, watchlistId, archivedAt: null },
      data: { archivedAt },
    });
    return result.count === 1;
  }
}

function intentData(input: CreateIntentRecordInput) {
  return {
    ...input,
    structuredPayload: input.structuredPayload as Prisma.InputJsonValue,
  };
}

export class PrismaWatchIntentRepository implements WatchIntentRepository {
  listForInstrument(userId: string, instrumentId: string) {
    return prisma.watchIntent.findMany({
      where: { userId, instrumentId },
      orderBy: [{ logicalIntentId: "asc" }, { version: "desc" }],
    });
  }

  listActiveForInstruments(userId: string, instrumentIds: string[]) {
    return prisma.watchIntent.findMany({
      where: { userId, instrumentId: { in: instrumentIds }, status: "ACTIVE" },
      orderBy: [{ instrumentId: "asc" }, { logicalIntentId: "asc" }],
    });
  }

  findCurrent(userId: string, logicalIntentId: string) {
    return prisma.watchIntent.findFirst({
      where: { userId, logicalIntentId, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
  }

  findLatest(userId: string, logicalIntentId: string) {
    return prisma.watchIntent.findFirst({ where: { userId, logicalIntentId }, orderBy: { version: "desc" } });
  }

  create(input: CreateIntentRecordInput) {
    return prisma.watchIntent.create({ data: intentData(input) });
  }

  async supersedeAndCreate(previousId: string, input: CreateIntentRecordInput) {
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.watchIntent.updateMany({
        where: { id: previousId, status: "ACTIVE" },
        data: { status: "SUPERSEDED" },
      });
      if (updated.count !== 1) throw new Error("Intent was changed before the edit could be saved.");
      return transaction.watchIntent.create({ data: intentData(input) });
    });
  }

  archiveCurrent(id: string) {
    return prisma.watchIntent.update({ where: { id }, data: { status: "ARCHIVED" } });
  }


  resolveCurrent(id: string, resolvedAt: Date, resolvedAtSequence: number) {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.watchIntent.findUniqueOrThrow({ where: { id } });
      const changed = await transaction.watchIntent.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "RESOLVED", resolvedAt, resolvedAtSequence } });
      if (changed.count !== 1) throw new AppError("INTENT_VERSION_CONFLICT", "This watch reason changed. Refresh and try again.", 409);
      await transaction.watchGraph.updateMany({ where: { userId: current.userId, watchIntentLogicalId: current.logicalIntentId, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
      return transaction.watchIntent.findUniqueOrThrow({ where: { id } });
    });
  }

  keepWatching(id: string, throughSequence: number) {
    return prisma.watchIntent.update({ where: { id }, data: { lifecycleReviewedThroughSequence: throughSequence } });
  }

  renew(previousId: string, input: CreateIntentRecordInput) {
    return prisma.watchIntent.create({ data: intentData({ ...input, supersedesId: previousId }) });
  }
}

export class PrismaDemoSessionRepository implements DemoSessionRepository {
  getById(id: string) {
    return prisma.demoSession.findUnique({ where: { id } });
  }

  async setPosition(id: string, currentStep: number, currentSequence: number, currentTime: Date) {
    const state = await prisma.demoSession.findUniqueOrThrow({ where: { id } });
    return prisma.demoSession.update({ where: { id }, data: { currentStep, currentSequence, currentTime, ...(state.providerStatus === "UNAVAILABLE" ? {} : { lastHealthySequence: currentSequence }) } });
  }

  resetScenario(id: string, scenarioId: string, time: Date, userId: string, baselines: Parameters<DemoSessionRepository["resetScenario"]>[4]) {
    return prisma.$transaction(async (transaction) => {
      const state = await transaction.demoSession.update({ where: { id }, data: { scenarioId, currentStep: 0, currentSequence: 0, currentTime: time, providerStatus: "HEALTHY", lastHealthySequence: 0, generation: { increment: 1 } } });
      const active = await transaction.watchlistItem.findMany({ where: { archivedAt: null, watchlist: { userId } } });
      for (const item of active) {
        const baseline = baselines.find((row) => row.instrumentId === item.instrumentId);
        if (!baseline) throw new AppError("INVALID_MARKET_STATE", "Scenario baseline is incomplete.", 409);
        await transaction.knowledgeCursor.upsert({ where: { userId_instrumentId: { userId, instrumentId: item.instrumentId } },
          create: { userId, instrumentId: item.instrumentId, lastSeenSequence: 0, lastSeenEventTime: time, lastObservedSnapshotId: baseline.snapshotId, cursorVersion: 1 },
          update: { lastSeenSequence: 0, lastSeenEventTime: time, lastObservedSnapshotId: baseline.snapshotId, cursorVersion: { increment: 1 } } });
      }
      return state;
    });
  }

  async setProviderStatus(id: string, status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE") {
    const state = await prisma.demoSession.findUniqueOrThrow({ where: { id } });
    return prisma.demoSession.update({ where: { id }, data: { providerStatus: status, ...(status === "UNAVAILABLE" ? {} : { lastHealthySequence: state.currentSequence }) } });
  }
}

export class PrismaMarketSnapshotRepository implements MarketSnapshotRepository {
  findCurrent(instrumentId: string, currentSequence: number, scenarioId = "groww-delta-default") {
    return prisma.marketSnapshot.findFirst({ where: { scenarioId, instrumentId, sequence: { lte: currentSequence } }, orderBy: { sequence: "desc" } });
  }

  async findCurrentMany(instrumentIds: string[], currentSequence: number, scenarioId = "groww-delta-default") {
    if (instrumentIds.length === 0) return [];
    const rows = await prisma.marketSnapshot.findMany({
      where: { scenarioId, instrumentId: { in: instrumentIds }, sequence: { lte: currentSequence } },
      orderBy: [{ instrumentId: "asc" }, { sequence: "desc" }],
    });
    const found = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!found.has(row.instrumentId)) found.set(row.instrumentId, row);
    return [...found.values()];
  }

  listThroughSequence(instrumentId: string, currentSequence: number, scenarioId = "groww-delta-default") {
    return prisma.marketSnapshot.findMany({ where: { scenarioId, instrumentId, sequence: { lte: currentSequence } }, orderBy: { sequence: "asc" } });
  }

  listForInstrumentsThrough(instrumentIds: string[], currentSequence: number, scenarioId = "groww-delta-default") {
    if (instrumentIds.length === 0) return Promise.resolve([]);
    return prisma.marketSnapshot.findMany({
      where: { scenarioId, instrumentId: { in: instrumentIds }, sequence: { lte: currentSequence } },
      orderBy: [{ instrumentId: "asc" }, { sequence: "asc" }],
    });
  }
}

export class PrismaMarketEventRepository implements MarketEventRepository {
  listBetweenSequences(exclusiveStart: number, inclusiveEnd: number, scenarioId = "groww-delta-default") {
    return prisma.marketEvent.findMany({
      where: { scenarioId, sequence: { gt: exclusiveStart, lte: inclusiveEnd } },
      orderBy: [{ sequence: "asc" }, { eventTime: "asc" }, { id: "asc" }],
    });
  }
}

export class PrismaKnowledgeCursorRepository implements KnowledgeCursorRepository {
  acknowledgeMany(userId: string, inputs: Parameters<KnowledgeCursorRepository["acknowledgeMany"]>[1], scope: "INSTRUMENT" | "WATCHLIST") {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "DemoSession" WHERE "id" = 'default-demo-session' FOR SHARE`;
      const state = await transaction.demoSession.findUnique({ where: { id: "default-demo-session" } });
      const result = [];
      for (const input of [...inputs].sort((a, b) => a.instrumentId.localeCompare(b.instrumentId))) {
        if (input.expectedScenarioId !== undefined && (input.expectedScenarioId !== state?.scenarioId || input.expectedGeneration !== state.generation)) throw new AppError("INVALID_ACK_SEQUENCE", "The replay was reset. Refresh before marking information seen.", 409);
        const rows = await transaction.$queryRaw<Array<{ lastSeenSequence: number }>>`
          SELECT "lastSeenSequence" FROM "KnowledgeCursor"
          WHERE "userId" = ${userId} AND "instrumentId" = ${input.instrumentId} FOR UPDATE`;
        const previous = rows[0];
        if (!previous) throw new AppError("CURSOR_NOT_FOUND", "The knowledge cursor does not exist.", 409);
        if (previous.lastSeenSequence < input.sequence) {
          await transaction.knowledgeCursor.updateMany({
            where: { userId, instrumentId: input.instrumentId, lastSeenSequence: { lt: input.sequence } },
            data: { lastSeenSequence: input.sequence, lastSeenEventTime: input.eventTime, lastObservedSnapshotId: input.snapshotId, cursorVersion: { increment: 1 } },
          });
          await transaction.knowledgeAcknowledgement.create({ data: {
            userId, instrumentId: input.instrumentId, fromSequence: previous.lastSeenSequence,
            throughSequence: input.sequence, scope, scenarioId: state?.scenarioId ?? "groww-delta-default", demoGeneration: state?.generation ?? 0,
          } });
        }
        result.push(await transaction.knowledgeCursor.findUniqueOrThrow({ where: { userId_instrumentId: { userId, instrumentId: input.instrumentId } } }));
      }
      return result;
    });
  }
  listForInstruments(userId: string, instrumentIds: string[]) {
    if (instrumentIds.length === 0) return Promise.resolve([]);
    return prisma.knowledgeCursor.findMany({
      where: { userId, instrumentId: { in: instrumentIds } },
      orderBy: { instrumentId: "asc" },
    });
  }

  setBaseline(userId: string, input: Parameters<KnowledgeCursorRepository["setBaseline"]>[1]) {
    return prisma.knowledgeCursor.upsert({
      where: { userId_instrumentId: { userId, instrumentId: input.instrumentId } },
      update: {
        lastSeenSequence: input.sequence,
        lastSeenEventTime: input.eventTime,
        lastObservedSnapshotId: input.snapshotId,
        cursorVersion: { increment: 1 },
      },
      create: {
        userId,
        instrumentId: input.instrumentId,
        lastSeenSequence: input.sequence,
        lastSeenEventTime: input.eventTime,
        lastObservedSnapshotId: input.snapshotId,
        cursorVersion: 1,
      },
    });
  }

  async advanceMonotonic(userId: string, input: Parameters<KnowledgeCursorRepository["advanceMonotonic"]>[1]) {
    await prisma.knowledgeCursor.updateMany({
      where: { userId, instrumentId: input.instrumentId, lastSeenSequence: { lt: input.sequence } },
      data: {
        lastSeenSequence: input.sequence,
        lastSeenEventTime: input.eventTime,
        lastObservedSnapshotId: input.snapshotId,
        cursorVersion: { increment: 1 },
      },
    });
    return prisma.knowledgeCursor.findUnique({ where: { userId_instrumentId: { userId, instrumentId: input.instrumentId } } });
  }

  resetMany(userId: string, inputs: Parameters<KnowledgeCursorRepository["resetMany"]>[1]) {
    return prisma.$transaction(inputs.map((input) => prisma.knowledgeCursor.upsert({
      where: { userId_instrumentId: { userId, instrumentId: input.instrumentId } },
      update: {
        lastSeenSequence: input.sequence,
        lastSeenEventTime: input.eventTime,
        lastObservedSnapshotId: input.snapshotId,
        cursorVersion: { increment: 1 },
      },
      create: {
        userId,
        instrumentId: input.instrumentId,
        lastSeenSequence: input.sequence,
        lastSeenEventTime: input.eventTime,
        lastObservedSnapshotId: input.snapshotId,
        cursorVersion: 1,
      },
    })));
  }
}

export class PrismaKnowledgeAcknowledgementRepository implements KnowledgeAcknowledgementRepository {
  create(input: Parameters<KnowledgeAcknowledgementRepository["create"]>[0]) {
    return prisma.knowledgeAcknowledgement.create({ data: input });
  }

  listForInstrument(userId: string, instrumentId: string) {
    return prisma.knowledgeAcknowledgement.findMany({
      where: { userId, instrumentId },
      orderBy: [{ throughSequence: "asc" }, { acknowledgedAt: "asc" }],
    });
  }
}

export class PrismaWatchGraphRepository implements WatchGraphRepository {
  listActiveForIntentLogicalIds(userId: string, logicalIntentIds: string[]) {
    if (logicalIntentIds.length === 0) return Promise.resolve([]);
    return prisma.watchGraph.findMany({
      where: { userId, watchIntentLogicalId: { in: logicalIntentIds }, status: "ACTIVE" },
      include: graphInclude,
      orderBy: [{ watchIntentLogicalId: "asc" }, { version: "desc" }],
    });
  }

  listForIntent(userId: string, logicalIntentId: string) {
    return prisma.watchGraph.findMany({
      where: { userId, watchIntentLogicalId: logicalIntentId },
      include: graphInclude,
      orderBy: { version: "desc" },
    });
  }

  findActive(userId: string, logicalIntentId: string) {
    return prisma.watchGraph.findFirst({
      where: { userId, watchIntentLogicalId: logicalIntentId, status: "ACTIVE" },
      include: graphInclude,
      orderBy: { version: "desc" },
    });
  }

  createVersion(previousId: string | null, input: Parameters<WatchGraphRepository["createVersion"]>[1]) {
    return prisma.$transaction(async (transaction) => {
      if (previousId) {
        await transaction.watchGraph.updateMany({ where: { id: previousId, status: "ACTIVE" }, data: { status: "SUPERSEDED" } });
      }
      await transaction.watchGraph.create({
        data: {
          id: input.id,
          logicalGraphId: input.logicalGraphId,
          userId: input.userId,
          instrumentId: input.instrumentId,
          watchIntentLogicalId: input.watchIntentLogicalId,
          version: input.version,
          provenance: input.provenance,
          templateKey: input.templateKey,
          effectiveFromSequence: input.effectiveFromSequence,
          effectiveScenarioId: input.effectiveScenarioId,
          effectiveDemoGeneration: input.effectiveDemoGeneration,
          supersedesId: input.supersedesId,
          nodes: { create: input.nodes.map((node) => ({ id: node.id, nodeKey: node.nodeKey, type: node.type, label: node.label, metadata: (node.metadata ?? {}) as Prisma.InputJsonValue })) },
        },
      });
      if (input.edges.length) {
        await transaction.watchGraphEdge.createMany({ data: input.edges.map((edge) => ({ id: edge.id, graphId: input.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, relationship: edge.relationship, weight: edge.weight })) });
      }
      const created = await transaction.watchGraph.findUnique({ where: { id: input.id }, include: graphInclude });
      if (!created) throw new Error("The graph version could not be loaded after creation.");
      return created;
    });
  }

  async archiveActiveForIntent(userId: string, logicalIntentId: string) {
    const result = await prisma.watchGraph.updateMany({ where: { userId, watchIntentLogicalId: logicalIntentId, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
    return result.count;
  }
}
