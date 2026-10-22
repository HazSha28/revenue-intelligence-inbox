import type { AppRecord } from '../types/app';
import type { CallPayload, MeetingPayload, TranscriptPayload } from '../types/source';
import type { RiskSignal, RiskRadarData, RiskCategory, RiskSeverity } from '../types/features';
import { meetingEvidenceRef, callEvidenceRef } from './evidence';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  unresolved_problem:      'Unresolved Customer Problem',
  payment_issue:           'Payment / Transaction Issue',
  integration_blocker:     'Integration Blocker',
  unanswered_question:     'Unanswered Technical Question',
  uncertain_commitment:    'Uncertain Product Commitment',
  pending_followup:        'Pending Follow-up Action',
  customer_dissatisfaction: 'Customer Dissatisfaction',
};

function getEvidence(record: AppRecord, keyword: string): { evidence: string; ref: string } {
  if (record.source_type === 'call') {
    const transcript = (record.payload as CallPayload).transcript ?? '';
    const lower = transcript.toLowerCase();
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 20);
      const end = Math.min(transcript.length, idx + keyword.length + 80);
      const snippet = transcript.slice(start, end).trim();
      const ref = callEvidenceRef(record.record_ref, record.source_id, snippet);
      return { evidence: snippet, ref: ref.display };
    }
    return { evidence: transcript.slice(0, 120), ref: `[${record.record_ref}]` };
  }

  // Meeting
  const tp = record.transcript_payload;
  if (!tp) return { evidence: '', ref: `[${record.record_ref}]` };

  const lower = keyword.toLowerCase();
  for (let i = 0; i < tp.turns.length; i++) {
    if (tp.turns[i].text.toLowerCase().includes(lower)) {
      const ref = meetingEvidenceRef(record.record_ref, record.source_id, i + 1);
      return { evidence: tp.turns[i].text, ref: ref.display };
    }
  }
  return { evidence: tp.turns[0]?.text ?? '', ref: `[${record.record_ref}, turn 1]` };
}

