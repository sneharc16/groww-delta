import { randomUUID, createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import { SCENARIO_VERSIONS } from "../../../data/replay/versioning";
import { seededIntents } from "../../../data/demo/initial-intents";
import { findDriverTemplate, graphDraftFromTemplate } from "@/domain/graph/templates";
export const sessionTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export async function findSession(token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) return null;
  return prisma.anonymousSession.findFirst({ where: { tokenHash: sessionTokenHash(token), expiresAt: { gt: new Date() } } });
}
export async function createAnonymousSession() {
  const token = randomUUID(), id = randomUUID(), userId = randomUUID(), demoSessionId = randomUUID();
  const session = await prisma.$transaction(async tx => {
    const initial = await tx.marketSnapshot.findMany({ where: { scenarioId: "groww-delta-default", scenarioVersion: SCENARIO_VERSIONS["groww-delta-default"], sequence: 0, instrument: { isWatchlistEligible: true } } });
    if (!initial.length) throw new AppError("DATABASE_NOT_READY", "The demo definitions have not been seeded.", 503);
    await tx.user.create({ data: { id: userId, displayName: "Anonymous Investor" } });
    await tx.demoSession.create({ data: { id: demoSessionId, scenarioId: "groww-delta-default", scenarioVersion: SCENARIO_VERSIONS["groww-delta-default"], currentStep: 0, currentSequence: 0, currentTime: initial[0].eventTime } });
    await tx.watchlist.create({ data: { id: randomUUID(), userId, name: "My Watchlist", items: { create: initial.map(snapshot => ({
      instrumentId: snapshot.instrumentId, provenanceSource: "IMPORTED_DEMO", provenanceReference: "groww-delta-default",
    })) } } });
    await tx.knowledgeCursor.createMany({ data: initial.map(snapshot => ({ userId, instrumentId: snapshot.instrumentId, lastSeenSequence: 0, lastSeenEventTime: snapshot.eventTime, lastObservedSnapshotId: snapshot.id })) });
    await tx.watchIntent.createMany({ data: seededIntents.map(intent => ({ ...intent, id: randomUUID(), userId, version: 1, effectiveFromSequence: 0, structuredPayload: intent.structuredPayload as Prisma.InputJsonValue })) });
    const template = findDriverTemplate("AIRLINE_FUEL_COST", "NSE:INDIGO");
    const draft = graphDraftFromTemplate(template, ["FUEL_COST", "CRUDE"]);
    const graphId = randomUUID(), nodeIds = new Map(draft.nodes.map(node => [node.nodeKey, randomUUID()]));
    await tx.watchGraph.create({ data: { id: graphId, logicalGraphId: randomUUID(), userId, instrumentId: "NSE:INDIGO", watchIntentLogicalId: "intent:indigo:driver", version: 1, provenance: "IMPORTED_DEMO", templateKey: template.key, effectiveFromSequence: 0,
      nodes: { create: draft.nodes.map(node => ({ id: nodeIds.get(node.nodeKey)!, nodeKey: node.nodeKey, type: node.type, label: node.label, metadata: (node.metadata ?? {}) as Prisma.InputJsonValue })) },
    } });
    await tx.watchGraphEdge.createMany({ data: draft.edges.map(edge => ({ id: randomUUID(), graphId, fromNodeId: nodeIds.get(edge.fromKey)!, toNodeId: nodeIds.get(edge.toKey)!, relationship: edge.relationship, weight: edge.weight })) });
    return tx.anonymousSession.create({ data: { id, userId, demoSessionId, tokenHash: sessionTokenHash(token), expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000) } });
  }, { timeout: 20_000 });
  return { token, session };
}
