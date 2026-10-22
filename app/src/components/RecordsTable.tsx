import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppRecord } from '../types/app';
import type { CallPayload, MeetingPayload } from '../types/source';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from '../lib/routing';
import { formatDateOnlyIST, getConversationDate } from '../lib/metrics';
import RouteBadge from './RouteBadge';
import ReviewBadge from './ReviewBadge';

interface RecordsTableProps {
  records: AppRecord[];
}

type SortKey = 'record_ref' | 'date' | 'route' | 'review_state' | 'source_type';

export default function RecordsTable({ records }: RecordsTableProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('record_ref');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...records].sort((a, b) => {
    let av: string, bv: string;
    if (sortKey === 'date') {
      av = getConversationDate(a).toISOString();
      bv = getConversationDate(b).toISOString();
    } else if (sortKey === 'record_ref') {
      av = a.record_ref; bv = b.record_ref;
    } else if (sortKey === 'route') {
      av = a.effective_route; bv = b.effective_route;
    } else if (sortKey === 'review_state') {
      av = a.review_state; bv = b.review_state;
    } else {
      av = a.source_type; bv = b.source_type;
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortBtn = ({ col }: { col: SortKey }) => (
    <button onClick={() => toggleSort(col)} className="ml-1 opacity-50 hover:opacity-100 text-xs">
      {sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </button>
  );

  const hasTranscript = (r: AppRecord) =>
    r.source_type === 'call'
      ? hasUsableCallTranscript(r.payload as CallPayload)
      : hasUsableMeetingTranscript(r.transcript_payload);

  const getTitle = (r: AppRecord) =>
    r.source_type === 'meeting'
      ? (r.payload as MeetingPayload).title
      : `${(r.payload as CallPayload).rep_name ?? '—'} · ${(r.payload as CallPayload).direction}`;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left font-medium">
              Ref <SortBtn col="record_ref" />
            </th>
            <th className="px-4 py-3 text-left font-medium">
              Type <SortBtn col="source_type" />
            </th>
            <th className="px-4 py-3 text-left font-medium">Title / Caller</th>
            <th className="px-4 py-3 text-left font-medium">
              Date (IST) <SortBtn col="date" />
            </th>
            <th className="px-4 py-3 text-left font-medium">Transcript</th>
            <th className="px-4 py-3 text-left font-medium">
              Effective Route <SortBtn col="route" />
            </th>
            <th className="px-4 py-3 text-left font-medium">
              Review <SortBtn col="review_state" />
            </th>
            <th className="px-4 py-3 text-left font-medium">Rev</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {sorted.map(r => (
            <tr
              key={`${r.source_type}::${r.source_id}`}
              onClick={() => navigate(`/inbox/${r.source_type}/${r.source_id}`)}
              className="hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{r.record_ref}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  r.source_type === 'call'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}>
                  {r.source_type}
                </span>
              </td>
              <td className="px-4 py-3 max-w-xs">
                <span className="truncate block text-gray-800 text-xs">{getTitle(r)}</span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                {formatDateOnlyIST(getConversationDate(r))}
              </td>
              <td className="px-4 py-3 text-center text-base">
                {hasTranscript(r) ? '✓' : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3">
                <RouteBadge route={r.effective_route} isOverride={r.manual_override} compact />
              </td>
              <td className="px-4 py-3">
                <ReviewBadge state={r.review_state} compact />
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">r{r.applied_revision}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">No records match the current filters.</div>
      )}
    </div>
  );
}
