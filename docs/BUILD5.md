# Build 5: final engineering reference

Build 5 preserves the Build 4 policy and modular monolith. It adds isolation, transactional coordination, reproducibility and measurement—not new financial predictions or recommendations.

## Architecture and session model

A cryptographically random server-issued anonymous UUID cookie identifies an AnonymousSession. Only its SHA-256 token hash is stored. HttpOnly, SameSite=Lax, a 30-day expiry, and Secure in production protect the cookie. Each session owns an independent User and DemoSession; all watchlist, intent, graph, lifecycle, cursor/history, corporate-action and grouped-move preference state is scoped to that identity. No login or personal profile is requested.

Shared market definitions remain immutable. Existing demo-user data is preserved for legacy offline developer scripts, never selected by HTTP routes. Reset/switch changes only the active session's replay/knowledge baseline and preserves reason history. An expired/corrupt session fails explicitly and offers deliberate creation of a new anonymous demo.

All mutations execute within a per-session row lock and database transaction. Receipts bind an Idempotency-Key to the request content and preconditions. Same-key retries reuse the committed response; mismatched payloads fail. If-Match protects UI intent/graph edits; replay position protects advancement; scenario/generation protects stale-tab acknowledgement. Read evaluations use RepeatableRead and never write knowledge. The bounded HTTP body is at most 32 KiB.

## Frozen policy and instrumentation

Reference version `groww-delta-reference-1.0.0`, SHA-256 `6def3e3af65c5f762db078a450a00c6f7fb55ce02d6b2028f11cd016ba85d967`. Default weights and thresholds are unchanged.

Every item carries a Decision Trace assembled from actual computation: policy/scenario identity, pseudonymous session, source/receipt times, immutable event/correction lineage, cursor, versions, matches, graph path, component scores, reasons, trust, Calm and corporate-action state. Internal scores are not primary consumer copy. Query/decision logs correlate through requestId without SQL, credentials, cookies or raw errors.

Offline replay/JSONL/CSV export and explicit component/baseline configurations use the same analyzer. Production never imports experimental presets. Four v1.0.0 scenarios have canonical content hashes, immutable database dataset records and version-scoped observations. Existing sessions pin a version; a missing installed version fails explicitly rather than silently switching data.

## Observed reference regression

| Position | Relevant / Significant / Quiet |
| --- | --- |
| Step 0 | 0 / 0 / 5 |
| Step 1 | 0 / 0 / 5 |
| Step 2 | 4 / 1 / 0 |
| Mark all at Step 2 | 0 / 0 / 5 |
| Step 3 | 0 / 0 / 5 |
| Step 4 | 1 / 0 / 4 |

Step 4 IndiGo: contextual path IndiGo → Fuel cost → Crude; relevance 85, direct match false, price significance 0, final score 61. These are computed results, not fixture cards.

Resilience regressions preserve stale/conflicting suppression; delayed confirmation at <=60 seconds (not 61); trusted baseline continuity; outage last-confirmed state; explicit seen corrections and unseen replacement; Calm Mode grouping with explicit HDFC condition; and split review without false triggers. The shock benchmark moves -400 bps with 5/5 breadth and four grouped generic moves. Reliance's later residual surfaces independently. HDFC's ₹1,550 target becomes a suggested ₹775 after 1:2 split only through a confirmed new version.

## Audit and measured performance

[BUILD5_AUDIT.md](BUILD5_AUDIT.md) records eleven demonstrated repairs, reproductions and regressions. Historical semantics, temporal bounds, graph subject authority, trust, correction lineage and research isolation were cross-checked, not just inferred from passing tests.

Hardware: Apple M1, 8 logical CPUs, 8 GiB RAM, macOS arm64, Node 22.17.0. Offline benchmark: 3 warmups, 20 measured samples per size; full domain computation including traces, not SQL/network/UI.

| Instruments | Event observations | p50 ms | p95 ms | Graph nodes visited | Observed RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| 5 | 8 | 0.871 | 1.185 | 4 | 99.9 |
| 50 | 80 | 4.922 | 5.618 | 40 | 104.4 |
| 500 | 800 | 41.529 | 46.944 | 400 | 159.5 |
| 5,000 | 8,000 | 371.330 | 387.522 | 4,000 | 305.7 |

