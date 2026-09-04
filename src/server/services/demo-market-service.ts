import { defaultReplayScenario } from "../../../data/replay/default-scenario";
import { DEFAULT_DEMO_SESSION_ID } from "@/lib/constants";
import { AppError } from "@/lib/errors/app-error";
import type { DemoSessionRepository } from "@/server/repositories/contracts";
import type { DemoStateRecord } from "@/domain/market/types";
import type { DemoStateDto } from "@/server/dto/types";

export class DemoMarketService {
  constructor(private readonly sessions: DemoSessionRepository) {}

  private toDto(state: DemoStateRecord): DemoStateDto {
    return {
      scenario: {
        id: defaultReplayScenario.id,
        name: defaultReplayScenario.name,
        totalSteps: defaultReplayScenario.steps.length - 1,
        timezone: defaultReplayScenario.timezone,
      },
      currentStep: state.currentStep,
      currentSequence: state.currentSequence,
      currentTime: state.currentTime.toISOString(),
      atFinalStep: state.currentStep >= defaultReplayScenario.steps.length - 1,
    };
  }

  async getState() {
    const state = await this.sessions.getById(DEFAULT_DEMO_SESSION_ID);
    if (!state) throw new AppError("DEMO_SESSION_NOT_FOUND", "The default demo session has not been seeded.", 404);
    return this.toDto(state);
  }

  async advance(): Promise<DemoStateDto & { advanced: boolean; message?: string }> {
    const state = await this.sessions.getById(DEFAULT_DEMO_SESSION_ID);
    if (!state) throw new AppError("DEMO_SESSION_NOT_FOUND", "The default demo session has not been seeded.", 404);
    if (state.currentStep >= defaultReplayScenario.steps.length - 1) {
      return { ...this.toDto(state), advanced: false, message: "The demo market is already at the final step." };
    }
    const next = defaultReplayScenario.steps[state.currentStep + 1];
    const updated = await this.sessions.setPosition(DEFAULT_DEMO_SESSION_ID, next.step, next.sequence, new Date(next.eventTime));
    return { ...this.toDto(updated), advanced: true };
  }

  async reset() {
    const initial = defaultReplayScenario.steps[0];
    const updated = await this.sessions.setPosition(DEFAULT_DEMO_SESSION_ID, initial.step, initial.sequence, new Date(initial.eventTime));
    return { ...this.toDto(updated), reset: true };
  }
}
