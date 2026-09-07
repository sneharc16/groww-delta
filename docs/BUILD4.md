# Build 4 — Trust and resilience

Build 4 extends the existing attention engine; it does not create a parallel scoring system. Phase A audited fourteen invariant groups and repaired eight semantic issues before Phase B. See [the audit](BUILD4_AUDIT.md).

## Trust policy

The consumer vocabulary is **Current / Delayed / Unreliable / Corrected**. “Current” describes the provider's resolved quality metadata, not official verification, exchange connectivity, or independently verified financial truth. Everything remains simulated.

Every attention item exposes source, observation time, receipt time, quality, age/delay, and typed trust reasons. Event summaries retain actual event/receipt times and correction references. Candidate-versus-confirmed price facts and suppression codes are available in Demo debug. The lowest-quality contributing observation lowers confidence. Delayed events are disclosed even when the stock snapshot itself is fresh.

Trusted price-condition state ignores STALE and CONFLICTING snapshots. A stale quote entering a range does not alter that state: the subsequent fresh quote compares against the last trusted outside value and can confirm entry. This also works if the stale step was explicitly acknowledged. DELAYED price confirmation requires a receipt timestamp and delay at most 60 seconds; 61 seconds fails. All thresholds live in `src/domain/trust/policy.ts`.

Stale/conflicting events cannot confirm technical/direct/graph relevance or contribute ordinary event significance. Withheld events and problematic observations produce separate Trust Notices. Last confirmed values remain available instead of clearing the screen. Notices are awareness/review items, never recommendations.

Catch Up order is trust notices, market context, relevant changes, significant changes, then quiet instruments. Internal suppression reasons and trusted baselines appear only in Demo debug.

## Corrections and immutable events

Corrections are append-only events of the same semantic type with `correctionOfId` and CORRECTED quality. This preserves earnings matching without a second payload protocol. The original stays queryable.

- Unseen original: suppress replaced content and analyze only the latest corrected interpretation.
- Seen original: show “Information you previously viewed was corrected” with deterministic changed fields and original/correction timestamps; do not repeat the original normal card.
- A correction chain can reach the last revision the user actually saw, even if intermediate revisions were not seen.
- Explicitly marking the correction seen advances the normal Knowledge Cursor.

Normalize provider arrays before analysis: deduplicate identical stable IDs; reject conflicting immutable content under one ID with `EVENT_INTEGRITY_CONFLICT`; sort by sequence, event time, then ID. Invalid or non-linear correction references fail safely. Ingestion sequence drives novelty. Event time describes when something occurred, so a late-arriving earlier event is still new after the cursor.

## Corporate actions

A STOCK_SPLIT event has positive integer `oldShares` / `newShares`. A 1:2 split multiplies the reference level by 1/2. Arithmetic uses BigInt and rounds to the nearest paise, half-paise upward.

A structural price jump is excluded from ordinary saved-price transitions and mechanical price significance. The user receives a review notice, not a target-hit message.

- **Update:** atomically supersede the old intent, create a new version effective now, and record the authoritative split reference, original/adjusted paise, resulting intent ID, and decision timestamp.
- **Keep:** record the explicit choice, retain the original threshold, and stop repeating that action's review.
- **Review later:** retain an advisory review item without blocking the watchlist.

Targets are never silently changed. Client requests send only a decision and event identity; the service verifies ownership, occurrence, instrument, ratios, and current intent and derives the adjustment itself.

## Market context and Calm Mode

NSE:NIFTY50 is an INDEX with watchlist eligibility disabled. Benchmark observations use the same provider/repository interface as equities.

Calm Mode activates when absolute benchmark movement reaches 250 bps, or at least 70% of active watched equities move in its direction and median absolute equity movement reaches 200 bps. Index instruments are excluded from breadth.

While active, generic price significance uses a transparent beta=1 residual: stock delta minus benchmark delta, with existing absolute movement buckets. Explicit price conditions, events, volume, direct relevance and graph relevance are not suppressed. Each instrument's residual uses its own cursor window; broad context uses the scenario's baseline. Grouped generic moves remain visible through “Show grouped market moves” and the full watchlist.

These are prototype product thresholds, not empirical factor estimates. A production system could use sector/beta-adjusted residuals.

