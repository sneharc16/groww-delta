# Architecture

Groww Delta Build 1 is a modular monolith: one deployable Next.js application with explicit internal boundaries. This keeps local development simple while protecting the domain model from framework, storage, and market-provider details.

```mermaid
flowchart TD
  UI[React UI] --> API[Next.js Route Handlers]
  API --> Services[Application Services]
  Services --> Domain[Domain Rules and Validation]
  Services --> Repositories[Repository Interfaces]
  Repositories --> Prisma[Prisma Repositories]
  Prisma --> PostgreSQL[(PostgreSQL)]

  MarketQuery[MarketQueryService] --> Provider[MarketDataProvider]
  Provider --> Replay[ReplayMarketProvider]
  Replay --> MarketRepos[Snapshot / Event / Demo Repositories]
  Fixture[Deterministic Replay Scenario] --> Seed[Idempotent Seed]
  Seed --> PostgreSQL
  MarketRepos --> PostgreSQL
```

## Boundaries

### UI

`src/components` renders DTOs and sends user input through HTTP APIs. It does not access Prisma or replay fixtures. Formatting helpers convert integer paise and normalized timestamps at this boundary.

### Route handlers

`src/app/api` parses query/body data, calls a service, and maps errors to the common JSON envelope. Route handlers contain no watchlist, intent-versioning, or replay rules.

### Application services

`src/server/services` owns use-case rules:

- `WatchlistService`: default-list reads, duplicate prevention, add, and archive
- `WatchIntentService`: payload validation, create, versioned edit, and archive
- `DemoMarketService`: exact one-step advance, final-step behavior, and reset
- `MarketQueryService`: watchlist snapshots and occurred-event queries
- `InstrumentService`: available instrument queries

### Domain

`src/domain` contains storage-independent types, discriminated Zod schemas, and intent presentation summaries. WatchIntent validation is applied again inside the service boundary so untrusted JSON cannot bypass a route.

### Repositories

Repository contracts live in `src/server/repositories/contracts.ts`. Prisma implementations live separately in `prisma-repositories.ts`. Intent supersession plus creation is one database transaction.

### Market providers

`MarketDataProvider` defines snapshot, sequence, and event reads. `ReplayMarketProvider` derives the visible market exclusively from the persisted `DemoSession.currentSequence`. UI and general application services never import fixture files.

A future live provider belongs beside `ReplayMarketProvider` and would be selected in `src/server/container.ts`. Build 1 contains no live-provider code.

## Persistence and concurrency

PostgreSQL is the only source of product state. A partial unique index enforces one active `WatchlistItem` for each watchlist/instrument pair while allowing archived history and later re-addition. Intent versions have a unique `(logicalIntentId, version)` key, a self-reference to the previous row, and atomic version transitions.
