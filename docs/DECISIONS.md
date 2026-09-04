# Build 1 decisions

## ADR-001: No live market API

**Decision:** Build 1 uses only `ReplayMarketProvider` behind `MarketDataProvider`.

**Reason:** Product and test behavior must be transparent, reproducible, and independent of external credentials, outages, rate limits, or licensing. Every replay value is labeled as simulated.

## ADR-002: Deterministic replay

**Decision:** Scenario snapshots, volumes, times, and event IDs are fixed fixtures; the current position is persisted.

**Reason:** The same action must produce the same result for demos and automated tests, and browser refresh must not reset state.

## ADR-003: Money in paise

**Decision:** Monetary database/domain fields are integer paise.

**Reason:** Binary floating-point is unsafe for durable monetary identity and comparison. Decimal formatting happens only at presentation boundaries.

## ADR-004: Versioned Watch Intent

**Decision:** Edits supersede and append instead of overwriting.

**Reason:** User context remains auditable and later attention items can be reproduced against the exact intent version that existed at the time.

## ADR-005: Immutable market events

**Decision:** Events are append-oriented and corrections point to an earlier event.

**Reason:** Historical facts remain explainable; corrected data does not silently rewrite the evidence used by later calculations.

## ADR-006: No authentication

**Decision:** All requests use the correctly modeled, seeded `demo-user`.

**Reason:** Authentication is outside Build 1. Keeping user ownership in the schema avoids coupling current domain behavior to that temporary omission.

## ADR-007: Modular monolith, no microservices

**Decision:** Use a single full-stack repository and process.

**Reason:** Build 1 has no independent scaling or deployment need that justifies operational complexity. Internal interfaces provide sufficient extensibility.

## ADR-008: Business logic outside UI and routes

**Decision:** React renders DTOs, routes adapt HTTP, services enforce use cases, repositories own persistence, and providers own market-source behavior.

**Reason:** Boundaries make rules independently testable and allow later UI, persistence, or market-provider changes without duplicating domain logic.
