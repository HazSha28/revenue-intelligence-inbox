import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppRecord } from '../types/app';
import type { ActionItem, ActionStatus, ActionPriority } from '../types/features';
import { extractActions, getActionCenterData, mergeActionStates } from '../lib/actionEngine';
import MetricCard from '../components/MetricCard';

interface ActionCenterProps {
  records: AppRecord[];
  persistedActions: Map<string, ActionItem>;
  onActionChange: (actionId: string, updates: Partial<ActionItem>) => void;
}

const STATUS_CONFIG: Record<ActionStatus, { label: string; classes: string; dot: string }> = {
  suggested:    { label: 'Suggested',   classes: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400' },
  in_progress:  { label: 'In Progress', classes: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-400' },
  completed:    { label: 'Completed',   classes: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500' },
  blocked:      { label: 'Blocked',     classes: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
  dismissed:    { label: 'Dismissed',   classes: 'bg-gray-50 text-gray-400 border-gray-200',     dot: 'bg-gray-300' },
};

const PRIORITY_CONFIG: Record<ActionPriority, { label: string; classes: string }> = {
  high:   { label: 'High',   classes: 'bg-red-50 text-red-600 border-red-200' },
  medium: { label: 'Medium', classes: 'bg-amber-50 text-amber-600 border-amber-200' },
  low:    { label: 'Low',    classes: 'bg-blue-50 text-blue-600 border-blue-200' },
};

export default function ActionCenter({ records, persistedActions, onActionChange }: ActionCenterProps) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'all' | ActionStatus>('all');

  const allActions = useMemo(() => {
    const extracted = extractActions(records);
    return mergeActionStates(extracted, persistedActions);
  }, [records, persistedActions]);

  const stats = useMemo(() => getActionCenterData(allActions), [allActions]);

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <div className="text-5xl">📋</div>
        <p className="text-sm text-gray-400">Import data to generate suggested actions.</p>
      </div>
    );
  }

  const filtered = statusFilter === 'all'
    ? allActions.filter(a => a.status !== 'dismissed')
    : allActions.filter(a => a.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">📋</span> Smart Action Center
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Auto-extracted follow-up actions from conversation text. Explicit agreements are distinguished from suggestions. Status changes persist across refreshes.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Suggested" value={stats.suggested} accent="text-blue-600" accentBar="bg-blue-400" />
        <MetricCard label="In Progress" value={stats.inProgress} accent="text-amber-600" accentBar="bg-amber-400" />
        <MetricCard label="Completed" value={stats.completed} accent="text-green-600" accentBar="bg-green-500" />
        <MetricCard label="High Priority" value={stats.highPriority} accent="text-red-600" accentBar="bg-red-500" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'suggested', 'in_progress', 'completed', 'blocked'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              statusFilter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? `All Active (${allActions.filter(a => a.status !== 'dismissed').length})`
              : `${STATUS_CONFIG[f].label} (${allActions.filter(a => a.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Action list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400">
            No actions match this filter.
          </div>
        ) : (
          filtered.map(action => {
            const statusCfg = STATUS_CONFIG[action.status];
            const prioCfg = PRIORITY_CONFIG[action.priority];
            return (
              <div key={action.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-semibold text-gray-800">{action.title}</span>
                      {action.isExplicit ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 font-medium">
                          ✓ Explicitly agreed
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-500 border border-purple-100 font-medium">
                          Suggested
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${prioCfg.classes}`}>
                        {prioCfg.label}
                      </span>
                    </div>

                    {/* Evidence */}
                    <div className="bg-gray-50 rounded-lg p-2.5 border-l-2 border-gray-300 mb-2">
                      <p className="text-xs text-gray-500 italic">"{action.evidence}"</p>
                      <code className="text-[10px] text-indigo-500 font-mono mt-0.5 block">{action.evidenceRef}</code>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-gray-400">
                      <button
                        onClick={() => navigate(`/inbox/${action.sourceType}/${action.sourceId}`)}
                        className="font-mono font-semibold text-brand-600 hover:underline"
                      >
                        {action.recordRef}
                      </button>
                      {action.suggestedOwner && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 1115 0" />
                          </svg>
                          {action.suggestedOwner}
                        </span>
                      )}
                      {action.dueDate && (
                        <span className="flex items-center gap-1 text-amber-500">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                          </svg>
                          {action.dueDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.classes}`}>
                      {statusCfg.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {action.status !== 'in_progress' && (
                        <button
                          onClick={() => onActionChange(action.id, { status: 'in_progress' })}
                          className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors"
                          title="Start working"
                        >
                          Start
                        </button>
                      )}
                      {action.status !== 'completed' && (
                        <button
                          onClick={() => onActionChange(action.id, { status: 'completed' })}
                          className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                          title="Mark complete"
                        >
                          ✓ Done
                        </button>
                      )}
                      {action.status !== 'blocked' && (
                        <button
                          onClick={() => onActionChange(action.id, { status: 'blocked' })}
                          className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                          title="Mark blocked"
                        >
                          ✕
                        </button>
                      )}
                      {action.status !== 'dismissed' && (
                        <button
                          onClick={() => onActionChange(action.id, { status: 'dismissed' })}
                          className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors"
                          title="Dismiss"
                        >
                          ⊘
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
