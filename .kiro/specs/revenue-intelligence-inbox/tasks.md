# Tasks — Revenue Intelligence Inbox

## Phase 1: Project Foundation
- [x] T-01 Read all assignment files (START_HERE.md, DATA_CONTRACT.md, DATA_DICTIONARY.md, CONVERSATIONS.md, 01_initial.json, 02_update.json)
- [ ] T-02 Scaffold Vite + React + TypeScript project at workspace root
- [ ] T-03 Install dependencies: tailwindcss, recharts, react-router-dom, vitest, @testing-library/react
- [ ] T-04 Configure Tailwind CSS
- [ ] T-05 Create directory structure: src/types, src/lib, src/components, src/pages, src/data

## Phase 2: Types and Data Layer
- [ ] T-06 Define TypeScript interfaces in src/types/source.ts (CallPayload, MeetingPayload, TranscriptPayload, EnvelopeRecord, DeliveryEnvelope)
- [ ] T-07 Define app state types in src/types/app.ts (AppRecord, RecordAnalysis, ImportLogEntry, RouteKey)
- [ ] T-08 Embed JSON data files in src/data/ (initial01.json, update02.json)
- [ ] T-09 Implement localStorage persistence in src/lib/storage.ts

## Phase 3: Import Engine
- [ ] T-10 Implement import engine in src/lib/importEngine.ts with revision-aware upsert
- [ ] T-11 Implement idempotency guard (ignore same/older revision)
- [ ] T-12 Implement full payload replacement (no partial merge)
- [ ] T-13 Preserve manual route and manager notes through updates
- [ ] T-14 Detect transcript change and mark analysis stale

## Phase 4: Routing and Analysis
- [ ] T-15 Implement route taxonomy in src/lib/routing.ts
- [ ] T-16 Implement suggested route derivation from metadata and transcript content
- [ ] T-17 Implement analysis generation in src/lib/analysis.ts (deterministic, evidence-grounded)
- [ ] T-18 Implement evidence reference generation in src/lib/evidence.ts
- [ ] T-19 Implement metrics calculations in src/lib/metrics.ts

## Phase 5: UI Components
- [ ] T-20 Build MetricCard component
- [ ] T-21 Build FilterBar component
- [ ] T-22 Build RecordsTable component with sorting
- [ ] T-23 Build TranscriptViewer component
- [ ] T-24 Build RouteSelector component
- [ ] T-25 Build ReviewBadge component
- [ ] T-26 Build ImportHistory component
- [ ] T-27 Build ExportPanel component
- [ ] T-28 Build Sidebar navigation component

## Phase 6: Pages
- [ ] T-29 Build Dashboard page with MetricCards and Recharts
- [ ] T-30 Build Intelligence Inbox page with FilterBar and RecordsTable
- [ ] T-31 Build Record Detail page with TranscriptViewer and analysis
- [ ] T-32 Build Manager Brief page
- [ ] T-33 Build Routing & Review page
- [ ] T-34 Build Imports & Replay page
- [ ] T-35 Build Exports page

## Phase 7: Export Generation
- [ ] T-36 Implement JSON manifest generation in src/lib/export.ts
- [ ] T-37 Implement CSV manifest generation
- [ ] T-38 Implement individual record JSON output generation
- [ ] T-39 Implement ZIP export (if practical)

## Phase 8: Tests
- [ ] T-40 Test: initial import produces 44 records
- [ ] T-41 Test: duplicate import is idempotent
- [ ] T-42 Test: reordered re-import is idempotent
- [ ] T-43 Test: revision 2 replaces revision 1 for M07
- [ ] T-44 Test: older revision is ignored after newer applied
- [ ] T-45 Test: full replacement including null fields
- [ ] T-46 Test: manual route preserved through revision update
- [ ] T-47 Test: transcript count (17 initial, 18 after update)
- [ ] T-48 Test: connection rate and unknown status calculation
- [ ] T-49 Test: evidence reference format
- [ ] T-50 Test: manifest contents and export paths
- [ ] T-51 Test: no duplicate active outputs on repeated export
- [ ] T-52 Test: invalid input handling

## Phase 9: Finalise
- [ ] T-53 Write README.md
- [ ] T-54 Run production build (npm run build)
- [ ] T-55 Run tests (npm run test)
- [ ] T-56 Fix build/test errors

## Acceptance Checklist
- [ ] 44 unique source records after both deliveries
- [ ] 17 usable texts initially, 18 after update
- [ ] M07 revision 2 preserved after re-importing revision 1
- [ ] Manual route on M07 preserved through update
- [ ] Analysis marked stale when transcript changes
- [ ] All state persists after browser refresh
- [ ] Export manifest has correct paths (no absolute paths)
- [ ] No duplicate active outputs on repeat export
- [ ] All automated tests pass
- [ ] Production build succeeds
