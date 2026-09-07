import { AppError } from "@/lib/errors/app-error";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import type { DemoMarketController, DemoMarketState } from "@/server/market/providers/demo-market-controller";
import type { DemoStateDto } from "@/server/dto/types";

export class DemoMarketService {
  constructor(
    private readonly controller: DemoMarketController,
    private readonly market: MarketDataProvider,
  ) {}

  private toDto(state: DemoMarketState): DemoStateDto {
    return {
      scenario: state.scenario,
      currentStep: state.position.currentStep,
      currentSequence: state.position.currentSequence,
      currentTime: state.position.currentTime.toISOString(),
      atFinalStep: state.atFinalStep,
    };
  }

  listScenarios() { return this.controller.listScenarios(); }

  async switchScenario(scenarioId: string, userId: string) {
    const state = await this.controller.switchScenario(scenarioId, userId);
    return this.toDto(state);
  }

  async setProviderStatus(status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE") {
    await this.controller.setProviderStatus(status);
    return this.market.getHealth();
  }

  async getState() {
    const state = await this.controller.getDemoState();
    if (!state) throw new AppError("DEMO_SESSION_NOT_FOUND", "The default demo session has not been seeded.", 404);
    return this.toDto(state);
  }

  async advance(): Promise<DemoStateDto & { advanced: boolean; message?: string }> {
    const state = await this.controller.advanceDemo();
    if (!state) throw new AppError("DEMO_SESSION_NOT_FOUND", "The default demo session has not been seeded.", 404);
    return { ...this.toDto(state), advanced: state.advanced, ...(state.message ? { message: state.message } : {}) };
  }

  async reset(userId: string) {
    const resetState = await this.controller.resetDemo(userId);
    return { ...this.toDto(resetState), reset: true };
  }
}