Event observations count per-instrument candidate observations, not unique external news stories. Memory is observed whole-process RSS, not isolated peak allocation. p99 is intentionally omitted because 20 samples do not support it.

Separate PostgreSQL-backed Catch Up measurement (five instruments, 20 samples, embedded local backend/pool=1): 212.025 ms p50 / 333.942 ms p95, 17 emitted SQL queries per evaluation. Earlier uncongested measurement was 152.321 / 180.676 ms; environment/load matters. No production SLA is inferred. One-intent versus ten-intent lifecycle queries initially grew 11→38; batching reduces both to 11. The benchmark retains a regression assertion. No caching infrastructure was added.

Large-scale database throughput, multi-host load and production network latency are **not measured**. Generated benchmark JSON retains samples, execution/source identity, measurements and environment. It is not committed as a large experiment dataset.

## Accessibility and UX

The existing visual system is retained. The pass fixed measured contrast failures, invalid progress ARIA and async error races. Native keyboard dialogs, unique labels, visible focus, skip navigation and reduced-motion support are present. Axe WCAG 2.1 A/AA checks cover Catch Up, Watchlist, Stock Detail and Demo at 390/768/1440 widths, driver editing, and mobile attention/trust/Calm/corporate states. Keyboard Enter/Escape and overflow assertions supplement automated rules.

Visual inspection of the captured mobile Stock Detail and Calm Mode screens found no clipping or collisions. Screenshot inspection and automated browser interaction are engineering checks, not a human screen-reader certification. Real assistive-technology user testing, browser-specific zoom audits and a formal WCAG conformance assessment remain deployment validation work.

## Database/security/deployment

Three additive Build 5 migrations add AnonymousSession, MutationReceipt, ReplayDataset; event source/version and snapshot dataset version; DemoSession version pin; scoped uniqueness and query indexes; active-version constraints; graph endpoint/weight constraints; immutable market/dataset update triggers. Existing data is not reset.

Seed is insert-only for market facts and preserves session state. Physical database tests use uniquely owned records, including rollback failure injection. Separate processes must not concurrently drive this host's embedded PostgreSQL protocol; CI uses ordinary PostgreSQL 16.

Security headers disable framing/object embedding, constrain form/base origins, disable unused browser permissions and MIME sniffing, and limit referrer disclosure. Runtime environment validation rejects invalid configuration without echoing values. Health reports connectivity/schema/provider/build identity only. React escapes consumer strings; no external authentication, analytics, market feed or AI integration is added.

Vercel-compatible Node deployment remains supported. Run migrations/seed as release steps, use HTTPS and private DATABASE_URL, and size the pool for the deployment. No existing production deployment has been changed.

## Validation record

- Lint and strict typecheck passed.
- 180 unit/service/research invariants passed, including all 163 Build 4 tests.
- Complete 19-flow browser run passed, including expiry recovery, stale-tab protection, session/preferences isolation and the original eleven flows.
- Production build passed.
- All seven migrations applied without reset; double seed passed with unchanged counts/state.
- Physical database concurrency/rollback/immutability/version isolation passed.
- Reference JSONL and CSV exports were byte-identical on repeated runs (25 traces, trace-set hash `a1f28c3ef06ac02fcf59ce5bc655f5267394abd8d4e59950778153ac299ab537`).
- GitHub Actions workflow pins Node/pnpm, frozen installation, PostgreSQL migration/seed, all checks and full Chromium suite. Remote execution status is reported separately from local validation.

## Known limitations

Anonymous cookies are bearer credentials, not full authentication. There is no cross-device account recovery. Expired sessions are rejected, but automated retention cleanup and deployment-level abuse/rate limits are not installed. Provisioning/receipts need an operational retention policy before public high-volume use.

The application is a hardened **simulated reference implementation**, not a live-market production trading product. Trust quality is provider-resolved prototype metadata, beta=1 is not an empirical factor model, and curated graphs are configured relevance rather than causal claims. Only installed replay versions can run; archived source is reproducible by Git revision.

No external monitoring, backup automation, multi-provider reconciliation, real-user relevance labels, statistical evaluation or publication claims are included. Offline presets are evaluation foundations, not validated scientific conclusions. See [Research handoff](RESEARCH_HANDOFF.md) and [Reproducibility](REPRODUCIBILITY.md).
