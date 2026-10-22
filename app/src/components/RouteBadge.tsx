import type { RouteKey } from '../types/app';
import { ROUTE_LABELS } from '../types/app';

interface RouteBadgeProps {
  route: RouteKey;
  isOverride?: boolean;
  compact?: boolean;
}

const ROUTE_STYLES: Record<RouteKey, string> = {
  sales_new:       'bg-blue-50 text-blue-700 border-blue-200',
  sales_followup:  'bg-purple-50 text-purple-700 border-purple-200',
  partnership:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  customer_support:'bg-amber-50 text-amber-700 border-amber-200',
  product_issue:   'bg-red-50 text-red-700 border-red-200',
  integration:     'bg-cyan-50 text-cyan-700 border-cyan-200',
  payments_billing:'bg-orange-50 text-orange-700 border-orange-200',
  compliance_kyc:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  internal:        'bg-lime-50 text-lime-700 border-lime-200',
  no_contact:      'bg-gray-50 text-gray-500 border-gray-200',
  unclassified:    'bg-gray-50 text-gray-400 border-gray-200',
};

export default function RouteBadge({ route, isOverride = false, compact = false }: RouteBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full font-medium ${compact ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'} ${ROUTE_STYLES[route]}`}>
      {ROUTE_LABELS[route]}
      {isOverride && <span title="Manual override" className="opacity-60">✎</span>}
    </span>
  );
}
