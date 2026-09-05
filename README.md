# Groww Delta

> A living watchlist that remembers **why you are watching**, **what you already know**, and **what changed that actually matters**.

**Live Demo:** https://groww-delta-dusky.vercel.app/

---

## Overview

Traditional watchlists are good at remembering **which securities a user follows**.

They are much less effective at remembering:

- **why** the user added a stock,
- **what** the user has already seen,
- **which conditions** the user is waiting for,
- and whether a new market event is actually relevant to that reason.

As the number of followed instruments grows, users are forced to repeatedly scan prices, news, earnings, alerts, and market movements just to answer a simple question:

> **Did anything happen that I actually care about?**

**Groww Delta** explores a different model.

Instead of treating a watchlist as a static collection of tickers, Delta treats it as a collection of **unresolved investment questions**.

A user may be watching:

- HDFC Bank near ₹1,550
- Tata Motors for a breakout near ₹1,000
- TCS for Q2 margin developments
- IndiGo because of fuel-cost conditions
- Reliance simply because a sufficiently unusual move would be worth knowing

Delta remembers these reasons, maintains a cursor over what the user has already seen, evaluates new information against those reasons, suppresses repetition, and surfaces only changes that deserve attention.

---

## Core Idea

```text
Traditional Watchlist

Ticker
  ↓
Price / News / Alert
  ↓
User decides whether it matters


Groww Delta

Ticker
  +
Watch Reason
  +
Knowledge Cursor
  +
Confirmed Driver Graph
  +
New Market Information
  ↓
Deterministic Attention Engine
  ↓
Relevant / Significant / Quiet
```

The key distinction is:

> **Market movement is not the same as user relevance.**

Delta models that distinction explicitly.

---

# Product Principles

### 1. Catch me up, don't make me scan

The user should not need to inspect every stock repeatedly.

Delta summarises only what changed **since the user's last known state**.

### 2. No alert without an explanation

Every surfaced item should answer:

- What changed?
- Why did Delta surface it?
- How does it relate to what I am watching?

### 3. No repeated information

Once a user acknowledges an update, the same information should not continue appearing as new.

### 4. Relevance is personal

A move can be unimportant for one user and highly relevant for another depending on the reason they are watching the instrument.

### 5. Quiet is a valid state

The goal is not to maximise notifications.

Sometimes the correct output is:

> **You're caught up. Nothing meaningful changed.**

### 6. Context should remain explainable

Contextual relationships are based on explicit, user-confirmed driver relationships rather than opaque inference.

---

# Demo

Groww Delta contains a deterministic replay environment so the full system can be evaluated without depending on live financial APIs.

The demo uses simulated market data for five instruments:

| Instrument | Example Watch Reason |
|---|---|
| TCS | Q2 margins |
| HDFCBANK | Price near ₹1,550 |
| TATAMOTORS | Breakout near ₹1,000 |
| INDIGO | Fuel-cost conditions ahead of results |
| RELIANCE | No matching reason; only unusual moves should surface |

All simulated information is explicitly marked:

> **SIMULATED · DEMO DATA**

---

## Deterministic Replay

The replay advances the simulated market in fixed 30-minute steps.

### Step 0 — Baseline

The user begins completely caught up.

```text
Relevant:     0
Significant:  0
Quiet:        5
```

No information needs attention.

---

### Step 1 — Normal Market Movement

Prices move normally.

The system detects those movements, but none crosses the user's attention threshold.

Expected result:

```text
You're caught up.

Prices moved, but nothing crossed your attention threshold.
```

This demonstrates an important property of Delta:

> **A price change alone is not sufficient reason to interrupt the user.**

---

### Step 2 — Meaningful Changes

Several watch conditions are triggered.

Expected result:

```text
Relevant:     4
Significant:  1
```

Examples:

#### TCS

```text
Quarterly results were published
Matches your Q2 margins watch.
```

#### Tata Motors

```text
Your breakout condition changed
Matches your breakout near ₹1,000 watch.
Volume is 2.2× expected.
```

#### HDFC Bank

