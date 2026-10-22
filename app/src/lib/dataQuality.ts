import type { AppRecord } from '../types/app';
import type { CallPayload, MeetingPayload } from '../types/source';
import type { DataQualityReport } from '../types/features';
import type { ImportLogEntry } from '../types/app';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';

export function computeDataQuality(records: AppRecord[], importLog: ImportLogEntry[]): DataQualityReport {
  const total = records.length;

  const recordsWithTranscript = records.filter(r =>
    r.source_type === 'call'
      ? hasUsableCallTranscript(r.payload as CallPayload)
      : hasUsableMeetingTranscript(r.transcript_payload)
  ).length;

  const recordsWithNullTranscript = records.filter(r => {
    if (r.source_type === 'call') return (r.payload as CallPayload).transcript === null;
    return r.transcript_payload === null;
  }).length;

  const recordsWithBlankTranscript = records.filter(r => {
    if (r.source_type === 'call') {
      const t = (r.payload as CallPayload).transcript;
      return t !== null && t.trim().length === 0;
    }
    return r.transcript_payload !== null && r.transcript_payload.turns.length > 0 &&
      !r.transcript_payload.turns.some(t => t.text.trim().length > 0);
  }).length;

  const recordsWithEmptyTurns = records.filter(r =>
    r.source_type === 'meeting' &&
    r.transcript_payload !== null &&
    r.transcript_payload.turns.length === 0 &&
    r.transcript_payload.unavailable_reason !== null
  ).length;

  const unknownConnectionCount = records.filter(r =>
    r.source_type === 'call' && (r.payload as CallPayload).is_connected === null
  ).length;

  const pendingReviewCount = records.filter(r => r.review_state === 'pending_review').length;
  const analysisStaleCount = records.filter(r => r.review_state === 'analysis_stale').length;
  const reviewedCount = records.filter(r => r.review_state === 'reviewed').length;

  // Revisions applied
  const revMap = new Map<number, number>();
  for (const r of records) {
    revMap.set(r.applied_revision, (revMap.get(r.applied_revision) ?? 0) + 1);
  }
  const revisionsApplied = Array.from(revMap.entries())
    .map(([revision, count]) => ({ revision, count }))
    .sort((a, b) => a.revision - b.revision);

  // Duplicate imports ignored (sum all 'ignored' counts from import log)
  const duplicateImportsIgnored = importLog.reduce((s, e) => s + e.ignored, 0);

  // Records with missing evidence (no analysis summary AND no topics)
  const recordsWithMissingEvidence = records.filter(r =>
    !r.analysis.summary && r.analysis.key_topics.length === 0
  ).length;

  // Records with unresolved processing states (classification_status not 'stored')
  const recordsWithUnresolvedProcessing = records.filter(r => {
    if (r.source_type === 'call') {
      const status = (r.payload as CallPayload).classification_status;
      return status !== 'stored' && status !== null;
    }
    const status = (r.payload as MeetingPayload).summary_status;
    return status !== 'stored' && status !== null && status !== 'failed';
  }).length;

  // Quality score calculation (0-100)
  let score = 100;
  const notes: string[] = [];

  // Deduct for missing transcripts
  const missingPct = total > 0 ? (total - recordsWithTranscript) / total : 0;
  score -= Math.round(missingPct * 40);
  if (missingPct > 0.5) notes.push(`${Math.round(missingPct * 100)}% of records lack usable transcript text.`);

  // Deduct for stale analysis
  if (analysisStaleCount > 0) {
    score -= analysisStaleCount * 2;
    notes.push(`${analysisStaleCount} record(s) have stale analysis awaiting review.`);
  }

  // Deduct for pending review
  if (pendingReviewCount > 0) {
    score -= Math.round(pendingReviewCount * 0.5);
    notes.push(`${pendingReviewCount} record(s) pending review.`);
  }

  // Deduct for unknown connection
  if (unknownConnectionCount > 0) {
    notes.push(`${unknownConnectionCount} call(s) have unknown connection status (is_connected=null).`);
  }

  // Deduct for missing evidence
  if (recordsWithMissingEvidence > 0) {
    score -= recordsWithMissingEvidence * 1;
    notes.push(`${recordsWithMissingEvidence} record(s) have no generated analysis (no summary or topics).`);
  }

  // Bonus: data imported
  if (total === 0) {
    score = 0;
    notes.push('No data imported.');
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  if (notes.length === 0) notes.push('Data quality is good. All records have transcripts and current analysis.');

  return {
    totalRecords: total,
    recordsWithTranscript,
    recordsWithoutTranscript: total - recordsWithTranscript,
    recordsWithNullTranscript,
    recordsWithBlankTranscript,
    recordsWithEmptyTurns,
    unknownConnectionCount,
    pendingReviewCount,
    analysisStaleCount,
    reviewedCount,
    revisionsApplied,
    duplicateImportsIgnored,
    recordsWithMissingEvidence,
    recordsWithUnresolvedProcessing,
    qualityScore: score,
    qualityNotes: notes,
  };
}
