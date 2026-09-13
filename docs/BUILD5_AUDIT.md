# Build 5 adversarial audit

Baseline: `67ae054a0ae44b37d6c8562277f20a83095e0fe8`; branch `build5-final`.
All 163 original domain/service/integration tests passed before changes. Scientific thresholds and expected replay results are unchanged.

## Demonstrated findings and repairs

Thirteen defects were reproduced and repaired. New requirements and defensive additions are listed separately; they are not inflated into defect counts.

| ID | Defect and reproduction | Root cause / repair | Regression evidence |
| --- | --- | --- | --- |
| D1 | Injected cursor persistence failure leaves an added watchlist item; compound renewal could similarly partially commit. | Services span multiple repositories without a shared command transaction. All HTTP commands now execute in one session-locked transaction; nested repositories join it. | `verify-build5-database.ts` first reproduces an uncoordinated partial write on its own records, then proves request-boundary rollback; renewal rollback and parallel Mark All/Seen also pass. |
| D2 | Adding future intent/graph versions changed current decision identity (new test failed). | Trace received unbounded configuration. Filter causal versions before scoring/tracing. | Future configuration trace-equality test. |
| D3 | Repeating identical events changed decision identity (new test failed). | Scoring deduped, trace did not. Normalize/deduplicate once at analyzer entry. | Duplicate trace-equality test. |
| D4 | Failed related-driver lookup rendered nothing; RTL could not find role=alert. | Catch cleared state and swallowed the error. Preserve explicit retryable error. | RelatedDrivers failure-injection RTL test. |
| D5 | A late driver lookup showed “No active watch reason” after resolution; browser and RTL reproduced it. | Stale asynchronous responses and a freshly filtered intent array on every render. Memoize active intents and invalidate obsolete request generations. | Late-failure RTL test plus preserved lifecycle browser flow. |
| D6 | Axe measured 3.81–4.41 contrast ratios for small text / primary button and 4.35 for quiet badges. | Existing palette tokens missed AA contrast. Darken teal, amber and muted text without changing semantic colors/layout. | WCAG 2.1 A/AA scans at 390/768/1440 and resilience-state scans. |
| D7 | Axe rejected aria-label on the generic replay progress div. | Missing semantic progressbar role and values. Add role/min/max/current. | Demo accessibility scan. |
| D8 | Two immutable dataset versions produced two snapshots in a query expected to return one. | Snapshot/event repository predicates ignored version. Add version predicates, provider propagation, versioned IDs and session pinning. | Physical PostgreSQL two-version regression (initially 2 != 1). |
| D9 | Injected stock-history 503 did not show an error (browser test failed). | Stock Detail catch replaced history/lifecycle with empty arrays. Propagate failure to explicit retry UI; catch mutation failures too. | Stock-history browser failure-injection test. |
| D10 | A stale tab acknowledged sequence 2 of a different reset generation (expected 409, received 200). | Client knowledge command lacked observed environment context. Add scenario/generation precondition, carried by consumer acknowledgement controls. | Stale-tab test asserts 409 and unchanged 4/1/0 attention. |
| D11 | Measured lifecycle graph-history query count grew from 11 (one intent) to 38 (ten intents). | One graph-history lookup per logical intent, each with relation reads. Batch all historical graphs/relations for the instrument’s intent IDs. | Database benchmark query-growth assertion failed before batching; after repair both one- and ten-intent reads use 11 queries. Retained as a regression. |
| D12 | Linux CI failed three existing mobile overflow assertions; Verdana on macOS reproduced a demo badge extending to x=396.28 at a 390px viewport. | Header flex row assumed platform-specific text widths. Allow natural row wrapping with accessible navigation height; do not hide overflow or the demo label. | Dedicated 320/390px fallback-font browser test failed before repair, alongside the unchanged original overflow assertions. |
| D13 | A correction notice open in an old tab acknowledged a newly reset replay at the same sequence; dedicated browser test failed. | Correction-notice acknowledgement omitted the environment precondition used by other acknowledgement controls. Pass the observed scenario/generation through the same server transaction guard. | Stale-correction browser test verifies rejection and preservation of the new replay’s unacknowledged TCS update. |

