import type { AppRecord, DashboardMetrics, RouteKey } from '../types/app';
import type { CallPayload, MeetingPayload } from '../types/source';
import { ROUTE_LABELS, ROUTE_COLORS } from '../types/app';
import { hasUsableCallTranscript, hasUsableMeetingTranscript } from './routing';

export function computeMetrics(records: AppRecord[]): DashboardMetrics {
  const calls = records.filter(r => r.source_type === 'call');
  const meetings = records.filter(r => r.source_type === 'meeting');

  // Usable transcripts
  const usableCallTranscripts = calls.filter(r =>
    hasUsableCallTranscript(r.payload as CallPayload)
  ).length;

  const usableMeetingTranscripts = meetings.filter(r =>
    hasUsableMeetingTranscript(r.transcript_payload)
  ).length;

  // Connection status — calls only
  const callsWithKnownConnection = calls.filter(r =>
    (r.payload as CallPayload).is_connected !== null
  );
  const connectedCalls = callsWithKnownConnection.filter(r =>
    (r.payload as CallPayload).is_connected === true
  ).length;
  const notConnectedCalls = callsWithKnownConnection.filter(r =>
    (r.payload as CallPayload).is_connected === false
  ).length;
  const unknownConnectionCalls = calls.filter(r =>
    (r.payload as CallPayload).is_connected === null
  ).length;

  // Review states
  const pendingReviewCount = records.filter(r => r.review_state === 'pending_review').length;
  const reviewedCount = records.filter(r => r.review_state === 'reviewed').length;
  const analysisStalCount = records.filter(r => r.review_state === 'analysis_stale').length;

  // Records by route — count by effective_routes, note multi-route inflation
  const routeCounts = new Map<RouteKey, number>();
  for (const record of records) {
    const routes = record.effective_routes.length > 0 ? record.effective_routes : [record.effective_route];
    for (const route of routes) {
      routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
    }
  }
  const recordsByRoute = (Object.keys(ROUTE_LABELS) as RouteKey[])
    .map(route => ({
      route,
      label: ROUTE_LABELS[route],
      count: routeCounts.get(route) ?? 0,
      color: ROUTE_COLORS[route],
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);

  // Records by type
  const recordsByType = [
    { type: 'Calls', count: calls.length },
    { type: 'Meetings', count: meetings.length },
  ];

  // Processing status breakdown
  const processingMap = new Map<string, number>();
  for (const record of records) {
    const status = (record.payload as CallPayload).classification_status
      ?? (record.payload as MeetingPayload).summary_status
      ?? 'unknown';
    processingMap.set(status, (processingMap.get(status) ?? 0) + 1);
  }
  const processingStatusBreakdown = Array.from(processingMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Transcript status breakdown
  const transcriptMap = new Map<string, number>();
  for (const record of records) {
    let status: string;
    if (record.source_type === 'call') {
      const p = record.payload as CallPayload;
      if (p.transcript !== null && p.transcript.trim().length > 0) status = 'usable_text';
      else if (p.transcript === null) status = 'no_transcript';
      else status = 'blank_transcript';
    } else {
      const tp = record.transcript_payload;
      if (tp === null) status = 'no_transcript_payload';
      else if (tp.turns.some(t => t.text.trim().length > 0)) status = 'usable_turns';
      else if (tp.unavailable_reason) status = 'unavailable: ' + tp.unavailable_reason;
      else status = 'empty_turns';
    }
    transcriptMap.set(status, (transcriptMap.get(status) ?? 0) + 1);
  }
  const transcriptStatusBreakdown = Array.from(transcriptMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRecords: records.length,
    callCount: calls.length,
    meetingCount: meetings.length,
    usableTranscriptCount: usableCallTranscripts + usableMeetingTranscripts,
    usableCallTranscripts,
    usableMeetingTranscripts,
    connectedCalls,
    notConnectedCalls,
    unknownConnectionCalls,
    totalCallsWithKnownConnection: callsWithKnownConnection.length,
    pendingReviewCount,
    reviewedCount,
    analysisStalCount,
    recordsByRoute,
    recordsByType,
    processingStatusBreakdown,
    transcriptStatusBreakdown,
  };
}

export function formatConnectionRate(connected: number, total: number): string {
  if (total === 0) return 'N/A';
  return `${((connected / total) * 100).toFixed(0)}%`;
}

export function getConversationDate(record: AppRecord): Date {
  if (record.source_type === 'call') {
    return new Date((record.payload as CallPayload).started_at);
  } else {
    return new Date((record.payload as MeetingPayload).starts_at);
  }
}

export function formatDateIST(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnlyIST(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
