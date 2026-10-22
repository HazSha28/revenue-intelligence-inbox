import { useState, useMemo } from 'react';
import type { AppRecord } from '../types/app';
import type { CallPayload } from '../types/source';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from '../lib/routing';
import FilterBar, { DEFAULT_FILTERS, type InboxFilters } from '../components/FilterBar';
import RecordsTable from '../components/RecordsTable';

interface IntelligenceInboxProps { records: AppRecord[] }

export default function IntelligenceInbox({ records }: IntelligenceInboxProps) {
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.sourceType !== 'all' && r.source_type !== filters.sourceType) return false;
      if (filters.route !== 'all' && r.effective_route !== filters.route) return false;
      if (filters.reviewState !== 'all' && r.review_state !== filters.reviewState) return false;

      const hasTx = r.source_type === 'call'
        ? hasUsableCallTranscript(r.payload as CallPayload)
        : hasUsableMeetingTranscript(r.transcript_payload);
      if (filters.transcriptAvail === 'yes' && !hasTx) return false;
      if (filters.transcriptAvail === 'no' && hasTx) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const inRef = r.record_ref.toLowerCase().includes(q);
        const inId = r.source_id.toLowerCase().includes(q);
        const inTitle = r.source_type === 'meeting'
          ? (r.payload as { title: string }).title.toLowerCase().includes(q)
          : false;
        const inRep = r.source_type === 'call'
          ? ((r.payload as CallPayload).rep_name ?? '').toLowerCase().includes(q)
          : false;
        if (!inRef && !inId && !inTitle && !inRep) return false;
      }
      return true;
    });
  }, [records, filters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Intelligence Inbox</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} of {records.length} records
          </p>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <RecordsTable records={filtered} />
    </div>
  );
}
