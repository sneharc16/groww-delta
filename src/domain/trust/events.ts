import { MARKET_EVENT_TYPES } from "@/domain/market/types";
import type { MarketEventRecord } from "@/domain/market/types";
import { AppError } from "@/lib/errors/app-error";

function canonical(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ":" + canonical(item)).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
export function normalizeEvents(events: MarketEventRecord[]): MarketEventRecord[] {
  const byId = new Map<string, MarketEventRecord>();
  for (const event of events) {
    if (!MARKET_EVENT_TYPES.includes(event.type) || !Number.isSafeInteger(event.sequence) || event.sequence < 0 || !event.id || !(event.eventTime instanceof Date) || !Number.isFinite(event.eventTime.getTime())) throw new AppError("INVALID_MARKET_EVENT", "Unsupported or malformed market event.", 409);
    const previous = byId.get(event.id);
    if (previous && canonical(previous) !== canonical(event)) throw new AppError("EVENT_INTEGRITY_CONFLICT", "Conflicting content was received for the same immutable market event.", 409);
    byId.set(event.id, event);
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence || a.eventTime.getTime() - b.eventTime.getTime() || a.id.localeCompare(b.id));
}
export function resolveCorrections(events: MarketEventRecord[]) {
  const ordered = normalizeEvents(events);
  const byId = new Map(ordered.map((event) => [event.id, event]));
  const replaced = new Set<string>();
  for (const event of ordered) {
    if (!event.correctionOfId) continue;
    const original = byId.get(event.correctionOfId);
    if (!original || original.sequence >= event.sequence || original.instrumentId !== event.instrumentId || original.type !== event.type) {
      throw new AppError("INVALID_CORRECTION_REFERENCE", "The correction must reference an earlier event of the same type and instrument.", 409);
    }
    if (replaced.has(original.id)) throw new AppError("INVALID_CORRECTION_REFERENCE", "Correction revisions must form a single ordered chain.", 409);
    replaced.add(original.id);
  }
  return { current: ordered.filter((event) => !replaced.has(event.id)), all: ordered, byId };
}

/** Walk a validated correction chain to the newest revision the user acknowledged. */
export function seenCorrectionAncestor(event: MarketEventRecord, byId: Map<string, MarketEventRecord>, cursorSequence: number): MarketEventRecord | null {
  let parent = event.correctionOfId ? byId.get(event.correctionOfId) : undefined;
  const visited = new Set<string>();
  while (parent && !visited.has(parent.id)) {
    if (parent.sequence <= cursorSequence) return parent;
    visited.add(parent.id);
    parent = parent.correctionOfId ? byId.get(parent.correctionOfId) : undefined;
  }
  return null;
}
