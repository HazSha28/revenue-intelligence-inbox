import type { AppRecord } from '../types/app';
import type { CallPayload, MeetingPayload } from '../types/source';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from '../lib/routing';
import { formatDateIST, getConversationDate } from '../lib/metrics';

interface DataStatusProps { records: AppRecord[] }

export default function DataStatus({ records }: DataStatusProps) {
  const revCounts = new Map<number, number>();
  for (const r of records) {
    revCounts.set(r.applied_revision, (revCounts.get(r.applied_revision) ?? 0) + 1);
  }

  const calls = records.filter(r => r.source_type === 'call');
  const meetings = records.filter(r => r.source_type === 'meeting');
  const usableCalls = calls.filter(r => hasUsableCallTranscript(r.payload as CallPayload));
  const usableMeetings = meetings.filter(r => hasUsableMeetingTranscript(r.transcript_payload));
  const manualOverrides = records.filter(r => r.manual_override);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Data Status</h1>
        <p className="text-sm text-gray-400 mt-0.5">Current state of imported source records and derived data.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat label="Unique records" value={records.length} note="(source_type, source_id)" />
        <Stat label="Calls" value={calls.length} />
        <Stat label="Meetings" value={meetings.length} />
        <Stat label="Usable call transcripts" value={usableCalls.length} note={`of ${calls.length}`} />
        <Stat label="Usable meeting transcripts" value={usableMeetings.length} note={`of ${meetings.length}`} />
        <Stat label="Manual route overrides" value={manualOverrides.length} />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Applied Revisions</h2>
        <div className="flex flex-wrap gap-3">
          {Array.from(revCounts.entries()).sort().map(([rev, count]) => (
            <div key={rev} className="bg-gray-50 rounded-lg px-4 py-2 text-sm">
              <span className="font-bold text-gray-800">r{rev}</span>
              <span className="text-gray-400 ml-2">{count} records</span>
            </div>
          ))}
          {revCounts.size === 0 && <span className="text-sm text-gray-400">No data imported.</span>}
        </div>
      </div>

      {manualOverrides.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Manual Route Overrides ({manualOverrides.length})</h2>
          <div className="space-y-2">
            {manualOverrides.map(r => (
              <div key={`${r.source_type}::${r.source_id}`} className="flex items-center gap-3 text-xs">
                <span className="font-mono font-semibold text-brand-600 w-10">{r.record_ref}</span>
                <span className="text-gray-500">{r.source_type}</span>
                <span className="text-gray-400">suggested: {r.suggested_route}</span>
                <span className="font-medium text-amber-700">→ effective: {r.effective_route}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">All Records ({records.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Ref</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Source ID</th>
                  <th className="px-3 py-2 text-left">Date (IST)</th>
                  <th className="px-3 py-2 text-left">Rev</th>
                  <th className="px-3 py-2 text-left">Route</th>
                  <th className="px-3 py-2 text-left">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records
                  .slice()
                  .sort((a, b) => a.record_ref.localeCompare(b.record_ref))
                  .map(r => {
                    const hasTx = r.source_type === 'call'
                      ? hasUsableCallTranscript(r.payload as CallPayload)
                      : hasUsableMeetingTranscript(r.transcript_payload);
                    return (
                      <tr key={`${r.source_type}::${r.source_id}`}>
                        <td className="px-3 py-1.5 font-mono font-semibold text-brand-600">{r.record_ref}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.source_type}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-300 text-xs">{r.source_id.slice(0, 12)}…</td>
                        <td className="px-3 py-1.5 text-gray-500">{formatDateIST(getConversationDate(r))}</td>
                        <td className="px-3 py-1.5 text-gray-400">r{r.applied_revision}</td>
                        <td className="px-3 py-1.5 text-gray-600">{r.effective_route}</td>
                        <td className="px-3 py-1.5 text-center">{hasTx ? '✓' : '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs font-medium text-gray-600 mt-1">{label}</div>
      {note && <div className="text-xs text-gray-400 mt-0.5">{note}</div>}
    </div>
  );
}
