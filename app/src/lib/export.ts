import type { AppRecord } from '../types/app';
import { ROUTE_LABELS } from '../types/app';
import type { CallPayload, MeetingPayload } from '../types/source';

// ── Manifest types ────────────────────────────────────────────────────────────

export interface ManifestRecord {
  source_type: string;
  source_id: string;
  record_ref: string;
  applied_revision: number;
  suggested_route: string;
  suggested_route_label: string;
  effective_route: string;
  effective_route_label: string;
  manual_override: boolean;
  output_paths: string[];
  processing_state: string;
  review_state: string;
  analysis_freshness: 'current' | 'stale' | 'pending';
  conversation_date: string;
}

export interface ExportManifest {
  generated_at: string;
  total_records: number;
  note: string;
  records: ManifestRecord[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProcessingState(record: AppRecord): string {
  if (record.source_type === 'call') {
    return (record.payload as CallPayload).classification_status ?? 'unknown';
  }
  return (record.payload as MeetingPayload).summary_status ?? 'unknown';
}

function getConversationDate(record: AppRecord): string {
  if (record.source_type === 'call') {
    return (record.payload as CallPayload).started_at;
  }
  return (record.payload as MeetingPayload).starts_at;
}

function getOutputPath(record: AppRecord): string {
  const folder = record.source_type === 'call' ? 'calls' : 'meetings';
  return `outputs/${folder}/${record.record_ref}.json`;
}

function analysisFreshness(record: AppRecord): 'current' | 'stale' | 'pending' {
  if (!record.analysis.summary && record.analysis.key_topics.length === 0) return 'pending';
  if (record.analysis.is_stale || record.review_state === 'analysis_stale') return 'stale';
  return 'current';
}

function toManifestRecord(record: AppRecord): ManifestRecord {
  return {
    source_type: record.source_type,
    source_id: record.source_id,
    record_ref: record.record_ref,
    applied_revision: record.applied_revision,
    suggested_route: record.suggested_route,
    suggested_route_label: ROUTE_LABELS[record.suggested_route],
    effective_route: record.effective_route,
    effective_route_label: ROUTE_LABELS[record.effective_route],
    manual_override: record.manual_override,
    output_paths: [getOutputPath(record)],
    processing_state: getProcessingState(record),
    review_state: record.review_state,
    analysis_freshness: analysisFreshness(record),
    conversation_date: getConversationDate(record),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildManifest(records: AppRecord[]): ExportManifest {
  return {
    generated_at: new Date().toISOString(),
    total_records: records.length,
    note: 'Selected sample — not representative of whole-team performance. Unique records identified by (source_type, source_id).',
    records: records
      .slice()
      .sort((a, b) => a.record_ref.localeCompare(b.record_ref))
      .map(toManifestRecord),
  };
}

export function manifestToCSV(manifest: ExportManifest): string {
  const headers = [
    'source_type',
    'source_id',
    'record_ref',
    'applied_revision',
    'suggested_route',
    'effective_route',
    'effective_route_label',
    'manual_override',
    'output_path',
    'processing_state',
    'review_state',
    'analysis_freshness',
    'conversation_date',
  ];

  const rows = manifest.records.map(r => [
    r.source_type,
    r.source_id,
    r.record_ref,
    r.applied_revision,
    r.suggested_route,
    r.effective_route,
    r.effective_route_label,
    r.manual_override ? 'true' : 'false',
    r.output_paths[0] ?? '',
    r.processing_state,
    r.review_state,
    r.analysis_freshness,
    r.conversation_date,
  ]);

  const escape = (v: unknown) => {
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

export function buildRecordOutput(record: AppRecord): object {
  return {
    source_type: record.source_type,
    source_id: record.source_id,
    record_ref: record.record_ref,
    applied_revision: record.applied_revision,
    payload: record.payload,
    transcript_payload: record.transcript_payload,
    suggested_route: record.suggested_route,
    effective_route: record.effective_route,
    manual_override: record.manual_override,
    analysis: record.analysis,
    review_state: record.review_state,
    manager_notes: record.manager_notes,
    first_imported_at: record.first_imported_at,
    last_updated_at: record.last_updated_at,
  };
}

export function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
