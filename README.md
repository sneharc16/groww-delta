# Groww Delta

**The Living Watchlist** remembers not only which companies an investor follows, but why they care. This repository contains Build 1: a working, database-backed foundation for watchlists, versioned Watch Intents, and a deterministic simulated Indian market.

All prices, times, volumes, and events shown by the application are **simulated demo data**. They are not Groww or NSE live quotes and must not be used for trading decisions.

## Build 1 scope

- A responsive Catch Up shell, full watchlist, stock detail, Watch Intent editor/history, and demo controls
- Five seeded NSE instruments for the deterministic scenario
- Add/archive/re-add watchlist items
- Multiple active Watch Intents per instrument
- Non-destructive intent edits with version history and provenance
- PostgreSQL persistence through Prisma repositories
- Persisted Knowledge Cursor baselines and demo position
- `MarketDataProvider` boundary with a database-backed `ReplayMarketProvider`
- REST-style Next.js route handlers with Zod validation and consistent API errors
- Unit/service tests and a Playwright critical-flow test

Build 1 does **not** implement meaningful-change analysis, relevance or attention scoring, automatic Knowledge Cursor acknowledgement, notifications, AI features, live market data, authentication, recommendations, or trading.

## Architecture

The repository is one Next.js App Router application. Client components call route handlers; handlers validate input and delegate to application services; services own business rules; repositories own Prisma access. Market reads go through `MarketDataProvider`, never directly to replay fixtures from the UI.

See [Architecture](docs/ARCHITECTURE.md), [Domain model](docs/DOMAIN_MODEL.md), [Decisions](docs/DECISIONS.md), and [Build 1 scope](docs/BUILD1.md).

## Prerequisites

- Node.js 22+
- Corepack/pnpm
- Docker with Docker Compose

## Local setup

```bash
corepack enable
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The seeded user is `demo-user` and the seeded watchlist is `My Watchlist`.

Running `pnpm db:seed` more than once is safe. It does not duplicate rows or reset a user-advanced demo position.

Useful database commands:

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm db:down
```

## Validation

With PostgreSQL running, migrated, and seeded:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The Playwright flow updates a TCS watch reason and advances the persisted replay. Run `pnpm db:seed` before the first browser test; use the Reset Scenario control if you want to return to Step 0 afterward.

## API surface

- `GET /api/instruments`
- `GET /api/watchlist`
- `POST /api/watchlist/items`
- `DELETE /api/watchlist/items/:id`
- `GET|POST /api/watch-intents`
- `PATCH /api/watch-intents/:logicalIntentId`
- `POST /api/watch-intents/:logicalIntentId/archive`
- `GET /api/demo/state`
- `POST /api/demo/advance`
- `POST /api/demo/reset`
- `GET /api/market/current`
- `GET /api/market/events?sinceSequence=<number>`

## Future market provider extension

The provider contract lives at `src/server/market/providers/market-data-provider.ts`. A later live provider can implement that interface and be selected in the server composition root. It should not change UI, API, or watch-intent domain code. No live provider exists in Build 1.