```text
Entered your ₹1,550 watch range.
```

#### IndiGo

```text
A fuel-cost driver you chose to watch changed.
```

#### Reliance

```text
Unusually large move

No watch reason matched, but the move crossed
the significance threshold.
```

This gives Delta two independent ways of earning the user's attention:

```text
Relevant
    → important because of the user's watch reason

Significant
    → important because the market movement itself is unusual
```

---

### Step 3 — Novelty Test

The user selects:

> **Mark all caught up**

Delta advances the user's Knowledge Cursor.

Previously surfaced information should no longer appear as new.

The market can continue moving, but acknowledged events remain suppressed.

Expected result:

```text
You're caught up.

Prices moved, but nothing crossed your attention threshold.
```

This demonstrates that Delta is not simply recalculating alerts from the current price snapshot.

It remembers **what the user already knows**.

---

### Step 4 — Contextual Relevance

This step demonstrates the Driver Graph.

A material change occurs in crude oil.

IndiGo itself barely moves.

A traditional price-alert system may therefore remain silent.

Delta instead evaluates the user's confirmed relationship:

```text
IndiGo
   ↓
Fuel cost
   ↓
Crude
```

and surfaces:

```text
INDIGO

Related to a driver you're tracking

Crude moved materially.

Why this is connected:
IndiGo → Fuel cost → Crude

InterGlobe Aviation itself: approximately +0.10%
```

The important point is that the stock did **not** need to make a large move.

The information became relevant because something connected to the user's original investment question changed.

---

# System Architecture

Groww Delta is implemented as a **layered monolith**.

This keeps the deployment surface small while maintaining clear separation between presentation, application, domain, and persistence responsibilities.

```mermaid
flowchart TB

    U[User]

    subgraph UI["Presentation Layer"]
        CU[Catch Up]
        WL[Watchlist]
        SD[Stock Detail]
        DEMO[Demo Controls]
    end

    subgraph APP["Application Layer"]
        CS[Catch-Up Service]
        WS[Watchlist Service]
        AS[Acknowledgement Service]
        DS[Demo Replay Service]
        LS[Lifecycle Service]
    end

    subgraph DOMAIN["Domain Layer"]
        AE[Attention Engine]
        IM[Intent Matching]
        KC[Knowledge Cursor]
        DG[Driver Graph Traversal]
        LC[Watch Lifecycle]
        SIG[Significance Analysis]
    end

    subgraph DATA["Infrastructure / Data"]
        RP[Replay Market Provider]
        PRISMA[Prisma]
        PG[(PostgreSQL / Neon)]
    end

    U --> UI

    CU --> CS
    WL --> WS
    SD --> WS
    DEMO --> DS

    CS --> AE
    CS --> KC
    AS --> KC
    WS --> IM
    LS --> LC

    AE --> IM
    AE --> SIG
    AE --> DG
    AE --> KC
    AE --> RP

    CS --> PRISMA
    WS --> PRISMA
    AS --> PRISMA
    LS --> PRISMA
    DS --> PRISMA

    PRISMA --> PG
```

---

# Request Flow

A typical Catch Up request moves through the system as follows.

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Catch Up UI
    participant API as Application Service
    participant DB as PostgreSQL
    participant M as Market Provider
    participant E as Attention Engine

    U->>UI: Open Catch Up
    UI->>API: Request current attention state

    API->>DB: Load watch intents
    API->>DB: Load knowledge cursors
    API->>DB: Load driver graph
    API->>M: Load replay market state

    API->>E: Analyse instruments

    E->>E: Calculate significance
    E->>E: Match direct intent
    E->>E: Evaluate novelty
    E->>E: Traverse confirmed drivers
    E->>E: Calculate attention score

    E-->>API: Relevant / Significant / Quiet

    API-->>UI: Explainable attention items
    UI-->>U: Catch Up view
```

---

# Core Domain Model

Delta is built around a small number of explicit domain concepts.

## Watch Intent

A Watch Intent represents **why the user is monitoring an instrument**.

Examples:

```text
HDFCBANK
"Watching near ₹1,550"

