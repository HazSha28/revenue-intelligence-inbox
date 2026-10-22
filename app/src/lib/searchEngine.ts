import type { AppRecord } from '../types/app';
import { ROUTE_LABELS } from '../types/app';
import type { CallPayload, MeetingPayload, TranscriptTurn } from '../types/source';
import type { SearchResult, SearchResultType } from '../types/features';
import { meetingEvidenceRef, callEvidenceRef } from './evidence';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';
import type { RiskSignal } from '../types/features';
import type { ActionItem } from '../types/features';
import type { FollowUpGap } from '../types/features';

const TYPE_LABELS: Record<SearchResultType, string> = {
  record_ref:       'Record',
  source_id:         'Source ID',
  transcript_phrase: 'Transcript',
  participant:       'Participant',
  risk:             'Risk',
  action:           'Action',
  review_status:    'Review State',
  route:            'Route',
};

const MAX_RESULTS = 50;

function makeContext(text: string, query: string, radius = 60): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, 120);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end) + suffix;
}

export function globalSearch(
  query: string,
  records: AppRecord[],
  risks: RiskSignal[],
  actions: ActionItem[],
  gaps: FollowUpGap[],
): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const record of records) {
    // Record ref
    if (record.record_ref.toLowerCase().includes(q)) {
      results.push({
        type: 'record_ref', typeLabel: TYPE_LABELS.record_ref,
        title: record.record_ref,
        subtitle: `${record.source_type} · ${(record.payload as CallPayload).rep_name ?? (record.payload as MeetingPayload).title ?? ''}`,
        recordRef: record.record_ref,
        sourceType: record.source_type,
        sourceId: record.source_id,
        matchContext: '',
        evidenceRef: `[${record.record_ref}]`,
      });
    }

    // Source ID
    if (record.source_id.toLowerCase().includes(q)) {
      results.push({
        type: 'source_id', typeLabel: TYPE_LABELS.source_id,
        title: record.source_id,
        subtitle: `${record.record_ref} · ${record.source_type}`,
        recordRef: record.record_ref,
        sourceType: record.source_type,
        sourceId: record.source_id,
        matchContext: '',
        evidenceRef: `[${record.record_ref}]`,
      });
    }

    // Review state
    if (record.review_state.toLowerCase().includes(q)) {
      results.push({
        type: 'review_status', typeLabel: TYPE_LABELS.review_status,
        title: record.review_state.replace(/_/g, ' '),
        subtitle: `${record.record_ref} · ${record.source_type}`,
        recordRef: record.record_ref,
        sourceType: record.source_type,
        sourceId: record.source_id,
        matchContext: '',
        evidenceRef: `[${record.record_ref}]`,
      });
    }

    // Effective route
    const routeLabel = ROUTE_LABELS[record.effective_route].toLowerCase();
    if (routeLabel.includes(q) || record.effective_route.toLowerCase().includes(q)) {
      results.push({
        type: 'route', typeLabel: TYPE_LABELS.route,
        title: ROUTE_LABELS[record.effective_route],
        subtitle: `${record.record_ref} · ${record.source_type}`,
        recordRef: record.record_ref,
        sourceType: record.source_type,
        sourceId: record.source_id,
        matchContext: record.manual_override ? 'Manual override' : 'System suggested',
        evidenceRef: `[${record.record_ref}]`,
      });
    }

    // Participant names (meeting speakers, call rep names)
    if (record.source_type === 'call') {
      const repName = (record.payload as CallPayload).rep_name ?? '';
      if (repName.toLowerCase().includes(q)) {
        results.push({
          type: 'participant', typeLabel: TYPE_LABELS.participant,
          title: repName,
          subtitle: `Caller · ${record.record_ref}`,
          recordRef: record.record_ref,
          sourceType: record.source_type,
          sourceId: record.source_id,
          matchContext: '',
          evidenceRef: `[${record.record_ref}]`,
        });
      }
    }

    if (record.source_type === 'meeting' && record.transcript_payload) {
      for (const turn of record.transcript_payload.turns) {
        if (turn.speaker.toLowerCase().includes(q)) {
          results.push({
            type: 'participant', typeLabel: TYPE_LABELS.participant,
            title: turn.speaker,
            subtitle: `Speaker · ${record.record_ref}`,
            recordRef: record.record_ref,
            sourceType: record.source_type,
            sourceId: record.source_id,
            matchContext: '',
            evidenceRef: `[${record.record_ref}]`,
          });
          break; // one per record
        }
      }
    }

    // Transcript phrase search
    if (record.source_type === 'call') {
      const transcript = (record.payload as CallPayload).transcript ?? '';
      if (transcript.toLowerCase().includes(q)) {
        const ctx = makeContext(transcript, q);
        const ref = callEvidenceRef(record.record_ref, record.source_id, ctx);
        results.push({
          type: 'transcript_phrase', typeLabel: TYPE_LABELS.transcript_phrase,
          title: ctx,
          subtitle: `${record.record_ref} · call`,
          recordRef: record.record_ref,
          sourceType: record.source_type,
          sourceId: record.source_id,
          matchContext: ctx,
          evidenceRef: ref.display,
        });
      }
    }

    if (record.source_type === 'meeting' && record.transcript_payload) {
      for (let i = 0; i < record.transcript_payload.turns.length; i++) {
        const turn = record.transcript_payload.turns[i];
        if (turn.text.toLowerCase().includes(q)) {
          const ref = meetingEvidenceRef(record.record_ref, record.source_id, i + 1);
          const ctx = makeContext(turn.text, q, 80);
          results.push({
            type: 'transcript_phrase', typeLabel: TYPE_LABELS.transcript_phrase,
            title: ctx,
            subtitle: `${record.record_ref} · turn ${i + 1} · ${turn.speaker}`,
            recordRef: record.record_ref,
            sourceType: record.source_type,
            sourceId: record.source_id,
            matchContext: ctx,
            evidenceRef: ref.display,
          });
          break; // one match per record for meetings
        }
      }
    }
  }

  // Risk search
  for (const risk of risks) {
    if (risk.categoryLabel.toLowerCase().includes(q) || risk.reason.toLowerCase().includes(q) || risk.evidence.toLowerCase().includes(q)) {
      results.push({
        type: 'risk', typeLabel: TYPE_LABELS.risk,
        title: risk.categoryLabel,
        subtitle: `${risk.recordRef} · ${risk.severity}`,
        recordRef: risk.recordRef,
        sourceType: risk.sourceType,
        sourceId: risk.sourceId,
        matchContext: risk.reason,
        evidenceRef: risk.evidenceRef,
      });
    }
  }

  // Action search
  for (const action of actions) {
    if (action.title.toLowerCase().includes(q) || action.evidence.toLowerCase().includes(q)) {
      results.push({
        type: 'action', typeLabel: TYPE_LABELS.action,
        title: action.title,
        subtitle: `${action.recordRef} · ${action.status}`,
        recordRef: action.recordRef,
        sourceType: action.sourceType,
        sourceId: action.sourceId,
        matchContext: action.evidence.slice(0, 120),
        evidenceRef: action.evidenceRef,
      });
    }
  }

  return results.slice(0, MAX_RESULTS);
}
