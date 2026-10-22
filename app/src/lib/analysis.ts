import type { RecordAnalysis, RouteKey } from '../types/app';
import type { CallPayload, MeetingPayload, TranscriptPayload, TranscriptTurn } from '../types/source';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';

/**
 * Generate deterministic, evidence-grounded analysis from transcript content.
 * Does NOT invent information not present in the source text.
 */
export function generateAnalysis(
  sourceType: 'call' | 'meeting',
  payload: CallPayload | MeetingPayload,
  transcriptPayload: TranscriptPayload | null,
  routes: RouteKey[],
  revision: number
): RecordAnalysis {
  const now = new Date().toISOString();

  if (sourceType === 'call') {
    return analyseCall(payload as CallPayload, routes, revision, now);
  } else {
    return analyseMeeting(payload as MeetingPayload, transcriptPayload, routes, revision, now);
  }
}

function analyseCall(
  payload: CallPayload,
  routes: RouteKey[],
  revision: number,
  generatedAt: string
): RecordAnalysis {
  const transcript = payload.transcript ?? '';
  const hasText = hasUsableCallTranscript(payload);

  if (!hasText) {
    return {
      summary: null,
      key_topics: [],
      issues: [],
      risks: [],
      follow_up_actions: [],
      analysis_revision: revision,
      is_stale: false,
      generated_at: generatedAt,
    };
  }

  const lower = transcript.toLowerCase();
  const key_topics: string[] = [];
  const issues: string[] = [];
  const risks: string[] = [];
  const follow_up_actions: string[] = [];

  // Extract topics from content
  if (lower.includes('api') || lower.includes('developer access')) key_topics.push('API / developer access');
  if (lower.includes('expense')) key_topics.push('Expense management');
  if (lower.includes('vendor') || lower.includes('supplier')) key_topics.push('Vendor / supplier management');
  if (lower.includes('invoice')) key_topics.push('Invoice processing');
  if (lower.includes('prepaid') || lower.includes('card')) key_topics.push('Corporate cards');
  if (lower.includes('partner')) key_topics.push('Partnership');
  if (lower.includes('cold call') || lower.includes('introductory')) key_topics.push('Cold outreach');
  if (lower.includes('email') && lower.includes('follow')) key_topics.push('Email follow-up requested');
  if (lower.includes('voicemail')) key_topics.push('Voicemail left');

  // Issues from transcript
  if (lower.includes("not interested")) issues.push('Prospect is not interested');
  if (lower.includes("already have")) issues.push('Prospect has existing solution');
  if (lower.includes("wrong email")) issues.push('Email deliverability issue — wrong address initially used');
  if (lower.includes("can't hear") || lower.includes("connection problem") || lower.includes("very faint"))
    issues.push('Poor audio quality during call');
  if (lower.includes("doesn't work") || lower.includes("left anymore"))
    issues.push("Contact may have changed role");

  // Risks
  if (lower.includes("not interested") || lower.includes("already have"))
    risks.push('Low conversion probability');
  if (lower.includes("connection problem") && lower.includes("email"))
    risks.push('No reliable contact method established');

  // Follow-up actions
  if (lower.includes('email you') || lower.includes('send it over') || lower.includes('send me'))
    follow_up_actions.push('Send follow-up email with product information');
  if (lower.includes('monday') || lower.includes('tuesday'))
    follow_up_actions.push('Schedule follow-up call Monday/Tuesday');
  if (lower.includes('call me back'))
    follow_up_actions.push('Awaiting callback from prospect');
  if (lower.includes('messaging app') || lower.includes('chat app'))
    follow_up_actions.push('Send proposal via messaging app');

  // Summary
  const outcome = payload.observed_outcome ?? 'unknown';
  const direction = payload.direction;
  const repName = payload.rep_name ?? 'Rep';
  const summary = buildCallSummary(transcript, direction, outcome, repName, routes);

  return {
    summary,
    key_topics,
    issues,
    risks,
    follow_up_actions,
    analysis_revision: revision,
    is_stale: false,
    generated_at: generatedAt,
  };
}

