import type { AppRecord, RouteKey } from '../types/app';
import { ROUTE_LABELS } from '../types/app';
import type { CallPayload, MeetingPayload, TranscriptPayload } from '../types/source';
import type { RoutingExplanation, RoutingReason } from '../types/features';
import { meetingEvidenceRef, callEvidenceRef } from './evidence';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';

function getEvidenceRef(record: AppRecord, keyword: string): { evidence: string; ref: string } {
  if (record.source_type === 'call') {
    const transcript = (record.payload as CallPayload).transcript ?? '';
    const lower = transcript.toLowerCase();
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 10);
      const end = Math.min(transcript.length, idx + keyword.length + 60);
      const snippet = transcript.slice(start, end).trim();
      return { evidence: snippet, ref: callEvidenceRef(record.record_ref, record.source_id, snippet).display };
    }
    return { evidence: '', ref: `[${record.record_ref}]` };
  }

  const tp = record.transcript_payload;
  if (!tp) return { evidence: '', ref: `[${record.record_ref}]` };

  for (let i = 0; i < tp.turns.length; i++) {
    if (tp.turns[i].text.toLowerCase().includes(keyword.toLowerCase())) {
      return { evidence: tp.turns[i].text.slice(0, 200), ref: meetingEvidenceRef(record.record_ref, record.source_id, i + 1).display };
    }
  }
  return { evidence: '', ref: `[${record.record_ref}]` };
}

function buildReasons(record: AppRecord): RoutingReason[] {
  const reasons: RoutingReason[] = [];
  const isCall = record.source_type === 'call';
  const hasText = isCall
    ? hasUsableCallTranscript(record.payload as CallPayload)
    : hasUsableMeetingTranscript(record.transcript_payload);

  if (!hasText) {
    reasons.push({
      signal: 'No usable transcript text',
      evidence: 'Transcript is null or empty',
      evidenceRef: `[${record.record_ref}]`,
      weight: 'strong',
    });
    return reasons;
  }

  const lower = isCall
    ? ((record.payload as CallPayload).transcript ?? '').toLowerCase()
    : (record.transcript_payload?.turns?.map(t => t.text).join(' ') ?? '').toLowerCase();

  const addReason = (signal: string, keyword: string, weight: 'strong' | 'moderate' | 'weak') => {
    const ev = getEvidenceRef(record, keyword);
    reasons.push({ signal, evidence: ev.evidence, evidenceRef: ev.ref, weight });
  };

  // Partnership signals
  if (lower.includes('partner')) addReason('Partner programme discussion', 'partner', 'strong');
  if (lower.includes('referral')) addReason('Referral link discussed', 'referral', 'strong');
  if (lower.includes('commission')) addReason('Commission structure mentioned', 'commission', 'strong');
  if (lower.includes('advisory')) addReason('Advisory firm context', 'advisory', 'moderate');

  // Integration signals
  if (lower.includes('api')) addReason('API access discussed', 'api', 'strong');
  if (lower.includes('webhook')) addReason('Webhook mentioned', 'webhook', 'moderate');
  if (lower.includes('electronic invoic')) addReason('Electronic invoicing discussion', 'electronic invoic', 'strong');
  if (lower.includes('integration')) addReason('Integration topic', 'integration', 'moderate');
  if (lower.includes('sandbox')) addReason('Sandbox / developer trial', 'sandbox', 'moderate');

  // Product issue signals
  if (lower.includes('bug')) addReason('Bug reported', 'bug', 'strong');
  if (lower.includes("can't upload")) addReason('Upload failure reported', "can't upload", 'strong');
  if (lower.includes('stuck showing')) addReason('Processing state stuck', 'stuck showing', 'strong');
  if (lower.includes('workaround')) addReason('Workaround provided', 'workaround', 'moderate');

  // Customer support signals
  if (lower.includes('token has expired')) addReason('Login token expired', 'token has expired', 'strong');
  if (lower.includes('invitation')) addReason('Account invitation issue', 'invitation', 'moderate');
  if (lower.includes('permission') && lower.includes('administrator')) addReason('Permission model discussion', 'permission', 'moderate');

  // Payment signals
  if (lower.includes('prepaid') && lower.includes('credit')) addReason('Card type discussion (prepaid vs credit)', 'prepaid', 'moderate');
  if (lower.includes('billing') && lower.includes('cycle')) addReason('Billing cycle discussed', 'billing', 'moderate');
  if (lower.includes('migration')) addReason('Card programme migration', 'migration', 'moderate');

  // Sales signals
  if (lower.includes('cold call') || lower.includes('cold introduction')) addReason('Cold outreach call', 'cold call', 'strong');
  if (lower.includes('follow-up') || lower.includes('follow up')) addReason('Follow-up on prior conversation', 'follow', 'moderate');
  if (lower.includes('proposal') && !lower.includes('partner')) addReason('Proposal requested', 'proposal', 'moderate');
  if (lower.includes('cfo')) addReason('CFO approval gate', 'cfo', 'moderate');

  // Internal signals
  if (lower.includes('training')) addReason('Training session', 'training', 'strong');
  if (lower.includes('back-office')) addReason('Back-office operations', 'back-office', 'moderate');

  // Compliance signals
  if (lower.includes('kyc') || lower.includes('kyb')) addReason('KYC/KYB mentioned', 'kyc', 'strong');
  if (lower.includes('incorporation')) addReason('Incorporation documents', 'incorporation', 'moderate');

  // No contact
  if (lower.includes('voicemail') || lower.includes('unresponsive')) addReason('Voicemail or unresponsive', 'voicemail', 'strong');

  return reasons;
}

