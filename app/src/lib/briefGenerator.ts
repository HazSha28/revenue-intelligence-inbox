import type { AppRecord } from '../types/app';
import { ROUTE_LABELS } from '../types/app';
import type { CallPayload, MeetingPayload } from '../types/source';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';
import { getConversationDate } from './metrics';
import { detectAllRisks } from './riskEngine';
import { detectAllGaps } from './gapDetector';

export interface GeneratedBrief {
  generatedAt: string;
  recordCount: number;
  usableTexts: number;
  sections: BriefSection[];
  stats: {
    total: number;
    withTranscript: number;
    pendingReview: number;
    analysisStale: number;
    highRisks: number;
    openActions: number;
    gapsDetected: number;
    uniqueRoutes: number;
  };
}

export interface BriefSection {
  id: string;
  title: string;
  icon: string;
  items: BriefItem[];
}

export interface BriefItem {
  text: string;
  recordRef: string;
  sourceType: string;
  sourceId: string;
  evidenceRef: string;
  type: 'fact' | 'inferred' | 'action';
  label: string;
}

export function generateBrief(records: AppRecord[]): GeneratedBrief {
  const risks = detectAllRisks(records);
  const gaps = detectAllGaps(records);

  const sections: BriefSection[] = [];

  // ── Section 1: Top issues needing attention ──
  const issueItems: BriefItem[] = [];
  for (const r of risks.risks.filter(rk => rk.severity === 'high').slice(0, 5)) {
    issueItems.push({
      text: `${r.categoryLabel}: ${r.reason}`,
      recordRef: r.recordRef,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      evidenceRef: r.evidenceRef,
      type: r.isInferred ? 'inferred' : 'fact',
      label: r.isInferred ? 'Inferred' : 'Source fact',
    });
  }
  sections.push({ id: 'issues', title: 'Top Issues Needing Attention', icon: '⚠', items: issueItems });

  // ── Section 2: Important product feedback ──
  const feedbackItems: BriefItem[] = [];
  for (const r of records) {
    if (r.analysis.issues.length > 0 && (r.review_state === 'pending_review' || r.review_state === 'analysis_stale')) {
      for (const issue of r.analysis.issues.slice(0, 2)) {
        if (feedbackItems.length >= 5) break;
        feedbackItems.push({
          text: issue,
          recordRef: r.record_ref,
          sourceType: r.source_type,
          sourceId: r.source_id,
          evidenceRef: r.source_type === 'meeting' ? `[${r.record_ref}, turn 1+]` : `[${r.record_ref}]`,
          type: 'fact',
          label: 'Source fact',
        });
      }
    }
    if (feedbackItems.length >= 5) break;
  }
  sections.push({ id: 'feedback', title: 'Important Product Feedback', icon: '💬', items: feedbackItems });

  // ── Section 3: High-priority follow-ups ──
  const followupItems: BriefItem[] = [];
  for (const r of records) {
    for (const action of r.analysis.follow_up_actions.slice(0, 1)) {
      if (followupItems.length >= 5) break;
      followupItems.push({
        text: action,
        recordRef: r.record_ref,
        sourceType: r.source_type,
        sourceId: r.source_id,
        evidenceRef: r.source_type === 'meeting' ? `[${r.record_ref}, turn 1+]` : `[${r.record_ref}]`,
        type: 'action',
        label: 'Suggested action',
      });
    }
    if (followupItems.length >= 5) break;
  }
  sections.push({ id: 'followups', title: 'High-Priority Follow-ups', icon: '↗', items: followupItems });

  // ── Section 4: Integration and payment blockers ──
  const blockerItems: BriefItem[] = [];
  for (const r of risks.risks.filter(rk => rk.category === 'integration_blocker' || rk.category === 'payment_issue').slice(0, 4)) {
    blockerItems.push({
      text: `${r.categoryLabel}: ${r.reason}`,
      recordRef: r.recordRef,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      evidenceRef: r.evidenceRef,
      type: r.isInferred ? 'inferred' : 'fact',
      label: r.isInferred ? 'Inferred' : 'Source fact',
    });
  }
  sections.push({ id: 'blockers', title: 'Integration & Payment Blockers', icon: '🚫', items: blockerItems });

  // ── Section 5: Meetings requiring review ──
  const reviewItems: BriefItem[] = [];
  const meetingsNeedingReview = records
    .filter(r => r.source_type === 'meeting' && (r.review_state === 'pending_review' || r.review_state === 'analysis_stale'))
    .slice(0, 5);
  for (const r of meetingsNeedingReview) {
    reviewItems.push({
      text: `${r.record_ref} — ${(r.payload as MeetingPayload).title} (${r.review_state === 'analysis_stale' ? 'Analysis stale' : 'Pending review'})`,
      recordRef: r.record_ref,
      sourceType: r.source_type,
      sourceId: r.source_id,
      evidenceRef: `[${r.record_ref}]`,
      type: 'fact',
      label: r.review_state === 'analysis_stale' ? 'Stale' : 'Pending',
    });
  }
  sections.push({ id: 'review', title: 'Meetings Requiring Review', icon: '◎', items: reviewItems });

  // ── Section 6: Newly available transcript content ──
  const newItems: BriefItem[] = [];
  for (const r of records) {
    if (r.analysis.is_stale || r.review_state === 'analysis_stale') {
      const hasText = r.source_type === 'call'
        ? hasUsableCallTranscript(r.payload as CallPayload)
        : hasUsableMeetingTranscript(r.transcript_payload);
      if (hasText) {
        newItems.push({
          text: `${r.record_ref} — New transcript content available at revision ${r.applied_revision}. Analysis needs refreshing.`,
          recordRef: r.record_ref,
          sourceType: r.source_type,
          sourceId: r.source_id,
          evidenceRef: `[${r.record_ref}]`,
          type: 'fact',
          label: 'New content',
        });
      }
    }
  }
  sections.push({ id: 'new', title: 'Newly Available Transcript Content', icon: '✨', items: newItems });

  // ── Section 7: Suggested next steps ──
  const stepItems: BriefItem[] = [];
  for (const g of gaps.slice(0, 5)) {
    stepItems.push({
      text: g.suggestedAction,
      recordRef: g.recordRef,
      sourceType: g.sourceType,
      sourceId: g.sourceId,
      evidenceRef: g.evidenceRef,
      type: 'action',
      label: g.isNotEvidenced ? 'Not evidenced' : 'Suggested',
    });
  }
  sections.push({ id: 'steps', title: 'Suggested Next Steps', icon: '→', items: stepItems });

  // Stats
  const withTranscript = records.filter(r =>
    r.source_type === 'call'
      ? hasUsableCallTranscript(r.payload as CallPayload)
      : hasUsableMeetingTranscript(r.transcript_payload)
  ).length;
  const openActions = records.reduce((s, r) => s + r.analysis.follow_up_actions.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    usableTexts: withTranscript,
    sections,
    stats: {
      total: records.length,
      withTranscript,
      pendingReview: records.filter(r => r.review_state === 'pending_review').length,
      analysisStale: records.filter(r => r.review_state === 'analysis_stale').length,
      highRisks: risks.highCount,
      openActions,
      gapsDetected: gaps.length,
      uniqueRoutes: new Set(records.map(r => r.effective_route)).size,
    },
  };
}

