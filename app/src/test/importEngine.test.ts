import { describe, it, expect, beforeEach } from 'vitest';
import { processDelivery, validateEnvelope } from '../lib/importEngine';
import type { DeliveryEnvelope, EnvelopeRecord } from '../types/source';
import type { AppRecord } from '../types/app';
import { INITIAL_DELIVERY, UPDATE_DELIVERY } from '../data';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCallRecord(overrides: Partial<EnvelopeRecord> = {}): EnvelopeRecord {
  return {
    record_ref: 'T01',
    source_type: 'call',
    source_id: 'test-call-001',
    payload: {
      id: 'test-call-001',
      external_call_id: 'EXT-T01',
      workspace_slug: 'ws-test',
      rep_email: 'test@example.com',
      rep_name: 'Test Rep',
      rep_user_id: null,
      direction: 'outbound',
      direction_raw: 'outbound',
      from_number: 'PHONE-X',
      to_number: 'PHONE-Y',
      started_at: '2026-08-21T10:00:00Z',
      duration_seconds: 60,
      talk_time_seconds: 55,
      speaker_count: 2,
      segment_count: 4,
      is_connected: true,
      is_conversation: true,
      observed_outcome: 'follow_up',
      classification_reason: null,
      classification_status: 'stored',
      is_campaign_call: false,
      first_dial_ever: false,
      first_connect_ever: false,
      prior_dials_ever: 2,
      prior_connects_ever: 1,
      summary: null,
      summary_status: 'stored',
      transcript: 'Hello, this is a test transcript for the follow-up discussion.',
    },
    transcript_payload: null,
    ...overrides,
  };
}

