import type { AppRecord, ImportLogEntry, ImportRecordDetail, RecordAnalysis, ReviewState, RouteKey } from '../types/app';
import type { DeliveryEnvelope, EnvelopeRecord, TranscriptPayload } from '../types/source';
import { deriveRoutes, primaryRoute } from './routing';
import { generateAnalysis } from './analysis';

// ── helpers ──────────────────────────────────────────────────────────────────

function recordKey(sourceType: string, sourceId: string) {
  return `${sourceType}::${sourceId}`;
}

function transcriptChanged(
  existing: AppRecord,
  incoming: EnvelopeRecord,
): boolean {
  if (existing.source_type === 'call') {
    const oldTx = (existing.payload as { transcript: string | null }).transcript ?? null;
    const newTx = (incoming.payload as { transcript: string | null }).transcript ?? null;
    return oldTx !== newTx;
  }
  // meeting — compare full turns JSON
  const oldTurns = JSON.stringify(existing.transcript_payload?.turns ?? []);
  const newTurns = JSON.stringify(incoming.transcript_payload?.turns ?? []);
  return oldTurns !== newTurns;
}

function freshAnalysis(record: EnvelopeRecord, revision: number): RecordAnalysis {
  const routes = deriveRoutes(record.source_type, record.payload, record.transcript_payload);
  return generateAnalysis(
    record.source_type,
    record.payload,
    record.transcript_payload,
    routes,
    revision,
  );
}

function createNewRecord(record: EnvelopeRecord, revision: number): AppRecord {
  const routes = deriveRoutes(record.source_type, record.payload, record.transcript_payload);
  const primary = primaryRoute(routes);
  const analysis = generateAnalysis(
    record.source_type,
    record.payload,
    record.transcript_payload,
    routes,
    revision,
  );
  const now = new Date().toISOString();
  return {
    source_type: record.source_type,
    source_id: record.source_id,
    record_ref: record.record_ref,
    applied_revision: revision,
    payload: record.payload,
    transcript_payload: record.transcript_payload,
    suggested_route: primary,
    suggested_routes: routes,
    analysis,
    effective_route: primary,
    effective_routes: routes,
    manual_override: false,
    review_state: 'pending_review',
    manager_notes: '',
    first_imported_at: now,
    last_updated_at: now,
  };
}

function applyUpdate(existing: AppRecord, record: EnvelopeRecord, revision: number): AppRecord {
  const txChanged = transcriptChanged(existing, record);
  const routes = deriveRoutes(record.source_type, record.payload, record.transcript_payload);
  const primary = primaryRoute(routes);
  const analysis = txChanged
    ? { ...freshAnalysis(record, revision), is_stale: true }
    : existing.analysis;

  const reviewState: ReviewState = txChanged ? 'analysis_stale' : existing.review_state;

  return {
    ...existing,
    // updated source fields
    record_ref: record.record_ref,
    applied_revision: revision,
    payload: record.payload,
    transcript_payload: record.transcript_payload,
    // updated suggested (derived from new source)
    suggested_route: primary,
    suggested_routes: routes,
    analysis,
    review_state: reviewState,
    // preserved manager-controlled fields
    effective_route: existing.manual_override ? existing.effective_route : primary,
    effective_routes: existing.manual_override ? existing.effective_routes : routes,
    manual_override: existing.manual_override,
    manager_notes: existing.manager_notes,
    last_updated_at: new Date().toISOString(),
  };
}

// ── main export ───────────────────────────────────────────────────────────────

export interface ImportResult {
  records: AppRecord[];
  logEntry: ImportLogEntry;
}

export function processDelivery(
  envelope: DeliveryEnvelope,
  currentRecords: AppRecord[],
): ImportResult {
  // Build lookup map keyed by (source_type, source_id)
  const map = new Map<string, AppRecord>();
  for (const rec of currentRecords) {
    map.set(recordKey(rec.source_type, rec.source_id), rec);
  }

  const details: ImportRecordDetail[] = [];
  let applied = 0;
  let updated = 0;
  let ignored = 0;
  let errors = 0;

  for (const record of envelope.records) {
    try {
      if (!record.source_type || !record.source_id) {
        details.push({
          record_ref: record.record_ref ?? '?',
          source_type: record.source_type ?? 'call',
          source_id: record.source_id ?? '?',
          status: 'error',
          reason: 'Missing source_type or source_id',
        });
        errors++;
        continue;
      }

      const key = recordKey(record.source_type, record.source_id);
      const existing = map.get(key);

      if (existing) {
        if (existing.applied_revision >= envelope.revision) {
          details.push({
            record_ref: record.record_ref,
            source_type: record.source_type,
            source_id: record.source_id,
            status: 'ignored',
            reason: `Already at revision ${existing.applied_revision} ≥ incoming ${envelope.revision}`,
            previous_revision: existing.applied_revision,
            new_revision: envelope.revision,
          });
          ignored++;
        } else {
          const updated_record = applyUpdate(existing, record, envelope.revision);
          map.set(key, updated_record);
          details.push({
            record_ref: record.record_ref,
            source_type: record.source_type,
            source_id: record.source_id,
            status: 'updated',
            previous_revision: existing.applied_revision,
            new_revision: envelope.revision,
          });
          updated++;
        }
      } else {
        const newRec = createNewRecord(record, envelope.revision);
        map.set(key, newRec);
        details.push({
          record_ref: record.record_ref,
          source_type: record.source_type,
          source_id: record.source_id,
          status: 'applied',
          new_revision: envelope.revision,
        });
        applied++;
      }
    } catch (err) {
      details.push({
        record_ref: record.record_ref ?? '?',
        source_type: record.source_type ?? 'call',
        source_id: record.source_id ?? '?',
        status: 'error',
        reason: String(err),
      });
      errors++;
    }
  }

  const logEntry: ImportLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    batch_id: envelope.batch_id,
    revision: envelope.revision,
    exported_at: envelope.exported_at,
    total_in_batch: envelope.records.length,
    applied,
    updated,
    ignored,
    errors,
    details,
  };

  return {
    records: Array.from(map.values()),
    logEntry,
  };
}

export function validateEnvelope(raw: unknown): DeliveryEnvelope {
  if (!raw || typeof raw !== 'object') throw new Error('Not a JSON object');
  const obj = raw as Record<string, unknown>;
  if (typeof obj.batch_id !== 'string') throw new Error('Missing batch_id');
  if (typeof obj.revision !== 'number') throw new Error('Missing or non-numeric revision');
  if (typeof obj.exported_at !== 'string') throw new Error('Missing exported_at');
  if (!Array.isArray(obj.records)) throw new Error('Missing records array');
  return raw as DeliveryEnvelope;
}