## Deterministic scenario registry

| Scenario | Observed behavior in PostgreSQL-backed application verification |
| --- | --- |
| groww-delta-default | 0/0/5 → 0/0/5 → 4/1/0 → acknowledge 0/0/5 → Step 3 0/0/5 → Step 4 1/0/4 |
| data-quality | HDFC stale entry withheld at Step 1; fresh entry confirmed at Step 2; disputed Tata update withheld at Step 3; HDFC delayed 45 sec at Step 4; TCS original 2480 margin bps at Step 5 corrected to 2410 at Step 6 |
| market-shock | Nifty −400 bps, 5/5 breadth: four generic equity moves grouped, HDFC saved range survives; Step 2 Reliance residual +329.08 bps surfaces |
| corporate-action | HDFC ₹1,580 → ₹790 split; no false price hit; saved ₹1,550 has suggested equivalent ₹775; accepting creates a new intent version |

Default Step 4 remains graph-only IndiGo → Fuel cost → Crude, relevance 85, no direct FUEL_COST match and price significance zero.

Scenario switching is a validated database command, not a fixture path. It atomically resets session and active cursor baselines while retaining watchlist, intent, graph, and action history. All 102 scenario/benchmark snapshots and eight events have stable seed identities.

### Replay time namespaces

Production domain matching defaults to monotonic effective sequences. Replay is an explicit exception: `scenarioId` plus a persisted generation distinguish independent demo runs. Intent/graph versions record the namespace in which they were created. Within that run they cannot reinterpret older events; after an explicit reset/switch, retained configuration is adopted at the new baseline without editing historical versions. Acknowledgement history and corporate reviews are likewise scoped to their run. This prevents numerical sequences reused in different demos from contradicting knowledge history. Ordinary browser refresh never changes the namespace.

## Provider degradation

Demo controls persist HEALTHY, DEGRADED, or UNAVAILABLE status. During unavailability, provider reads are capped at the last successful sequence; last available data stays visible, new price-derived conditions are not confirmed, and acknowledgement beyond available information is rejected. New watchlist baselines are deferred while the provider is unavailable. Returning to healthy makes subsequent deterministic observations available again. No external monitoring service is introduced.

## Commands and validation

Use the README setup with PostgreSQL running. `DATABASE_URL` must be present for the build as well as runtime.

```sh
pnpm db:migrate:deploy
pnpm db:seed
pnpm test:seed
pnpm test:db
pnpm test:scenarios
pnpm lint
pnpm typecheck
pnpm test
pnpm build
PLAYWRIGHT_USE_BUILD=true pnpm test:e2e
```

`test:seed` compares row counts and session state through two seeds. `test:db` creates a uniquely named temporary test user, verifies database cursor/history coherence and rollback, then removes only its own test records. Browser tests preserve the original seven flows and add four trust flows, including 390px overflow checking. No arbitrary sleeps are used. The production-server option avoids development compilation latency; Next's webpack compiler remains unchanged.

On this host Docker is unavailable, so validation uses the existing local Prisma PostgreSQL server and `DATABASE_POOL_SIZE=1`, preserving Docker Compose support. The single-connection embedded host serializes physical connections; SQL row locks and conditional updates still enforce production PostgreSQL concurrency semantics, and concurrent application requests/rollback are exercised.

## Production evolution — documentation only

Provider adapters → raw observations → reconciliation → normalized market state → event stream → trust assessment → attention.

Build 4 consumes **provider-resolved quality metadata**. It does not implement a production multi-provider reconciler, conflict adjudication, live ingestion, or exchange integration. No AI, live market API, notifications, prediction, trading, microservices, Redis, Kafka, or Build 5 functionality is included.

## Final validation evidence

Final source gates: lint passed, strict typecheck passed, 163 unit/service/integration tests passed, production webpack build passed, and all 11 Playwright flows passed against that build. The Build 4 PostgreSQL migration applied successfully; double seed preserved every row count and demo position. PostgreSQL-backed scenario verification reproduced the table above, including Reliance residual +329.07801418439715 bps and HDFC's adjustment from version 11 to 12 during that run (version numbers grow as demo edits are preserved).

The remote README-only commits were retained during integration. No deployment configuration or external data source was changed.
