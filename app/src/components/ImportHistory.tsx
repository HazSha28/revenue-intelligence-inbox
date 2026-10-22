import type { ImportLogEntry } from '../types/app';

interface ImportHistoryProps {
  log: ImportLogEntry[];
}

export default function ImportHistory({ log }: ImportHistoryProps) {
  if (log.length === 0) {
    return <p className="text-sm text-gray-400 italic">No imports yet.</p>;
  }

  return (
    <div className="space-y-3">
      {[...log].reverse().map(entry => (
        <div key={entry.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{entry.batch_id}</span>
              <span className="text-xs text-gray-500">rev {entry.revision}</span>
              <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              {entry.applied > 0 && (
                <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                  +{entry.applied} added
                </span>
              )}
              {entry.updated > 0 && (
                <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                  ↑{entry.updated} updated
                </span>
              )}
              {entry.ignored > 0 && (
                <span className="bg-gray-50 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
                  ={entry.ignored} ignored
                </span>
              )}
              {entry.errors > 0 && (
                <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                  ✕{entry.errors} errors
                </span>
              )}
            </div>
          </div>

          {/* Detail accordion — show updated/error records */}
          {(entry.updated > 0 || entry.errors > 0) && (
            <div className="mt-3 border-t border-gray-50 pt-3 space-y-1">
              {entry.details
                .filter(d => d.status === 'updated' || d.status === 'error')
                .map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`font-mono ${d.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                      {d.record_ref}
                    </span>
                    <span className="text-gray-400">{d.source_type}</span>
                    {d.status === 'updated' && (
                      <span className="text-gray-500">rev {d.previous_revision} → {d.new_revision}</span>
                    )}
                    {d.status === 'error' && (
                      <span className="text-red-500">{d.reason}</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