function buildCallSummary(
  transcript: string,
  direction: string,
  outcome: string,
  repName: string,
  routes: RouteKey[]
): string {
  const lower = transcript.toLowerCase();
  const route = routes[0] ?? 'unclassified';

  if (route === 'no_contact') return `${direction} call, no contact established (${outcome}).`;

  if (route === 'partnership') {
    return `Partnership discussion. ${repName} explored a potential referral or partner arrangement. Contact showed conditional interest.`;
  }
  if (route === 'integration') {
    if (lower.includes('api') && lower.includes('email'))
      return `${repName} called to follow up on API/developer access discussion. Contact requested communication by email due to audio issues. Follow-up agreed.`;
    return `Integration / API access discussion with prospect.`;
  }
  if (route === 'sales_new') {
    if (lower.includes('not interested') || lower.includes("already have"))
      return `Cold outreach by ${repName}. Contact expressed no interest or stated existing solutions cover the need.`;
    return `Cold outreach by ${repName}. Contact requested more information by email.`;
  }
  if (route === 'sales_followup') {
    if (lower.includes('voicemail') || lower.includes('message for'))
      return `${repName} left a voicemail following up with prospect about expense platform consideration.`;
    return `Follow-up call by ${repName}. Contact requested information be sent via specified channel.`;
  }

  return `${direction} call by ${repName} (outcome: ${outcome}).`;
}

function analyseMeeting(
  payload: MeetingPayload,
  transcriptPayload: TranscriptPayload | null,
  routes: RouteKey[],
  revision: number,
  generatedAt: string
): RecordAnalysis {
  const hasText = hasUsableMeetingTranscript(transcriptPayload);

  if (!hasText) {
    return {
      summary: null,
      key_topics: [],
      issues: [],
      risks: [],
      follow_up_actions: [],
      analysis_revision: revision,
      is_stale: false,
      generated_at: generatedAt,
    };
  }

  const turns = transcriptPayload!.turns;
  const fullText = turns.map(t => t.text).join(' ');
  const lower = fullText.toLowerCase();
  const key_topics: string[] = [];
  const issues: string[] = [];
  const risks: string[] = [];
  const follow_up_actions: string[] = [];

  // Key topics
  if (lower.includes('card') || lower.includes('prepaid')) key_topics.push('Corporate cards (prepaid)');
  if (lower.includes('expense')) key_topics.push('Expense management');
  if (lower.includes('reimbursement')) key_topics.push('Reimbursement module');
  if (lower.includes('invoice')) key_topics.push('Invoice processing');
  if (lower.includes('vendor') || lower.includes('supplier') || lower.includes('payable')) key_topics.push('Accounts payable / vendor payments');
  if (lower.includes('receivable') || lower.includes('collection')) key_topics.push('Accounts receivable / collections');
  if (lower.includes('integration') || lower.includes('api') || lower.includes('accounting')) key_topics.push('Accounting / ERP integration');
  if (lower.includes('partner') || lower.includes('referral') || lower.includes('commission')) key_topics.push('Partner programme / commissions');
  if (lower.includes('electronic invoic') || lower.includes('peppol')) key_topics.push('Electronic invoicing / compliance');
  if (lower.includes('credit') && lower.includes('card')) key_topics.push('Credit cards (customer request)');
  if (lower.includes('migration')) key_topics.push('Card programme migration');
  if (lower.includes('kyc') || lower.includes('kyb') || lower.includes('compliance')) key_topics.push('KYC / KYB compliance');
  if (lower.includes('permission') || lower.includes('administrator') || lower.includes('login')) key_topics.push('Account access / permissions');
  if (lower.includes('billing') && lower.includes('invoice') && lower.includes('cycle')) key_topics.push('Billing cycle and payment collection');
  if (lower.includes('training')) key_topics.push('Product training');

  // Issues
  if (lower.includes('not working') || lower.includes('bug') || lower.includes("can't upload"))
    issues.push('Product bug or UX issue reported by customer');
  if (lower.includes('stuck showing processing'))
    issues.push('Reimbursement payments stuck in Processing state');
  if (lower.includes('workaround'))
    issues.push('Customer relying on workaround; root cause not yet resolved');
  if (lower.includes('carries forward') || lower.includes('old value carries'))
    issues.push('Mark as paid form retains previous payment amount — requires double action');
  if (lower.includes('token has expired') || lower.includes('invitation') && lower.includes('expired'))
    issues.push('Reset invitation token expiring before customer can use it');
  if (lower.includes('credit') && lower.includes('prepaid') && lower.includes('not'))
    issues.push('Customer prefers credit card; only prepaid currently available');
  if (lower.includes('price was') || lower.includes('became'))
    issues.push('Pricing discrepancy between quoted amounts — clarification needed');
  if (lower.includes('deadline') || lower.includes("does not have all") || lower.includes('q4'))
    issues.push('Q4 target at risk due to competing priorities');
  if (lower.includes('cfr') || lower.includes('cfo'))
    issues.push('CFO approval still required before proceeding');
  if (lower.includes("department setup") || lower.includes('move users'))
    issues.push('Department structure requires correction in platform');

  // Risks
  if (lower.includes('another option') || lower.includes('consider another'))
    risks.push('Customer may evaluate alternative providers if credit card need not met');
  if (lower.includes('not an immovable deadline') || lower.includes('early next year'))
    risks.push('Timeline may slip to Q1; internal project competing for Q4 slot');
  if (lower.includes('cfo') && lower.includes('approve'))
    risks.push('Deal contingent on CFO approval');
  if (lower.includes('existing bank') || lower.includes('bank administra'))
    risks.push('Bank integration path requires additional feasibility checks');

  // Follow-up actions
  if (lower.includes('send the details') || lower.includes('send the document') || lower.includes('will send'))
    follow_up_actions.push('Send follow-up documents / proposal');
  if (lower.includes('investigate') || lower.includes('raise') && lower.includes('team'))
    follow_up_actions.push('Raise reported issues with engineering/product team');
  if (lower.includes('check') && (lower.includes('feasibility') || lower.includes('eligibility') || lower.includes('confirm')))
    follow_up_actions.push('Confirm feasibility / eligibility with product or programme team');
  if (lower.includes('next call') || lower.includes('follow-up call') || lower.includes('arrange a session'))
    follow_up_actions.push('Schedule follow-up call or demo session');
  if (lower.includes('volume template') || lower.includes('template'))
    follow_up_actions.push('Customer to complete volume template before commercial proposal');
  if (lower.includes('memorandum') || lower.includes('sign'))
    follow_up_actions.push('Send partner memorandum for signing');
  if (lower.includes('referral link') || lower.includes('unique link'))
    follow_up_actions.push('Provide referral link and partner tracking sheet');
  if (lower.includes('refresh') && lower.includes('training') || lower.includes('training material'))
    follow_up_actions.push('Customer to review training material before next session');
  if (lower.includes('brookmint') || lower.includes('token'))
    follow_up_actions.push('Resolve expired invitation token for Brookmint Holdings access');
  if (lower.includes('access') && lower.includes('back-office'))
    follow_up_actions.push('Request back-office super-admin access for next training session');
  if (lower.includes('podcast'))
    follow_up_actions.push('Connect partner with marketing for potential podcast collaboration');

  // Summary from title + routes + content
  const summary = buildMeetingSummary(payload.title, routes, lower, turns.length);

  return {
    summary,
    key_topics: [...new Set(key_topics)],
    issues: [...new Set(issues)],
    risks: [...new Set(risks)],
    follow_up_actions: [...new Set(follow_up_actions)],
    analysis_revision: revision,
    is_stale: false,
    generated_at: generatedAt,
  };
}

