import { REFERENCE_POLICY, type AttentionPolicy } from "../../src/domain/policy/reference";
export const RESEARCH_POLICIES = ["full", "price-only", "significance-only", "intent-only", "intent-significance", "no-cursor", "no-graph", "no-urgency", "no-significance", "no-confidence", "equal-weights"] as const;
export type ResearchPolicyName = typeof RESEARCH_POLICIES[number];
/** Explicit offline entry point. HTTP services never import this module. */
export function researchPolicy(name: string): AttentionPolicy {
  if (!(RESEARCH_POLICIES as readonly string[]).includes(name)) throw new Error("Unknown research policy.");
  if (name === "full") return REFERENCE_POLICY;
  const policy: AttentionPolicy = { ...REFERENCE_POLICY, version: "research-1.0.0:" + name, weights: { ...REFERENCE_POLICY.weights }, components: { ...REFERENCE_POLICY.components } };
  if(name==="no-cursor") policy.components.cursor=false;
  if(name==="no-graph") policy.components.graph=false;
  if(name==="no-significance") policy.components.significance=false;
  if(name==="no-urgency") policy.components.urgency=false;
  if(name==="no-confidence") policy.components.confidence=false;
  if(name==="equal-weights") policy.weights={significance:.2,relevance:.2,novelty:.2,urgency:.2,confidence:.2};
  if(name==="price-only" || name==="significance-only") {
    policy.components.directIntent=false; policy.components.graph=false;
    policy.weights={significance:1,relevance:0,novelty:0,urgency:0,confidence:0};
  }
  if(name==="price-only") { policy.components.events=false; policy.components.volume=false; }
  if(name==="intent-only") { policy.components.significance=false; policy.weights={significance:0,relevance:1,novelty:0,urgency:0,confidence:0}; }
  if(name==="intent-significance") policy.weights={significance:.5,relevance:.5,novelty:0,urgency:0,confidence:0};
  return policy;
}
