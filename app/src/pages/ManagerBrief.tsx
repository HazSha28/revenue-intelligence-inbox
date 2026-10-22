import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppRecord } from '../types/app';
import { generateBrief, briefToText, briefToMarkdown } from '../lib/briefGenerator';
import { downloadBlob } from '../lib/export';
import RouteBadge from '../components/RouteBadge';

interface ManagerBriefProps { records: AppRecord[] }

const TYPE_BADGE: Record<string, { label: string; classes: string }> = {
  fact:     { label: 'Source fact', classes: 'bg-green-50 text-green-600 border-green-100' },
  inferred: { label: 'Inferred',   classes: 'bg-purple-50 text-purple-500 border-purple-100' },
  action:   { label: 'Action',     classes: 'bg-blue-50 text-blue-600 border-blue-100' },
};

export default function ManagerBrief({ records }: ManagerBriefProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const brief = useMemo(() => generateBrief(records), [records]);

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <div className="text-5xl">📋</div>
        <p className="text-sm text-gray-400">Import data first to generate the brief.</p>
      </div>
    );
  }

  const handleCopy = () => {
    const text = briefToText(brief);
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleDownloadMarkdown = () => {
    downloadBlob(briefToMarkdown(brief), 'manager_brief.md', 'text/markdown');
  };

  const handleDownloadText = () => {
    downloadBlob(briefToText(brief), 'manager_brief.txt', 'text/plain');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header with actions */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📋</span> Manager Brief
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Daily summary · Aug 21 2026 · {records.length} selected source records ·{' '}
            <em>Facts from transcript text. Inferred items labelled.</em>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            {copied
              ? <><svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Copied</>
              : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>Copy</>
            }
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            .md
          </button>
          <button
            onClick={handleDownloadText}
            className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            .txt
          </button>
        </div>
      </div>

      <DisclaimerBanner />

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
        {[
          { label: 'Records', value: brief.stats.total },
          { label: 'With text', value: brief.stats.withTranscript },
          { label: 'Pending', value: brief.stats.pendingReview },
          { label: 'Stale', value: brief.stats.analysisStale },
          { label: 'High risks', value: brief.stats.highRisks },
          { label: 'Actions', value: brief.stats.openActions },
          { label: 'Gaps', value: brief.stats.gapsDetected },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-800">{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sections */}
      {brief.sections.map(section => {
        if (section.items.length === 0) return null;
        return (
          <div key={section.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <span className="text-base">{section.icon}</span> {section.title}
              <span className="ml-auto text-[10px] text-gray-300 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                {section.items.length}
              </span>
            </h2>
            <div className="space-y-2">
              {section.items.map((item, i) => {
                const badge = TYPE_BADGE[item.type] ?? TYPE_BADGE.fact;
                return (
                  <div key={i} className="py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-start gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${badge.classes}`}>
                        {item.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-relaxed">{item.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => navigate(`/inbox/${item.sourceType}/${item.sourceId}`)}
                            className="text-xs text-brand-600 hover:underline font-mono font-semibold"
                          >
                            {item.recordRef} →
                          </button>
                          <code className="text-[10px] text-indigo-400 font-mono">{item.evidenceRef}</code>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
      <strong>Note:</strong> This brief is derived from a selected sample of records (21 Aug 2026, Asia/Kolkata).
      Metrics are not representative of whole-team performance. Analysis is deterministic from transcript text —
      inferred suggestions are labelled. Revenue figures, deal values, and conversion rates are not present in the source data and are not stated here.
    </div>
  );
}