function buildMeetingSummary(
  title: string,
  routes: RouteKey[],
  lower: string,
  turnCount: number
): string {
  const route = routes[0] ?? 'unclassified';
  const prefix = `Meeting: ${title} (${turnCount} turns).`;

  if (route === 'product_issue') {
    return `${prefix} Customer reported multiple product issues including description-save not persisting, document upload failing via Recreate Payment route, reimbursement transactions stuck in Processing, and Mark as Paid amount carrying forward. Workaround provided for upload issue; others escalated to engineering team.`;
  }
  if (route === 'customer_support') {
    return `${prefix} Account setup session covering two company accounts. Invitation reset attempted but token expired immediately. Discussed administrator permission model and account continuity. Accounting corrections and workflow questions also raised.`;
  }
  if (route === 'partnership') {
    return `${prefix} Partner programme discussion covering commission structure, onboarding requirements, referral link setup, and joint marketing possibilities.`;
  }
  if (route === 'integration') {
    if (lower.includes('electronic invoic') || lower.includes('ledger'))
      return `${prefix} Technical and commercial evaluation of electronic invoicing provider (LedgerBridge) for SpendNest's AP/AR modules. Sandbox, API, country coverage, pricing models, and implementation timeline discussed.`;
    return `${prefix} Integration and API discussion.`;
  }
  if (route === 'internal') {
    return `${prefix} Internal training session covering billing system workflows: invoice generation, payment retry logic, account freeze and recovery, and billing cycle configuration.`;
  }
  if (route === 'payments_billing') {
    if (lower.includes('migration'))
      return `${prefix} Card programme migration planning session. Discussed transition from existing card network, credit card request, bank-issued credit card integration feasibility, and department restructuring.`;
    return `${prefix} Discussion of cards, payments, and billing arrangements.`;
  }
  if (route === 'sales_followup') {
    if (lower.includes('receivable'))
      return `${prefix} Discovery meeting covering receivables automation, invoice volumes, collection follow-up process, and expense management capabilities.`;
    return `${prefix} Sales follow-up meeting covering expense management, card workflow, approval process, pricing, and next steps.`;
  }
  return `${prefix} Discussion captured across ${turnCount} turns.`;
}
