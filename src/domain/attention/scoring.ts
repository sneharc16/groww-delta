import { REFERENCE_POLICY, type AttentionPolicy } from "@/domain/policy/reference";
import type { AttentionLane } from "./types";

export const QUALITY_CONFIDENCE = REFERENCE_POLICY.qualityConfidence;

export function calculateAttentionScore(values: {
  significance: number;
  relevance: number;
  novelty: number;
  urgency: number;
  confidence: number;
}, policy: AttentionPolicy = REFERENCE_POLICY): number {
  const score = Object.entries(policy.weights).reduce((sum, [key, weight]) => sum + weight * values[key as keyof typeof values], 0);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyLane(relevance: number, significance: number, policy: AttentionPolicy = REFERENCE_POLICY): AttentionLane {
  if (relevance > 0) return "RELEVANT";
  if (significance >= policy.significantLaneThreshold) return "SIGNIFICANT";
  return "QUIET";
}
