import { formatINRFromPaise, formatINRLevelFromPaise } from "@/lib/format/market";
import type { AttentionDisplay, IntentMatch } from "./types";

function savedReason(match: IntentMatch): string {
  return match.originalText?.replace(/^Watching\s+/i, "") ?? "saved reason";
}

function humanize(value: string): string {
  return value.replaceAll("_", "-").toLowerCase();
}

export function buildAttentionDisplay(input: {
  name: string;
  topMatch: IntentMatch | null;
  priceSignificance: number;
  volumeSignificance: number;
  eventSignificance: number;
  volumeRatio: number | null;
  baselinePricePaise: number;
  currentPricePaise: number;
}): AttentionDisplay {
  const { topMatch } = input;
  const additionalSignals = input.volumeSignificance >= 50 && input.volumeRatio !== null
    ? [`Volume is ${input.volumeRatio.toFixed(1)}× expected.`]
    : [];

  if (topMatch) {
    const reason = savedReason(topMatch);
    if (topMatch.reasonCode === "PRICE_TARGET_NEAR_ENTERED") {
      return { label: "Price watch", headline: `Entered your ${formatINRLevelFromPaise(Number(topMatch.metadata.targetPricePaise))} watch range`, whySeeing: `Price moved from ${formatINRFromPaise(input.baselinePricePaise)} to ${formatINRFromPaise(input.currentPricePaise)} since you last checked.`, additionalSignals };
    }
    if (topMatch.reasonCode === "PRICE_TARGET_CROSSED_ABOVE" || topMatch.reasonCode === "PRICE_TARGET_CROSSED_BELOW") {
      const direction = topMatch.reasonCode.endsWith("ABOVE") ? "above" : "below";
      return { label: "Price watch", headline: `Crossed ${direction} your ${formatINRLevelFromPaise(Number(topMatch.metadata.targetPricePaise))} level`, whySeeing: `Matches your ${reason} watch.`, additionalSignals };
    }
    if (topMatch.reasonCode === "EARNINGS_EVENT_MATCHED") return { label: "Results watch", headline: "Quarterly results were published", whySeeing: `Matches your ${reason} watch.`, additionalSignals };
    if (topMatch.reasonCode === "TECHNICAL_SETUP_MATCHED") return { label: "Technical watch", headline: `Your ${humanize(String(topMatch.metadata.setup))} condition changed`, whySeeing: `Matches your ${reason} watch.`, additionalSignals };
    if (topMatch.reasonCode === "DRIVER_EVENT_MATCHED") return { label: "Driver watch", headline: `A ${humanize(String(topMatch.metadata.driverKey))} driver you chose to watch changed`, whySeeing: `Matches your ${reason} watch.`, additionalSignals };
    if (topMatch.reasonCode === "DIVIDEND_EVENT_MATCHED") return { label: "Dividend watch", headline: "A saved dividend event occurred", whySeeing: `Matches your ${reason} watch.`, additionalSignals };
    return { label: "Company event watch", headline: "A company event you chose to watch occurred", whySeeing: `Matches your ${reason} watch.`, additionalSignals };
  }

  if (input.priceSignificance >= 50) {
    return { label: "Unusual move", headline: `${input.name} made an unusually large move since you last checked`, whySeeing: "No watch reason matched, but the move crossed the significance threshold.", additionalSignals };
  }
  if (input.eventSignificance >= 50) return { label: "Market event", headline: "A material market event occurred", whySeeing: "No watch reason matched, but the event crossed the significance threshold.", additionalSignals };
  if (input.volumeSignificance >= 50) return { label: "Unusual volume", headline: `${input.name} traded at unusual volume`, whySeeing: "No watch reason matched, but volume crossed the significance threshold.", additionalSignals };
  return { label: "Quiet", headline: "Nothing crossed the attention threshold", whySeeing: "No direct watch reason or objective significance threshold matched.", additionalSignals: [] };
}
