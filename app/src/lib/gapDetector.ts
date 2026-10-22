import type { AppRecord } from '../types/app';
import type { CallPayload } from '../types/source';
import type { FollowUpGap, GapType } from '../types/features';
import { meetingEvidenceRef, callEvidenceRef } from './evidence';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';

const GAP_LABELS: Record<GapType, string> = {
  promise_to_send:         'Promise to Send Information',
  unanswered_question:     'Unanswered Technical Question',
  needs_confirmation:      'Needs Confirmation',
  workaround_unconfirmed:  'Workaround Without Confirmed Fix',
  no_explicit_next_step:   'No Explicit Next Step',
  escalation_pending:      'Escalation Pending',
};

function getEvidence(record: AppRecord, keyword: string): { evidence: string; ref: string } {
  if (record.source_type === 'call') {
    const transcript = (record.payload as CallPayload).transcript ?? '';
    const lower = transcript.toLowerCase();
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 10);
      const end = Math.min(transcript.length, idx + keyword.length + 100);
      const snippet = transcript.slice(start, end).trim();
      return { evidence: snippet, ref: callEvidenceRef(record.record_ref, record.source_id, snippet).display };
    }
    return { evidence: '', ref: `[${record.record_ref}]` };
  }

  const tp = record.transcript_payload;
  if (!tp) return { evidence: '', ref: `[${record.record_ref}]` };

  for (let i = 0; i < tp.turns.length; i++) {
    if (tp.turns[i].text.toLowerCase().includes(keyword.toLowerCase())) {
      return { evidence: tp.turns[i].text, ref: meetingEvidenceRef(record.record_ref, record.source_id, i + 1).display };
    }
  }
  return { evidence: '', ref: `[${record.record_ref}]` };
}

function detectGapsForRecord(record: AppRecord): FollowUpGap[] {
  const gaps: FollowUpGap[] = [];
  const isCall = record.source_type === 'call';
  const hasText = isCall
    ? hasUsableCallTranscript(record.payload as CallPayload)
    : hasUsableMeetingTranscript(record.transcript_payload);

  if (!hasText) return gaps;

  const lower = isCall
    ? ((record.payload as CallPayload).transcript ?? '').toLowerCase()
    : (record.transcript_payload?.turns?.map(t => t.text).join(' ') ?? '').toLowerCase();

  const addGap = (
    gapType: GapType,
    description: string,
    keyword: string,
    suggestedAction: string,
    isNotEvidenced: boolean = false
  ) => {
    const ev = getEvidence(record, keyword);
    if (!ev.evidence) return; // skip if no matching evidence found
    gaps.push({
      recordRef: record.record_ref,
      sourceType: record.source_type,
      sourceId: record.source_id,
      gapType,
      gapLabel: GAP_LABELS[gapType],
      description,
      evidence: ev.evidence,
      evidenceRef: ev.ref,
      suggestedAction,
      isNotEvidenced,
    });
  };

  // ── Promise to send information ──
  if (lower.includes('will send') || lower.includes("i'll send") || lower.includes('will email you')) {
    addGap('promise_to_send',
      'A participant promised to send information, but confirmation of receipt is not evidenced in this dataset.',
      'will send',
      'Confirm the information was sent and received; follow up if no response within 2 business days.',
      true);
  }
  if (lower.includes('send the details') || lower.includes('send the document')) {
    addGap('promise_to_send',
      'Documents or details were promised to be sent after the conversation.',
      'send the details',
      'Ensure the promised documents are sent and track receipt.',
      false);
  }

  // ── Unanswered technical questions ──
  if (lower.includes('do not have a reliable answer') || lower.includes("don't know the detail") || lower.includes('need to check')) {
    addGap('unanswered_question',
      'A technical question was raised that could not be answered during the conversation.',
      "don't know the detail",
      'Obtain the answer from the relevant team and communicate it to the contact.',
      false);
  }
  if (lower.includes('which fields are required') || lower.includes('how do we learn')) {
    addGap('unanswered_question',
      'Customer asked a specific technical question about field requirements that was addressed but may need documentation.',
      'how do we learn',
      'Provide documentation or a reference guide for the specific field requirements.',
      false);
  }

  // ── Needs confirmation ──
  if (lower.includes('cannot confirm') || lower.includes('i cannot confirm') || lower.includes('cannot confirm the')) {
    addGap('needs_confirmation',
      'A feasibility or eligibility question could not be confirmed during the call.',
      'cannot confirm',
      'Follow up with the programme or engineering team to confirm feasibility and inform the customer.',
      false);
  }
  if (lower.includes('confirm feasibility') || lower.includes('confirm the eligibility')) {
    addGap('needs_confirmation',
      'Integration feasibility for bank-card transactions needs confirmation with the programme team.',
      'feasibility',
      'Confirm with the programme team whether the integration path is viable.',
      false);
  }

  // ── Workaround without confirmed fix ──
  if (lower.includes('workaround') && (lower.includes('does not mean') || lower.includes('still raise') || lower.includes('still need'))) {
    addGap('workaround_unconfirmed',
      'A workaround was provided, but the root cause was explicitly stated as not resolved.',
      'workaround',
      'Track the issue to resolution and confirm with the customer when the fix is deployed.',
      false);
  }

  // ── No explicit next step ──
  // Records with useful content but analysis has no follow_up_actions and no "send" or "schedule" promise
  const hasAction = record.analysis.follow_up_actions.length > 0;
  const hasPromise = lower.includes('will send') || lower.includes('schedule') || lower.includes('follow up') || lower.includes('arrange');
  if (!hasAction && !hasPromise && record.analysis.summary && record.analysis.issues.length > 0) {
    addGap('no_explicit_next_step',
      'This record has substantive content and identified issues, but no explicit next step was agreed in the conversation.',
      record.analysis.issues[0].split(' ').slice(0, 3).join(' ').toLowerCase(),
      'Follow-up not evidenced in this dataset. Consider proactively reaching out to schedule a next step.',
      true);
  }

  // ── Escalation pending ──
  if (lower.includes('get it checked today') || lower.includes('ask the team') || lower.includes('i will report')) {
    addGap('escalation_pending',
      'An issue was escalated to the engineering/product team, but the resolution is not confirmed in this conversation.',
      'get it checked',
      'Confirm with the engineering team whether the escalated issue has been addressed.',
      true);
  }
  if (lower.includes('check that with the team') && lower.includes('today or monday')) {
    addGap('escalation_pending',
      'Team was asked to investigate; update promised "today or by Monday" but no confirmation of resolution.',
      'check that with the team',
      'Follow up with the team to confirm the investigation result and notify the customer.',
      true);
  }

  return gaps;
}

export function detectAllGaps(records: AppRecord[]): FollowUpGap[] {
  const allGaps: FollowUpGap[] = [];

  for (const record of records) {
    const gaps = detectGapsForRecord(record);
    allGaps.push(...gaps);
  }

  // Sort: non-evidenced first (more important), then by record_ref
  allGaps.sort((a, b) => {
    if (a.isNotEvidenced !== b.isNotEvidenced) return a.isNotEvidenced ? -1 : 1;
    return a.recordRef.localeCompare(b.recordRef);
  });

  return allGaps;
}

export function countGapsByType(gaps: FollowUpGap[]): { gapType: GapType; label: string; count: number }[] {
  const map = new Map<GapType, number>();
  for (const g of gaps) {
    map.set(g.gapType, (map.get(g.gapType) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([gapType, count]) => ({ gapType, label: GAP_LABELS[gapType], count }))
    .sort((a, b) => b.count - a.count);
}
