import { useState, useRef, useEffect } from 'react';
import type { AppRecord } from '../types/app';
import type { CallPayload, TranscriptTurn } from '../types/source';
import { meetingEvidenceRef, callEvidenceRef } from '../lib/evidence';

interface TranscriptViewerProps {
  record: AppRecord;
}

export default function TranscriptViewer({ record }: TranscriptViewerProps) {
  if (record.source_type === 'call') return <CallTranscript record={record} />;
  return <MeetingTranscript record={record} />;
}

// ── Speaker config ─────────────────────────────────────────────────────────────

interface SpeakerTheme {
  bubble: string;
  avatar: string;
  avatarBg: string;
  name: string;
  align: 'left' | 'right';
  initials: string;
}

const SPEAKER_THEMES: Record<string, SpeakerTheme> = {
  'Team member A': { bubble: 'bg-indigo-600 text-white', avatar: 'text-indigo-100', avatarBg: 'bg-indigo-500', name: 'text-indigo-300', align: 'right', initials: 'TA' },
  'Team member B': { bubble: 'bg-violet-600 text-white', avatar: 'text-violet-100', avatarBg: 'bg-violet-500', name: 'text-violet-300', align: 'right', initials: 'TB' },
  'Team member C': { bubble: 'bg-blue-600 text-white',   avatar: 'text-blue-100',   avatarBg: 'bg-blue-500',   name: 'text-blue-300',   align: 'right', initials: 'TC' },
  'Customer A':    { bubble: 'bg-white border border-gray-200 text-gray-800', avatar: 'text-amber-700', avatarBg: 'bg-amber-100', name: 'text-amber-600', align: 'left', initials: 'CA' },
  'Customer B':    { bubble: 'bg-white border border-gray-200 text-gray-800', avatar: 'text-orange-700', avatarBg: 'bg-orange-100', name: 'text-orange-600', align: 'left', initials: 'CB' },
  'Partner A':     { bubble: 'bg-white border border-gray-200 text-gray-800', avatar: 'text-emerald-700', avatarBg: 'bg-emerald-100', name: 'text-emerald-600', align: 'left', initials: 'PA' },
  'Supplier A':    { bubble: 'bg-white border border-gray-200 text-gray-800', avatar: 'text-cyan-700', avatarBg: 'bg-cyan-100', name: 'text-cyan-600', align: 'left', initials: 'SA' },
};

function getSpeakerTheme(speaker: string): SpeakerTheme {
  if (SPEAKER_THEMES[speaker]) return SPEAKER_THEMES[speaker];
  // Fallback: team members right, others left
  const isTeam = /team/i.test(speaker);
  return isTeam
    ? { bubble: 'bg-slate-700 text-white', avatar: 'text-slate-100', avatarBg: 'bg-slate-500', name: 'text-slate-300', align: 'right', initials: speaker.slice(0, 2).toUpperCase() }
    : { bubble: 'bg-white border border-gray-200 text-gray-800', avatar: 'text-gray-600', avatarBg: 'bg-gray-100', name: 'text-gray-500', align: 'left', initials: speaker.slice(0, 2).toUpperCase() };
}

// ── Highlight helper ──────────────────────────────────────────────────────────

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{p}</mark>
      : p
  );
}

// ── Call Transcript ───────────────────────────────────────────────────────────

function CallTranscript({ record }: { record: AppRecord }) {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const transcript = (record.payload as CallPayload).transcript;

  if (!transcript || transcript.trim().length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400 font-medium">No transcript available</p>
        <p className="text-xs text-gray-300">This call has no recorded conversation text.</p>
      </div>
    );
  }

  const evidenceRef = callEvidenceRef(record.record_ref, record.source_id, transcript.slice(0, 60));

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Call Transcript</span>
          <span className="bg-gray-100 text-gray-500 text-xs font-mono px-2 py-0.5 rounded-full">{record.record_ref}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-6 pr-3 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 w-28"
            />
          </div>
          <button onClick={handleCopy} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1">
            {copied
              ? <><svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Copied</>
              : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>Copy</>
            }
          </button>
        </div>
      </div>

      {/* Transcript body */}
      <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-100 p-5 text-sm text-gray-700 leading-7 max-h-72 overflow-y-auto">
        {highlightText(transcript, search)}
      </div>

      {/* Evidence ref */}
      <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        <span>Evidence ref:</span>
        <code className="font-mono text-indigo-600">{evidenceRef.display}</code>
      </div>
    </div>
  );
}

