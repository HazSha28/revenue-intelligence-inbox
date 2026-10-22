import type { AppRecord } from '../types/app';
import type { CallPayload, MeetingPayload, TranscriptPayload } from '../types/source';
import type { ActionItem, ActionStatus, ActionPriority, ActionCenterData } from '../types/features';
import { meetingEvidenceRef, callEvidenceRef } from './evidence';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';

function actionId(sourceType: string, sourceId: string, index: number): string {
  return `${sourceType}::${sourceId}::${index}`;
}

function getEvidenceForKeyword(record: AppRecord, keyword: string): { evidence: string; ref: string } {
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
    return { evidence: transcript.slice(0, 120), ref: `[${record.record_ref}]` };
  }

  const tp = record.transcript_payload;
  if (!tp) return { evidence: '', ref: `[${record.record_ref}]` };

  for (let i = 0; i < tp.turns.length; i++) {
    if (tp.turns[i].text.toLowerCase().includes(keyword.toLowerCase())) {
      return { evidence: tp.turns[i].text, ref: meetingEvidenceRef(record.record_ref, record.source_id, i + 1).display };
    }
  }
  return { evidence: tp.turns[0]?.text ?? '', ref: `[${record.record_ref}, turn 1]` };
}

function detectSuggestedOwner(lower: string): string | null {
  if (lower.includes('team') && lower.includes('investigate')) return 'Engineering team';
  if (lower.includes('cfo') && lower.includes('approve')) return 'Customer CFO';
  if (lower.includes('compliance')) return 'Compliance team';
  if (lower.includes('marketing')) return 'Marketing team';
  if (lower.includes('training')) return 'Training team';
  if (lower.includes('send the document') || lower.includes('send the details') || lower.includes('send follow')) return 'SpendNest rep';
  if (lower.includes('template')) return 'Customer (to complete)';
  return null;
}

function detectPriority(reason: string, issues: string[]): ActionPriority {
  const lower = reason.toLowerCase();
  if (lower.includes('token has expired') || lower.includes('stuck showing') || lower.includes('bug') || lower.includes('cfo')) return 'high';
  if (issues.length > 2) return 'high';
  if (lower.includes('send') || lower.includes('follow') || lower.includes('schedule') || lower.includes('confirm')) return 'medium';
  return 'low';
}

function detectDueDate(lower: string): string | null {
  // Only set when explicitly supported
  if (lower.includes('monday') || lower.includes('tuesday')) return 'Next Monday/Tuesday';
  if (lower.includes('today')) return 'Today';
  if (lower.includes('this week')) return 'This week';
  if (lower.includes('next week')) return 'Next week';
  if (lower.includes('before the commercial call')) return 'Before commercial call';
  return null;
}

function isExplicitlyAgreed(lower: string): boolean {
  // If the transcript shows active agreement (not just suggestion), mark as explicit
  if (lower.includes('will send') && (lower.includes('understood') || lower.includes('certainly') || lower.includes('all right'))) return true;
  if (lower.includes('agree') || lower.includes('let us do that') || lower.includes("let's do that")) return true;
  if (lower.includes('i will email you') || lower.includes("i'll send it")) return true;
  if (lower.includes('i will send') || lower.includes("i'll send")) return true;
  return false;
}

export function extractActions(records: AppRecord[]): ActionItem[] {
  const actions: ActionItem[] = [];
  const now = new Date().toISOString();

  for (const record of records) {
    const isCall = record.source_type === 'call';
    const hasText = isCall
      ? hasUsableCallTranscript(record.payload as CallPayload)
      : hasUsableMeetingTranscript(record.transcript_payload);

    if (!hasText) continue;

    const lower = isCall
      ? ((record.payload as CallPayload).transcript ?? '').toLowerCase()
      : (record.transcript_payload?.turns?.map(t => t.text).join(' ') ?? '').toLowerCase();

    // Extract from analysis.follow_up_actions (deterministic)
    for (let i = 0; i < record.analysis.follow_up_actions.length; i++) {
      const actionTitle = record.analysis.follow_up_actions[i];
      const keyword = actionTitle.split(' ').slice(0, 3).join(' ').toLowerCase();
      const ev = getEvidenceForKeyword(record, keyword);

      actions.push({
        id: actionId(record.source_type, record.source_id, i),
        title: actionTitle,
        evidence: ev.evidence,
        evidenceRef: ev.ref,
        recordRef: record.record_ref,
        sourceType: record.source_type,
        sourceId: record.source_id,
        suggestedOwner: detectSuggestedOwner(lower),
        priority: detectPriority(actionTitle, record.analysis.issues),
        status: 'suggested',
        dueDate: detectDueDate(lower),
        isExplicit: isExplicitlyAgreed(lower),
        createdAt: now,
        updatedAt: now,
      });
    }

    // Detect explicit commitments from transcript
    if (lower.includes('will send') && !record.analysis.follow_up_actions.some(a => a.includes('Send'))) {
      const ev = getEvidenceForKeyword(record, 'will send');
      actions.push({
        id: actionId(record.source_type, record.source_id, record.analysis.follow_up_actions.length),
        title: 'Send promised information to contact',
        evidence: ev.evidence,
        evidenceRef: ev.ref,
        recordRef: record.record_ref,
        sourceType: record.source_type,
        sourceId: record.source_id,
        suggestedOwner: 'SpendNest rep',
        priority: 'medium',
        status: 'suggested',
        dueDate: detectDueDate(lower),
        isExplicit: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (lower.includes('check with the team') || lower.includes('need to check')) {
      const ev = getEvidenceForKeyword(record, 'check with');
      actions.push({
        id: actionId(record.source_type, record.source_id, record.analysis.follow_up_actions.length + 1),
        title: 'Check with internal team and follow up with customer',
        evidence: ev.evidence,
        evidenceRef: ev.ref,
        recordRef: record.record_ref,
        sourceType: record.source_type,
        sourceId: record.source_id,
        suggestedOwner: detectSuggestedOwner(lower),
        priority: 'medium',
        status: 'suggested',
        dueDate: null,
        isExplicit: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return actions;
}

export function getActionCenterData(actions: ActionItem[]): ActionCenterData {
  return {
    actions,
    suggested: actions.filter(a => a.status === 'suggested').length,
    inProgress: actions.filter(a => a.status === 'in_progress').length,
    completed: actions.filter(a => a.status === 'completed').length,
    blocked: actions.filter(a => a.status === 'blocked').length,
    dismissed: actions.filter(a => a.status === 'dismissed').length,
    highPriority: actions.filter(a => a.priority === 'high' && a.status !== 'dismissed' && a.status !== 'completed').length,
  };
}

export function mergeActionStates(extracted: ActionItem[], persisted: Map<string, ActionItem>): ActionItem[] {
  // Start with extracted actions, then overlay any persisted user state
  return extracted.map(action => {
    const saved = persisted.get(action.id);
    if (saved) {
      // Keep extracted evidence/title but use saved status/dueDate/owner
      return { ...action, status: saved.status, dueDate: saved.dueDate ?? action.dueDate, updatedAt: saved.updatedAt };
    }
    return action;
  });
}