TATAMOTORS
"Watching for a breakout near ₹1,000"

TCS
"Watching Q2 margins"

INDIGO
"Watching fuel-cost conditions ahead of results"
```

Watch intents are versioned rather than silently overwritten.

This gives Delta a history of how the user's reason for monitoring an instrument evolved.

---

## Knowledge Cursor

The Knowledge Cursor represents the latest market state that a user has acknowledged.

Conceptually:

```text
Market state

t0 ----- t1 ----- t2 ----- t3 ----- t4
                    ↑
              Knowledge Cursor
```

Only information after that cursor is eligible to be considered **new**.

When the user marks an item as seen or selects **Mark all caught up**, the cursor advances monotonically.

This prevents previously acknowledged information from repeatedly resurfacing.

---

## Driver Graph

Some investment questions cannot be represented by a direct condition on the stock itself.

For example:

```text
IndiGo
  ↓
Fuel cost
  ↓
Crude
```

Delta stores these contextual relationships as a versioned, user-confirmed graph.

```mermaid
graph LR
    I[IndiGo]
    F[Fuel Cost]
    C[Crude Oil]

    I -->|driver| F
    F -->|driver| C
```

Graph traversal is deliberately bounded.

Current safeguards include:

```text
Maximum traversal depth: 3
Maximum visited nodes:    25
Minimum contextual relevance threshold: 50
```

Edge strength decreases across traversal depth rather than allowing an arbitrarily distant event to receive the same relevance as a direct relationship.

Direct intent matches remain stronger than contextual matches.

---

# Attention Engine

The Attention Engine is deterministic.

No large language model is required to decide whether an event deserves attention.

A candidate event is evaluated using:

```text
Attention =
    0.30 × Significance
  + 0.35 × Relevance
  + 0.15 × Novelty
  + 0.10 × Urgency
  + 0.10 × Confidence
```

Where:

### Significance

How unusual the market movement is relative to expected behaviour.

### Relevance

How strongly the change matches the user's saved Watch Intent.

Direct matches receive the highest relevance.

Contextual relevance can also be produced through the confirmed Driver Graph.

### Novelty

Whether this information is genuinely new relative to the user's Knowledge Cursor.

### Urgency

Whether the event has time-sensitive importance.

### Confidence

Confidence in the underlying event or market information.

The result is mapped into one of three attention lanes.

```mermaid
flowchart LR

    EVENT[New information]

    EVENT --> ENGINE[Attention Engine]

    ENGINE --> R[RELEVANT]
    ENGINE --> S[SIGNIFICANT]
    ENGINE --> Q[QUIET]

    R --> R1[Matches why the user is watching]
    S --> S1[Important even without a matching reason]
    Q --> Q1[Does not deserve attention]
```

---

# Direct Relevance vs Contextual Relevance

Delta deliberately separates the two.

### Direct relevance

```text
User:
"Tell me when HDFC Bank approaches ₹1,550"

Market:
HDFC Bank enters the watch range

Result:
Direct relevance = high
```

### Contextual relevance

```text
User:
"I'm watching IndiGo because of fuel costs"

Market:
Crude moves materially

IndiGo:
Barely moves

Graph:
IndiGo → Fuel cost → Crude

Result:
Contextually relevant
```

This lets Delta surface information that matters to the **investment thesis**, not merely the ticker.

---

# Living Watch Lifecycle

Watch reasons should not remain active forever without review.

When the condition underlying a Watch Intent has been fulfilled and acknowledged, Delta can surface a low-priority lifecycle prompt.

For example:

```text
Watching near ₹1,550

Your saved price condition was reached
and you have seen the update.

[Change reason] [Resolve] [Keep watching]
```

For recurring events:

```text
Watching Q2 margins

