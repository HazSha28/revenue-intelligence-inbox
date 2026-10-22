import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { AppRecord, RouteKey, ReviewState } from '../types/app';
import type { CallPayload, MeetingPayload } from '../types/source';
import { formatDateIST, getConversationDate } from '../lib/metrics';
import TranscriptViewer from '../components/TranscriptViewer';
import ReviewBadge from '../components/ReviewBadge';
import RouteBadge from '../components/RouteBadge';
import ExplainableRouting from '../components/ExplainableRouting';
import ConversationTimeline from '../components/ConversationTimeline';
import { detectAllGaps } from '../lib/gapDetector';

interface RecordDetailProps {
  records: AppRecord[];
  onOverrideRoute: (sourceType: string, sourceId: string, route: RouteKey) => void;
  onClearOverride: (sourceType: string, sourceId: string) => void;
  onSetReviewState: (sourceType: string, sourceId: string, state: ReviewState) => void;
}

export default function RecordDetail({
  records, onOverrideRoute, onClearOverride, onSetReviewState
}: RecordDetailProps) {
  const { sourceType, sourceId } = useParams<{ sourceType: string; sourceId: string }>();
  const navigate = useNavigate();

  const record = records.find(r => r.source_type === sourceType && r.source_id === sourceId);

  // Detect gaps for this record
  const recordGaps = useMemo(() => {
    if (!record) return [];
    const allGaps = detectAllGaps([record]);
    return allGaps;
  }, [record]);

  if (!record) {
    return (
      <div className="py-24 text-center">
        <p className="text-gray-400">Record not found.</p>
        <button onClick={() => navigate('/inbox')} className="mt-4 text-sm text-brand-600 underline">
          Back to inbox
        </button>
      </div>
    );
  }

  const isCall = record.source_type === 'call';
  const payload = record.payload;
  const convDate = formatDateIST(getConversationDate(record));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button
            onClick={() => navigate('/inbox')}
            className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
          >
            ← Back to Inbox
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="font-mono text-brand-600">{record.record_ref}</span>
            {isCall
              ? (payload as CallPayload).rep_name ?? 'Call'
              : (payload as MeetingPayload).title}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {record.source_type} · {convDate} (IST) · revision {record.applied_revision} ·{' '}
            <span className="font-mono text-xs">{record.source_id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ReviewBadge state={record.review_state} />
          <RouteBadge route={record.effective_route} isOverride={record.manual_override} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left: metadata + explainable routing */}
        <div className="space-y-4">
          <MetadataPanel record={record} />

          {/* Explainable Smart Routing */}
          <ExplainableRouting
            record={record}
            onOverride={(route: RouteKey) => onOverrideRoute(record.source_type, record.source_id, route)}
            onClearOverride={() => onClearOverride(record.source_type, record.source_id)}
          />

          {/* Review controls */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review State</h2>
            <ReviewBadge state={record.review_state} />
            <div className="flex gap-2 mt-2 flex-wrap">
              {(['pending_review', 'reviewed', 'analysis_stale'] as ReviewState[]).map(s => (
                <button
                  key={s}
                  disabled={record.review_state === s}
                  onClick={() => onSetReviewState(record.source_type, record.source_id, s)}
                  className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
                >
                  {s === 'pending_review' ? 'Mark pending' : s === 'reviewed' ? 'Mark reviewed' : 'Mark stale'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: timeline + analysis + transcript + gaps */}
        <div className="md:col-span-2 space-y-4">
          <ConversationTimeline record={record} gaps={recordGaps} />
          <AnalysisPanel record={record} />

          {/* Follow-up Gap Detector */}
          {recordGaps.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <span className="text-base">🔍</span> Follow-up Gap Detector
                <span className="bg-orange-50 text-orange-600 border border-orange-100 text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto">
                  {recordGaps.length} gap{recordGaps.length !== 1 ? 's' : ''}
                </span>
              </h2>
              {recordGaps.map((gap, i) => (
                <div key={i} className="bg-orange-50/50 border border-orange-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-orange-700">{gap.gapLabel}</span>
                    {gap.isNotEvidenced && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">
                        Not evidenced in dataset
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{gap.description}</p>
                  <div className="mt-1.5 bg-gray-50 rounded p-2 border-l-2 border-gray-300">
                    <p className="text-xs text-gray-500 italic">"{gap.evidence}"</p>
                    <code className="text-[10px] text-indigo-400 font-mono mt-0.5 block">{gap.evidenceRef}</code>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[10px] text-gray-400">Suggested:</span>
                    <span className="text-xs text-gray-600 font-medium">{gap.suggestedAction}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
            <TranscriptViewer record={record} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetadataPanel({ record }: { record: AppRecord }) {
  const isCall = record.source_type === 'call';
  const p = record.payload;

  const fields: { label: string; value: string | number | boolean | null }[] = isCall
    ? [
        { label: 'Direction', value: (p as CallPayload).direction },
        { label: 'Rep', value: (p as CallPayload).rep_name },
        { label: 'Rep email', value: (p as CallPayload).rep_email },
        { label: 'Duration (s)', value: (p as CallPayload).duration_seconds },
        { label: 'Is connected', value: String((p as CallPayload).is_connected) },
        { label: 'Is conversation', value: String((p as CallPayload).is_conversation) },
        { label: 'Outcome', value: (p as CallPayload).observed_outcome },
        { label: 'Campaign call', value: String((p as CallPayload).is_campaign_call) },
        { label: 'Prior dials', value: (p as CallPayload).prior_dials_ever },
        { label: 'Classification', value: (p as CallPayload).classification_status },
      ]
    : [
        { label: 'Title', value: (p as MeetingPayload).title },
        { label: 'Organiser', value: (p as MeetingPayload).organizer_email },
        { label: 'Provider', value: (p as MeetingPayload).provider },
        { label: 'Attendees', value: (p as MeetingPayload).attendee_count },
        { label: 'Recording', value: (p as MeetingPayload).recording_status },
        { label: 'Has transcript', value: String((p as MeetingPayload).has_transcript) },
        { label: 'Duration (s)', value: (p as MeetingPayload).duration_seconds },
        { label: 'Redacted', value: String((p as MeetingPayload).redacted) },
      ];

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Source Metadata</h2>
      <dl className="space-y-2">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex gap-2 text-xs">
            <dt className="text-gray-400 w-28 flex-shrink-0">{label}</dt>
            <dd className="text-gray-700 break-all">{value === null || value === undefined ? <span className="text-gray-300 italic">null</span> : String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AnalysisPanel({ record }: { record: AppRecord }) {
  const a = record.analysis;
  const freshness = a.is_stale || record.review_state === 'analysis_stale' ? 'stale' : 'current';

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Analysis</h2>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${freshness === 'current' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
            {freshness === 'current' ? 'Current' : 'Stale — revision ' + a.analysis_revision}
          </span>
          {a.generated_at && (
            <span className="text-xs text-gray-300">{new Date(a.generated_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
          )}
        </div>
      </div>

      {a.summary ? (
        <p className="text-sm text-gray-700 leading-relaxed">{a.summary}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">Pending review — no analysis generated.</p>
      )}

      {a.key_topics.length > 0 && (
        <Section label="Key Topics">
          <ul className="flex flex-wrap gap-1.5">
            {a.key_topics.map(t => <li key={t} className="bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5 text-xs">{t}</li>)}
          </ul>
        </Section>
      )}

      {a.issues.length > 0 && (
        <Section label="Issues">
          <BulletList items={a.issues} color="text-red-700" />
        </Section>
      )}

      {a.risks.length > 0 && (
        <Section label="Risks">
          <BulletList items={a.risks} color="text-amber-700" />
        </Section>
      )}

      {a.follow_up_actions.length > 0 && (
        <Section label="Follow-up Actions">
          <BulletList items={a.follow_up_actions} color="text-emerald-700" />
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="space-y-0.5">
      {items.map(item => (
        <li key={item} className={`text-xs flex gap-1.5 ${color}`}>
          <span>•</span><span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
