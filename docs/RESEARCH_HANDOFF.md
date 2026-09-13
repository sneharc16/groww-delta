# Research handoff: frozen reference implementation

## Reference policy

The source of scientific configuration is `src/domain/policy/reference.ts`.
Version: `groww-delta-reference-1.0.0`.
Canonical SHA-256: `6def3e3af65c5f762db078a450a00c6f7fb55ce02d6b2028f11cd016ba85d967`.

The policy and its nested objects are frozen. The default has not been retuned from Build 4. The golden-hash and canonical replay tests guard scientific meaning, not just successful execution.

| Component | Reference meaning |
| --- | --- |
| Significance | Objective price surprise, volume ratio, and strongest eligible event; maximum component plus 10 when at least two are nonzero; cap 100. |
| Price surprise | Absolute cursor-to-current price delta bps divided by sqrt(sum(expected interval move bps squared)). Missing expectations use absolute buckets. Monetary inputs remain integer paise. |
| Buckets | Surprise boundaries 1 / 1.5 / 2 / 3; absolute bps 50 / 100 / 200 / 400; volume 1.3 / 1.5 / 2 / 3; scores 0 / 30 / 50 / 70 / 90. |
| Event significance | Results 90, corporate event 80, technical/external driver 60, news 50, quote 0. Split discontinuities receive review, not ordinary price-event scoring. |
| Relevance | Direct structured intent match = 100. Otherwise strongest valid user-confirmed graph path, rounded product of edge weights, minimum 50. |
| Novelty | 100 for an actual new observation/change in the cursor window; 0 at/behind cursor. Sequence means ingestion/discovery order, not occurrence time. |
| Urgency | Crossing 100; near 80; earnings/technical 70; driver/dividend/company/contextual graph 60; no match 0. Internal ordering only. |
| Confidence | Lowest quality among evidence used: fresh 100, delayed 70, stale 30, conflicting 0, corrected 80. |
| Score | round(.30 significance + .35 relevance + .15 novelty + .10 urgency + .10 confidence), clamped 0–100. |
| Lane | RELEVANT if relevance >0; otherwise SIGNIFICANT if significance >=50; otherwise QUIET. Errors are not QUIET. |

Within attention lanes sort score descending, then symbol ascending. One card aggregates an instrument's signals; matches retain logical intent and graph versions.

## Knowledge, graph, and trust semantics

GET evaluation never advances existing knowledge. Explicit acknowledgement advances a conditional database cursor and inserts its history in the same transaction. Repeated/stale requests do not increment the cursor or duplicate history. New/re-added instruments baseline now.

Intent and graph versions take effect after their effective sequence. Historical payloads/edges remain inspectable. Production sequences never rewind; replay resets/switches use the existing explicit scenario/generation time-travel mapping. Graphs have one root, depth <=3, <=25 nodes, no self/duplicate edges. An authoritative subject cannot sneak back through fallback tags after removal of its node.

Stale/conflicting observations cannot confirm conditions or contextual relevance. They do not update the trusted transition state. Delay <=60 seconds may confirm; 61 seconds may not. Outages preserve last confirmed data and reject unsupported acknowledgements. Corrections are append-only chains: unseen originals are replaced in interpretation, whereas acknowledged originals receive an explicit correction notice.

Calm Mode activates at absolute benchmark move >=250 bps, or breadth >=70% with median absolute equity move >=200 bps. Only generic price significance changes: residual = stock delta minus benchmark delta (transparent beta=1). Explicit matches, graph relevance, volume and events survive; grouped moves remain accessible.

A split is a structural reference discontinuity, not a target crossing. Split-equivalent targets use oldShares/newShares and nearest integer paise, half up. Users confirm any adjustment; acceptance creates a new intent version. Keeping/reviewing is explicit and scoped to the session's replay generation.

## Offline configuration and baselines

`research/configs/policies.ts` provides explicit offline configurations for price-only, significance-only, intent-only, intent+significance, no-cursor, no-graph, no-urgency, no-confidence, equal weights and the full reference policy. These use the same analyzer; production services never import research presets or accept a client policy override.

Removal of a score component does **not** disable integrity validation or let unsafe evidence confirm a condition. The supplied presets are executable engineering foundations, not scientifically validated baselines. A future trust/Calm intervention must specify its safety and evaluation contract explicitly; changing trust thresholds is not currently a consumer or CLI switch.

## Versioned replay

Four immutable v1.0.0 datasets are defined in `data/replay/manifest.json`. Hashing uses canonical JSON: sorted object keys, preserved array order, normalized Dates and decimal BigInts, rejected nonfinite numbers. The manifest is checked before replay. New data requires a new version/hash and separate persisted IDs; v1 IDs retain backward compatibility. Queries are version-scoped. Sessions pin the installed dataset version and fail explicitly if that version is no longer installed; switching to an installed scenario is explicit recovery. Git preserves source for reproducing retired versions.

Scenario fixtures contain observations/events, never expected attention cards. Offline analysis receives only data through the chosen sequence. Adding future observations or future configuration versions cannot change a current trace.

## Trace/export contract

`AttentionDecisionTrace` in `src/domain/attention/trace.ts` is assembled from actual analyzer inputs/outputs. `traceSchemaVersion=1.0.0`. `decisionId` hashes canonical decision content, excluding wall-clock execution timing. It includes policy/scenario identity, a pseudonymous session identifier, cursor before/after, snapshot IDs, evidence provenance, correction lineage, intent/graph versions, components, final score/lane, matches, paths, reason codes, trust/corporate-action/Calm state, and measured graph visitation.

GET traces have identical cursorBefore/cursorAfter. Acknowledgement history is a separate persisted command record, not an invented read-side mutation. No cookies, credentials or full environment records enter traces. Event payloads are simulated dataset content.

`research:export` writes:
- `decisions.jsonl`: one complete canonical trace per instrument per evaluation.
- `decisions.csv`: stable columns in `research/schemas/export.ts`; nested structures are JSON in quoted CSV cells.
- `run.json`: code commit, source-tree hash, dirty-source flag, policy/scenario metadata, seed=0, schema version, execution timestamp and trace hash.

Execution metadata intentionally varies; repeated same-input **decision files** must be byte-identical. Source-tree hashing distinguishes uncommitted validation from the cited commit.

## Future evaluation interface

Join annotations on scenario/version, instrument, event IDs, logical intent/version and evaluation sequence. Keep ranking ties deterministic. Ground-truth labels and relevance judgments belong in separate versioned annotation datasets, not production fixtures or matchers. Exports permit Precision/Recall/NDCG/MAP at K, redundant/repeat surface rates, contextual recall, missed relevant events, alert volume, quiet fraction and score distributions. Benchmark records supply latency/throughput and traversal measurements.

RQ1 intent conditioning, RQ2 cursor redundancy, RQ3 graph recall, RQ4 trust safeguards and RQ5 Calm Mode trade-offs are **not answered** by this build. No statistical or publication-quality effectiveness claims are made. These small curated demos are correctness cases, not representative financial datasets.

Do not change the reference weights, bucket boundaries, fixtures under existing hashes, expected regressions, cursor acknowledgement semantics, trust policies or graph bounds to improve experimental results. Add an explicitly named offline policy/dataset version and rerun all reference invariants instead.
