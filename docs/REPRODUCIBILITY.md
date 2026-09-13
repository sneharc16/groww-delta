# Reproducing Build 5

## Environment and fresh clone

Node 22.17.0 (`.node-version`), pnpm 11.25.0 (`packageManager`), PostgreSQL 16; dependencies are lockfile-pinned. Next remains on webpack. Docker Compose is supported; validation on this macOS host uses the existing local Prisma PostgreSQL process because Docker is unavailable.

```sh
git clone git@github.com:sneharc16/groww-delta.git
cd groww-delta
git switch build5-final
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:up
pnpm db:migrate:deploy
pnpm db:seed
pnpm test:seed
pnpm dev
```

The example credentials are local Compose-only values, not deployment secrets. For an existing PostgreSQL instance set DATABASE_URL privately and omit db:up. Do not reset the database. All migrations are additive; the seed preserves user/session state. For constrained embedded validation only, set DATABASE_POOL_SIZE=1. Regular PostgreSQL defaults to a pool of five.

## Verification

```sh
pnpm verify
pnpm test:db
pnpm exec playwright install chromium
PLAYWRIGHT_USE_BUILD=true pnpm test:e2e
```

`verify` includes lint, strict typecheck, domain/service/research invariants and production build. `test:db` uses uniquely owned temporary test records and removes only those records; it proves physical database cursor/history atomicity, command rollback, dataset isolation and immutable market observations. Browser tests provision independent cookie sessions. They never reset another browser's demo.

`pnpm test:scenarios` is the preserved legacy developer regression script. It mutates the **offline demo-user** fixture state, not browser sessions. Prefer the isolated browser suite on a shared developer database.

## Offline replay, export, benchmark

```sh
pnpm research:replay --scenario groww-delta-default --policy full --ack-at 2
pnpm research:export --scenario data-quality --policy full --ack-at 5
pnpm research:export --scenario groww-delta-default --policy no-graph --ack-at 2 --output research/exports/no-graph
pnpm benchmark
pnpm benchmark:db
```

Offline replay/export and the synthetic benchmark need no database. The database benchmark needs migrated/seeded PostgreSQL. The ordinary reference sequence acknowledges Step 2 before advancing to Step 3. Use `--ack-at -1` for an unacknowledged correction variant. Output directories are ignored by Git. Repeat an export with identical options and compare decision JSONL/CSV bytes; run timestamps are intentionally different.

Read [RESEARCH_HANDOFF.md](RESEARCH_HANDOFF.md) before adding datasets/ablations. Record commit, source-tree hash, manifest, policy hash, seed, schema version and environment with every run. Do not cite wall-clock numbers without their hardware/database context.

## Deployment

Vercel-compatible Node runtime; no filesystem persistence is needed by the application. Research CLIs run offline, not in HTTP handlers. Configure DATABASE_URL, DEMO_MODE=true and optionally DATABASE_POOL_SIZE and BUILD_COMMIT (VERCEL_GIT_COMMIT_SHA is also recognized). Use TLS and a correctly sized PostgreSQL pool in deployment. Run `pnpm db:migrate:deploy` and seed as a release step, not on every request. `pnpm build && pnpm start` verifies local production behavior.

Anonymous cookies are HttpOnly, SameSite=Lax and Secure in production; the application assumes HTTPS outside localhost. `/api/health` reports only application/schema/provider identity and safe connectivity status. This build does not install a live provider, authentication, external telemetry, or manipulate an existing Vercel deployment.
