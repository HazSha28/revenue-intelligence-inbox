import type { AppRecord, RouteKey } from '../types/app';
import { ROUTE_LABELS } from '../types/app';
import { explainRouting } from '../lib/routingExplainer';
import RouteBadge from './RouteBadge';

interface ExplainableRoutingProps {
  record: AppRecord;
  onOverride: (route: RouteKey) => void;
  onClearOverride: () => void;
}

const CONFIDENCE_STYLES = {
  high:   { label: 'High confidence',   classes: 'bg-green-50 text-green-700 border-green-200',     dot: 'bg-green-500' },
  medium: { label: 'Medium confidence', classes: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500' },
  low:    { label: 'Low confidence',    classes: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-400' },
};

const WEIGHT_STYLES = {
  strong:   'bg-indigo-100 text-indigo-700',
  moderate: 'bg-gray-100 text-gray-500',
  weak:     'bg-gray-50 text-gray-400',
};

export default function ExplainableRouting({ record, onOverride, onClearOverride }: ExplainableRoutingProps) {
  const explanation = explainRouting(record);
  const confStyle = CONFIDENCE_STYLES[explanation.confidence];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          Explainable Smart Routing
        </h2>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${confStyle.classes}`}>
          {confStyle.label}
        </span>
      </div>

      {/* Route comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">Suggested</p>
          <RouteBadge route={explanation.suggestedRoute} compact />
        </div>
        <div className={`${record.manual_override ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'} rounded-lg p-3 border`}>
          <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">
            Effective {record.manual_override && '✎'}
          </p>
          <RouteBadge route={explanation.effectiveRoute} isOverride={record.manual_override} compact />
        </div>
      </div>

      {/* Confidence reason */}
      <p className="text-xs text-gray-500 italic">{explanation.confidenceReason}</p>

      {/* Routing reasons */}
      {explanation.reasons.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">Supporting Signals</p>
          {explanation.reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${WEIGHT_STYLES[reason.weight]}`}>
                {reason.weight}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-600">{reason.signal}</p>
                {reason.evidence && (
                  <p className="text-gray-400 italic mt-0.5 text-[11px]">"{reason.evidence.slice(0, 100)}{reason.evidence.length > 100 ? '…' : ''}"</p>
                )}
                <code className="text-[10px] text-indigo-400 font-mono">{reason.evidenceRef}</code>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alternative route */}
      {explanation.alternativeRoute && (
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
          <p className="text-xs text-purple-700 font-medium mb-1">Alternative route considered</p>
          <div className="flex items-center gap-2">
            <RouteBadge route={explanation.alternativeRoute} compact />
            <span className="text-xs text-purple-500">{explanation.alternativeReason}</span>
          </div>
        </div>
      )}

      {/* Analysis freshness */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-400 uppercase font-medium">Analysis freshness:</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
          explanation.analysisFreshness === 'current' ? 'bg-green-50 text-green-600 border-green-200'
          : explanation.analysisFreshness === 'stale' ? 'bg-red-50 text-red-600 border-red-200'
          : 'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          {explanation.analysisFreshness === 'current' ? 'Current' : explanation.analysisFreshness === 'stale' ? 'Stale' : 'Pending'}
        </span>
      </div>

      {/* Override controls */}
      <div className="border-t border-gray-50 pt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Override route:</span>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) onOverride(e.target.value as RouteKey); e.target.value = ''; }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            <option value="">— select —</option>
            {(Object.entries(ROUTE_LABELS) as [RouteKey, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {record.manual_override && (
            <button
              onClick={onClearOverride}
              className="text-xs text-red-400 hover:text-red-600 underline"
            >
              Clear override
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
