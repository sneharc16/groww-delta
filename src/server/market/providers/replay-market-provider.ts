import { DEFAULT_DEMO_SESSION_ID, DEMO_USER_ID } from "@/lib/constants";
import type { DemoStateRecord } from "@/domain/market/types";
import type { DemoSessionRepository, MarketEventRepository, MarketSnapshotRepository } from "@/server/repositories/contracts";
import { findReplayScenario, replayScenarios } from "../../../../data/replay/scenarios";
import { AppError } from "@/lib/errors/app-error";
import type { DemoMarketController, DemoMarketState } from "./demo-market-controller";
import type { MarketDataProvider } from "./market-data-provider";

export class ReplayMarketProvider implements MarketDataProvider, DemoMarketController {
  constructor(private readonly sessions: DemoSessionRepository, private readonly snapshots: MarketSnapshotRepository, private readonly events: MarketEventRepository) {}
  private async state() {
    const state = await this.sessions.getById(DEFAULT_DEMO_SESSION_ID);
    if (!state) throw new AppError("INVALID_MARKET_STATE", "The demo session has not been seeded.", 409);
    return state;
  }
  private scenario(id: string) {
    const scenario = findReplayScenario(id);
    if (!scenario) throw new AppError("INVALID_SCENARIO", "Choose an available demo scenario.", 400);
    return scenario;
  }
  private demoState(position: DemoStateRecord): DemoMarketState {
    const scenario = this.scenario(position.scenarioId);
    return { position, scenario: { id: scenario.id, name: scenario.name, totalSteps: scenario.steps.length - 1, timezone: scenario.timezone }, atFinalStep: position.currentStep >= scenario.steps.length - 1 };
  }
  listScenarios() { return replayScenarios.map(({ id, name }) => ({ id, name })); }
  async getEnvironment() { const state = await this.state(); return { scenarioId: state.scenarioId, demoTimeTravel: true, generation: state.generation ?? 0 }; }
  async getHealth() {
    const state = await this.state();
    const status = state.providerStatus ?? "HEALTHY";
    const sequence = state.lastHealthySequence ?? state.currentSequence;
    return { status, lastSuccessfulUpdate: this.scenario(state.scenarioId).steps.find((step) => step.sequence === sequence)?.eventTime ?? null,
      message: status === "UNAVAILABLE" ? "Market data is temporarily unavailable." : status === "DEGRADED" ? "The market data provider is degraded." : null };
  }
  async setProviderStatus(status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE") { await this.sessions.setProviderStatus(DEFAULT_DEMO_SESSION_ID, status); }
  async getDemoState() { return this.demoState(await this.state()); }
  async advanceDemo() {
    const position = await this.state();
    const scenario = this.scenario(position.scenarioId);
    const next = scenario.steps[position.currentStep + 1];
    if (!next) return { ...this.demoState(position), advanced: false, message: "The demo market is already at the final step." };
    const updated = await this.sessions.setPosition(DEFAULT_DEMO_SESSION_ID, next.step, next.sequence, new Date(next.eventTime));
    return { ...this.demoState(updated), advanced: true };
  }
  async switchScenario(scenarioId: string, userId: string) {
    const scenario = this.scenario(scenarioId);
    const initial = scenario.steps[0];
    const snapshots = await this.snapshots.findCurrentMany(initial.snapshots.map((row) => row.instrumentId), 0, scenarioId);
    const baselines = snapshots.map((snapshot) => ({ instrumentId: snapshot.instrumentId, sequence: 0, eventTime: snapshot.eventTime, snapshotId: snapshot.id }));
    const updated = await this.sessions.resetScenario(DEFAULT_DEMO_SESSION_ID, scenarioId, new Date(initial.eventTime), userId, baselines);
    return this.demoState(updated);
  }
  async resetDemo(userId = DEMO_USER_ID) { return this.switchScenario((await this.state()).scenarioId, userId); }
  private async access(requested?: number) {
    const state = await this.state();
    const available = state.providerStatus === "UNAVAILABLE" ? state.lastHealthySequence ?? 0 : state.currentSequence;
    return { scenarioId: state.scenarioId, sequence: Math.min(requested ?? available, available) };
  }
  async getCurrentSnapshot(id: string) { const a = await this.access(); return this.snapshots.findCurrent(id, a.sequence, a.scenarioId); }
  async getCurrentSnapshots(ids: string[]) { const a = await this.access(); return this.snapshots.findCurrentMany(ids, a.sequence, a.scenarioId); }
  async getSnapshots(id: string) { const a = await this.access(); return this.snapshots.listThroughSequence(id, a.sequence, a.scenarioId); }
  async getSnapshotAtOrBefore(id: string, sequence: number) { const a = await this.access(sequence); return this.snapshots.findCurrent(id, a.sequence, a.scenarioId); }
  async getSnapshotsAtOrBefore(ids: string[], sequence: number) { const a = await this.access(sequence); return this.snapshots.findCurrentMany(ids, a.sequence, a.scenarioId); }
  async getSnapshotsBetween(ids: string[], from: number, to: number) { return (await this.getSnapshotsForAnalysis(ids, to)).filter((row) => row.sequence > from); }
  async getSnapshotsForAnalysis(ids: string[], sequence: number) { const a = await this.access(sequence); return this.snapshots.listForInstrumentsThrough(ids, a.sequence, a.scenarioId); }
  async getEventsSince(sequence: number) { return this.getEventsBetween(sequence, (await this.state()).currentSequence); }
  async getEventsBetween(from: number, to: number) { const a = await this.access(to); return this.events.listBetweenSequences(from, a.sequence, a.scenarioId); }
  async getCurrentSequence() { return (await this.state()).currentSequence; }
}
