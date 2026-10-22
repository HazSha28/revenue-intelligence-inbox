import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppRecord, RouteKey, ReviewState } from '../types/app';
import { ROUTE_LABELS, ROUTE_COLORS } from '../types/app';
import RouteBadge from '../components/RouteBadge';
import ReviewBadge from '../components/ReviewBadge';

interface RoutingReviewProps {
  records: AppRecord[];
  onOverrideRoute: (sourceType: string, sourceId: string, route: RouteKey) => void;
  onClearOverride: (sourceType: string, sourceId: string) => void;
  onSetReviewState: (sourceType: string, sourceId: string, state: ReviewState) => void;
}

export default function RoutingReview({ records, onOverrideRoute, onClearOverride, onSetReviewState }: RoutingReviewProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'manual' | 'stale'>('all');

  const filtered = records.filter(r => {
    if (filter === 'manual') return r.manual_override;
    if (filter === 'stale') return r.review_state === 'analysis_stale';
    return true;
  });

  const totalRouteAssignments = records.reduce((s, r) => s + r.effective_routes.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Routing & Review</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {records.length} unique source records · {totalRouteAssignments} total route assignments
          {totalRouteAssignments > records.length && ` (${totalRouteAssignments - records.length} multi-route)`}
        </p>
      </div>

      {/* Taxonomy legend */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Route Taxonomy</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(ROUTE_LABELS) as [RouteKey, string][]).map(([k, v]) => (
            <span
              key={k}
              style={{ borderColor: ROUTE_COLORS[k] + '44', backgroundColor: ROUTE_COLORS[k] + '11', color: ROUTE_COLORS[k] }}
              className="inline-flex items-center gap-1.5 border rounded-full text-xs font-medium px-2.5 py-1"
            >
              <span
                style={{ backgroundColor: ROUTE_COLORS[k] }}
                className="w-1.5 h-1.5 rounded-full"
              />
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'manual', 'stale'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              filter === f
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? `All (${records.length})` : f === 'manual' ? `Manual overrides (${records.filter(r => r.manual_override).length})` : `Stale (${records.filter(r => r.review_state === 'analysis_stale').length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Ref</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Suggested Route</th>
              <th className="px-4 py-3 text-left font-medium">Effective Route</th>
              <th className="px-4 py-3 text-left font-medium">Review</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {filtered.map(r => (
              <tr key={`${r.source_type}::${r.source_id}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600">
                  <button onClick={() => navigate(`/inbox/${r.source_type}/${r.source_id}`)} className="hover:underline">
                    {r.record_ref}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.source_type}</td>
                <td className="px-4 py-3">
                  <RouteBadge route={r.suggested_route} compact />
                </td>
                <td className="px-4 py-3">
                  <RouteBadge route={r.effective_route} isOverride={r.manual_override} compact />
                </td>
                <td className="px-4 py-3">
                  <ReviewBadge state={r.review_state} compact />
                </td>
                <td className="px-4 py-3">
                  <InlineControls
                    record={r}
                    onOverride={route => onOverrideRoute(r.source_type, r.source_id, route)}
                    onClearOverride={() => onClearOverride(r.source_type, r.source_id)}
                    onSetReview={state => onSetReviewState(r.source_type, r.source_id, state)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">No records match.</div>
        )}
      </div>
    </div>
  );
}

function InlineControls({ record, onOverride, onClearOverride, onSetReview }: {
  record: AppRecord;
  onOverride: (r: RouteKey) => void;
  onClearOverride: () => void;
  onSetReview: (s: ReviewState) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <select
        defaultValue=""
        onChange={e => { if (e.target.value) onOverride(e.target.value as RouteKey); e.target.value = ''; }}
        className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none"
        title="Override route"
      >
        <option value="">Route ▾</option>
        {(Object.entries(ROUTE_LABELS) as [RouteKey, string][]).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {record.manual_override && (
        <button onClick={onClearOverride} className="text-xs text-red-400 hover:text-red-600" title="Clear override">✕</button>
      )}
      <select
        defaultValue=""
        onChange={e => { if (e.target.value) onSetReview(e.target.value as ReviewState); e.target.value = ''; }}
        className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none"
        title="Set review state"
      >
        <option value="">State ▾</option>
        <option value="pending_review">Pending</option>
        <option value="reviewed">Reviewed</option>
        <option value="analysis_stale">Stale</option>
      </select>
    </div>
  );
}