## Additional hardening (not counted as baseline defects)

- Shared demo identity was an explicitly replaced prototype assumption. Anonymous sessions now isolate user configuration, cursor/history, replay, lifecycle, review and preferences.
- Raw error-object logging posed a disclosure risk. Allowlisted logs omit SQL/parameters/cookies/environment; safe-logging tests reject extra fields.
- Replay and graph mutation races are serialized; receipts make duplicate action keys idempotent. If-Match and replay position preconditions reject stale edits/advances.
- Seed previously allowed overwrite through upsert updates. Build 5 uses insert-only market seeding, dataset manifests and database update-rejection triggers. Physical update attempts fail; double seed preserves all counts/state.
- Unknown runtime event categories previously reached nonfinite component arithmetic (the trace hash then rejected it). Input validation now returns an explicit INVALID_MARKET_EVENT instead. Its dedicated failing error-class test remains.
- Bounded request bytes, environment validation, safe health response, session-expiry recovery, immutable dataset provenance and database graph constraints were added.
- Native dialogs use unique accessible heading IDs. Reduced-motion support and a skip link are present.

## Final semantic cross-check

- Presentation/routes do not score or traverse graphs; Prisma and replay imports are absent from client components. No any, production symbol/step attention hacks, localStorage truth, external market/AI calls or required TODO/FIXME remain.
- Existing-session GETs are read-only. Cursor conditional update and acknowledgement insert share a transaction; cursorVersion changes only on advancement. New sessions initialize a baseline but do not acknowledge later data.
- Intent/graph effective intervals preserve historical interpretation. Graph subject authority prevents removed CRUDE from matching a broad FUEL_COST tag. Depth=3/nodes=25/threshold=50 remain unchanged.
- Trust state and confidence are separate from relevance. Untrusted intermediates cannot poison trusted transitions; correction chains and split reference frames remain distinct.
- Calm Mode changes generic price significance only; explicit direct and contextual matches survive.
- Attention policy and scenario manifests are canonical-hashed; production never imports offline policy presets.
- Temporal contamination tests cover future prices/events/corrections/intent/graph versions. Provider bounds access by current sequence and last healthy sequence, not fixture array length.
- Lifecycle suggestions require acknowledgement; resolving does not remove the stock, and renewal preserves old meaning.
- Research trace content is generated inside the same analyzer, not approximated from displayed copy. GET cursorBefore equals cursorAfter.
- Empty watchlists are a valid empty evaluation; missing snapshots, invalid events, failed history and provider errors are explicit, not fabricated quiet decisions.

## Validation environment caveat

The local embedded Prisma PostgreSQL backend must not be driven by separate test processes concurrently. Running browser verification alongside seed/DB checks reproduced PostgreSQL protocol error 08P01 (unnamed prepared-statement parameter mismatch). Those checks are run sequentially; no test expectation, policy or fixture was weakened. The CI definition uses ordinary PostgreSQL 16 and preserves full test assertions.

The parallel Mark All/Mark Seen test sends its stale sequence only after the two newer commands finish; this establishes the stated stale-request precondition on multi-connection PostgreSQL, rather than depending on local FIFO scheduling.

The eleven original browser flows now use `page.request` rather than a separate API cookie jar, because identity is no longer globally shared. Their expected outcomes remain unchanged. Accessibility also required disambiguating the application's error alert from Next's route-announcer alert, without weakening the error assertion.

Remote CI uncovered D12 after all local browser checks had passed. GitHub reporter annotations were enabled to expose exact failures without requiring authenticated log downloads. The two final repairs preserve policy/scenario hashes and all original assertions.

See [BUILD5.md](BUILD5.md) for final validation and limitations.
