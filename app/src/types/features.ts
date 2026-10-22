// Feature-specific types for Revenue Intelligence Inbox premium features

import type { RouteKey, ReviewState } from './app';

// ── Feature 1: Revenue Risk Radar ─────────────────────────────────────────────

export type RiskCategory =
  | 'unresolved_problem'
  | 'payment_issue'
  | 'integration_blocker'
  | 'unanswered_question'
  | 'uncertain_commitment'
  | 'pending_followup'
  | 'customer_dissatisfaction';

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface RiskSignal {
  recordRef: string;
  sourceType: string;
  sourceId: string;
  category: RiskCategory;
  categoryLabel: string;
  severity: RiskSeverity;
  reason: string;
  evidence: string;           // exact quote or turn reference
  evidenceRef: string;        // [M01, turn 3] or [C01: "quote"]
  suggestedAction: string;
  reviewState: ReviewState;
  isStale: boolean;
  isInferred: boolean;        // true when the risk is inferred, not explicitly stated
}

export interface RiskRadarData {
  risks: RiskSignal[];
  totalRisks: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  byCategory: { category: RiskCategory; label: string; count: number; severity: RiskSeverity }[];
}

// ── Feature 2: Smart Action Center ────────────────────────────────────────────

export type ActionStatus = 'suggested' | 'in_progress' | 'completed' | 'blocked' | 'dismissed';
export type ActionPriority = 'high' | 'medium' | 'low';

export interface ActionItem {
  id: string;                  // deterministic: recordKey + index
  title: string;
  evidence: string;
  evidenceRef: string;
  recordRef: string;
  sourceType: string;
  sourceId: string;
  suggestedOwner: string | null;   // only when supported by source text
  priority: ActionPriority;
  status: ActionStatus;
  dueDate: string | null;          // only when explicitly supported
  isExplicit: boolean;             // true = agreed in conversation, false = suggested
  createdAt: string;
  updatedAt: string;
}

export interface ActionCenterData {
  actions: ActionItem[];
  suggested: number;
  inProgress: number;
  completed: number;
  blocked: number;
  dismissed: number;
  highPriority: number;
}

// ── Feature 3: Explainable Smart Routing ──────────────────────────────────────

export interface RoutingExplanation {
  suggestedRoute: RouteKey;
  suggestedRouteLabel: string;
  effectiveRoute: RouteKey;
  effectiveRouteLabel: string;
  isManualOverride: boolean;
  reasons: RoutingReason[];
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string;
  alternativeRoute: RouteKey | null;
  alternativeReason: string | null;
  analysisFreshness: 'current' | 'stale' | 'pending';
}

export interface RoutingReason {
  signal: string;              // the detected signal
  evidence: string;            // supporting evidence
  evidenceRef: string;
  weight: 'strong' | 'moderate' | 'weak';
}

// ── Feature 4: Follow-up Gap Detector ──────────────────────────────────────────

export type GapType =
  | 'promise_to_send'
  | 'unanswered_question'
  | 'needs_confirmation'
  | 'workaround_unconfirmed'
  | 'no_explicit_next_step'
  | 'escalation_pending';

export interface FollowUpGap {
  recordRef: string;
  sourceType: string;
  sourceId: string;
  gapType: GapType;
  gapLabel: string;
  description: string;
  evidence: string;
  evidenceRef: string;
  suggestedAction: string;
  isNotEvidenced: boolean;    // true when follow-up is not evidenced in dataset
}

// ── Feature 5: Data Change & Replay Inspector ─────────────────────────────────

export interface RevisionDiff {
  recordRef: string;
  sourceType: string;
  sourceId: string;
  previousRevision: number | null;
  newRevision: number;
  changedFields: string[];
  transcriptChanged: boolean;
  analysisStale: boolean;
  manualRoutePreserved: boolean;
}

export interface ImportInspection {
  logEntryId: string;
  timestamp: string;
  batchId: string;
  revision: number;
  newRecords: number;
  updatedRecords: number;
  ignoredRecords: number;
  errors: number;
  diffs: RevisionDiff[];
}

// ── Feature 7: Evidence-First Search ──────────────────────────────────────────

export type SearchResultType =
  | 'record_ref'
  | 'source_id'
  | 'transcript_phrase'
  | 'participant'
  | 'risk'
  | 'action'
  | 'review_status'
  | 'route';

export interface SearchResult {
  type: SearchResultType;
  typeLabel: string;
  title: string;
  subtitle: string;
  recordRef: string;
  sourceType: string;
  sourceId: string;
  matchContext: string;       // surrounding text of the match
  evidenceRef: string;
}

// ── Feature 8: Data Quality Monitor ───────────────────────────────────────────

export interface DataQualityReport {
  totalRecords: number;
  recordsWithTranscript: number;
  recordsWithoutTranscript: number;
  recordsWithNullTranscript: number;
  recordsWithBlankTranscript: number;
  recordsWithEmptyTurns: number;
  unknownConnectionCount: number;
  pendingReviewCount: number;
  analysisStaleCount: number;
  reviewedCount: number;
  revisionsApplied: { revision: number; count: number }[];
  duplicateImportsIgnored: number;
  recordsWithMissingEvidence: number;    // analysis has no summary + no topics
  recordsWithUnresolvedProcessing: number; // classification_status not 'stored'
  qualityScore: number;                   // 0-100
  qualityNotes: string[];
}
