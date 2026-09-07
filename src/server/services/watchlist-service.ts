import type { InstrumentRepository, KnowledgeCursorRepository, WatchIntentRepository, WatchlistRepository } from "@/server/repositories/contracts";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import { assessData, canConfirmPrice } from "@/domain/trust/freshness";
import { AppError } from "@/lib/errors/app-error";
import { toInstrumentDto, toIntentDto, toSnapshotDto } from "@/server/dto/mappers";
import type { WatchlistDto } from "@/server/dto/types";

export class WatchlistService {
  constructor(
    private readonly watchlists: WatchlistRepository,
    private readonly instruments: InstrumentRepository,
    private readonly intents: WatchIntentRepository,
    private readonly market: MarketDataProvider,
    private readonly cursors: KnowledgeCursorRepository,
  ) {}

  async getDefault(userId: string): Promise<WatchlistDto> {
    const watchlist = await this.watchlists.getDefaultForUser(userId);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    const instrumentIds = watchlist.items.map((item) => item.instrumentId);
    const sequence = await this.market.getCurrentSequence();
    const [snapshots, intentRows, history, health] = await Promise.all([
      this.market.getCurrentSnapshots(instrumentIds),
      this.intents.listActiveForInstruments(userId, instrumentIds),
      this.market.getSnapshotsForAnalysis(instrumentIds, sequence),
      this.market.getHealth(),
    ]);
    const snapshotsByInstrument = new Map(snapshots.map((snapshot) => [snapshot.instrumentId, snapshot]));
    const items = watchlist.items.map((item) => {
      const observed = snapshotsByInstrument.get(item.instrumentId);
      const snapshot = observed && (observed.quality === "STALE" || observed.quality === "CONFLICTING") ? history.filter((row) => row.instrumentId === item.instrumentId && canConfirmPrice(row)).sort((a, b) => b.sequence - a.sequence)[0] : observed;
      return {
        dataTrust: observed ? { ...assessData(observed, observed.receivedTime ?? observed.eventTime), ...(health.status === "UNAVAILABLE" ? { label: "Last available data · provider unavailable" } : {}) } : null,
        id: item.id,
        addedAt: item.addedAt.toISOString(),
        provenanceSource: item.provenanceSource,
        provenanceReference: item.provenanceReference,
        instrument: toInstrumentDto(item.instrument),
        snapshot: snapshot ? toSnapshotDto(snapshot) : null,
        activeIntents: intentRows.filter((intent) => intent.instrumentId === item.instrumentId).map(toIntentDto),
      };
    });
    return { watchlist: { id: watchlist.id, name: watchlist.name }, items };
  }

  async add(userId: string, instrumentId: string) {
    const watchlist = await this.watchlists.getDefaultForUser(userId);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    const instrument = await this.instruments.findById(instrumentId);
    if (!instrument || instrument.kind === "INDEX" || instrument.isWatchlistEligible === false) {
      throw new AppError("INSTRUMENT_NOT_FOUND", "The selected instrument does not exist.", 404);
    }
    if (await this.watchlists.findActiveItem(watchlist.id, instrumentId)) {
      throw new AppError("DUPLICATE_WATCHLIST_ITEM", "This instrument is already in the watchlist.", 409);
    }
    const health = await this.market.getHealth();
    if (health.status === "UNAVAILABLE") throw new AppError("PROVIDER_UNAVAILABLE", "Add this stock once current market data is available to establish its baseline.", 409);
    const currentSequence = await this.market.getCurrentSequence();
    const snapshot = await this.market.getSnapshotAtOrBefore(instrumentId, currentSequence);
    if (!snapshot) throw new AppError("INVALID_MARKET_STATE", "No current market snapshot exists for this instrument.", 409);
    try {
      const item = await this.watchlists.addItem(watchlist.id, instrumentId);
      await this.cursors.setBaseline(userId, {
        instrumentId,
        sequence: currentSequence,
        eventTime: snapshot.eventTime,
        snapshotId: snapshot.id,
      });
      return { id: item.id, instrument: toInstrumentDto(item.instrument), addedAt: item.addedAt.toISOString() };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new AppError("DUPLICATE_WATCHLIST_ITEM", "This instrument is already in the watchlist.", 409);
      }
      throw error;
    }
  }

  async remove(userId: string, itemId: string) {
    const watchlist = await this.watchlists.getDefaultForUser(userId);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    const archived = await this.watchlists.archiveItem(itemId, watchlist.id, new Date());
    if (!archived) throw new AppError("WATCHLIST_ITEM_NOT_FOUND", "The watchlist item is not active.", 404);
    return { id: itemId, archived: true };
  }
}
