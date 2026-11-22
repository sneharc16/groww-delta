import { Prisma } from "@/generated/prisma/client";
import { database, type Database } from "./database";
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
  constructor(private readonly db: Database = database) {}
  listActive() {
    return this.db.instrument.findMany({ where: { isActive: true }, select: instrumentSelect, orderBy: { symbol: "asc" } });
  }

  findById(id: string) {
    return this.db.instrument.findUnique({ where: { id }, select: instrumentSelect });
  }
}

export class PrismaWatchlistRepository implements WatchlistRepository {
  constructor(private readonly db: Database = database) {}
  getDefaultForUser(userId: string) {
    return this.db.watchlist.findFirst({
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
    return this.db.watchlistItem.findFirst({
      where: { watchlistId, instrumentId, archivedAt: null },
      include: { instrument: { select: instrumentSelect } },
    });
  }

  addItem(watchlistId: string, instrumentId: string) {
    return this.db.watchlistItem.create({
      data: { watchlistId, instrumentId, provenanceSource: "MANUAL" },
      include: { instrument: { select: instrumentSelect } },
    });
  }

  async archiveItem(itemId: string, watchlistId: string, archivedAt: Date) {
    const result = await this.db.watchlistItem.updateMany({
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
  constructor(private readonly db: Database = database) {}
  listForInstrument(userId: string, instrumentId: string) {
    return this.db.watchIntent.findMany({
      where: { userId, instrumentId },
      orderBy: [{ logicalIntentId: "asc" }, { version: "desc" }],
    });
  }

  listActiveForInstruments(userId: string, instrumentIds: string[]) {
    return this.db.watchIntent.findMany({
      where: { userId, instrumentId: { in: instrumentIds }, status: "ACTIVE" },
      orderBy: [{ instrumentId: "asc" }, { logicalIntentId: "asc" }],
    });
  }

  findCurrent(userId: string, logicalIntentId: string) {
    return this.db.watchIntent.findFirst({
      where: { userId, logicalIntentId, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
  }

  findLatest(userId: string, logicalIntentId: string) {
    return this.db.watchIntent.findFirst({ where: { userId, logicalIntentId }, orderBy: { version: "desc" } });
  }

  create(input: CreateIntentRecordInput) {
    return this.db.watchIntent.create({ data: intentData(input) });
  }

  async supersedeAndCreate(previousId: string, input: CreateIntentRecordInput) {
    return this.db.$transaction(async (transaction) => {
      const updated = await transaction.watchIntent.updateMany({
        where: { id: previousId, status: "ACTIVE" },
        data: { status: "SUPERSEDED" },
      });
      if (updated.count !== 1) throw new Error("Intent was changed before the edit could be saved.");
      return transaction.watchIntent.create({ data: intentData(input) });
    });
  }

  archiveCurrent(id: string) {
    return this.db.watchIntent.update({ where: { id }, data: { status: "ARCHIVED" } });
  }


  resolveCurrent(id: string, resolvedAt: Date, resolvedAtSequence: number) {
    return this.db.$transaction(async (transaction) => {
      const current = await transaction.watchIntent.findUniqueOrThrow({ where: { id } });
      const changed = await transaction.watchIntent.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "RESOLVED", resolvedAt, resolvedAtSequence } });
      if (changed.count !== 1) throw new AppError("INTENT_VERSION_CONFLICT", "This watch reason changed. Refresh and try again.", 409);
      await transaction.watchGraph.updateMany({ where: { userId: current.userId, watchIntentLogicalId: current.logicalIntentId, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
      return transaction.watchIntent.findUniqueOrThrow({ where: { id } });
    });
  }

  keepWatching(id: string, throughSequence: number) {
    return this.db.watchIntent.update({ where: { id }, data: { lifecycleReviewedThroughSequence: throughSequence } });
  }

  renew(previousId: string, input: CreateIntentRecordInput) {
    return this.db.watchIntent.create({ data: intentData({ ...input, supersedesId: previousId }) });
  }
}

export class PrismaDemoSessionRepository implements DemoSessionRepository {
  constructor(private readonly db: Database = database) {}
  getById(id: string) {
    return this.db.demoSession.findUnique({ where: { id } });
  }

  async setPosition(id: string, currentStep: number, currentSequence: number, currentTime: Date) {
    const state = await this.db.demoSession.findUniqueOrThrow({ where: { id } });
    return this.db.demoSession.update({ where: { id }, data: { currentStep, currentSequence, currentTime, ...(state.providerStatus === "UNAVAILABLE" ? {} : { lastHealthySequence: currentSequence }) } });
  }

  resetScenario(id: string, scenarioId: string, time: Date, userId: string, baselines: Parameters<DemoSessionRepository["resetScenario"]>[4], scenarioVersion = "1.0.0") {
    return this.db.$transaction(async (transaction) => {
      const state = await transaction.demoSession.update({ where: { id }, data: { scenarioId, scenarioVersion, currentStep: 0, currentSequence: 0, currentTime: time, providerStatus: "HEALTHY", lastHealthySequence: 0, generation: { increment: 1 } } });
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
    const state = await this.db.demoSession.findUniqueOrThrow({ where: { id } });
    return this.db.demoSession.update({ where: { id }, data: { providerStatus: status, ...(status === "UNAVAILABLE" ? {} : { lastHealthySequence: state.currentSequence }) } });
  }
}

export class PrismaMarketSnapshotRepository implements MarketSnapshotRepository {
  constructor(private readonly db: Database = database) {}
  findCurrent(instrumentId: string, currentSequence: number, scenarioId = "groww-delta-default", scenarioVersion = "1.0.0") {
    return this.db.marketSnapshot.findFirst({ where: { scenarioId, scenarioVersion, instrumentId, sequence: { lte: currentSequence } }, orderBy: { sequence: "desc" } });
  }

  async findCurrentMany(instrumentIds: string[], currentSequence: number, scenarioId = "groww-delta-default", scenarioVersion = "1.0.0") {
    if (instrumentIds.length === 0) return [];
    const rows = await this.db.marketSnapshot.findMany({
      where: { scenarioId, scenarioVersion, instrumentId: { in: instrumentIds }, sequence: { lte: currentSequence } },
      orderBy: [{ instrumentId: "asc" }, { sequence: "desc" }],
    });
    const found = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!found.has(row.instrumentId)) found.set(row.instrumentId, row);
    return [...found.values()];
  }

  listThroughSequence(instrumentId: string, currentSequence: number, scenarioId = "groww-delta-default", scenarioVersion = "1.0.0") {
    return this.db.marketSnapshot.findMany({ where: { scenarioId, scenarioVersion, instrumentId, sequence: { lte: currentSequence } }, orderBy: { sequence: "asc" } });
  }

  listForInstrumentsThrough(instrumentIds: string[], currentSequence: number, scenarioId = "groww-delta-default", scenarioVersion = "1.0.0") {
    if (instrumentIds.length === 0) return Promise.resolve([]);
    return this.db.marketSnapshot.findMany({
      where: { scenarioId, scenarioVersion, instrumentId: { in: instrumentIds }, sequence: { lte: currentSequence } },
      orderBy: [{ instrumentId: "asc" }, { sequence: "asc" }],
    });
  }
}

export class PrismaMarketEventRepository implements MarketEventRepository {
  constructor(private readonly db: Database = database) {}
  listBetweenSequences(exclusiveStart: number, inclusiveEnd: number, scenarioId = "groww-delta-default", scenarioVersion = "1.0.0") {
    return this.db.marketEvent.findMany({
      where: { scenarioId, scenarioVersion, sequence: { gt: exclusiveStart, lte: inclusiveEnd } },
      orderBy: [{ sequence: "asc" }, { eventTime: "asc" }, { id: "asc" }],
    });
  }
}

export class PrismaKnowledgeCursorRepository implements KnowledgeCursorRepository {
  constructor(private readonly db: Database = database, private readonly demoSessionId = "default-demo-session") {}
  acknowledgeMany(userId: string, inputs: Parameters<KnowledgeCursorRepository["acknowledgeMany"]>[1], scope: "INSTRUMENT" | "WATCHLIST") {
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "DemoSession" WHERE "id" = ${this.demoSessionId} FOR SHARE`;
      const state = await transaction.demoSession.findUnique({ where: { id: this.demoSessionId } });
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
    return this.db.knowledgeCursor.findMany({
      where: { userId, instrumentId: { in: instrumentIds } },
      orderBy: { instrumentId: "asc" },
    });
  }

  setBaseline(userId: string, input: Parameters<KnowledgeCursorRepository["setBaseline"]>[1]) {
    return this.db.knowledgeCursor.upsert({
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
    await this.db.knowledgeCursor.updateMany({
      where: { userId, instrumentId: input.instrumentId, lastSeenSequence: { lt: input.sequence } },
      data: {
        lastSeenSequence: input.sequence,
        lastSeenEventTime: input.eventTime,
        lastObservedSnapshotId: input.snapshotId,
        cursorVersion: { increment: 1 },
      },
    });
    return this.db.knowledgeCursor.findUnique({ where: { userId_instrumentId: { userId, instrumentId: input.instrumentId } } });
  }

  resetMany(userId: string, inputs: Parameters<KnowledgeCursorRepository["resetMany"]>[1]) {
    return this.db.$transaction(async (tx) => Promise.all(inputs.map((input) => tx.knowledgeCursor.upsert({
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
    }))));
  }
}

export class PrismaKnowledgeAcknowledgementRepository implements KnowledgeAcknowledgementRepository {
  constructor(private readonly db: Database = database) {}
  create(input: Parameters<KnowledgeAcknowledgementRepository["create"]>[0]) {
    return this.db.knowledgeAcknowledgement.create({ data: input });
  }

  listForInstrument(userId: string, instrumentId: string) {
    return this.db.knowledgeAcknowledgement.findMany({
      where: { userId, instrumentId },
      orderBy: [{ throughSequence: "asc" }, { acknowledgedAt: "asc" }],
    });
  }
}

export class PrismaWatchGraphRepository implements WatchGraphRepository {
  listHistoryForIntentLogicalIds(userId: string, logicalIntentIds: string[]) {
    if (!logicalIntentIds.length) return Promise.resolve([]);
    return this.db.watchGraph.findMany({ where: { userId, watchIntentLogicalId: { in: logicalIntentIds } }, include: graphInclude, orderBy: [{ watchIntentLogicalId: "asc" }, { version: "desc" }] });
  }
  constructor(private readonly db: Database = database) {}
  listActiveForIntentLogicalIds(userId: string, logicalIntentIds: string[]) {
    if (logicalIntentIds.length === 0) return Promise.resolve([]);
    return this.db.watchGraph.findMany({
      where: { userId, watchIntentLogicalId: { in: logicalIntentIds }, status: "ACTIVE" },
      include: graphInclude,
      orderBy: [{ watchIntentLogicalId: "asc" }, { version: "desc" }],
    });
  }

  listForIntent(userId: string, logicalIntentId: string) {
    return this.db.watchGraph.findMany({
      where: { userId, watchIntentLogicalId: logicalIntentId },
      include: graphInclude,
      orderBy: { version: "desc" },
    });
  }

  findActive(userId: string, logicalIntentId: string) {
    return this.db.watchGraph.findFirst({
      where: { userId, watchIntentLogicalId: logicalIntentId, status: "ACTIVE" },
      include: graphInclude,
      orderBy: { version: "desc" },
    });
  }

  createVersion(previousId: string | null, input: Parameters<WatchGraphRepository["createVersion"]>[1]) {
    return this.db.$transaction(async (transaction) => {
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
    const result = await this.db.watchGraph.updateMany({ where: { userId, watchIntentLogicalId: logicalIntentId, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
    return result.count;
  }
}
