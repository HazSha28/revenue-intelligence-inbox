import { useState } from 'react';
import type { AppRecord } from '../types/app';
import { buildManifest, manifestToCSV, buildRecordOutput, downloadBlob } from '../lib/export';

interface ExportsProps { records: AppRecord[] }

export default function Exports({ records }: ExportsProps) {
  const [lastManifest, setLastManifest] = useState<ReturnType<typeof buildManifest> | null>(null);

  if (records.length === 0) {
    return <div className="py-24 text-center text-gray-400">Import data first before exporting.</div>;
  }

  const handleExportJSON = () => {
    const manifest = buildManifest(records);
    setLastManifest(manifest);
    downloadBlob(JSON.stringify(manifest, null, 2), 'manifest.json', 'application/json');
  };

  const handleExportCSV = () => {
    const manifest = buildManifest(records);
    setLastManifest(manifest);
    downloadBlob(manifestToCSV(manifest), 'manifest.csv', 'text/csv');
  };

  const handleExportAllRecords = () => {
    const manifest = buildManifest(records);
    setLastManifest(manifest);
    // Download each record output as a zip isn't trivially available without extra deps.
    // Instead: download manifest + a combined records JSON.
    const outputs = Object.fromEntries(
      records.map(r => [`outputs/${r.source_type === 'call' ? 'calls' : 'meetings'}/${r.record_ref}.json`, buildRecordOutput(r)])
    );
    const bundle = { manifest, outputs };
    downloadBlob(JSON.stringify(bundle, null, 2), 'revenue_intelligence_export.json', 'application/json');
  };

  const manifest = lastManifest ?? buildManifest(records);

  // Verify: every active output path in manifest has a corresponding record
  const recordRefs = new Set(records.map(r => r.record_ref));
  const orphanedPaths = manifest.records.flatMap(mr =>
    mr.output_paths.filter(p => {
      const ref = p.split('/').pop()?.replace('.json', '');
      return ref && !recordRefs.has(ref);
    })
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Exports</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Export current application state — {records.length} records. Repeated exports are idempotent.
        </p>
      </div>

      {/* Export actions */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Export Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportJSON}
            className="px-5 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Download manifest.json
          </button>
          <button
            onClick={handleExportCSV}
            className="px-5 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Download manifest.csv
          </button>
          <button
            onClick={handleExportAllRecords}
            className="px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Download full export bundle
          </button>
        </div>
        {orphanedPaths.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
            Warning: {orphanedPaths.length} output path(s) have no matching record. This should not occur in normal usage.
          </div>
        )}
      </div>

      {/* Manifest preview */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Manifest Preview</h2>
          <span className="text-xs text-gray-400">{manifest.total_records} records · {new Date(manifest.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
        </div>
        <p className="text-xs text-gray-400 italic">{manifest.note}</p>

        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Ref</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Rev</th>
                <th className="px-3 py-2 text-left font-medium">Effective Route</th>
                <th className="px-3 py-2 text-left font-medium">Override</th>
                <th className="px-3 py-2 text-left font-medium">Output Path</th>
                <th className="px-3 py-2 text-left font-medium">Review</th>
                <th className="px-3 py-2 text-left font-medium">Freshness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {manifest.records.map(mr => (
                <tr key={`${mr.source_type}::${mr.source_id}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono font-semibold text-brand-600">{mr.record_ref}</td>
                  <td className="px-3 py-2 text-gray-500">{mr.source_type}</td>
                  <td className="px-3 py-2 text-gray-400">r{mr.applied_revision}</td>
                  <td className="px-3 py-2">
                    <span className="text-gray-700">{mr.effective_route_label}</span>
                    {mr.manual_override && <span className="ml-1 text-amber-500" title="Manual override">✎</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{mr.manual_override ? 'yes' : '—'}</td>
                  <td className="px-3 py-2 font-mono text-gray-400">{mr.output_paths[0]}</td>
                  <td className="px-3 py-2 text-gray-500">{mr.review_state}</td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${mr.analysis_freshness === 'current' ? 'text-green-600' : mr.analysis_freshness === 'stale' ? 'text-red-600' : 'text-amber-600'}`}>
                      {mr.analysis_freshness}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
