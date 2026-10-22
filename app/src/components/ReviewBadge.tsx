import type { ReviewState } from '../types/app';

interface ReviewBadgeProps {
  state: ReviewState;
  compact?: boolean;
}

const CONFIG: Record<ReviewState, { label: string; classes: string }> = {
  pending_review: { label: 'Pending review', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  reviewed:       { label: 'Reviewed',        classes: 'bg-green-50 text-green-700 border-green-200' },
  analysis_stale: { label: 'Analysis stale',  classes: 'bg-red-50 text-red-700 border-red-200'   },
};

export default function ReviewBadge({ state, compact = false }: ReviewBadgeProps) {
  const { label, classes } = CONFIG[state];
  return (
    <span className={`inline-flex items-center border rounded-full font-medium ${compact ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'} ${classes}`}>
      {label}
    </span>
  );
}
