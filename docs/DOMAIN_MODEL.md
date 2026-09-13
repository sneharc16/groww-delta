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
- `effectiveFromSequence`, the market sequence at which that version began applying.

Editing never overwrites the active row. In one transaction, the old version becomes `SUPERSEDED` and a new `ACTIVE` row is created with the same logical ID, the next version, and a link to its predecessor. Archiving changes only the current active version to `ARCHIVED`. Historical intent rows remain inspectable.

New and edited versions take the current market sequence as their effective sequence. Intent matching starts after the later of this sequence and the user's cursor, preventing a newly added reason from reinterpreting older market events. When the demo clock intentionally rewinds, analysis clamps a future effective sequence to the current replay sequence; this is replay time-travel behavior, not a production-market rule.

Supported types are `PRICE_LEVEL`, `EARNINGS`, `DIVIDEND`, `TECHNICAL`, `COMPANY_EVENT`, `DRIVER`, `LONG_TERM`, and `GENERAL`. Their payloads are discriminated and validated in `src/domain/intent/schemas.ts`.

## MarketSnapshot

A point-in-time observation for one instrument and replay sequence. All money uses integer paise. It stores price, OHLC, cumulative/expected cumulative volume, simulated expected one-step movement in basis points, event time, source, and quality. `(scenarioId, instrumentId, sequence)` is unique. Expected movement is fixture metadata used to normalize price changes over a multi-step window with `sqrt(sum(stepMove²))`; it is not real volatility data.

## MarketEvent

An immutable conceptual fact assigned to a deterministic sequence, with optional instrument, event/received times, source, quality, typed event name, JSON payload, normalized `subjectType`/`subjectKey`, tags, and optional correction reference. Subjects and tags create a generic graph-matching surface without replacing typed payload semantics.

## WatchGraph, nodes, and edges

A WatchGraph belongs to one logical Watch Intent and instrument. Like an intent, it has an immutable version chain, status, provenance, template key, and `effectiveFromSequence`. Editing relationships supersedes the prior graph and creates a new active version, so new relationships cannot reinterpret older events.

Nodes use a small controlled type set (`INSTRUMENT`, `QUESTION`, `METRIC`, `DRIVER`, `EXTERNAL_DRIVER`, `EVENT_CATEGORY`, `PRICE_CONDITION`). Exactly one instrument root is required. Edges use six controlled relationship labels and an integer 0–100 relevance weight. Weights mean configured relevance strength, never causal probability. Traversal is capped at depth three and 25 visited nodes.

## KnowledgeCursor

The persisted knowledge baseline for one user/instrument pair: last seen sequence/event time, last observed snapshot, and cursor version. Reads never move it. Only explicit acknowledgement advances it, and the database update is monotonic. Individual acknowledgement can leave instruments at different baselines. Adding or re-adding a watchlist instrument starts its cursor at the current market sequence. Demo reset returns active instruments to the Step 0 baseline.

## DemoSession

Stores the active replay scenario, step, sequence, and simulated time. It is persisted independently of browser state, so refreshing does not reset the replay. Advance and reset update this row through `DemoMarketService`.

## KnowledgeAcknowledgement

An append-only acknowledgement record captures one instrument's prior and resulting sequence, whether it came from an individual or watchlist command, and its acknowledgement time. It supports the watch timeline but never replaces the cursor's role as current knowledge state.

## AttentionItem

An AttentionItem is derived, not persisted. It aggregates at most one consumer card per active instrument for the window after that instrument's Knowledge Cursor through the current market sequence. It contains baseline/current state, price and volume measurements, material events, direct intent matches, reason codes, confidence, internal score, and a `RELEVANT`, `SIGNIFICANT`, or `QUIET` lane.

Relevance and significance are intentionally separate. Direct structured matches score relevance 100. If no direct match exists, a fresh/delayed event may match a confirmed graph path; path relevance is the product of edge weights and must be at least 50. The strongest path drives the consumer explanation while all matches remain attached to their logical intents. Objective significance remains independent.

## Watch Intent lifecycle

Resolvable structured intents become `RESOLUTION_ELIGIBLE` only after a matching event/transition occurred and the Knowledge Cursor crossed it. The user may keep watching, change, or resolve; nothing is auto-archived and the watchlist item remains. Results/dividend reasons may renew as a new active version. Expiry and acknowledged event age can create a calm `STALE_CANDIDATE` review suggestion. The watch timeline is derived from intent/graph versions, market events, acknowledgements, and resolution fields.

## Build 4 extensions

- **Instrument:** kind EQUITY/INDEX and isWatchlistEligible. Nifty 50 is benchmark context, not an addable stock.
- **MarketSnapshot:** scenarioId and receivedTime; quality/freshness stays provider-resolved. Money remains integer paise.
- **MarketEvent:** scenarioId and append-only correction chains using existing correctionOfId. Sequence means discovery/ingestion ordering; eventTime remains actual occurrence.
- **Intent / graph:** effectiveScenarioId and effectiveDemoGeneration scope effectiveFromSequence to an explicit replay run. Stored historical versions never change when the demo rewinds.
- **DemoSession:** generation, providerStatus, lastHealthySequence support atomic scenario baselines and last-available-data reads.
- **KnowledgeAcknowledgement:** scenarioId and demoGeneration separate immutable action history from later time-travel resets. Successful advancement/history writes are atomic.
- **CorporateActionReview:** user/logical intent/event/run identity, decision, original and adjusted targets, resulting intent ID and decision timestamp. Adjustment appends a new intent version.
- **TrustNotice:** derived awareness/review object separate from attention lanes, with type, severity, human copy, structured reasons and source/time/action metadata.
- **MarketContext:** derived benchmark delta, breadth, median movement, Calm Mode and grouped count. No new persisted market truth.
- **AttentionItem:** trust metadata, trusted baseline reference, market-relative delta and grouped state extend the existing single analysis result. Formula and direct/graph semantics remain intact.

Demo namespace rebasing is explicit orchestration only. Within an uninterrupted run new intent/graph versions cannot interpret prior events. Between runs retained user configuration begins at the new baseline; old acknowledgement records remain stored but do not become assertions about the new run.

## Build 5 isolation and reproducibility

AnonymousSession stores a random session identity, hashed bearer token, expiry, unique User/DemoSession ownership and grouped-move disclosure preference. MutationReceipt uniquely binds session+action key to a request hash and committed response.

ReplayDataset identifies scenario+version+content hash. Snapshots/events carry scenarioVersion; events add sourceEventId and eventVersion while correctionOfId remains append-only lineage. DemoSession pins its dataset version. Queries cannot mix versions; new versions receive distinct durable record IDs.

AttentionDecisionTrace is derived, not market truth. It records policy/scenario hashes, actual evidence and interpretation versions, cursor state, component decisions, explanations and trust/context metadata. Research run manifests separately retain wall-clock execution, code/source identity and seed.
