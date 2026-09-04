import { describe, expect, it } from "vitest";
import { WatchlistService } from "./watchlist-service";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import {
  MemoryDemoSessionRepository, MemoryEventRepository, MemoryInstrumentRepository, MemoryIntentRepository,
  MemorySnapshotRepository, MemoryWatchlistRepository, testInstrument, watchlistRecord,
} from "../../../tests/helpers/in-memory";
import type { WatchlistItemRecord } from "@/server/repositories/contracts";
import type { MarketSnapshotRecord } from "@/domain/market/types";

const item: WatchlistItemRecord = {
  id: "item-1", watchlistId: "demo-watchlist", instrumentId: "NSE:TCS", addedAt: new Date(), archivedAt: null,
  provenanceSource: "IMPORTED_DEMO", provenanceReference: "groww-delta-default", instrument: testInstrument,
};
const snapshot: MarketSnapshotRecord = {
  id: "snapshot:0:NSE:TCS", instrumentId: "NSE:TCS", sequence: 0, eventTime: new Date(), pricePaise: 320000,
  openPaise: 319500, highPaise: 320400, lowPaise: 319000, cumulativeVolume: 540000n, expectedCumulativeVolume: 560000n,
  source: "ReplayMarketProvider", quality: "FRESH",
};

function setup(items: WatchlistItemRecord[]) {
  const watchlists = new MemoryWatchlistRepository(watchlistRecord(items));
  const market = new ReplayMarketProvider(new MemoryDemoSessionRepository(), new MemorySnapshotRepository([snapshot]), new MemoryEventRepository([]));
  return { watchlists, service: new WatchlistService(watchlists, new MemoryInstrumentRepository(), new MemoryIntentRepository(), market) };
}

describe("WatchlistService", () => {
  it("rejects duplicate active additions", async () => {
    const { service } = setup([{ ...item }]);
    await expect(service.add("demo-user", "NSE:TCS")).rejects.toMatchObject({ code: "DUPLICATE_WATCHLIST_ITEM" });
  });

  it("archives removal and permits re-adding the instrument", async () => {
    const { service, watchlists } = setup([{ ...item }]);
    await expect(service.remove("demo-user", "item-1")).resolves.toEqual({ id: "item-1", archived: true });
    expect(watchlists.record.items[0].archivedAt).toBeInstanceOf(Date);
    await expect(service.add("demo-user", "NSE:TCS")).resolves.toMatchObject({ instrument: { id: "NSE:TCS" } });
    expect(watchlists.record.items.filter((row) => row.archivedAt === null)).toHaveLength(1);
  });

  it("returns the current replay price in the watchlist DTO", async () => {
    const { service } = setup([{ ...item }]);
    const result = await service.getDefault("demo-user");
    expect(result.items[0].snapshot?.pricePaise).toBe(320000);
    expect(result.items[0].snapshot?.source).toBe("ReplayMarketProvider");
  });
});
