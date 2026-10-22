import type { RouteKey, ReviewState } from '../types/app';
import { ROUTE_LABELS } from '../types/app';

export interface InboxFilters {
  search: string;
  sourceType: 'all' | 'call' | 'meeting';
  route: RouteKey | 'all';
  reviewState: ReviewState | 'all';
  transcriptAvail: 'all' | 'yes' | 'no';
}

export const DEFAULT_FILTERS: InboxFilters = {
  search: '',
  sourceType: 'all',
  route: 'all',
  reviewState: 'all',
  transcriptAvail: 'all',
};

interface FilterBarProps {
  filters: InboxFilters;
  onChange: (f: InboxFilters) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const set = (patch: Partial<InboxFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        type="search"
        placeholder="Search records…"
        value={filters.search}
        onChange={e => set({ search: e.target.value })}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-52"
      />

      <select
        value={filters.sourceType}
        onChange={e => set({ sourceType: e.target.value as InboxFilters['sourceType'] })}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="all">All types</option>
        <option value="call">Calls</option>
        <option value="meeting">Meetings</option>
      </select>

      <select
        value={filters.route}
        onChange={e => set({ route: e.target.value as InboxFilters['route'] })}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="all">All routes</option>
        {(Object.entries(ROUTE_LABELS) as [RouteKey, string][]).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      <select
        value={filters.reviewState}
        onChange={e => set({ reviewState: e.target.value as InboxFilters['reviewState'] })}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="all">All review states</option>
        <option value="pending_review">Pending review</option>
        <option value="reviewed">Reviewed</option>
        <option value="analysis_stale">Analysis stale</option>
      </select>

      <select
        value={filters.transcriptAvail}
        onChange={e => set({ transcriptAvail: e.target.value as InboxFilters['transcriptAvail'] })}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="all">All transcripts</option>
        <option value="yes">Has transcript</option>
        <option value="no">No transcript</option>
      </select>

      {(filters.search || filters.sourceType !== 'all' || filters.route !== 'all' ||
        filters.reviewState !== 'all' || filters.transcriptAvail !== 'all') && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
