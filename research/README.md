# Groww Delta research foundation

The production reference policy is frozen in `src/domain/policy/reference.ts`. This directory contains offline adapters/configuration, stable JSONL/CSV exporters and deterministic scale measurements—not UI modes or paper claims.

- `configs/policies.ts`: explicit research presets; production never imports them.
- `replay.ts`: bounded deterministic inputs into the production analyzer.
- `schemas/export.ts`: stable tabular columns and complete JSONL traces.
- `scripts/replay.ts`: replay/export with provenance and run manifest.
- `benchmarks/runner.ts`: 5/50/500/5,000 instrument synthetic full-analyzer benchmark.
- `exports/`, `benchmarks/results/`: generated, ignored output.

Start with [Research handoff](../docs/RESEARCH_HANDOFF.md) and [exact reproduction commands](../docs/REPRODUCIBILITY.md). No benchmark or demo establishes statistical relevance, investment performance or publication readiness of a dataset.
