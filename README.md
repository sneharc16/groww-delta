# Groww Delta

**The Living Watchlist** remembers which companies an investor follows, why they care, and what has changed since they last acknowledged the market. This repository contains Builds 1 and 2: the persistent watchlist foundation plus a deterministic, explainable Catch Up attention engine.

All prices, times, volumes, and events shown by the application are **simulated demo data**. They are not Groww or NSE live quotes and must not be used for trading decisions.

## Current scope (Builds 1–2)

- An engine-driven Catch Up screen, full watchlist, stock detail, Watch Intent editor/history, and demo controls
- Five seeded NSE instruments for the deterministic scenario
- Add/archive/re-add watchlist items
- Multiple active Watch Intents per instrument
- Non-destructive intent edits with version history and provenance
- PostgreSQL persistence through Prisma repositories
- Monotonic per-instrument Knowledge Cursors with explicit `Mark seen` and `Mark all caught up` commands
- Transition-based structured intent matching for price, earnings, technical, driver, dividend, and company-event intents
- Objective price, volume, and event significance with deterministic scoring and three attention lanes
- Effective market sequences on intent versions, preventing new or edited reasons from reinterpreting older events
- One derived, explainable attention item per instrument; no persisted attention truth
- `MarketDataProvider` boundary with a database-backed `ReplayMarketProvider`
- REST-style Next.js route handlers with Zod validation and consistent API errors
- Unit, service, default-scenario integration tests, and four Playwright flows

Build 2 does **not** implement semantic or graph-based inference, AI summaries, automatic acknowledgement, notifications, live market data, authentication, recommendations, or trading. See [Build 2](docs/BUILD2.md) for the exact boundary.

## Architecture

The repository is one Next.js App Router application. Client components call route handlers; handlers validate input and delegate to application services; services own business rules; repositories own Prisma access. Market reads go through `MarketDataProvider`, never directly to replay fixtures from the UI.

See [Architecture](docs/ARCHITECTURE.md), [Domain model](docs/DOMAIN_MODEL.md), [Decisions](docs/DECISIONS.md), [Build 1](docs/BUILD1.md), and [Build 2](docs/BUILD2.md).

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

The Playwright suite covers Build 1 watchlist/intent behavior and Build 2 attention/acknowledgement behavior. Tests reset the replay where a fixed baseline is required.

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
- `GET /api/catch-up`
- `POST /api/catch-up/acknowledge`

## Future market provider extension

The provider contract lives at `src/server/market/providers/market-data-provider.ts`. A later live provider can implement that interface and be selected in the server composition root. It should not change UI, API, watch-intent, or attention-domain code. No live provider exists in Build 2.
