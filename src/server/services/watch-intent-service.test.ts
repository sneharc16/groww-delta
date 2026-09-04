import { describe, expect, it } from "vitest";
import { WatchIntentService } from "./watch-intent-service";
import { MemoryInstrumentRepository, MemoryIntentRepository, intentRecord } from "../../../tests/helpers/in-memory";

const earningsInput = {
  type: "EARNINGS" as const,
  originalText: "Watching Q2 profit",
  structuredPayload: { focus: ["PROFIT" as const], quarterLabel: "Q2" },
  provenanceSource: "STOCK_DETAIL" as const,
};

describe("WatchIntentService", () => {
  it("creates a new version and supersedes the previous row when edited", async () => {
    const repository = new MemoryIntentRepository([intentRecord()]);
    const service = new WatchIntentService(repository, new MemoryInstrumentRepository());

    const edited = await service.edit("demo-user", "logical-1", earningsInput);

    expect(edited.version).toBe(2);
    expect(edited.logicalIntentId).toBe("logical-1");
    expect(edited.supersedesId).toBe("version-1");
    expect(repository.rows.find((row) => row.id === "version-1")?.status).toBe("SUPERSEDED");
    expect(repository.rows).toHaveLength(2);
  });

  it("allows multiple separate logical intents for one instrument", async () => {
    const repository = new MemoryIntentRepository();
    const service = new WatchIntentService(repository, new MemoryInstrumentRepository());
    const first = await service.create("demo-user", "NSE:TCS", earningsInput);
    const second = await service.create("demo-user", "NSE:TCS", {
      type: "GENERAL", originalText: "Track management commentary", structuredPayload: { note: "Management commentary" }, provenanceSource: "STOCK_DETAIL",
    });

    expect(first.logicalIntentId).not.toBe(second.logicalIntentId);
    expect((await service.list("demo-user", "NSE:TCS"))).toHaveLength(2);
  });

  it("validates untrusted payloads inside the service boundary", async () => {
    const service = new WatchIntentService(new MemoryIntentRepository(), new MemoryInstrumentRepository());
    await expect(service.create("demo-user", "NSE:TCS", {
      type: "PRICE_LEVEL", originalText: "Invalid", structuredPayload: { targetPricePaise: -1, mode: "NEAR" }, provenanceSource: "MANUAL",
    })).rejects.toThrow();
  });
});
