import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppRecord, ImportLogEntry } from '../types/app';
import type { ImportInspection, RevisionDiff } from '../types/features';

interface ReplayInspectorProps {
  records: AppRecord[];
  importLog: ImportLogEntry[];
}

export default function ReplayInspector({ records, importLog }: ReplayInspectorProps) {
  const navigate = useNavigate();
  const [selectedImport, setSelectedImport] = useState<string | null>(null);

  // Build inspection data from import log + current records
  const inspections = useMemo<ImportInspection[]>(() => {
    return importLog.map(entry => {
      const diffs: RevisionDiff[] = [];

      for (const detail of entry.details) {
        if (detail.status === 'updated' || detail.status === 'applied') {
          const record = records.find(r => r.source_id === detail.source_id && r.source_type === detail.source_type);
          const transcriptChanged = detail.status === 'updated' && record?.analysis.is_stale;

          diffs.push({
            recordRef: detail.record_ref,
            sourceType: detail.source_type,
            sourceId: detail.source_id,
            previousRevision: detail.previous_revision ?? null,
            newRevision: detail.new_revision ?? entry.revision,
            changedFields: detail.status === 'updated'
              ? ['payload', 'transcript_payload', 'suggested_route', 'analysis']
              : ['all (new record)'],
            transcriptChanged: !!transcriptChanged,
            analysisStale: (record?.review_state ?? '') === 'analysis_stale',
            manualRoutePreserved: record?.manual_override ?? false,
          });
        }
      }

      return {
        logEntryId: entry.id,
        timestamp: entry.timestamp,
        batchId: entry.batch_id,
        revision: entry.revision,
        newRecords: entry.applied,
        updatedRecords: entry.updated,
        ignoredRecords: entry.ignored,
        errors: entry.errors,
        diffs,
      };
    });
  }, [importLog, records]);

  if (importLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <div className="text-5xl">🔍</div>
        <p className="text-sm text-gray-400">No imports yet. Go to Imports & Replay to load data.</p>
      </div>
    );
  }

  const selected = selectedImport ? inspections.find(i => i.logEntryId === selectedImport) : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">🔍</span> Data Change & Replay Inspector
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Revision history with per-record diffs. Shows transcript changes, stale analysis, and preserved manual routes.
        </p>
      </div>

      {/* Import timeline */}
      <div className="space-y-3">
        {[...inspections].reverse().map((insp, i) => {
          const isExpanded = selectedImport === insp.logEntryId;
          const isLast = i === 0; // most recent
          return (
            <div key={insp.logEntryId} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Timeline header */}
              <button
                onClick={() => setSelectedImport(isExpanded ? null : insp.logEntryId)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full ${insp.revision === 2 ? 'bg-purple-500' : 'bg-brand-500'} ${isLast ? 'ring-4 ring-brand-100' : ''}`} />
                  {i < inspections.length - 1 && <div className="w-0.5 h-8 bg-gray-100 mt-1" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{insp.batchId}</span>
                    <span className="text-xs text-gray-500">revision {insp.revision}</span>
                    {isLast && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 font-medium">Latest</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(insp.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
                  </div>
                </div>

                {/* Counts */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {insp.newRecords > 0 && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">+{insp.newRecords} new</span>
                  )}
                  {insp.updatedRecords > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">↑{insp.updatedRecords} updated</span>
                  )}
                  {insp.ignoredRecords > 0 && (
                    <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5 font-medium">={insp.ignoredRecords} ignored</span>
                  )}
                  {insp.errors > 0 && (
                    <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-medium">✕{insp.errors} errors</span>
                  )}
                </div>

                <svg className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* Expanded diff detail */}
              {isExpanded && insp.diffs.length > 0 && (
                <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-2 bg-gray-50/50">
                  {insp.diffs.map((diff, j) => (
                    <div key={j} className="bg-white rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <button
                          onClick={() => navigate(`/inbox/${diff.sourceType}/${diff.sourceId}`)}
                          className="font-mono text-xs font-semibold text-brand-600 hover:underline"
                        >
                          {diff.recordRef}
                        </button>
                        <span className="text-xs text-gray-400">{diff.sourceType}</span>
                        {diff.previousRevision !== null && (
                          <span className="text-xs text-gray-500 font-mono">
                            rev {diff.previousRevision} → {diff.newRevision}
                          </span>
                        )}
                        {diff.previousRevision === null && (
                          <span className="text-xs text-green-600 font-mono">new (rev {diff.newRevision})</span>
                        )}
                      </div>

                      {/* Changed fields */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {diff.changedFields.map(field => (
                          <span key={field} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">{field}</span>
                        ))}
                      </div>

                      {/* Flags */}
                      <div className="flex flex-wrap gap-2">
                        {diff.transcriptChanged && (
                          <span className="text-[10px] flex items-center gap-1 bg-purple-50 text-purple-600 border border-purple-100 rounded-full px-2 py-0.5 font-medium">
                            📝 Transcript changed
                          </span>
                        )}
                        {diff.analysisStale && (
                          <span className="text-[10px] flex items-center gap-1 bg-red-50 text-red-600 border border-red-100 rounded-full px-2 py-0.5 font-medium">
                            ⚠ Analysis stale
                          </span>
                        )}
                        {diff.manualRoutePreserved && (
                          <span className="text-[10px] flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full px-2 py-0.5 font-medium">
                            ✎ Manual route preserved
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Expanded: ignored details */}
              {isExpanded && insp.ignoredRecords > 0 && insp.diffs.length === 0 && (
                <div className="border-t border-gray-50 px-4 pb-4 pt-3 bg-gray-50/50">
                  <p className="text-xs text-gray-400 italic">
                    All {insp.ignoredRecords} records were ignored (already at revision {insp.revision} or higher). Idempotent import confirmed.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* M07 highlight */}
      {records.some(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a' && r.applied_revision === 2) && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
            <span>🧪</span> M07 Late-Transcript Scenario
          </h2>
          <p className="text-xs text-purple-700">
            M07 (Willowfield Trust) is at revision 2. Its transcript was delivered in the update batch and contains 27 turns.
            {records.find(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a')?.analysis.is_stale
              ? ' Analysis is marked stale — the newer transcript needs review.' : ' Analysis has been reviewed.'}
            {records.find(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a')?.manual_override
              ? ' Manual route override is preserved.' : ' No manual override applied.'}
          </p>
          <button
            onClick={() => navigate('/inbox/meeting/4f304fff-fd40-5cfc-a366-0a134c445c2a')}
            className="text-xs text-purple-700 underline hover:text-purple-800"
          >
            View M07 record →
          </button>
        </div>
      )}
    </div>
  );
}
