import { DEFAULT_DEMO_SESSION_ID } from "@/lib/constants";
import type { DemoSessionRepository, MarketEventRepository, MarketSnapshotRepository } from "@/server/repositories/contracts";
import type { MarketDataProvider } from "./market-data-provider";

export class ReplayMarketProvider implements MarketDataProvider {
  constructor(
    private readonly sessions: DemoSessionRepository,
    private readonly snapshots: MarketSnapshotRepository,
    private readonly events: MarketEventRepository,
  ) {}

  private async sequence(): Promise<number> {
    const state = await this.sessions.getById(DEFAULT_DEMO_SESSION_ID);
    if (!state) throw new Error("The default demo session has not been seeded.");
    return state.currentSequence;
  }

  async getCurrentSnapshot(instrumentId: string) {
    return this.snapshots.findCurrent(instrumentId, await this.sequence());
  }

  async getCurrentSnapshots(instrumentIds: string[]) {
    return this.snapshots.findCurrentMany(instrumentIds, await this.sequence());
  }

  async getSnapshots(instrumentId: string) {
    return this.snapshots.listThroughSequence(instrumentId, await this.sequence());
  }

  async getEventsSince(sequence: number) {
    return this.events.listBetweenSequences(sequence, await this.sequence());
  }

  getCurrentSequence() {
    return this.sequence();
  }
}
