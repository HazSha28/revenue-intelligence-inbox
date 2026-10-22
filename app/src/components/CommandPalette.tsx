import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppRecord, RouteKey, ReviewState } from '../types/app';
import { ROUTE_LABELS } from '../types/app';
import type { SearchResult } from '../types/features';
import { globalSearch } from '../lib/searchEngine';
import { detectAllRisks } from '../lib/riskEngine';
import { extractActions } from '../lib/actionEngine';
import { detectAllGaps } from '../lib/gapDetector';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  records: AppRecord[];
}

const PAGE_COMMANDS = [
  { label: 'Go to Dashboard', path: '/', icon: '▦' },
  { label: 'Go to Intelligence Inbox', path: '/inbox', icon: '☰' },
  { label: 'Go to Manager Brief', path: '/brief', icon: '✦' },
  { label: 'Go to Routing & Review', path: '/routing', icon: '⇄' },
  { label: 'Go to Imports & Replay', path: '/imports', icon: '⇩' },
  { label: 'Go to Exports', path: '/exports', icon: '⬡' },
  { label: 'Go to Data Status', path: '/status', icon: '◎' },
  { label: 'Go to Risk Radar', path: '/risk', icon: '🛰️' },
  { label: 'Go to Action Center', path: '/actions', icon: '📋' },
  { label: 'Go to Replay Inspector', path: '/replay', icon: '🔍' },
  { label: 'Go to Data Quality', path: '/quality', icon: '📊' },
];

const TYPE_ICONS: Record<string, string> = {
  record_ref: '📄',
  source_id: '🆔',
  transcript_phrase: '💬',
  participant: '👤',
  risk: '⚠️',
  action: '📋',
  review_status: '👁',
  route: '⇄',
};

export default function CommandPalette({ open, onClose, records }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute search results
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const risks = detectAllRisks(records);
    const actions = extractActions(records);
    const gaps = detectAllGaps(records);
    return globalSearch(query, records, risks.risks, actions, gaps);
  }, [query, records]);

  // Combine page commands + search results
  const allItems = useMemo(() => {
    const pages = query.trim()
      ? PAGE_COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
      : PAGE_COMMANDS;
    return [
      ...pages.map(p => ({ kind: 'page' as const, ...p })),
      ...searchResults.map(r => ({ kind: 'search' as const, ...r })),
    ];
  }, [query, searchResults]);

  // Keyboard navigation
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, allItems.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && allItems[activeIndex]) {
        const item = allItems[activeIndex];
        if (item.kind === 'page') { navigate(item.path); onClose(); }
        else { navigate(`/inbox/${item.sourceType}/${item.sourceId}`); onClose(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, allItems, activeIndex, navigate, onClose]);

  if (!open) return null;

  const handleClick = (item: typeof allItems[0]) => {
    if (item.kind === 'page') { navigate(item.path); }
    else { navigate(`/inbox/${item.sourceType}/${item.sourceId}`); }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden border border-gray-100"
        onClick={e => e.stopPropagation()}
        role="combobox"
        aria-expanded="true"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search records, transcripts, risks, actions… or type a page name"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            className="flex-1 text-sm outline-none placeholder:text-gray-300"
            aria-label="Search"
          />
          <kbd className="text-[10px] text-gray-300 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {allItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              {query.trim() ? 'No results found.' : 'Start typing to search…'}
            </div>
          )}

          {allItems.map((item, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={i}
                onClick={() => handleClick(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  isActive ? 'bg-brand-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-base flex-shrink-0">
                  {item.kind === 'page' ? item.icon : TYPE_ICONS[item.type] ?? '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-gray-800 font-medium block truncate">
                    {item.kind === 'page' ? item.label : item.title}
                  </span>
                  {item.kind === 'search' && (
                    <span className="text-xs text-gray-400 truncate block">{item.subtitle}</span>
                  )}
                </div>
                {item.kind === 'search' && (
                  <span className="text-[10px] text-gray-300 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
                    {item.typeLabel}
                  </span>
                )}
                {isActive && (
                  <kbd className="text-[10px] text-gray-300 flex-shrink-0">↵</kbd>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-50 px-4 py-2 flex items-center justify-between text-[10px] text-gray-300">
          <span>{allItems.length} results</span>
          <div className="flex items-center gap-2">
            <kbd className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 font-mono">↑↓</kbd>
            <span>navigate</span>
            <kbd className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 font-mono">↵</kbd>
            <span>open</span>
          </div>
        </div>
      </div>
    </div>
  );
}
