import type { InstrumentRepository } from "@/server/repositories/contracts";
import { toInstrumentDto } from "@/server/dto/mappers";

export class InstrumentService {
  constructor(private readonly instruments: InstrumentRepository) {}

  async listAvailable() {
    return (await this.instruments.listActive()).filter((instrument) => instrument.isWatchlistEligible !== false && instrument.kind !== "INDEX").map(toInstrumentDto);
  }
}
