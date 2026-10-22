import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip
} from 'recharts';
import type { AppRecord } from '../types/app';
import type { RiskSeverity, RiskCategory } from '../types/features';
import { detectAllRisks } from '../lib/riskEngine';
import MetricCard from '../components/MetricCard';

interface RiskRadarProps { records: AppRecord[] }

const SEVERITY_STYLES: Record<RiskSeverity, { label: string; classes: string; dot: string; bar: string }> = {
  high:   { label: 'High',   classes: 'bg-red-50 text-red-700 border-red-200',     dot: 'bg-red-500',    bar: 'bg-red-500' },
  medium: { label: 'Medium', classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-500' },
  low:    { label: 'Low',    classes: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-500',  bar: 'bg-blue-400' },
};

const CATEGORY_ICONS: Record<RiskCategory, string> = {
  unresolved_problem: '🔧',
  payment_issue: '💳',
  integration_blocker: '🔌',
  unanswered_question: '❓',
  uncertain_commitment: '⚖️',
  pending_followup: '⏳',
  customer_dissatisfaction: '⚠️',
};

export default function RiskRadar({ records }: RiskRadarProps) {
  const navigate = useNavigate();
  const [severityFilter, setSeverityFilter] = useState<'all' | RiskSeverity>('all');

  const data = useMemo(() => detectAllRisks(records), [records]);

  if (records.length === 0) {
    return <EmptyState message="Import data to activate the Revenue Risk Radar." />;
  }

  const filtered = severityFilter === 'all'
    ? data.risks
    : data.risks.filter(r => r.severity === severityFilter);

  const radarData = data.byCategory.map(c => ({ category: c.label.split(' ')[0], count: c.count, fullMark: 10 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">🛰️</span> Revenue Risk Radar
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Evidence-backed risk signals from {records.length} records. Inferred risks are labelled. No revenue losses or probabilities invented.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Risks" value={data.totalRisks} accentBar="bg-gray-400" />
        <MetricCard label="High Severity" value={data.highCount} accent="text-red-600" accentBar="bg-red-500" />
        <MetricCard label="Medium" value={data.mediumCount} accent="text-amber-600" accentBar="bg-amber-500" />
        <MetricCard label="Low" value={data.lowCount} accent="text-blue-600" accentBar="bg-blue-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Radar chart */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Risk Distribution by Category</h2>
          {data.totalRisks > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <PolarRadiusAxis tick={{ fontSize: 9 }} angle={90} domain={[0, 'dataMax']} />
                <Radar dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                <Tooltip formatter={(v: number) => [`${v} risk(s)`, '']} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-gray-400">No risks detected.</div>
          )}
        </div>

        {/* Risk list */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'high', 'medium', 'low'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSeverityFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  severityFilter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? `All (${data.totalRisks})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${f === 'high' ? data.highCount : f === 'medium' ? data.mediumCount : data.lowCount})`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400">
              No risks match this filter.
            </div>
          ) : (
            filtered.slice(0, 20).map((risk, i) => {
              const sev = SEVERITY_STYLES[risk.severity];
              return (
                <div
                  key={i}
                  className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{CATEGORY_ICONS[risk.category]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-800">{risk.categoryLabel}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sev.classes}`}>
                          {sev.label}
                        </span>
                        {risk.isInferred && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 font-medium">
                            Inferred
                          </span>
                        )}
                        {risk.isStale && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100 font-medium">
                            Stale analysis
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{risk.reason}</p>
                      <div className="mt-2 bg-gray-50 rounded-lg p-2.5 border-l-2 border-gray-300">
                        <p className="text-xs text-gray-500 italic">"{risk.evidence}"</p>
                        <code className="text-[10px] text-indigo-500 font-mono mt-1 block">{risk.evidenceRef}</code>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400">Next action:</span>
                        <span className="text-xs text-gray-600 font-medium">{risk.suggestedAction}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => navigate(`/inbox/${risk.sourceType}/${risk.sourceId}`)}
                          className="text-xs text-brand-600 underline hover:text-brand-700"
                        >
                          View {risk.recordRef} →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <div className="text-5xl">🛰️</div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