// ── Meeting Transcript (chat bubbles) ─────────────────────────────────────────

function MeetingTranscript({ record }: { record: AppRecord }) {
  const [search, setSearch] = useState('');
  const [activeTurn, setActiveTurn] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tp = record.transcript_payload;

  if (!tp) {
    return (
      <EmptyTranscript message="No transcript payload for this meeting." />
    );
  }
  const turns = tp.turns;
  if (turns.length === 0) {
    return (
      <EmptyTranscript message={tp.unavailable_reason ? `Unavailable: ${tp.unavailable_reason}` : 'No transcript turns supplied for this meeting.'} />
    );
  }

  // Unique speakers for legend
  const speakers = [...new Set(turns.map(t => t.speaker))];

  const matchingTurns = search.trim()
    ? turns.reduce<number[]>((acc, t, i) => { if (t.text.toLowerCase().includes(search.toLowerCase())) acc.push(i); return acc; }, [])
    : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Meeting Transcript</span>
          </div>
          <span className="bg-purple-50 text-purple-600 border border-purple-100 text-xs font-semibold px-2 py-0.5 rounded-full">
            {turns.length} turns
          </span>
          <span className="bg-gray-100 text-gray-500 text-xs font-mono px-2 py-0.5 rounded-full">{record.record_ref}</span>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search transcript…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-6 pr-3 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 w-40"
          />
          {matchingTurns.length > 0 && (
            <span className="absolute -right-1 -top-1 bg-yellow-400 text-yellow-900 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {matchingTurns.length}
            </span>
          )}
        </div>
      </div>

      {/* Speaker legend */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {speakers.map(sp => {
          const theme = getSpeakerTheme(sp);
          return (
            <div key={sp} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className={`w-4 h-4 rounded-full ${theme.avatarBg} flex items-center justify-center text-[8px] font-bold text-white`}>
                {theme.initials}
              </span>
              {sp}
            </div>
          );
        })}
      </div>

      {/* Chat bubbles */}
      <div ref={scrollRef} className="space-y-3 max-h-[460px] overflow-y-auto pr-1 scroll-smooth">
        {turns.map((turn: TranscriptTurn, i: number) => {
          const theme = getSpeakerTheme(turn.speaker);
          const isRight = theme.align === 'right';
          const ref = meetingEvidenceRef(record.record_ref, record.source_id, i + 1);
          const isMatch = search.trim() && turn.text.toLowerCase().includes(search.toLowerCase());
          const isActive = activeTurn === i;

          return (
            <div
              key={i}
              id={`turn-${i}`}
              className={`flex gap-2.5 items-end ${isRight ? 'flex-row-reverse' : 'flex-row'} ${isMatch ? 'ring-2 ring-yellow-300 rounded-2xl' : ''}`}
              onClick={() => setActiveTurn(isActive ? null : i)}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${theme.avatarBg}`}>
                {theme.initials}
              </div>

              {/* Bubble */}
              <div className={`max-w-[78%] cursor-pointer group`}>
                {/* Speaker + time */}
                <div className={`flex items-center gap-1.5 mb-1 ${isRight ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-[10px] font-semibold ${theme.name}`}>{turn.speaker}</span>
                  <span className="text-[10px] text-gray-300 font-mono">{turn.timecode}</span>
                  <span className={`text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ${isRight ? 'mr-auto' : 'ml-auto'}`}>
                    {ref.display}
                  </span>
                </div>

                {/* Text bubble */}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-shadow ${theme.bubble} ${isActive ? 'ring-2 ring-offset-1 ring-indigo-300' : ''} ${isRight ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                  {highlightText(turn.text, search)}
                </div>

                {/* Turn number */}
                {isActive && (
                  <div className={`mt-1 flex ${isRight ? 'justify-end' : 'justify-start'}`}>
                    <code className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full font-mono border border-indigo-100">
                      {ref.display}
                    </code>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="text-[10px] text-gray-300 text-center mt-1">
        Click any bubble to reveal its evidence reference · Speaker labels are local to this meeting
      </p>
    </div>
  );
}

function EmptyTranscript({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
