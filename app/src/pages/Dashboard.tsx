import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import type { AppRecord } from '../types/app';
import { computeMetrics, formatConnectionRate } from '../lib/metrics';
import MetricCard from '../components/MetricCard';

interface DashboardProps { records: AppRecord[] }

export default function Dashboard({ records }: DashboardProps) {
  const m = useMemo(() => computeMetrics(records), [records]);

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
        <div className="text-5xl">📥</div>
        <h2 className="text-xl font-semibold text-gray-700">No data imported yet</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          Go to <strong>Imports & Replay</strong> and click "Import initial delivery" to load the dataset.
        </p>
      </div>
    );
  }

  const connectionRate = formatConnectionRate(m.connectedCalls, m.totalCallsWithKnownConnection);
  const transcriptPct = m.totalRecords > 0
    ? `${((m.usableTranscriptCount / m.totalRecords) * 100).toFixed(0)}% coverage`
    : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Selected sample — Aug 21 2026 · Asia/Kolkata · {m.totalRecords} unique source records. Not representative of whole-team performance.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Records" value={m.totalRecords} sub="unique (source_type, source_id)" />
        <MetricCard label="Calls" value={m.callCount} accent="text-blue-600" />
        <MetricCard label="Meetings" value={m.meetingCount} accent="text-purple-600" />
        <MetricCard
          label="Usable Transcripts"
          value={m.usableTranscriptCount}
          sub={transcriptPct}
          accent="text-emerald-600"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Connected Calls"
          value={m.connectedCalls}
          sub={`${connectionRate} of calls with known status (source-reported)`}
          accent="text-green-600"
        />
        <MetricCard
          label="Not Connected"
          value={m.notConnectedCalls}
          sub="source-reported is_connected=false"
          accent="text-red-500"
        />
        <MetricCard
          label="Unknown Connection"
          value={m.unknownConnectionCalls}
          sub="is_connected=null"
          accent="text-gray-500"
        />
        <MetricCard
          label="Pending Review"
          value={m.pendingReviewCount}
          sub={`${m.reviewedCount} reviewed · ${m.analysisStalCount} stale`}
          accent="text-amber-600"
        />
      </div>

      {/* Transcript breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Transcript Coverage</h2>
        <p className="text-xs text-gray-400 mb-3">
          Calls with usable transcript: {m.usableCallTranscripts} / {m.callCount} · Meetings with usable turns: {m.usableMeetingTranscripts} / {m.meetingCount}
        </p>
        <div className="flex flex-wrap gap-3">
          {m.transcriptStatusBreakdown.map(row => (
            <div key={row.status} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
              <span className="font-medium text-gray-700">{row.count}</span>
              <span className="text-gray-400 ml-1">{row.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Records by route */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Records by Route</h2>
          <p className="text-xs text-gray-400 mb-3">
            Route assignments ({m.recordsByRoute.reduce((s, r) => s + r.count, 0)}) may exceed unique records ({m.totalRecords}) when multi-route is assigned.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={m.recordsByRoute} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v} records`, '']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {m.recordsByRoute.map(entry => (
                  <Cell key={entry.route} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Source type pie */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">By Type</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={m.recordsByType}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="45%"
                outerRadius={70}
                label={({ type, count }) => `${type}: ${count}`}
                labelLine={false}
              >
                <Cell fill="#3b82f6" />
                <Cell fill="#8b5cf6" />
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Processing status */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Processing Status Breakdown</h2>
        <div className="flex flex-wrap gap-3">
          {m.processingStatusBreakdown.map(row => (
            <div key={row.status} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
              <span className="font-medium text-gray-700">{row.count}</span>
              <span className="text-gray-400 ml-1">{row.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
