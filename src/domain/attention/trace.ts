import { contentHash } from "@/domain/policy/hash";
import type { AttentionPolicy } from "@/domain/policy/reference";
import type { AttentionAnalysisInput, AttentionItem } from "./types";
const hashes = new WeakMap<AttentionPolicy, string>();
export function policyHash(policy: AttentionPolicy) {
  const previous = Object.isFrozen(policy) ? hashes.get(policy) : undefined;
  if (previous) return previous;
  const hash = contentHash(policy);
  if (Object.isFrozen(policy)) hashes.set(policy, hash);
  return hash;
}
export function decisionTrace(input: AttentionAnalysisInput, item: Omit<AttentionItem, "decisionTrace">, policy: AttentionPolicy) {
  const events = input.events.filter(event => event.sequence <= input.currentSequence).sort((a,b) => a.sequence-b.sequence || a.id.localeCompare(b.id));
  const byId = new Map(events.map(event => [event.id,event]));
  const lineage = (id: string) => {
    const ids: string[] = [], seen = new Set<string>();
    let event = byId.get(id);
    while(event) {
      if(seen.has(event.id)) throw new Error("Cyclic correction provenance.");
      seen.add(event.id); ids.unshift(event.id);
      event = event.correctionOfId ? byId.get(event.correctionOfId) : undefined;
    }
    return ids;
  };
  const trace = {
    traceSchemaVersion: "1.0.0",
    timestamp: input.currentTime.toISOString(),
    policyVersion: policy.version, policyConfigHash: policyHash(policy),
    scenarioId: input.traceContext?.scenarioId ?? input.snapshots[0]?.scenarioId ?? "unspecified",
    scenarioVersion: input.traceContext?.scenarioVersion ?? "unspecified",
    scenarioContentHash: input.traceContext?.scenarioContentHash ?? null,
    researchSessionId: input.traceContext?.researchSessionId ?? contentHash(input.cursor.userId).slice(0,24),
    instrumentId: input.instrument.id,
    cursorBefore: { sequence: input.cursor.lastSeenSequence, version: input.cursor.cursorVersion },
    cursorAfter: { sequence: input.cursor.lastSeenSequence, version: input.cursor.cursorVersion },
    acknowledgementState: input.currentSequence <= input.cursor.lastSeenSequence ? "CAUGHT_UP" : "NOT_ACKNOWLEDGED",
    throughSequence: input.currentSequence,
    snapshots: { baselineId: item.baselineSnapshot.id, currentId: item.currentSnapshot.id, trustedBaselineId: item.trustedBaselineSnapshotId },
    provenance: events.map(event => ({
      eventId: event.id, sourceEventId: event.sourceEventId ?? event.id, eventVersion: event.eventVersion ?? lineage(event.id).length, correctionLineage: lineage(event.id),
      source: event.source, sourceTimestamp: event.eventTime.toISOString(), receivedTimestamp: event.receivedTime.toISOString(),
      sequence: event.sequence, quality: event.quality, instrumentId: event.instrumentId, category: event.type,
      subjectKey: event.subjectKey, payload: event.payload, contentHash: contentHash(event),
    })),
    intentVersions: input.activeIntents.map(intent => ({ logicalIntentId: intent.logicalIntentId, version: intent.version, effectiveFromSequence: intent.effectiveFromSequence })).sort((a,b)=>a.logicalIntentId.localeCompare(b.logicalIntentId)),
    graphVersions: input.activeGraphs.map(graph => ({ logicalGraphId: graph.logicalGraphId, version: graph.version, effectiveFromSequence: graph.effectiveFromSequence })).sort((a,b)=>a.logicalGraphId.localeCompare(b.logicalGraphId)),
    significanceScore: item.significance, relevanceScore: item.relevance, noveltyScore: item.novelty,
    urgencyScore: item.urgency, confidenceScore: item.confidence, finalAttentionScore: item.score, lane: item.lane,
    priceSignificance: item.priceSignificance, volumeSignificance: item.volumeSignificance, eventSignificance: item.eventSignificance,
    directIntentMatch: item.matchedIntents.some(match=>match.matchType==="DIRECT"),
    contextualMatch: item.matchedIntents.some(match=>match.matchType==="GRAPH"),
    matches: item.matchedIntents.map(match=>({ logicalIntentId: match.logicalIntentId, intentVersion: match.version, type: match.matchType, eventIds: match.eventIds, snapshotIds: match.transitionSnapshotIds, graphVersion: match.graphMatch?.graphVersion ?? null })),
    graphPaths: item.relevancePaths, reasonCodes: item.reasonCodes,
    marketQuality: item.trust.quality, source: item.trust.source, sourceTimestamp: item.trust.eventTime, receivedTimestamp: item.trust.receivedTime,
    trustReasonCodes: [...new Set([...item.trust.reasonCodes, ...item.trustNotices.flatMap(notice=>notice.reasonCodes)])],
    corporateActionState: item.trustNotices.filter(notice=>notice.type==="CORPORATE_ACTION_REVIEW").map(notice=>notice.action),
    calmModeState: { active: input.marketContext?.calmModeActive ?? false, grouped: item.groupedMarketMove, adjustedDeltaBps: item.marketAdjustedDeltaBps },
    graphNodesVisited: input.metrics?.graphNodesVisited ?? 0,
  };
  return { decisionId: contentHash(trace), ...trace };
}
export type AttentionDecisionTrace = ReturnType<typeof decisionTrace>;