function computeConfidence(reasons: RoutingReason[]): { confidence: 'high' | 'medium' | 'low'; reason: string } {
  const strong = reasons.filter(r => r.weight === 'strong').length;
  const moderate = reasons.filter(r => r.weight === 'moderate').length;
  if (strong >= 2) return { confidence: 'high', reason: `${strong} strong signal(s) and ${moderate} moderate signal(s) support this route.` };
  if (strong >= 1) return { confidence: 'medium', reason: `${strong} strong signal and ${moderate} moderate signal(s) found.` };
  if (moderate >= 1) return { confidence: 'low', reason: `Only moderate signals found; route may need manual confirmation.` };
  return { confidence: 'low', reason: 'No strong keyword signals; route based on metadata fallback.' };
}

function detectAlternativeRoute(record: AppRecord): { route: RouteKey | null; reason: string | null } {
  const isCall = record.source_type === 'call';
  const lower = isCall
    ? ((record.payload as CallPayload).transcript ?? '').toLowerCase()
    : (record.transcript_payload?.turns?.map(t => t.text).join(' ') ?? '').toLowerCase();

  const primary = record.suggested_route;
  const alternatives: { route: RouteKey; reason: string }[] = [];

  // Check if the record could legitimately fit another route
  if (primary !== 'partnership' && lower.includes('partner')) alternatives.push({ route: 'partnership', reason: 'Contains partnership signals' });
  if (primary !== 'integration' && lower.includes('api')) alternatives.push({ route: 'integration', reason: 'Contains API/integration signals' });
  if (primary !== 'payments_billing' && lower.includes('prepaid') && lower.includes('card')) alternatives.push({ route: 'payments_billing', reason: 'Contains payment/card signals' });
  if (primary !== 'product_issue' && lower.includes('workaround')) alternatives.push({ route: 'product_issue', reason: 'Contains workaround signals suggesting a product issue' });
  if (primary !== 'compliance_kyc' && lower.includes('compliance')) alternatives.push({ route: 'compliance_kyc', reason: 'Contains compliance signals' });

  if (alternatives.length > 0) return { route: alternatives[0].route, reason: alternatives[0].reason };
  return { route: null, reason: null };
}

export function explainRouting(record: AppRecord): RoutingExplanation {
  const reasons = buildReasons(record);
  const { confidence, reason: confidenceReason } = computeConfidence(reasons);
  const alt = detectAlternativeRoute(record);

  const freshness: 'current' | 'stale' | 'pending' =
    record.analysis.is_stale || record.review_state === 'analysis_stale' ? 'stale'
    : !record.analysis.summary ? 'pending'
    : 'current';

  return {
    suggestedRoute: record.suggested_route,
    suggestedRouteLabel: ROUTE_LABELS[record.suggested_route],
    effectiveRoute: record.effective_route,
    effectiveRouteLabel: ROUTE_LABELS[record.effective_route],
    isManualOverride: record.manual_override,
    reasons,
    confidence,
    confidenceReason,
    alternativeRoute: alt.route,
    alternativeReason: alt.reason,
    analysisFreshness: freshness,
  };
}
