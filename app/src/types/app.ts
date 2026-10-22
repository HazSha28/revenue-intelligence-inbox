import type { CallPayload, MeetingPayload, TranscriptPayload } from './source';

export type RouteKey =
  | 'sales_new'
  | 'sales_followup'
  | 'partnership'
  | 'customer_support'
  | 'product_issue'
  | 'integration'
  | 'payments_billing'
  | 'compliance_kyc'
  | 'internal'
  | 'no_contact'
  | 'unclassified';

export const ROUTE_LABELS: Record<RouteKey, string> = {
  sales_new: 'New Sales Outreach',
  sales_followup: 'Sales Follow-up',
  partnership: 'Partnership / Referral',
  customer_support: 'Customer Support',
  product_issue: 'Product Issue',
  integration: 'Integration / API',
  payments_billing: 'Payments & Billing',
  compliance_kyc: 'Compliance / KYC',
  internal: 'Internal / Training',
  no_contact: 'No Contact',
  unclassified: 'Unclassified',
};

export const ROUTE_COLORS: Record<RouteKey, string> = {
  sales_new: '#3b82f6',
  sales_followup: '#8b5cf6',
  partnership: '#10b981',
  customer_support: '#f59e0b',
  product_issue: '#ef4444',
  integration: '#06b6d4',
  payments_billing: '#f97316',
  compliance_kyc: '#6366f1',
  internal: '#84cc16',
  no_contact: '#9ca3af',
  unclassified: '#d1d5db',
};

export type ReviewState = 'pending_review' | 'reviewed' | 'analysis_stale';

export interface RecordAnalysis {
  summary: string | null;
  key_topics: string[];
  issues: string[];
  risks: string[];
  follow_up_actions: string[];
  analysis_revision: number;
  is_stale: boolean;
  generated_at: string;
}

export interface AppRecord {
  // Identity
  source_type: 'call' | 'meeting';
  source_id: string;
  record_ref: string;
  applied_revision: number;

  // Source data (immutable after import except full replacement)
  payload: CallPayload | MeetingPayload;
  transcript_payload: TranscriptPayload | null;

  // Derived (set at import, updated when transcript changes)
  suggested_route: RouteKey;
  suggested_routes: RouteKey[];   // may have multiple
  analysis: RecordAnalysis;

  // Manager-controlled (never overwritten by import)
  effective_route: RouteKey;
  effective_routes: RouteKey[];
  manual_override: boolean;
  review_state: ReviewState;
  manager_notes: string;

  // Timestamps
  first_imported_at: string;
  last_updated_at: string;
}

export interface ImportLogEntry {
  id: string;
  timestamp: string;
  batch_id: string;
  revision: number;
  exported_at: string;
  total_in_batch: number;
  applied: number;
  updated: number;
  ignored: number;
  errors: number;
  details: ImportRecordDetail[];
}

export interface ImportRecordDetail {
  record_ref: string;
  source_type: 'call' | 'meeting';
  source_id: string;
  status: 'applied' | 'updated' | 'ignored' | 'error';
  reason?: string;
  previous_revision?: number;
  new_revision?: number;
}

export interface AppState {
  records: AppRecord[];
  import_log: ImportLogEntry[];
  schema_version: number;
}

// Metrics types
export interface DashboardMetrics {
  totalRecords: number;
  callCount: number;
  meetingCount: number;
  usableTranscriptCount: number;
  usableCallTranscripts: number;
  usableMeetingTranscripts: number;
  connectedCalls: number;
  notConnectedCalls: number;
  unknownConnectionCalls: number;
  totalCallsWithKnownConnection: number;
  pendingReviewCount: number;
  reviewedCount: number;
  analysisStalCount: number;
  recordsByRoute: { route: RouteKey; label: string; count: number; color: string }[];
  recordsByType: { type: string; count: number }[];
  processingStatusBreakdown: { status: string; count: number }[];
  transcriptStatusBreakdown: { status: string; count: number }[];
}
