import { useState } from 'react';
import type { AppRecord, ImportLogEntry } from '../types/app';
import type { DeliveryEnvelope } from '../types/source';
import { validateEnvelope, processDelivery } from '../lib/importEngine';
import { saveRecordsAndLog } from '../lib/storage';
import { INITIAL_DELIVERY, UPDATE_DELIVERY } from '../data';
import ImportHistory from '../components/ImportHistory';

interface ImportsReplayProps {
  records: AppRecord[];
  importLog: ImportLogEntry[];
  onStateChange: (records: AppRecord[], log: ImportLogEntry[]) => void;
}

type ActionStatus = 'idle' | 'running' | 'success' | 'error';

interface ActionState {
  status: ActionStatus;
  message: string;
}

// Shuffle array (for re-import with reordered records)
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ImportsReplay({ records, importLog, onStateChange }: ImportsReplayProps) {
  const [status, setStatus] = useState<Record<string, ActionState>>({});
  const [userFile, setUserFile] = useState<File | null>(null);

  const runAction = (key: string, fn: () => void) => {
    setStatus(s => ({ ...s, [key]: { status: 'running', message: 'Processing…' } }));
    try {
      fn();
      // message set inside fn via setStatus
    } catch (err) {
      setStatus(s => ({ ...s, [key]: { status: 'error', message: String(err) } }));
    }
  };

  const importEnvelope = (envelope: DeliveryEnvelope, key: string) => {
    const result = processDelivery(envelope, records);
    saveRecordsAndLog(result.records, [...importLog, result.logEntry]);
    onStateChange(result.records, [...importLog, result.logEntry]);
    const { applied, updated, ignored, errors } = result.logEntry;
    setStatus(s => ({
      ...s,
      [key]: {
        status: 'success',
        message: `Done: ${applied} added · ${updated} updated · ${ignored} ignored · ${errors} errors`,
      },
    }));
  };

  const handleImportInitial = () => runAction('initial', () => importEnvelope(INITIAL_DELIVERY, 'initial'));

  const handleReImportInitial = () => {
    runAction('reimport', () => {
      // Re-import with shuffled record order
      const shuffledEnvelope: DeliveryEnvelope = {
        ...INITIAL_DELIVERY,
        records: shuffled(INITIAL_DELIVERY.records),
      };
      importEnvelope(shuffledEnvelope, 'reimport');
    });
  };

  const handleImportUpdate = () => runAction('update', () => importEnvelope(UPDATE_DELIVERY, 'update'));

  const handleReset = () => {
    runAction('reset', () => {
      // Reset to only initial delivery
      const result = processDelivery(INITIAL_DELIVERY, []);
      saveRecordsAndLog(result.records, [result.logEntry]);
      onStateChange(result.records, [result.logEntry]);
      setStatus(s => ({
        ...s,
        reset: { status: 'success', message: `Reset complete: ${result.records.length} records loaded at revision 1.` },
      }));
    });
  };

  const handleFileImport = async () => {
    if (!userFile) return;
    runAction('file', async () => {
      try {
        const text = await userFile.text();
        const raw = JSON.parse(text);
        const envelope = validateEnvelope(raw);
        importEnvelope(envelope, 'file');
      } catch (err) {
        setStatus(s => ({ ...s, file: { status: 'error', message: `Import failed: ${err}` } }));
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Imports & Replay</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {records.length} unique source records currently loaded
        </p>
      </div>

      {/* Preset actions */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Preset Import Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ActionButton
            label="Import initial delivery"
            description="Load 01_initial.json (revision 1, 43 records)"
            onClick={handleImportInitial}
            state={status['initial']}
            color="blue"
          />
          <ActionButton
            label="Re-import initial (reordered)"
            description="Same revision 1 data, record order shuffled — must be idempotent"
            onClick={handleReImportInitial}
            state={status['reimport']}
            color="purple"
          />
          <ActionButton
            label="Import update delivery"
            description="Load 02_update.json (revision 2, M07 update — transcript arrives)"
            onClick={handleImportUpdate}
            state={status['update']}
            color="emerald"
          />
          <ActionButton
            label="Reset to initial state"
            description="Clear all data and reload revision 1 — repeatable demo start"
            onClick={handleReset}
            state={status['reset']}
            color="amber"
          />
        </div>
      </div>

      {/* File upload */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Import from File</h2>
        <p className="text-xs text-gray-400">Upload a JSON delivery envelope file. Malformed files will show an error.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept=".json"
            onChange={e => setUserFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50"
          />
          <button
            disabled={!userFile || status['file']?.status === 'running'}
            onClick={handleFileImport}
            className="px-4 py-1.5 text-xs bg-gray-800 text-white rounded-lg disabled:opacity-40 hover:bg-gray-700"
          >
            Import file
          </button>
        </div>
        {status['file'] && <StatusBadge state={status['file']} />}
      </div>

      {/* Replay instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-blue-800">Replay Sequence</h2>
        <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside">
          <li><strong>Reset to initial state</strong> — loads revision 1 (44 unique records, 17 usable texts)</li>
          <li><strong>Re-import initial (reordered)</strong> — all records ignored (revision 1 already applied)</li>
          <li>Go to Routing &amp; Review and manually override M07's route</li>
          <li><strong>Import update delivery</strong> — M07 updated to revision 2 (18 usable texts); manual route preserved; analysis marked stale</li>
          <li><strong>Re-import initial (reordered)</strong> again — M07 stays revision 2 (ignored)</li>
          <li>Refresh the browser — all state persists from localStorage</li>
        </ol>
        <div className="bg-blue-100 rounded-lg p-3 text-xs text-blue-800">
          <strong>Expected result:</strong> 44 unique source records · M07 at revision 2 · Manual route on M07 intact · 18 usable transcripts · Analysis stale on M07
        </div>
      </div>

      {/* Import history */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Import History</h2>
        <ImportHistory log={importLog} />
      </div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  description: string;
  onClick: () => void;
  state?: ActionState;
  color: 'blue' | 'purple' | 'emerald' | 'amber';
}

const COLOR_MAP = {
  blue:    { btn: 'bg-blue-600 hover:bg-blue-700', ring: 'ring-blue-200' },
  purple:  { btn: 'bg-purple-600 hover:bg-purple-700', ring: 'ring-purple-200' },
  emerald: { btn: 'bg-emerald-600 hover:bg-emerald-700', ring: 'ring-emerald-200' },
  amber:   { btn: 'bg-amber-500 hover:bg-amber-600', ring: 'ring-amber-200' },
};

function ActionButton({ label, description, onClick, state, color }: ActionButtonProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-2">
      <button
        onClick={onClick}
        disabled={state?.status === 'running'}
        className={`w-full text-sm font-medium text-white rounded-lg py-2 px-4 ${c.btn} disabled:opacity-50 transition-colors`}
      >
        {state?.status === 'running' ? 'Processing…' : label}
      </button>
      <p className="text-xs text-gray-400">{description}</p>
      {state && state.status !== 'running' && <StatusBadge state={state} />}
    </div>
  );
}

function StatusBadge({ state }: { state: ActionState }) {
  const cls = state.status === 'success'
    ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-red-50 text-red-700 border-red-200';
  return (
    <div className={`border rounded-lg px-3 py-1.5 text-xs ${cls}`}>
      {state.message}
    </div>
  );
}
