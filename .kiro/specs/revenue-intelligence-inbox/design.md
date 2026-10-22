# Design — Revenue Intelligence Inbox

## 1. Architecture

### Technology Stack
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Testing**: Vitest + @testing-library/react
- **Persistence**: Browser localStorage (no backend)
- **Routing**: React Router v6 (client-side only)

### Module Map
```
src/
  types/           # TypeScript interfaces for source data and app state
  data/            # Embedded JSON files (imported at build time)
  lib/
    importEngine   # Revision-aware upsert logic
    storage        # localStorage read/write with versioning
    routing        # Suggested route derivation
    metrics        # Aggregated statistics
    evidence       # Evidence reference generation
    analysis       # Analysis freshness and content
    export         # JSON/CSV manifest and file generation
  components/      # Reusable UI components
  pages/           # Route-level page components
  App.tsx          # Router + layout shell
  main.tsx         # Entry point
```

## 2. Data Model

### Envelope (raw JSON)
```typescript
interface DeliveryEnvelope {
  batch_id: string;
  revision: number;
  exported_at: string;
  records: EnvelopeRecord[];
}
interface EnvelopeRecord {
  record_ref: string;
  source_type: 'call' | 'meeting';
  source_id: string;
  payload: CallPayload | MeetingPayload;
  transcript_payload: TranscriptPayload | null;
}
```

### Stored App Record
```typescript
interface AppRecord {
  // Identity
  source_type: 'call' | 'meeting';
  source_id: string;
  record_ref: string;          // convenience, from latest delivery
  applied_revision: number;

  // Source data (never mutated after import except full replacement)
  payload: CallPayload | MeetingPayload;
  transcript_payload: TranscriptPayload | null;

  // Derived (stored separately, never overwritten by import)
  suggested_route: RouteKey;
  analysis: RecordAnalysis;

  // Manager-controlled (never overwritten by import)
  effective_route: RouteKey;
  manual_override: boolean;
  review_state: 'pending_review' | 'reviewed' | 'analysis_stale';
  manager_notes: string;

  // Timestamps
  first_imported_at: string;
  last_updated_at: string;
}
```

### Analysis
```typescript
interface RecordAnalysis {
  summary: string | null;
  key_topics: string[];
  issues: string[];
  risks: string[];
  follow_up_actions: string[];
  analysis_revision: number;   // revision this analysis was generated for
  is_stale: boolean;
}
```

## 3. Import Engine Logic
```
function importDelivery(envelope):
  for each record in envelope.records:
    key = (record.source_type, record.source_id)
    existing = store.get(key)
    if existing and existing.applied_revision >= envelope.revision:
      log IGNORED
      continue
    if existing:
      newRecord = fullReplace(existing, record, envelope.revision)
      if transcriptChanged(existing, record):
        newRecord.review_state = 'analysis_stale'
        newRecord.analysis.is_stale = true
      newRecord.effective_route = existing.effective_route  // preserve manual
      newRecord.manual_override = existing.manual_override
      newRecord.manager_notes = existing.manager_notes
      log UPDATED
    else:
      newRecord = createNew(record, envelope.revision)
      log APPLIED
    store.set(key, newRecord)
```

## 4. Route Taxonomy
Routes are derived from transcript content and source metadata:

| Key | Label | Signal |
|-----|-------|--------|
| `sales_new` | New Sales Outreach | cold call, first_dial_ever=true, no prior conversation |
| `sales_followup` | Sales Follow-up | prior_dials_ever > 0, outcome=follow_up, known prospect |
| `partnership` | Partnership / Referral | partner commission, referral link, advisory firm |
| `customer_support` | Customer Support | existing customer, account setup, login issues |
| `product_issue` | Product Issue | bug report, broken feature, workaround described |
| `integration` | Integration / API | API access, webhook, ERP integration discussion |
| `payments_billing` | Payments & Billing | billing cycle, invoice, payment failure, freeze |
| `compliance_kyc` | Compliance / KYC | KYC, KYB, incorporation documents, identity checks |
| `internal` | Internal / Training | internal team session, training walkthrough |
| `no_contact` | No Contact | voicemail, unresponsive, null transcript |
| `unclassified` | Unclassified | insufficient data |

## 5. Metrics Definitions
- **Unique records**: count distinct (source_type, source_id) after revisions
- **Usable call text**: payload.transcript is non-null and non-empty
- **Usable meeting text**: transcript_payload.turns has ≥ 1 non-empty turn
- **Transcript coverage**: usable texts / total records (stated separately by type)
- **Source-reported connection rate**: calls with is_connected=true / calls with non-null is_connected
- **Unknown connection**: calls with is_connected=null
- **Route counts**: may exceed unique records if multi-route; difference is noted

## 6. UI Pages & Navigation

### Persistent Sidebar
1. Dashboard (`/`)
2. Intelligence Inbox (`/inbox`)
3. Manager Brief (`/brief`)
4. Routing & Review (`/routing`)
5. Imports & Replay (`/imports`)
6. Exports (`/exports`)
7. Data Status (`/status`)

### Dashboard
- MetricCard grid (8 cards): Total Records, Calls, Meetings, Usable Transcripts, Connected Calls, Unknown Connection, Pending Review, Reviewed
- BarChart: Records by route (Recharts)
- PieChart: Source types
- Table: Processing status breakdown

### Intelligence Inbox
- FilterBar: source_type, route, transcript_avail, review_state, search text
- RecordsTable: sortable columns
- Clicking row → navigate to `/inbox/:sourceType/:sourceId`

### Record Detail
- Metadata panel (left)
- TranscriptViewer (right or below): turns with speaker/timecode, evidence references
- Analysis panel: summary, topics, issues, actions, freshness badge
- RouteSelector: current route, override button
- ReviewBadge: state with change controls

### Manager Brief
- Auto-generated from current records
- Sections: Key Themes, Unresolved Issues, Follow-up Actions, Records Needing Attention
- Each item links to source record with evidence reference

### Routing & Review
- Table of all records with route columns
- Inline route override
- Bulk review state update
- Route taxonomy legend

### Imports & Replay
- 4 action buttons with progress feedback
- ImportHistory list: timestamp, batch_id, revision, records applied/ignored/updated
- Replay instructions panel

### Exports
- Export current state as JSON manifest
- Export as CSV manifest
- Download individual record outputs
- ExportPanel showing manifest preview

## 7. Evidence Reference Format
- Meeting: `[M01, turn 3]` → M01 source_id + turn index (1-based)
- Call: `[C01: "exact short quote"]` → record_ref + quoted text fragment
- Do not invent speaker timecodes or talk ratios

## 8. Persistence Strategy
- Key: `revenue_intelligence_inbox_v1`
- Value: JSON object `{ records: AppRecord[], import_log: ImportLogEntry[] }`
- Written after every import and every manual change
- Read on application start

## 9. Export Format

### Manifest JSON
```json
{
  "generated_at": "ISO timestamp",
  "total_records": 44,
  "records": [{
    "source_type": "call",
    "source_id": "...",
    "record_ref": "C01",
    "applied_revision": 1,
    "suggested_route": "sales_new",
    "effective_route": "sales_new",
    "manual_override": false,
    "output_paths": ["outputs/calls/C01.json"],
    "processing_state": "stored",
    "review_state": "pending_review",
    "analysis_freshness": "current"
  }]
}
```

### CSV Columns
source_type, source_id, record_ref, applied_revision, suggested_route, effective_route, manual_override, output_path, processing_state, review_state, analysis_freshness
