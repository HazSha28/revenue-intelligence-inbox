interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;       // tailwind text-color class
  accentBar?: string;    // tailwind bg-color class for top bar
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

const TREND_ICONS = {
  up:      <span className="text-emerald-500 text-xs font-bold">↑</span>,
  down:    <span className="text-red-400 text-xs font-bold">↓</span>,
  neutral: <span className="text-gray-300 text-xs">—</span>,
};

export default function MetricCard({
  label, value, sub, accent = 'text-gray-900', accentBar, icon, trend,
}: MetricCardProps) {
  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* top accent bar */}
      {accentBar && <div className={`h-1 w-full ${accentBar}`} />}

      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight">{label}</span>
          {icon && (
            <span className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
              {icon}
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
          <span className={`text-3xl font-bold leading-none ${accent}`}>{value}</span>
          {trend && <span className="mb-0.5">{TREND_ICONS[trend]}</span>}
        </div>

        {sub && <span className="text-xs text-gray-400 leading-relaxed">{sub}</span>}
      </div>
    </div>
  );
}