[Watch next results]
[Change reason]
[Resolve]
[Keep watching]
```

This turns the watchlist into a living system rather than an ever-growing collection of forgotten alerts.

---

# End-to-End User Flow

```mermaid
flowchart TD

    A[Add / Follow Instrument]

    A --> B[Define why you are watching]

    B --> C[Create Watch Intent]

    C --> D[Optional: Confirm relevant drivers]

    D --> E[Delta evaluates new market state]

    E --> F{Anything deserves attention?}

    F -->|No| G[You're caught up]

    F -->|Direct intent match| H[Relevant]

    F -->|Unusual market movement| I[Significant]

    F -->|Confirmed contextual driver| J[Contextually Relevant]

    H --> K[Explain why it surfaced]
    I --> K
    J --> K

    K --> L[User reviews update]

    L --> M[Mark seen / Mark all caught up]

    M --> N[Advance Knowledge Cursor]

    N --> O{Watch condition fulfilled?}

    O -->|No| E

    O -->|Yes| P[Review watch reason]

    P --> Q[Resolve]
    P --> R[Change reason]
    P --> S[Keep watching]
    P --> T[Watch next event]

    Q --> END[Closed]
    R --> E
    S --> E
    T --> E
```

---

# Data Flow

```text
Replay Market Data
        │
        ▼
Market Provider
        │
        ▼
Event / Price State
        │
        ├───────────────┐
        ▼               ▼
Significance        Intent Matching
Analysis                │
        │               │
        └───────┬───────┘
                ▼
          Driver Graph
             Matching
                │
                ▼
         Knowledge Cursor
          / Novelty Check
                │
                ▼
         Attention Engine
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
    Relevant Significant Quiet
        │       │
        └───┬───┘
            ▼
        Catch Up UI
```

---

# Architecture Decisions

## Deterministic attention decisions

The ranking and classification layer is intentionally deterministic.

This provides:

- reproducibility
- inspectability
- stable testing
- clear failure analysis
- predictable user behaviour

---

## Server-side source of truth

Application state is persisted in PostgreSQL.

The browser is not treated as the authoritative source of product state.

This means acknowledgement, Watch Intents, lifecycle state, and replay position survive browser refreshes.

---

## No direct client database access

The UI communicates with application/API routes.

Database access remains server-side through Prisma.

```text
Browser
   ↓
Next.js Route / Application Service
   ↓
Domain Logic
   ↓
Prisma
   ↓
PostgreSQL
```

---

## Layered monolith over premature microservices

Groww Delta currently runs as one deployable application.

The system still maintains domain boundaries so components can be separated later if operational scale requires it.

For the current product stage this provides:

- simpler deployments
- fewer network boundaries
- easier debugging
- transactional consistency
- lower operational complexity

---

# Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Validation | Zod |
| Forms | React Hook Form |
| Database | PostgreSQL |
| Database Platform | Neon |
| ORM | Prisma 7 |
| PostgreSQL Adapter | `@prisma/adapter-pg` |
| Unit / Integration Tests | Vitest |
| Browser Tests | Playwright |
| Deployment | Vercel |
| Package Manager | pnpm |

---

# Project Structure

The repository follows domain-oriented boundaries rather than placing business logic directly inside UI components.

```text
groww-delta/
│
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── demo/
│   │   ├── watchlist/
│   │   └── ...
│   │
│   ├── domain/
│   │   ├── attention/
│   │   ├── graph/
│   │   ├── intent/
│   │   └── ...
│   │
│   ├── services/
│   │   └── ...
│   │
│   ├── generated/
│   │   └── prisma/
│   │
│   └── ...
│
├── tests/
│   └── ...
│
├── docs/
│   ├── BUILD1.md
│   ├── BUILD2.md
│   └── BUILD3.md
│
├── package.json
├── prisma.config.ts
└── README.md
```

---

# Local Development

## Prerequisites

- Node.js
- pnpm
- PostgreSQL

The project declares:

```text
pnpm@11.25.0
```

---

## 1. Clone the repository

```bash
git clone <repository-url>
cd g1
```

---

## 2. Install dependencies

```bash
pnpm install
```

---

## 3. Configure PostgreSQL

Create a PostgreSQL database and expose its connection string through:

```text
DATABASE_URL
```

Example `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Never commit real credentials to the repository.

---

## 4. Generate Prisma Client

```bash
pnpm db:generate
```

---

## 5. Apply database migrations

For production-style deployment:

```bash
pnpm db:migrate:deploy
```

For local schema development:

```bash
pnpm db:migrate
```

---

## 6. Seed deterministic demo data

```bash
pnpm db:seed
```

The seed creates the deterministic replay scenario used throughout the product demo.

---

## 7. Start the application

```bash
pnpm dev
```

Then open:

```text
http://localhost:3000
```

---

# Available Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Create production build |
| `pnpm start` | Run production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript validation |
| `pnpm test` | Run Vitest suite |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm db:generate` | Generate Prisma Client |
| `pnpm db:migrate` | Run development migrations |
| `pnpm db:migrate:deploy` | Apply existing migrations |
| `pnpm db:seed` | Seed deterministic demo data |

---

# Testing Strategy

The system is tested at multiple levels.

```mermaid
flowchart TD

    A[Domain Unit Tests]
    B[Service / Integration Tests]
    C[Database Behaviour Tests]
    D[Browser / Playwright Tests]
    E[Production Build]

    A --> B
    B --> C
    C --> D
    D --> E
```

Build 3 includes coverage for:

- deterministic attention scoring
- direct intent matching
- significance classification
- Knowledge Cursor behaviour
- acknowledgement semantics
- novelty suppression
- driver-graph traversal
- graph traversal bounds
- graph versioning
- intent lifecycle
- replay state progression
- stale relationship protection
- event-subject authority
- API/service integration
- critical end-to-end user flows

The Build 3 development gate completed with:

```text
100 unit / service / integration tests
7 Playwright end-to-end tests
TypeScript validation
Lint validation
Production build validation
Database migration validation
```

---

# Production Deployment

The current production architecture is intentionally small.

```mermaid
flowchart LR

    B[Browser]
    V[Vercel<br/>Next.js Application]
    N[(Neon<br/>PostgreSQL)]

    B -->|HTTPS| V
    V -->|DATABASE_URL| N
```

### Application

Hosted on **Vercel**.

The same Next.js application serves the interface and server-side Route Handlers.

### Database

Hosted on **Neon PostgreSQL**.

Schema management is handled through Prisma migrations.

---

# Production Environment Variables

Required:

```text
DATABASE_URL
```

The value must be a valid PostgreSQL connection string.

Deployment credentials must be stored through the hosting provider's secret-management mechanism and must never be committed to source control.

---

# Resilience and Safety Boundaries

The prototype deliberately places several boundaries around the system.

### No trading execution

Delta does not place orders or execute trades.

### No investment recommendation engine

The product identifies information relevant to a user's existing watch reason.

It does not tell the user whether to buy or sell a security.

### Explicit simulated-data disclosure

The current demo uses deterministic simulated data.

The UI clearly labels this information.

### Bounded graph traversal

Contextual relationships cannot recursively propagate without limits.

### Deterministic decision path

The reason an item appears can be inspected and reproduced.

### User-confirmed contextual relationships

The Driver Graph represents relationships the user has deliberately chosen to monitor rather than unconstrained inferred correlations.

---

# Why This Architecture?

There is an important distinction between an **information system** and an **attention system**.

Most market products optimise for access to more information:

```text
More prices
More news
More alerts
More dashboards
```

Delta explores the opposite question:

> **Given everything that changed, what deserves the user's attention now?**

That requires state beyond the current market snapshot.

The system needs to understand:

```text
What am I watching?
Why am I watching it?
What did I already know?
What changed since then?
Does that change match my reason?
Is it unusually significant anyway?
Is it connected to a driver I explicitly care about?
```

The architecture therefore treats **attention state** as a first-class domain concept rather than a presentation-layer filter.

---

# Example: Why Delta Is Different

Consider a user who follows IndiGo because fuel costs may affect upcoming results.

A normal watchlist knows:

```text
INDIGO
₹5,186
+0.10%
```

Delta additionally knows:

```text
Watch Intent:
Fuel-cost conditions ahead of results

Confirmed Driver Graph:
IndiGo → Fuel cost → Crude

Knowledge Cursor:
User was last caught up at 11:00 AM

New Information:
Crude moved materially
```

The resulting Catch Up item becomes:

```text
INDIGO

Related to a driver you're tracking

Crude moved materially.

Why this is connected:
IndiGo → Fuel cost → Crude

InterGlobe Aviation itself: +0.10% since you last checked
```

The information is surfaced not because IndiGo moved substantially, but because something relevant to the user's **reason for watching IndiGo** changed.

That is the central idea behind Groww Delta.

---

# Current Scope

Groww Delta V3 focuses on proving the underlying interaction and attention model.

Implemented:

- Living watchlist
- Watch Intents
- Versioned intent history
- Knowledge Cursors
- Deterministic Catch Up
- Direct intent matching
- Market significance detection
- Novelty suppression
- Per-item acknowledgement
- Mark-all acknowledgement
- User-confirmed Driver Graph
- Bounded contextual traversal
- Explainable relationship paths
- Watch lifecycle review
- Intent resolution
- Intent renewal
- Keep-watching workflow
- Deterministic replay environment
- Persistent server-side state
- Responsive product UI
- Debuggable attention-engine output

The demo deliberately does **not** depend on live financial APIs so evaluation remains reproducible.

---

# Quick Demo Guide

For evaluators who want to see the core product behaviour quickly:

1. Open the **Demo** tab.
2. Select **Reset scenario**.
3. At **Step 0**, observe that all five stocks are quiet.
4. Advance to **Step 1** and open **Catch Up**.
5. Observe that ordinary price movement is suppressed.
6. Advance to **Step 2**.
7. Observe:
   - 4 changes matching saved watch reasons
   - 1 significant Reliance move without a matched reason
8. Select **Mark all caught up**.
9. Advance to **Step 3**.
10. Confirm that previously acknowledged information does not repeat.
11. Advance to **Step 4**.
12. Observe IndiGo being surfaced through:

```text
IndiGo → Fuel cost → Crude
```

even though IndiGo itself moved only marginally.

This demonstrates the three central properties of Delta:

```text
Intent
+
Memory
+
Context
```

---

# Future Work

The architecture is designed to support several natural extensions:

- live market-data providers
- exchange and corporate-action feeds
- broader event provenance
- data freshness and provider-health modelling
- correction handling
- portfolio-aware context
- richer watch conditions
- user-specific alert policies
- benchmarking attention reduction against traditional alerts
- large-scale evaluation of intent-conditioned financial event ranking

These are deliberately kept outside the current V3 demo so the system remains understandable and deterministic.

---

# Research Direction

Groww Delta also motivates a broader research question:

> **Can financial information ranking improve when a system models not only what changed, but also why a user is monitoring an asset and what information they have already consumed?**

A general formulation is:

```text
A(e, u, t) =
    f(
        S(e),
        N(e, u),
        R(e, Iu),
        Q(e),
        C(t)
    )
```

where:

```text
S  = market significance
N  = novelty relative to user knowledge
R  = relevance to user intent
Q  = information quality / confidence
C  = market context
Iu = user's monitoring intent
```

This provides a path from the current product prototype toward empirical evaluation of **intent-conditioned attention ranking**.

---

# Engineering Philosophy

Groww Delta intentionally favours:

```text
Explicit state        over hidden behaviour
Determinism           over opaque ranking
Explainability        over unexplained alerts
Domain boundaries     over UI-bound business logic
User acknowledgement  over repeated notification
Simple deployment     over premature distribution
Reproducibility       over fragile live-demo dependencies
```

The objective is not to build the largest market-data system.

It is to build the smallest system capable of answering a harder question:

> **What changed that this particular user should actually care about?**

---

# Disclaimer

Groww Delta is a prototype built using simulated market information for demonstration purposes.

It does not provide investment advice, trading recommendations, financial research, or order execution.

All securities, prices, events, and replay scenarios shown in the demo should be interpreted only as product-development test data.
