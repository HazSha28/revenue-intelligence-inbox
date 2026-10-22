import type { AppRecord } from '../types/app';
import type { CallPayload, MeetingPayload, TranscriptTurn } from '../types/source';
import type { FollowUpGap } from '../types/features';
import { meetingEvidenceRef, callEvidenceRef } from '../lib/evidence';
import { getConversationDate, formatDateIST } from '../lib/metrics';

interface ConversationTimelineProps {
  record: AppRecord;
  gaps: FollowUpGap[];
}

interface TimelineEvent {
  time: string;
  label: string;
  icon: string;
  description: string;
  evidenceRef: string;
  type: 'date' | 'topic' | 'concern' | 'commitment' | 'question' | 'issue' | 'gap' | 'revision';
  highlight?: boolean;
}

function buildTimeline(record: AppRecord, gaps: FollowUpGap[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Date event
  const date = getConversationDate(record);
  events.push({
    time: formatDateIST(date),
    label: 'Conversation date',
    icon: '📅',
    description: `${record.source_type === 'call' ? 'Call started' : 'Meeting started'} · Asia/Kolkata`,
    evidenceRef: `[${record.record_ref}]`,
    type: 'date',
  });

  // Revision event
  events.push({
    time: `Rev ${record.applied_revision}`,
    label: 'Applied revision',
    icon: '📦',
    description: record.analysis.is_stale
      ? `Revision ${record.applied_revision} applied. Analysis is stale — transcript changed since last analysis.`
      : `Revision ${record.applied_revision} applied. Analysis is current.`,
    evidenceRef: `[${record.record_ref}]`,
    type: 'revision',
    highlight: record.analysis.is_stale,
  });

  // Key topics
  for (const topic of record.analysis.key_topics.slice(0, 4)) {
    const ev = getEvidenceForKeyword(record, topic.toLowerCase().split(' ')[0]);
    events.push({
      time: 'Topic',
      label: topic,
      icon: '💬',
      description: `Key discussion point: ${topic}`,
      evidenceRef: ev,
      type: 'topic',
    });
  }

  // Issues / concerns
  for (const issue of record.analysis.issues.slice(0, 3)) {
    const ev = getEvidenceForKeyword(record, issue.toLowerCase().split(' ')[0]);
    events.push({
      time: 'Concern',
      label: issue,
      icon: '⚠️',
      description: `Customer concern: ${issue}`,
      evidenceRef: ev,
      type: 'issue',
      highlight: true,
    });
  }

  // Follow-up commitments
  for (const action of record.analysis.follow_up_actions.slice(0, 3)) {
    const ev = getEvidenceForKeyword(record, action.toLowerCase().split(' ')[0]);
    events.push({
      time: 'Action',
      label: action,
      icon: '↗',
      description: `Follow-up action: ${action}`,
      evidenceRef: ev,
      type: 'commitment',
    });
  }

  // Gaps
  for (const gap of gaps.slice(0, 3)) {
    events.push({
      time: 'Gap',
      label: gap.gapLabel,
      icon: '🔍',
      description: gap.description,
      evidenceRef: gap.evidenceRef,
      type: 'gap',
      highlight: true,
    });
  }

  return events;
}

function getEvidenceForKeyword(record: AppRecord, keyword: string): string {
  if (record.source_type === 'call') {
    const transcript = (record.payload as CallPayload).transcript ?? '';
    const lower = transcript.toLowerCase();
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx >= 0) {
      const snippet = transcript.slice(Math.max(0, idx - 10), idx + keyword.length + 60).trim();
      return callEvidenceRef(record.record_ref, record.source_id, snippet).display;
    }
    return `[${record.record_ref}]`;
  }
  const tp = record.transcript_payload;
  if (!tp) return `[${record.record_ref}]`;
  for (let i = 0; i < tp.turns.length; i++) {
    if (tp.turns[i].text.toLowerCase().includes(keyword.toLowerCase())) {
      return meetingEvidenceRef(record.record_ref, record.source_id, i + 1).display;
    }
  }
  return `[${record.record_ref}]`;
}

const TYPE_STYLES = {
  date:        'border-brand-200 bg-brand-50',
  topic:       'border-blue-100 bg-blue-50/50',
  concern:     'border-amber-100 bg-amber-50/50',
  issue:       'border-red-100 bg-red-50/50',
  commitment:  'border-emerald-100 bg-emerald-50/50',
  question:    'border-purple-100 bg-purple-50/50',
  gap:         'border-orange-100 bg-orange-50/50',
  revision:    'border-gray-100 bg-gray-50/50',
};

export default function ConversationTimeline({ record, gaps }: ConversationTimelineProps) {
  const events = buildTimeline(record, gaps);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m-9-3h8.5" />
        </svg>
        Conversation Intelligence Timeline
      </h2>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />

        <div className="space-y-3">
          {events.map((event, i) => (
            <div key={i} className="relative pl-10">
              {/* Timeline dot */}
              <div className={`absolute left-2.5 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[8px] ${
                event.highlight ? 'bg-red-400' : event.type === 'date' ? 'bg-brand-500' : event.type === 'topic' ? 'bg-blue-400' : event.type === 'commitment' ? 'bg-emerald-400' : event.type === 'revision' ? 'bg-gray-400' : 'bg-amber-400'
              }`}>
                <span className="text-white text-[7px]">{event.icon}</span>
              </div>

              {/* Event card */}
              <div className={`rounded-lg border p-3 ${TYPE_STYLES[event.type]} ${event.highlight ? 'ring-1 ring-red-200' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700">{event.label}</span>
                  <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">{event.time}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{event.description}</p>
                <code className="text-[10px] text-indigo-400 font-mono mt-1 block">{event.evidenceRef}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