function detectRisksForRecord(record: AppRecord): RiskSignal[] {
  const risks: RiskSignal[] = [];
  const isCall = record.source_type === 'call';
  const hasText = isCall
    ? hasUsableCallTranscript(record.payload as CallPayload)
    : hasUsableMeetingTranscript(record.transcript_payload);

  if (!hasText) return risks;

  // Get the full text for keyword scanning
  const lower = isCall
    ? ((record.payload as CallPayload).transcript ?? '').toLowerCase()
    : (record.transcript_payload?.turns?.map(t => t.text).join(' ') ?? '').toLowerCase();

  const addRisk = (
    category: RiskCategory,
    severity: RiskSeverity,
    reason: string,
    keyword: string,
    suggestedAction: string,
    isInferred: boolean
  ) => {
    const ev = getEvidence(record, keyword);
    risks.push({
      recordRef: record.record_ref,
      sourceType: record.source_type,
      sourceId: record.source_id,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      severity,
      reason,
      evidence: ev.evidence,
      evidenceRef: ev.ref,
      suggestedAction,
      reviewState: record.review_state,
      isStale: record.analysis.is_stale,
      isInferred,
    });
  };

  // ── Unresolved customer problems ──
  if (lower.includes('bug') || lower.includes('not working') || lower.includes("can't upload") || lower.includes('stuck showing')) {
    addRisk('unresolved_problem', 'high',
      'Customer reported a product bug or broken workflow that was not confirmed resolved in the conversation.',
      lower.includes('stuck showing') ? 'stuck showing' : 'bug',
      'Investigate the reported issue and confirm resolution with the customer.', false);
  }

  if (lower.includes('workaround') && !lower.includes('resolved')) {
    addRisk('unresolved_problem', 'medium',
      'A workaround was discussed but the root cause was not confirmed resolved.',
      'workaround',
      'Address the underlying issue so the workaround is no longer needed.', false);
  }

  if (lower.includes('token has expired') || (lower.includes('invitation') && lower.includes('expired'))) {
    addRisk('unresolved_problem', 'high',
      'Account setup invitation token expired before the customer could use it.',
      'token has expired',
      'Regenerate the invitation token and troubleshoot the expiry issue with engineering.', false);
  }

  // ── Payment / transaction issues ──
  if (lower.includes('prepaid') && lower.includes('credit') && (lower.includes('not') || lower.includes('prefer'))) {
    addRisk('payment_issue', 'high',
      'Customer explicitly wants credit cards but only prepaid is available. They stated they may look at another option.',
      'another option',
      'Escalate the credit card request to the bank partnership team and confirm feasibility.', false);
  }

  if (lower.includes('pricing') || lower.includes('price was') || lower.includes('became')) {
    if (lower.includes('became') || lower.includes('price was')) {
      addRisk('payment_issue', 'medium',
        'Pricing discrepancy noted between previously quoted and current amounts.',
        'became',
        'Clarify the pricing breakdown and confirm the correct quote to the customer.', false);
    }
  }

  // ── Integration blockers ──
  if (lower.includes('deadline') && (lower.includes('not an immovable') || lower.includes('early next year') || lower.includes('competing'))) {
    addRisk('integration_blocker', 'medium',
      'Integration project timeline may slip due to competing internal priorities.',
      'deadline',
      'Confirm the Q4 target with management or communicate the revised timeline to the integration partner.', false);
  }

  if (lower.includes('feasibility') && (lower.includes('confirm') || lower.includes('check') || lower.includes('cannot confirm'))) {
    addRisk('integration_blocker', 'high',
      'Integration feasibility for bank-card transaction feed could not be confirmed on the call.',
      'feasibility',
      'Confirm with the programme team whether existing bank cards can join the transaction-feed programme.', false);
  }

  // ── Unanswered technical questions ──
  if (lower.includes('do not have a reliable answer') || lower.includes("i don't know") || lower.includes('need to check')) {
    addRisk('unanswered_question', 'medium',
      'A technical question was raised that could not be answered during the conversation.',
      'need to check',
      'Follow up with the product or engineering team to provide the answer to the customer.', true);
  }

  // ── Uncertain product commitments ──
  if (lower.includes('cfo') && lower.includes('approve')) {
    addRisk('uncertain_commitment', 'high',
      'Deal progression is contingent on CFO approval that has not yet been obtained.',
      'cfo',
      'Prepare materials for the CFO and schedule a follow-up to present the proposal.', false);
  }

  if (lower.includes('decide whether') || lower.includes('not decided')) {
    addRisk('uncertain_commitment', 'medium',
      'Customer stated they need to decide internally before proceeding.',
      'decide',
      'Provide supporting information for the internal decision and offer a follow-up call.', true);
  }

  // ── Pending follow-up actions ──
  if (record.analysis.follow_up_actions.length > 0 && (record.review_state === 'pending_review' || record.review_state === 'analysis_stale')) {
    addRisk('pending_followup', 'medium',
      `Record has ${record.analysis.follow_up_actions.length} pending follow-up action(s) awaiting review.`,
      hasText ? (lower.includes('send') ? 'send' : lower.slice(0, 20)) : '',
      'Review and action the pending follow-up items for this record.', true);
  }

  // ── Customer dissatisfaction ──
  if (lower.includes("not interested") || lower.includes("don't want") || lower.includes("didn't ask for this call")) {
    addRisk('customer_dissatisfaction', 'medium',
      'Customer expressed explicit dissatisfaction with being contacted.',
      'not interested',
      'Remove the contact from outreach lists and document the objection in the CRM.', false);
  }

  if (lower.includes("already have") || lower.includes("already very automated") || lower.includes("already in place")) {
    addRisk('customer_dissatisfaction', 'low',
      'Customer indicated their current solution already covers the proposed offering.',
      'already have',
      'Document the existing solution and deprioritise for future outreach unless a gap emerges.', true);
  }

  return risks;
}

export function detectAllRisks(records: AppRecord[]): RiskRadarData {
  const allRisks: RiskSignal[] = [];

  for (const record of records) {
    const recordRisks = detectRisksForRecord(record);
    allRisks.push(...recordRisks);
  }

  // Sort by severity (high first), then by record_ref
  const severityOrder: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };
  allRisks.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.recordRef.localeCompare(b.recordRef);
  });

  const byCategoryMap = new Map<RiskCategory, { count: number; severity: RiskSeverity }>();
  for (const risk of allRisks) {
    const existing = byCategoryMap.get(risk.category);
    if (!existing || severityOrder[risk.severity] < severityOrder[existing.severity]) {
      byCategoryMap.set(risk.category, { count: (existing?.count ?? 0) + 1, severity: risk.severity });
    } else {
      existing.count++;
    }
  }

  const byCategory = Array.from(byCategoryMap.entries())
    .map(([category, { count, severity }]) => ({ category, label: CATEGORY_LABELS[category], count, severity }))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.count - a.count);

  return {
    risks: allRisks,
    totalRisks: allRisks.length,
    highCount: allRisks.filter(r => r.severity === 'high').length,
    mediumCount: allRisks.filter(r => r.severity === 'medium').length,
    lowCount: allRisks.filter(r => r.severity === 'low').length,
    byCategory,
  };
}
