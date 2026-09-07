/** Replay runs are independent time namespaces. Stored historical versions never change. */
export function inReplayEnvironment<T extends { effectiveFromSequence: number; effectiveScenarioId?: string; effectiveDemoGeneration?: number }>(record: T, scenarioId: string, generation = 0): T {
  return (record.effectiveScenarioId ?? "groww-delta-default") === scenarioId && (record.effectiveDemoGeneration ?? 0) === generation
    ? record : { ...record, effectiveFromSequence: 0 };
}
