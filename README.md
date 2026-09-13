# Groww Delta — The Living Watchlist

A deterministic, explainable watchlist that remembers why you are watching, what you acknowledged, and which new changes relate to your saved reasons. All market data is simulated. No investment recommendations, trading, AI APIs or live market integration.

Build 5 hardens the Build 4 reference semantics with isolated anonymous sessions, transactional mutations, versioned policy/replay hashes, decision traces and offline research exports. The main product remains Catch Up → understand why → acknowledge → review the watch reason.

## Run locally

Node 22.17.0, pnpm 11.25.0 and PostgreSQL are required.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:up
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. Each browser gets its own server-generated anonymous session. Advance the default demo to Step 2, mark all caught up, then advance through Steps 3 and 4. Resilience scenarios are available under Demo.

## Verify and reproduce

```sh
pnpm verify
pnpm test:db
pnpm test:seed
pnpm exec playwright install chromium
PLAYWRIGHT_USE_BUILD=true pnpm test:e2e
pnpm research:export
pnpm benchmark
```

See [Reproducibility](docs/REPRODUCIBILITY.md) for exact environment/deployment/replay commands, [Build 5](docs/BUILD5.md) for engineering validation and limitations, [Audit](docs/BUILD5_AUDIT.md), and [Research handoff](docs/RESEARCH_HANDOFF.md) for the frozen policy and export contract.

## Architecture

React → Next route/session boundary → application services → domain rules/repository interfaces → Prisma/PostgreSQL. MarketDataProvider isolates replay. Attention, graph, knowledge, trust and policy logic do not depend on React. Research instrumentation uses the same analyzer outside the UI. [Architecture details](docs/ARCHITECTURE.md).

The previous public demo is [hosted here](https://groww-delta-dusky.vercel.app/); its deployment version is not changed automatically by this branch. Source: [sneharc16/groww-delta](https://github.com/sneharc16/groww-delta).

## Author

Sneha Roychowdhury · B.Tech ECE-AI, IGDTUW, Delhi. [GitHub](https://github.com/sneharc16) · [LinkedIn](https://www.linkedin.com/in/snehaaroychowdhury/).

This is a simulated information-attention reference implementation, not investment advice or a trading system. Curated demos test correctness; they are not evidence of real-world relevance or financial outcomes.
