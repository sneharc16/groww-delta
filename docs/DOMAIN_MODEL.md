# Domain model

## User

Owns watchlists, Watch Intents, and Knowledge Cursors. Build 1 seeds `demo-user` (`Demo Investor`) while retaining a durable `userId` on user-owned records so authentication can be introduced later.

## Instrument

A durable security identity such as `NSE:TCS`. `symbol` alone is not the primary key because the same symbol could exist on different exchanges. Instrument metadata includes exchange, company name, optional sector, currency, and active state.

## Watchlist and WatchlistItem

A Watchlist belongs to a user. Build 1 seeds `My Watchlist`. A WatchlistItem records when and where an instrument was added; removing a stock sets `archivedAt` rather than deleting the row. PostgreSQL prevents duplicate active items for the same watchlist and instrument.

## WatchIntent

A WatchIntent records why a user follows an instrument. One instrument can have multiple independent logical intents. Each version stores:

- a stable `logicalIntentId` and immutable row `id`;
- a discriminated type and server-validated structured payload;
- the user's original short text;
- provenance source/reference;
- status, horizon, optional expiry, and timestamps;
- a monotonically increasing version and `supersedesId` link.

Editing never overwrites the active row. In one transaction, the old version becomes `SUPERSEDED` and a new `ACTIVE` row is created with the same logical ID, the next version, and a link to its predecessor. Archiving changes only the current active version to `ARCHIVED`. Historical intent rows remain inspectable.

Supported types are `PRICE_LEVEL`, `EARNINGS`, `DIVIDEND`, `TECHNICAL`, `COMPANY_EVENT`, `DRIVER`, `LONG_TERM`, and `GENERAL`. Their payloads are discriminated and validated in `src/domain/intent/schemas.ts`.

## MarketSnapshot

A point-in-time observation for one instrument and replay sequence. All money uses integer paise. It stores price, OHLC, cumulative/expected cumulative volume, event time, source, and quality. `(instrumentId, sequence)` is unique.

## MarketEvent

An immutable conceptual fact assigned to a deterministic sequence, with optional instrument, event/received times, source, quality, typed event name, JSON payload, and optional correction reference. Corrections are represented by new rows rather than mutation of the original fact.

## KnowledgeCursor

The persisted baseline for one user/instrument pair: last seen sequence/event time, last observed snapshot, and cursor schema version. Build 1 seeds each cursor at Step 0 and does not advance cursors when pages are viewed.

## DemoSession

Stores the active replay scenario, step, sequence, and simulated time. It is persisted independently of browser state, so refreshing does not reset the replay. Advance and reset update this row through `DemoMarketService`.