export function briefToText(brief: GeneratedBrief): string {
  const lines: string[] = [];
  lines.push('REVENUE INTELLIGENCE — MANAGER BRIEF');
  lines.push(`Generated: ${new Date(brief.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`);
  lines.push(`Records: ${brief.recordCount} · Usable texts: ${brief.usableTexts} · High risks: ${brief.stats.highRisks} · Gaps: ${brief.stats.gapsDetected}`);
  lines.push('');
  lines.push('Note: Selected sample — not representative of whole-team performance.');
  lines.push('Facts are from transcript text. Inferred items are labelled. No revenue figures invented.');
  lines.push('');

  for (const section of brief.sections) {
    if (section.items.length === 0) continue;
    lines.push(`## ${section.title.toUpperCase()}`);
    for (const item of section.items) {
      lines.push(`  ${item.label}: ${item.text} [${item.recordRef}] ${item.evidenceRef}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function briefToMarkdown(brief: GeneratedBrief): string {
  const lines: string[] = [];
  lines.push('# Revenue Intelligence — Manager Brief');
  lines.push('');
  lines.push(`**Generated:** ${new Date(brief.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`);
  lines.push(`**Records:** ${brief.recordCount} · **Usable texts:** ${brief.usableTexts} · **High risks:** ${brief.stats.highRisks} · **Gaps:** ${brief.stats.gapsDetected}`);
  lines.push('');
  lines.push('> Selected sample — not representative of whole-team performance. Facts from transcript text. Inferred items labelled. No revenue figures invented.');
  lines.push('');

  for (const section of brief.sections) {
    if (section.items.length === 0) continue;
    lines.push(`## ${section.icon} ${section.title}`);
    lines.push('');
    for (const item of section.items) {
      lines.push(`- **[${item.label}]** ${item.text} — \`${item.recordRef}\` ${item.evidenceRef}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
