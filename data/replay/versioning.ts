import manifest from "./manifest.json";
import { contentHash } from "../../src/domain/policy/hash";
import { replayScenarios, type ReplayScenario } from "./scenarios";
export const SCENARIO_VERSIONS: Readonly<Record<string, string>> = Object.freeze({
  "groww-delta-default": "1.0.0", "data-quality": "1.0.0", "market-shock": "1.0.0", "corporate-action": "1.0.0",
});
export function scenarioIdentity(scenario: ReplayScenario) {
  const version = SCENARIO_VERSIONS[scenario.id];
  if (!version) throw new Error("Unversioned replay scenario.");
  const frozen = manifest[scenario.id as keyof typeof manifest];
  if (!frozen || frozen.version !== version || frozen.hash !== contentHash(scenario)) throw new Error("Replay content changed without a new versioned manifest.");
  return { scenarioId: scenario.id, scenarioVersion: version, scenarioContentHash: contentHash(scenario) };
}
export const SCENARIO_IDENTITIES = replayScenarios.map(scenarioIdentity);

/** Version 1 keeps Build 4 durable IDs; later versions coexist without overwriting it. */
export const datasetRecordId = (sourceId: string, version: string) => version === "1.0.0" ? sourceId : sourceId + "@" + version;
