import type { RouteKey } from '../types/app';
import { ROUTE_LABELS } from '../types/app';
import RouteBadge from './RouteBadge';

interface RouteSelectorProps {
  suggestedRoute: RouteKey;
  effectiveRoute: RouteKey;
  isOverride: boolean;
  onOverride: (route: RouteKey) => void;
  onClearOverride: () => void;
  compact?: boolean;
}

export default function RouteSelector({
  suggestedRoute,
  effectiveRoute,
  isOverride,
  onOverride,
  onClearOverride,
  compact = false,
}: RouteSelectorProps) {
  return (
    <div className={`space-y-2 ${compact ? '' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Effective:</span>
        <RouteBadge route={effectiveRoute} isOverride={isOverride} />
        {isOverride && (
          <button
            onClick={onClearOverride}
            className="text-xs text-gray-400 hover:text-red-500 underline"
          >
            Clear override
          </button>
        )}
      </div>

      {!isOverride && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Suggested:</span>
          <RouteBadge route={suggestedRoute} compact />
        </div>
      )}
      {isOverride && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">System suggested:</span>
          <RouteBadge route={suggestedRoute} compact />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-1">
        <span className="text-xs text-gray-500">Override:</span>
        <select
          defaultValue=""
          onChange={e => { if (e.target.value) onOverride(e.target.value as RouteKey); e.target.value = ''; }}
          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">— select route —</option>
          {(Object.entries(ROUTE_LABELS) as [RouteKey, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
