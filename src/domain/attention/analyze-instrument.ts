import { buildAttentionDisplay } from "./explanations";
import { matchIntents } from "./intent-matchers";
import { calculateAttentionScore, classifyLane, QUALITY_CONFIDENCE } from "./scoring";
import {
  calculateExpectedWindowMoveBps,
  calculatePriceDeltaBps,
  calculatePriceSignificance,
  calculateVolumeRatio,
  combineSignificance,
  EVENT_SIGNIFICANCE,
  volumeSignificanceFromRatio,
} from "./significance";
import type { AttentionAnalysisInput, AttentionItem } from "./types";
import type { AttentionReasonCode } from "./reason-codes";

export function analyzeInstrument(input: AttentionAnalysisInput): AttentionItem | null {
  const orderedSnapshots = [...input.snapshots].sort((a, b) => a.sequence - b.sequence);
  const baseline = orderedSnapshots.filter((snapshot) => snapshot.sequence <= input.cursor.lastSeenSequence).at(-1);
  const current = orderedSnapshots.filter((snapshot) => snapshot.sequence <= input.currentSequence).at(-1);
  if (!baseline || !current) return null;

  const hasWindow = input.currentSequence > input.cursor.lastSeenSequence;
  const windowEvents = hasWindow
    ? input.events.filter((event) => event.sequence > input.cursor.lastSeenSequence && event.sequence <= input.currentSequence)
    : [];
  const priceDeltaPaise = current.pricePaise - baseline.pricePaise;
  const priceDeltaBps = hasWindow ? calculatePriceDeltaBps(baseline.pricePaise, current.pricePaise) : 0;
  const expectedWindowMoveBps = hasWindow
    ? calculateExpectedWindowMoveBps(orderedSnapshots, input.cursor.lastSeenSequence, input.currentSequence)
    : null;
  const priceResult = hasWindow ? calculatePriceSignificance(priceDeltaBps, expectedWindowMoveBps) : { priceSurprise: null, significance: 0 };
  const volumeRatio = calculateVolumeRatio(current);
  const volumeSignificance = hasWindow ? volumeSignificanceFromRatio(volumeRatio) : 0;
  const eventSignificance = hasWindow ? Math.max(0, ...windowEvents.map((event) => EVENT_SIGNIFICANCE[event.type])) : 0;
  const combined = combineSignificance(priceResult.significance, volumeSignificance, eventSignificance);
  const matchedIntents = hasWindow ? matchIntents({
    intents: input.activeIntents,
    snapshots: orderedSnapshots,
    events: windowEvents,
    cursorSequence: input.cursor.lastSeenSequence,
    currentSequence: input.currentSequence,
  }) : [];
  const relevance = matchedIntents.length ? 100 : 0;
  const urgency = Math.max(0, ...matchedIntents.map((match) => match.urgency));
  const hasActualChange = hasWindow && (current.id !== baseline.id || windowEvents.length > 0 || priceDeltaPaise !== 0);
  const novelty = hasActualChange ? 100 : 0;
  const usedQualities = [baseline.quality, current.quality, ...windowEvents.filter((event) => EVENT_SIGNIFICANCE[event.type] > 0 || matchedIntents.some((match) => match.eventIds.includes(event.id))).map((event) => event.quality)];
  const confidence = Math.min(...usedQualities.map((quality) => QUALITY_CONFIDENCE[quality]));
  const lane = classifyLane(relevance, combined.significance);
  const reasonCodes: AttentionReasonCode[] = [];
  if (novelty > 0) reasonCodes.push("NEW_SINCE_LAST_SEEN");
  reasonCodes.push(...matchedIntents.map((match) => match.reasonCode));
  if (priceResult.significance >= 50) reasonCodes.push("UNUSUAL_PRICE_MOVE");
  if (volumeSignificance >= 50) reasonCodes.push("UNUSUAL_VOLUME");
  if (eventSignificance >= 50) reasonCodes.push("MATERIAL_MARKET_EVENT");
  if (combined.multipleSignals) reasonCodes.push("MULTIPLE_SIGNALS");
  if (confidence === 100) reasonCodes.push("DATA_FRESH");
  else if (usedQualities.includes("DELAYED")) reasonCodes.push("DATA_DELAYED");

  return {
    instrument: input.instrument,
    fromSequence: input.cursor.lastSeenSequence,
    toSequence: input.currentSequence,
    fromTime: input.cursor.lastSeenEventTime ?? baseline.eventTime,
    toTime: input.currentTime,
    baselineSnapshot: baseline,
    currentSnapshot: current,
    baselinePricePaise: baseline.pricePaise,
    currentPricePaise: current.pricePaise,
    priceDeltaPaise,
    priceDeltaBps,
    expectedWindowMoveBps,
    priceSurprise: priceResult.priceSurprise,
    volumeRatio,
    priceSignificance: priceResult.significance,
    volumeSignificance,
    eventSignificance,
    significance: combined.significance,
    relevance,
    novelty,
    urgency,
    confidence,
    score: calculateAttentionScore({ significance: combined.significance, relevance, novelty, urgency, confidence }),
    lane,
    matchedIntents,
    reasonCodes: [...new Set(reasonCodes)],
    eventSummaries: windowEvents.map((event) => ({ id: event.id, type: event.type, eventTime: event.eventTime, quality: event.quality, payload: event.payload })),
    display: buildAttentionDisplay({ name: input.instrument.name, topMatch: matchedIntents[0] ?? null, priceSignificance: priceResult.significance, volumeSignificance, eventSignificance, volumeRatio, baselinePricePaise: baseline.pricePaise, currentPricePaise: current.pricePaise }),
  };
}
