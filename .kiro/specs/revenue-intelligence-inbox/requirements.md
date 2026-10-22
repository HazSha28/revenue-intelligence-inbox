# Requirements — Revenue Intelligence Inbox

## 1. Purpose
Build a polished, functional SaaS-style web application for a sales manager to review call records, meeting records, transcripts, action items, suggested routing, and processing status from sequential data deliveries.

## 2. Data Source
- Two JSON delivery files: `sales/data/01_initial.json` (revision 1, 43 records) and `sales/data/02_update.json` (revision 2, 1 record — M07 update).
- Total unique source records after both deliveries: **44** (not 45).
- Initial usable conversation texts: **17**. After update: **18**.
- Record identity: `(source_type, source_id)` pair only — never by title, phone, company name, or array position.

## 3. Functional Requirements

### FR-1 Import & Revision Engine
- FR-1.1 Import 01_initial.json as revision 1.
- FR-1.2 Import 02_update.json as revision 2; replace M07's full source payload and transcript_payload.
- FR-1.3 Ignore any delivery with the same or older revision for a given (source_type, source_id).
- FR-1.4 A newer revision replaces the entire source payload and transcript_payload including nulls — no partial merge.
- FR-1.5 A newer source revision must not erase a manager's explicit manual route override.
- FR-1.6 When transcript changes, mark analysis stale or refresh it.
- FR-1.7 Persist all state in localStorage across browser refreshes.
- FR-1.8 Make repeated imports idempotent (no duplicate records).
- FR-1.9 Handle malformed files with clear user-facing error messages.
- FR-1.10 Display import history log: records applied, ignored, and updated.

### FR-2 Dashboard
- FR-2.1 Show live metrics calculated from currently applied source records.
- FR-2.2 Metrics: total unique records, call count, meeting count, records with usable transcript, calls connected (is_connected=true), calls with null is_connected (unknown), pending review, records by route, records by processing/transcript status.
- FR-2.3 Use accurate denominators for percentages; label dataset as selected sample.
- FR-2.4 Distinguish source-reported status from transcript-based conclusions.
- FR-2.5 Do not count repeated imports as new records.

### FR-3 Intelligence Inbox
- FR-3.1 Searchable, filterable records table.
- FR-3.2 Columns: record_ref, source_type, title/caller info, conversation date (Asia/Kolkata), transcript availability, suggested route, effective route, processing status, review status, applied revision.
- FR-3.3 Filters: source_type, route, transcript availability, review state.
- FR-3.4 Selecting a record opens detail view.

### FR-4 Record Detail & Transcript Viewer
- FR-4.1 Display source metadata and actual conversation text.
- FR-4.2 Calls: transcript from payload.transcript.
- FR-4.3 Meetings: turns from transcript_payload.turns with speaker and timecode.
- FR-4.4 Evidence references: meetings use source_id + 1-based turn number; calls use exact short quote + record_ref/source_id.
- FR-4.5 Show summary, key topics, issues, risks, follow-up actions, suggested route, review state, analysis freshness.
- FR-4.6 Show "Pending review" or "Analysis stale" when analysis is missing or outdated.
- FR-4.7 Do not invent evidence, speaker timecodes, or talk ratios.

### FR-5 Routing & Review
- FR-5.1 Route taxonomy based on supplied data content.
- FR-5.2 Suggested route (system-derived) and effective route (may be manual override).
- FR-5.3 Manager can manually override route; override persists across imports and refreshes.
- FR-5.4 Display manual override clearly.
- FR-5.5 Support multi-route assignment without inflating unique record count.
- FR-5.6 Review states: pending_review, reviewed, analysis_stale.

### FR-6 Manager Brief
- FR-6.1 Daily summary generated from current dataset.
- FR-6.2 Important themes, unresolved issues, follow-up actions, records needing attention.
- FR-6.3 Evidence references traceable to source records.
- FR-6.4 Distinguish confirmed facts from inferred suggestions.

### FR-7 Imports & Replay
- FR-7.1 Buttons: Import initial delivery, Re-import initial delivery, Import update delivery, Reset to initial state.
- FR-7.2 Activity log showing applied/ignored/updated per import.
- FR-7.3 Support the full replay sequence demonstrating correct revision handling.

### FR-8 Exports
- FR-8.1 JSON and CSV export formats.
- FR-8.2 Manifest fields: source_type, source_id, applied_revision, suggested_route, effective_route, output_paths, processing_state, review_state, manual_override_flag, analysis_freshness.
- FR-8.3 Output paths are relative, not absolute machine paths.
- FR-8.4 Every listed active output must exist.
- FR-8.5 Repeated exports must not create unexplained duplicate active outputs.
- FR-8.6 Export reflects current state, not a hard-coded snapshot.

## 4. Non-Functional Requirements
- NF-1 No backend or database; runs entirely in browser with localStorage.
- NF-2 No paid APIs or external network dependencies for core workflows.
- NF-3 React + TypeScript + Vite + Tailwind CSS + Recharts.
- NF-4 Vitest unit tests for import rules, metrics, exports.
- NF-5 Responsive, accessible, professional SaaS light theme.
- NF-6 Modular code: separate types, storage, import engine, routing, metrics, export generation.

## 5. Replay Acceptance Criteria
1. Import 01_initial.json → 44 unique records, 17 usable texts.
2. Re-import 01_initial.json (same or reordered) → still 44 records, no change.
3. Manually set M07 route override.
4. Import 02_update.json → M07 updated to revision 2, usable texts = 18.
5. Import 01_initial.json again → M07 stays revision 2, manual route preserved.
6. Browser refresh → all state persists.
7. M07 analysis shown as stale/pending review.

## 6. Route Taxonomy
Based on conversation content:
- `sales_new` — New prospect/cold outreach sales call
- `sales_followup` — Follow-up with known prospect
- `partnership` — Partner onboarding / referral programme
- `customer_support` — Existing customer issue resolution
- `product_issue` — Reported product bug or UX problem
- `integration` — API / webhook / integration discussion
- `payments_billing` — Payment, billing, invoicing discussion
- `compliance_kyc` — KYC/KYB or compliance discussion
- `internal` — Internal team training or operations
- `no_contact` — Voicemail/no answer/unresponsive
- `unclassified` — Insufficient context to classify
