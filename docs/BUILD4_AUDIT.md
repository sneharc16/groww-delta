# Build 4 adversarial audit — Phase A

Starting revision: 6e64c3269196a7a335d31599b50badbb92e91898.

Read the implementation, repository write paths, SQL constraints, provider, matchers, graph validator/traversal, timeline, lifecycle, consumer components, and all route handlers. Searched tracked source for Prisma/fixture imports, scoring copies, localStorage, external requests, symbol/step attention branches, any, TODO, and FIXME. Generated dependencies are excluded from source findings.

## Results

Fourteen invariant groups audited. Eight semantic issues found and repaired. No open FAIL findings at the Phase A gate.

| Invariant group | Status | Evidence and repair |
| --- | --- | --- |
| Layering | REPAIRED | No client DB/fixture access, route scoring, duplicate scoring, localStorage truth, forbidden integrations, any, or unfinished placeholders. Found next-cycle lifecycle sequencing in two React components; moved it into IntentLifecycleService. |
| Demo hardcoding | PASS | Symbol literals occur only in curated template configuration, fixtures, tests, and the permitted Demo walkthrough. Attention is derived generically. |
| Knowledge Cursor | PASS | SQL conditional lastSeenSequence update and increment prevent regressions. Explicit baseline/reset commands are the documented replay/re-add exceptions. Add/re-add use current market snapshots. GET query paths have no writes. |
| Acknowledgement consistency | REPAIRED | Prior code advanced cursor and inserted history separately, allowing failed/duplicate audit writes. acknowledgeMany now locks rows in deterministic order and commits conditional advancement plus audit insertion in one PostgreSQL transaction. Stale/equal requests insert no history or version increment; mark-all is atomic. |
| Intent versioning | REPAIRED | Existing edits append versions correctly. Price matcher could inspect supplied snapshots beyond currentSequence; it now bounds the snapshot window. Historical timeline bounds each intent version, retains its payload, and ends resolved versions at resolution. |
| Graph versioning | REPAIRED | Nodes/edges are appended per version. Historical timeline previously selected one intent at graph creation, missing later intent versions and allowing post-resolution interpretation. It now binds each event to the intent/graph version effective at that sequence. |
| Graph removal | PASS | Subject is authoritative; CRUDE with FUEL_COST tag cannot re-enter a graph after CRUDE removal. Explicit adversarial regression covers this. |
| Graph bounds | REPAIRED | Creation validated structure, but persisted traversal did not fully revalidate cycles, aliases, depth, or weights. Traversal now validates the complete stored graph and unique node IDs before bounded traversal. Depth 3 and 25-node limits cannot be bypassed through aliases. |
| Direct versus graph | PASS | Direct matches retain relevance 100 and a DIRECT label; graph paths retain GRAPH metadata and contextual copy. Duplicate direct/graph matches for the same event and intent are suppressed. |
| Effective sequences | REPAIRED | Demo rewind clamp was unconditional in generic domain code. It now requires explicit demoTimeTravel opt-in from replay orchestration; domain defaults preserve production sequence semantics. New/renewed intents and graphs cannot match earlier events. |
| Lifecycle | REPAIRED | Eligibility requires cursor acknowledgement; siblings and watchlist membership remain separate. Resolution and graph closure now share a database transaction. Stale age now begins no earlier than the acknowledged market time. Renewal remains versioned; cleanup is advisory. |
| Attention score | PASS | Exact 0.30/0.35/0.15/0.10/0.10 formula, deterministic rounding/cap, independent lane classification. Numeric score appears only under Demo engine debug. |
| Transition semantics | PASS | NEAR/ABOVE/BELOW use ordered transitions, including intermediate snapshots. Persistent acknowledged conditions do not re-alert. The requested last-trusted-snapshot enhancement is Phase B work. |
| Canonical regression | PASS | Executed the complete deterministic service scenario before Phase B: 0/0/5 → 0/0/5 → 4/1/0 → acknowledge 0/0/5 → Step 3 0/0/5 → Step 4 1/0/4. Step 4 INDIGO GRAPH relevance 85, no direct match, price significance 0. |

## Timeline timestamp repair

The previous timeline replaced action timestamps with replay snapshot times. It now retains createdAt, resolvedAt, and acknowledgedAt for user actions, and eventTime for market facts. Historical market time and real user action time are distinct clocks in a replay; neither is fabricated.

## Regression evidence

Dedicated adversarial tests in src/domain/intent/audit.test.ts exercise version windows, historical graph meaning, removed-subject fallback, persisted cycles/aliases, future snapshots, acknowledgement rollback and stale writes, and actual action timestamps. Lifecycle service/domain regressions cover service-owned renewal and age since acknowledgement. Existing tests cover GET purity, sibling intent isolation, re-add baselines, score and transition boundaries.

Phase A gate PASSED before Phase B: lint, strict typecheck, 108 unit/service/integration tests, canonical replay, and production build. PostgreSQL transaction integration is also included in final database validation.

Final database verification passed using real Prisma repository commands: concurrent/stale acknowledgement, no redundant version/history writes, and rollback after the first cursor/history update when a later cursor is missing. Temporary test records were removed. Replay reset now has one atomic repository-owned session/cursor path rather than a second post-transaction reset.
