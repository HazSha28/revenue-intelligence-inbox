# Revenue Intelligence Inbox

A premium, fully-functional sales intelligence dashboard for reviewing call records, meeting records, transcripts, action items, routing decisions, and processing status from sequential data deliveries — with 10 advanced features including a Revenue Risk Radar, Smart Action Center, Explainable Routing, Follow-up Gap Detector, and a Command Palette.

---

## Quick Start

```bash
cd app
npm install
npm run dev          # development server — open http://localhost:5173
npm run build        # production build → dist/
npm run test         # run all 90 automated tests
```

> **First run:** the app starts empty. Go to **Imports & Replay** and click **Import initial delivery** to load the dataset.
> **Pro tip:** Press **Ctrl+K** (or Cmd+K) anywhere to open the Command Palette for global search.

---

## Feature Overview

### 11 Pages (persistent sidebar navigation, grouped into 4 sections)

#### Overview
| Page | Path | Purpose |
|---|---|---|
| Dashboard | `/` | Live metrics, charts, transcript coverage, connection rate |
| Intelligence Inbox | `/inbox` | Searchable/filterable records table, click-through to detail |
| Manager Brief | `/brief` | Executive daily brief with copy/export, 7 sections |

#### Intelligence
| Page | Path | Purpose |
|---|---|---|
| Risk Radar | `/risk` | Revenue risk dashboard with radar chart, severity filtering, evidence-backed risk cards |
| Action Center | `/actions` | Auto-extracted follow-up actions with status tracking (suggested/in-progress/completed/blocked) |

#### Operations
| Page | Path | Purpose |
|---|---|---|
| Routing & Review | `/routing` | Inline route override and review-state controls with taxonomy legend |
| Imports & Replay | `/imports` | Preset import buttons, file upload, import history log, replay instructions |
| Replay Inspector | `/replay` | Revision timeline with per-record diffs, transcript change detection, M07 scenario |
| Exports | `/exports` | JSON/CSV manifest download, full bundle, manifest preview |

#### Insights
| Page | Path | Purpose |
|---|---|---|
| Data Quality | `/quality` | Quality score gauge (0-100), transcript coverage, pending/stale counts, revision breakdown |
| Data Status | `/status` | Per-record table, revision breakdown, manual overrides |

---

## 10 Premium Features

### 1. Revenue Risk Radar (`/risk`)
- Detects 7 risk categories: unresolved problems, payment issues, integration blockers, unanswered questions, uncertain commitments, pending follow-ups, customer dissatisfaction
- Each risk shows: category, severity (High/Medium/Low), reason, supporting evidence, source record, suggested next action, review status
- Recharts radar chart for risk distribution by category
- Inferred risks are explicitly labelled; no revenue losses or probabilities invented

### 2. Smart Action Center (`/actions`)
- Auto-extracts follow-up actions from conversation text
- Each action: title, evidence, linked record, suggested owner (when supported), priority, status, due date (when explicitly supported)
- Explicitly agreed actions vs. suggested actions are clearly distinguished
- User can start, complete, block, or dismiss actions — changes persist across refreshes via localStorage

### 3. Explainable Smart Routing (on Record Detail)
- Shows suggested route, effective route, manual override status, and analysis freshness
- Lists supporting signals with weight (strong/moderate/weak) and evidence references
- Confidence label with reasoning
- Alternative route suggestion when genuinely applicable
- Full override control with clear separation from system-suggested routes

### 4. Follow-up Gap Detector (on Record Detail)
- Detects 6 gap types: promise to send, unanswered question, needs confirmation, workaround unconfirmed, no explicit next step, escalation pending
- Each gap shows exact supporting evidence and evidence reference
- Uses "Not evidenced in this dataset" wording when follow-up is inferred rather than observed

### 5. Data Change & Replay Inspector (`/replay`)
- Visual timeline of every import with expandable per-record diffs
- Shows changed fields, transcript changes, stale analysis, and preserved manual routes
- M07 late-transcript scenario highlighted with status indicators
- Confirms idempotency of repeated imports

### 6. Manager Brief Generator (`/brief`)
- 7-section executive brief: top issues, product feedback, high-priority follow-ups, integration/payment blockers, meetings needing review, newly available transcripts, suggested next steps
- Every item labelled as source fact, inferred, or action
- Copy to clipboard, download as Markdown, or download as plain text
- All insights link to source records with evidence references

### 7. Evidence-First Search (Command Palette — Ctrl+K)
- Global search across: record refs, source IDs, transcript phrases, participant names, risk categories, action items, review status, routes
- Keyboard-navigable results (arrow keys + Enter)
- Opens the relevant record when selected
- Never merges different records merely because names look similar

### 8. Data Quality Monitor (`/quality`)
- Quality score (0-100) with radial gauge
- Metrics: records with/without transcripts, null vs blank, unknown connection, pending/stale/reviewed, missing evidence, unresolved processing, duplicate imports ignored
- Revision breakdown chart
- Quality notes with specific deductions explained
- Selected-sample disclaimer