function makeEnvelope(revision: number, records: EnvelopeRecord[]): DeliveryEnvelope {
  return {
    batch_id: `batch-r${revision}`,
    revision,
    exported_at: '2026-08-22T09:00:00Z',
    records,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('processDelivery — initial import', () => {
  it('loads all 44 unique records from the initial delivery', () => {
    const result = processDelivery(INITIAL_DELIVERY, []);
    expect(result.records.length).toBe(44);
  });

  it('sets applied_revision to 1 for all records', () => {
    const result = processDelivery(INITIAL_DELIVERY, []);
    expect(result.records.every(r => r.applied_revision === 1)).toBe(true);
  });

  it('log entry shows 44 applied, 0 ignored', () => {
    const result = processDelivery(INITIAL_DELIVERY, []);
    expect(result.logEntry.applied).toBe(44);
    expect(result.logEntry.ignored).toBe(0);
    expect(result.logEntry.updated).toBe(0);
  });

  it('17 records have usable call transcripts initially', () => {
    const result = processDelivery(INITIAL_DELIVERY, []);
    const usableCalls = result.records.filter(r =>
      r.source_type === 'call' &&
      typeof (r.payload as { transcript: string | null }).transcript === 'string' &&
      ((r.payload as { transcript: string | null }).transcript ?? '').trim().length > 0
    );
    // meetings with usable turns (M07 has none initially)
    const usableMeetings = result.records.filter(r =>
      r.source_type === 'meeting' &&
      r.transcript_payload !== null &&
      r.transcript_payload.turns.some(t => t.text.trim().length > 0)
    );
    expect(usableCalls.length + usableMeetings.length).toBe(17);
  });

  it('identity uses (source_type, source_id) — no duplicates', () => {
    const result = processDelivery(INITIAL_DELIVERY, []);
    const keys = result.records.map(r => `${r.source_type}::${r.source_id}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});

describe('processDelivery — idempotency', () => {
  it('re-importing revision 1 when revision 1 is already applied ignores all records', () => {
    const first = processDelivery(INITIAL_DELIVERY, []);
    const second = processDelivery(INITIAL_DELIVERY, first.records);
    expect(second.logEntry.ignored).toBe(44);
    expect(second.logEntry.applied).toBe(0);
    expect(second.records.length).toBe(44);
  });

  it('re-importing reordered revision 1 is still idempotent', () => {
    const first = processDelivery(INITIAL_DELIVERY, []);
    const shuffled: DeliveryEnvelope = {
      ...INITIAL_DELIVERY,
      records: [...INITIAL_DELIVERY.records].reverse(),
    };
    const second = processDelivery(shuffled, first.records);
    expect(second.records.length).toBe(44);
    expect(second.logEntry.ignored).toBe(44);
  });
});

describe('processDelivery — revision 2 (update)', () => {
  it('revision 2 replaces M07 and total stays at 44', () => {
    const after1 = processDelivery(INITIAL_DELIVERY, []);
    const after2 = processDelivery(UPDATE_DELIVERY, after1.records);
    expect(after2.records.length).toBe(44);
  });

  it('M07 has applied_revision 2 after update', () => {
    const after1 = processDelivery(INITIAL_DELIVERY, []);
    const after2 = processDelivery(UPDATE_DELIVERY, after1.records);
    const m07 = after2.records.find(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a');
    expect(m07).toBeDefined();
    expect(m07!.applied_revision).toBe(2);
  });

  it('18 usable texts after update (M07 gains transcript)', () => {
    const after1 = processDelivery(INITIAL_DELIVERY, []);
    const after2 = processDelivery(UPDATE_DELIVERY, after1.records);
    const usable = after2.records.filter(r => {
      if (r.source_type === 'call') {
        const tx = (r.payload as { transcript: string | null }).transcript;
        return typeof tx === 'string' && tx.trim().length > 0;
      }
      return r.transcript_payload?.turns?.some(t => t.text.trim().length > 0) ?? false;
    });
    expect(usable.length).toBe(18);
  });

  it('M07 analysis is marked stale after transcript update', () => {
    const after1 = processDelivery(INITIAL_DELIVERY, []);
    const after2 = processDelivery(UPDATE_DELIVERY, after1.records);
    const m07 = after2.records.find(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a');
    expect(m07!.review_state).toBe('analysis_stale');
    expect(m07!.analysis.is_stale).toBe(true);
  });

  it('log entry shows 1 updated, 0 applied, 0 ignored for the update batch', () => {
    const after1 = processDelivery(INITIAL_DELIVERY, []);
    const result = processDelivery(UPDATE_DELIVERY, after1.records);
    expect(result.logEntry.updated).toBe(1);
    expect(result.logEntry.applied).toBe(0);
    expect(result.logEntry.ignored).toBe(0);
  });
});

describe('processDelivery — older revision ignored', () => {
  it('importing revision 1 after revision 2 does not downgrade M07', () => {
    const after1 = processDelivery(INITIAL_DELIVERY, []);
    const after2 = processDelivery(UPDATE_DELIVERY, after1.records);
    const after1again = processDelivery(INITIAL_DELIVERY, after2.records);

    const m07 = after1again.records.find(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a');
    expect(m07!.applied_revision).toBe(2);
    expect(after1again.records.length).toBe(44);
  });
});

describe('processDelivery — full replacement', () => {
  it('revision 2 replaces entire payload including null fields', () => {
    const after1 = processDelivery(INITIAL_DELIVERY, []);
    const after2 = processDelivery(UPDATE_DELIVERY, after1.records);
    const m07 = after2.records.find(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a');
    // After revision 2, transcript_payload should have 27 turns
    expect(m07!.transcript_payload?.turns?.length).toBe(27);
  });

  it('null transcript_payload in incoming fully replaces existing', () => {
    // Simulate: r1 has transcript, r2 nulls it
    const r1 = makeEnvelope(1, [makeCallRecord({ record_ref: 'T01', source_id: 'test-null-001' })]);
    const nulledRecord = makeCallRecord({
      record_ref: 'T01',
      source_id: 'test-null-001',
      payload: {
        ...makeCallRecord().payload,
        transcript: null,
      } as EnvelopeRecord['payload'],
    });
    const r2 = makeEnvelope(2, [nulledRecord]);
    const after1 = processDelivery(r1, []);
    const after2 = processDelivery(r2, after1.records);
    const rec = after2.records.find(r => r.source_id === 'test-null-001');
    expect((rec!.payload as { transcript: string | null }).transcript).toBeNull();
  });
});

describe('processDelivery — manual route preservation', () => {
  it('manual route override survives a newer source revision', () => {
    const e1 = makeEnvelope(1, [makeCallRecord()]);
    const after1 = processDelivery(e1, []);

    // Simulate manual override
    const withOverride: AppRecord[] = after1.records.map(r =>
      r.source_id === 'test-call-001'
        ? { ...r, effective_route: 'customer_support' as const, effective_routes: ['customer_support' as const], manual_override: true }
        : r
    );

    // Import revision 2
    const e2 = makeEnvelope(2, [makeCallRecord({ payload: { ...(makeCallRecord().payload as object), transcript: 'Updated content after version 2 upgrade.' } as EnvelopeRecord['payload'] })]);
    const after2 = processDelivery(e2, withOverride);

    const rec = after2.records.find(r => r.source_id === 'test-call-001');
    expect(rec!.manual_override).toBe(true);
    expect(rec!.effective_route).toBe('customer_support');
    expect(rec!.applied_revision).toBe(2);
  });
});

describe('processDelivery — invalid input', () => {
  it('throws on missing batch_id', () => {
    expect(() => validateEnvelope({ revision: 1, exported_at: 'x', records: [] })).toThrow();
  });

  it('throws on non-numeric revision', () => {
    expect(() => validateEnvelope({ batch_id: 'x', revision: 'one', exported_at: 'x', records: [] })).toThrow();
  });

  it('throws on missing records array', () => {
    expect(() => validateEnvelope({ batch_id: 'x', revision: 1, exported_at: 'x' })).toThrow();
  });

  it('records with missing source_id are logged as errors', () => {
    const e = makeEnvelope(1, [{ record_ref: 'BAD', source_type: 'call', source_id: '', payload: {} as never, transcript_payload: null }]);
    const result = processDelivery(e, []);
    expect(result.logEntry.errors).toBe(1);
    expect(result.records.length).toBe(0);
  });
});
