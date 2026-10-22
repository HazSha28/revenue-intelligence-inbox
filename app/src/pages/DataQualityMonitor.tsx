import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Cell
} from 'recharts';
import type { AppRecord, ImportLogEntry } from '../types/app';
import { computeDataQuality } from '../lib/dataQuality';
import MetricCard from '../components/MetricCard';

interface DataQualityMonitorProps {
  records: AppRecord[];
  importLog: ImportLogEntry[];
}

export default function DataQualityMonitor({ records, importLog }: DataQualityMonitorProps) {
  const report = useMemo(() => computeDataQuality(records, importLog), [records, importLog]);

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <div className="text-5xl">📊</div>
        <p className="text-sm text-gray-400">Import data to see the quality report.</p>
      </div>
    );
  }

  const qualityColor = report.qualityScore >= 80 ? '#10b981' : report.qualityScore >= 60 ? '#f59e0b' : '#ef4444';
  const qualityLabel = report.qualityScore >= 80 ? 'Good' : report.qualityScore >= 60 ? 'Fair' : 'Needs attention';

  const radialData = [{ name: 'Quality', value: report.qualityScore, fill: qualityColor }];

  const revisionData = report.revisionsApplied.map(r => ({ revision: `Rev ${r.revision}`, count: r.count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">📊</span> Data Quality Monitor
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          All figures calculated from current application state. Selected sample — not representative of overall sales performance.
        </p>
      </div>

      {/* Quality score + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Quality score gauge */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col items-center justify-center">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 self-start">Quality Score</h2>
          <ResponsiveContainer width="100%" height={140}>
            <RadialBarChart innerRadius="65%" outerRadius="90%" data={radialData} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={10}>
                <Cell fill={qualityColor} />
              </RadialBar>
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold" fill={qualityColor}>
                {report.qualityScore}
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
          <span className="text-sm font-medium" style={{ color: qualityColor }}>{qualityLabel}</span>
        </div>

        {/* Stats grid */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard label="With Transcript" value={report.recordsWithTranscript} sub={`of ${report.totalRecords} records`} accent="text-green-600" accentBar="bg-green-500" />
          <MetricCard label="Without Transcript" value={report.recordsWithoutTranscript} sub={`${report.recordsWithNullTranscript} null · ${report.recordsWithBlankTranscript} blank`} accent="text-gray-500" accentBar="bg-gray-400" />
          <MetricCard label="Unknown Connection" value={report.unknownConnectionCount} sub="calls with is_connected=null" accent="text-gray-500" accentBar="bg-gray-300" />
          <MetricCard label="Pending Review" value={report.pendingReviewCount} sub="awaiting manager review" accent="text-amber-600" accentBar="bg-amber-400" />
          <MetricCard label="Analysis Stale" value={report.analysisStaleCount} sub="transcript changed, analysis not refreshed" accent="text-red-500" accentBar="bg-red-500" />
          <MetricCard label="Reviewed" value={report.reviewedCount} sub="manager reviewed" accent="text-green-600" accentBar="bg-green-400" />
          <MetricCard label="Missing Evidence" value={report.recordsWithMissingEvidence} sub="no analysis summary or topics" accent="text-orange-500" accentBar="bg-orange-400" />
          <MetricCard label="Unresolved Processing" value={report.recordsWithUnresolvedProcessing} sub="classification_status not 'stored'" accent="text-gray-500" accentBar="bg-gray-300" />
          <MetricCard label="Duplicates Ignored" value={report.duplicateImportsIgnored} sub="across all imports" accent="text-blue-500" accentBar="bg-blue-400" />
        </div>
      </div>

      {/* Revisions chart */}
      {revisionData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Records by Applied Revision</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revisionData}>
              <XAxis dataKey="revision" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} records`, '']} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quality notes */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quality Notes</h2>
        <ul className="space-y-1.5">
          {report.qualityNotes.map((note, i) => (
            <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
              <span className="text-gray-300 mt-0.5">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
        This is a selected sample of {report.totalRecords} interaction records from 21 August 2026. Counts are labelled as selected records, not whole-team or representative performance.
        Metrics use accurate denominators: connection rate denominator excludes null values; transcript coverage uses usable-text / total-records.
      </div>
    </div>
  );
}