### 9. Premium UX
- **Command Palette** (Ctrl+K): global search + page navigation
- **Toast notifications**: success/error feedback for imports, route changes, action updates
- **Confirm dialogs**: for destructive actions (keyboard-accessible)
- **Conversation Timeline**: chronological visualization of topics, concerns, commitments, and gaps per record
- **Responsive layout**: works on desktop and tablet
- **Consistent status badges**: severity, review state, route, action status

### 10. Chat-Style Transcript Viewer (on Record Detail)
- Meeting transcripts rendered as chat bubbles with speaker avatars, color-coded by speaker type
- Keyword search with match count and text highlighting
- Click any bubble to reveal its evidence reference
- Call transcripts with search, copy, and evidence reference
- Speaker legend showing all participants

---

## Core Capabilities (Preserved from Original)

- **Revision-aware import engine** — identity is `(source_type, source_id)`. Never keyed by title, phone, or array position.
- **Idempotent imports** — same or older revision is silently ignored; no duplicates ever created.
- **Full payload replacement** — revision 2 replaces the entire source payload including null fields; no partial merge.
- **Manual route preservation** — manager route overrides survive newer source revisions.
- **Stale analysis detection** — when a transcript changes, the record is flagged `analysis_stale`.
- **localStorage persistence** — all records, revisions, manual overrides, review states, action states, and import logs survive browser refresh.
- **Evidence-grounded analysis** — summaries, topics, issues, and actions derived only from transcript text. Nothing invented.
- **Accurate metrics** — source-reported connection rate uses `is_connected=true / non-null is_connected`. Null tracked separately from false.
- **Export manifest** — relative output paths, no machine-absolute paths, no duplicate active outputs.

---

## Replay Demonstration

Follow these steps on the **Imports & Replay** page:

1. **Import initial delivery** → 44 unique records, 17 usable texts
2. **Re-import initial (reordered)** → all ignored, still 44 records
3. Go to **Routing & Review** and override M07's route
4. **Import update delivery** → M07 updated to revision 2, 18 usable texts, manual route preserved, analysis stale
5. **Re-import initial again** → M07 stays revision 2 (ignored)
6. **Refresh browser** → all state persists

Verify on **Replay Inspector** (`/replay`) that the timeline shows the M07 update with transcript-change and stale-analysis flags.

---

## Automated Tests (90 total)

```
src/test/importEngine.test.ts    (20 tests) — import, idempotency, revision handling
src/test/metrics.test.ts         (14 tests) — counts, connection rate, route assignments
src/test/export.test.ts          (10 tests) — manifest, CSV, output paths
src/test/evidence.test.ts        (9 tests)  — evidence reference formats
src/test/featureEngine.test.ts   (37 tests) — risk engine, action engine, routing
                                              explainer, gap detector, search engine,
                                              data quality, brief generator
```

Run all tests: `npm run test`

---

## Technology Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3
- Recharts 2
- React Router 6
- Vitest 2 + @testing-library/react
- Browser localStorage (no backend, no paid APIs)

---

## Module Map

```
src/
  types/
    source.ts        # Raw OXO envelope types
    app.ts           # AppRecord, RouteKey, ReviewState, AppState
    features.ts      # Risk, Action, Gap, SearchResult, RoutingExplanation, DataQuality
  lib/
    importEngine     # Revision-aware upsert (preserves manual overrides)
    routing          # Suggested route derivation
    analysis         # Deterministic transcript analysis
    evidence         # Evidence reference generation
    metrics          # Dashboard metrics
    storage          # localStorage persistence (+ action states)
    export           # JSON/CSV manifest
    riskEngine       # Rule-based risk detection (7 categories)
    actionEngine     # Action extraction + user state merge
    routingExplainer # Explainable routing with signals + confidence
    gapDetector      # Follow-up gap detection (6 types)
    briefGenerator   # Executive brief with 7 sections + export
    searchEngine     # Global evidence-first search
    dataQuality      # Quality score (0-100) with deductions
  components/
    Sidebar, MetricCard, FilterBar, RecordsTable, TranscriptViewer
    RouteBadge, ReviewBadge, RouteSelector, ImportHistory
    ExplainableRouting, ConversationTimeline   # New premium components
    CommandPalette, Toast, ConfirmDialog      # UX infrastructure
  pages/
    Dashboard, IntelligenceInbox, RecordDetail, ManagerBrief
    RoutingReview, ImportsReplay, Exports, DataStatus
    RiskRadar, ActionCenter, ReplayInspector, DataQualityMonitor  # New pages
```

---

## Known Limitations

- Analysis is deterministic keyword matching, not semantic NLP. Edge cases may misroute records.
- Multi-route assignment is supported; the UI shows primary effective route in tables.
- No ZIP export — the full bundle is a single JSON file with manifest + record outputs.
- The chunk size warning from Vite (recharts + lodash) is cosmetic; production build works correctly.
- No audio/video playback — source data contains only text transcripts.

---

## Assumptions

- `exported_at` is delivery time, not conversation time. Dates use `started_at`/`starts_at` in Asia/Kolkata.
- `null` is distinct from `false`, `0`, and an empty array throughout.
- The 20 B-series records are valid source records with null transcripts; they count toward the 44 unique records.
- Redacted summaries/classification_reasons are assessment redactions, not upstream failures.
