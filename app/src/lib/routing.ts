import type { RouteKey } from '../types/app';
import type { CallPayload, MeetingPayload, TranscriptPayload } from '../types/source';

/**
 * Derive suggested route(s) from source metadata and transcript content.
 * Returns an array of RouteKeys (usually 1, sometimes 2 for mixed content).
 * Identity: (source_type, source_id) — never based on title or company name.
 */
export function deriveRoutes(
  sourceType: 'call' | 'meeting',
  payload: CallPayload | MeetingPayload,
  transcriptPayload: TranscriptPayload | null
): RouteKey[] {
  if (sourceType === 'call') {
    return deriveCallRoutes(payload as CallPayload);
  } else {
    return deriveMeetingRoutes(payload as MeetingPayload, transcriptPayload);
  }
}

function deriveCallRoutes(payload: CallPayload): RouteKey[] {
  const transcript = payload.transcript ?? '';

  // No transcript and not connected → no_contact
  if (!hasUsableCallTranscript(payload)) {
    return ['no_contact'];
  }

  const lower = transcript.toLowerCase();
  const routes: RouteKey[] = [];

  // Partnership / referral signals
  if (
    lower.includes('partner') ||
    lower.includes('referral') ||
    lower.includes('advisory') ||
    lower.includes('commission') ||
    lower.includes('incorporate')
  ) {
    routes.push('partnership');
  }

  // Integration / API signals
  if (
    lower.includes('api') ||
    lower.includes('webhook') ||
    lower.includes('developer access') ||
    lower.includes('event notification') ||
    lower.includes('integration')
  ) {
    routes.push('integration');
  }

  // Existing customer support signals
  if (
    lower.includes('account') &&
    (lower.includes('issue') || lower.includes('problem') || lower.includes('bug') || lower.includes('login'))
  ) {
    routes.push('customer_support');
  }

  // Product issue signals
  if (
    lower.includes('bug') ||
    lower.includes("can't upload") ||
    lower.includes('not working') ||
    lower.includes('workaround')
  ) {
    if (!routes.includes('product_issue')) routes.push('product_issue');
  }

  // Payments & billing
  if (
    lower.includes('invoice') ||
    lower.includes('payment') ||
    lower.includes('billing') ||
    lower.includes('prepaid') ||
    lower.includes('credit card')
  ) {
    routes.push('payments_billing');
  }

  // If no routes derived yet, use metadata
  if (routes.length === 0) {
    const outcome = payload.observed_outcome ?? '';
    if (outcome === 'follow_up' || (payload.prior_dials_ever ?? 0) > 0) {
      routes.push('sales_followup');
    } else if (payload.is_campaign_call) {
      routes.push('sales_new');
    } else {
      routes.push('unclassified');
    }
    return routes;
  }

  // If it has partnership/integration but was a sales call
  if (routes.length > 0 && !routes.includes('sales_followup') && !routes.includes('sales_new')) {
    const outcome = payload.observed_outcome ?? '';
    if (outcome === 'follow_up' && (payload.prior_dials_ever ?? 0) > 0) {
      // Already has a better route
    }
  }

  return routes;
}

function deriveMeetingRoutes(payload: MeetingPayload, transcriptPayload: TranscriptPayload | null): RouteKey[] {
  const turns = transcriptPayload?.turns ?? [];
  const hasText = turns.some(t => t.text.trim().length > 0);

  if (!hasText) {
    // No usable text — use recording status
    if (payload.recording_status === 'cancelled') return ['no_contact'];
    return ['unclassified'];
  }

  const fullText = turns.map(t => t.text).join(' ').toLowerCase();
  const routes: RouteKey[] = [];

  // Internal training signals
  if (
    fullText.includes('training') ||
    fullText.includes('demo account') ||
    fullText.includes('back-office') ||
    fullText.includes('billing cycle') && fullText.includes('operations')
  ) {
    routes.push('internal');
  }

  // Product issue / support session
  if (
    fullText.includes('bug') ||
    fullText.includes("can't upload") ||
    fullText.includes('workaround') ||
    (fullText.includes('issue') && fullText.includes('team to investigate')) ||
    fullText.includes('stuck showing') ||
    fullText.includes('recreate payment')
  ) {
    routes.push('product_issue');
  }

  // Customer support (account setup, login, access)
  if (
    fullText.includes('invitation') ||
    fullText.includes('reset') && fullText.includes('login') ||
    fullText.includes('account setup') ||
    fullText.includes('permission') ||
    fullText.includes('access') && fullText.includes('administrator')
  ) {
    if (!routes.includes('product_issue')) {
      routes.push('customer_support');
    }
  }

  // Partnership / referral
  if (
    fullText.includes('partner') ||
    fullText.includes('referral') ||
    fullText.includes('commission') ||
    fullText.includes('memorandum')
  ) {
    routes.push('partnership');
  }

  // Integration / API / electronic invoicing
  if (
    fullText.includes('api') ||
    fullText.includes('integration') ||
    fullText.includes('electronic invoicing') ||
    fullText.includes('ledgerbridge') ||
    fullText.includes('webhook') ||
    fullText.includes('peppol') ||
    fullText.includes('sandbox')
  ) {
    routes.push('integration');
  }

  // Payments & billing
  if (
    fullText.includes('prepaid') ||
    fullText.includes('credit card') ||
    (fullText.includes('card') && fullText.includes('migration')) ||
    fullText.includes('invoice') && fullText.includes('billing')
  ) {
    if (!routes.includes('payments_billing')) routes.push('payments_billing');
  }

  // Sales / new prospect meeting
  if (
    fullText.includes('proposal') ||
    fullText.includes('cfo') ||
    (fullText.includes('expense') && (fullText.includes('pilot') || fullText.includes('evaluation')))
  ) {
    if (routes.length === 0) routes.push('sales_followup');
  }

  // Compliance / KYC
  if (
    fullText.includes('kyc') ||
    fullText.includes('kyb') ||
    fullText.includes('identity document') ||
    fullText.includes('incorporation document') ||
    fullText.includes('compliance')
  ) {
    if (!routes.includes('compliance_kyc')) routes.push('compliance_kyc');
  }

  // Receivables / AR discussion
  if (
    fullText.includes('receivable') ||
    fullText.includes('collection') ||
    fullText.includes('outstanding invoice')
  ) {
    if (routes.length === 0) routes.push('sales_followup');
  }

  if (routes.length === 0) routes.push('unclassified');
  return routes;
}

export function hasUsableCallTranscript(payload: CallPayload): boolean {
  return typeof payload.transcript === 'string' && payload.transcript.trim().length > 0;
}

export function hasUsableMeetingTranscript(transcriptPayload: TranscriptPayload | null): boolean {
  if (!transcriptPayload) return false;
  return transcriptPayload.turns.some(t => t.text.trim().length > 0);
}

export function primaryRoute(routes: RouteKey[]): RouteKey {
  return routes[0] ?? 'unclassified';
}
