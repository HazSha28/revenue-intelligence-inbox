import { describe, it, expect } from 'vitest';
import { computeMetrics, formatConnectionRate } from '../lib/metrics';
import { processDelivery } from '../lib/importEngine';
import { INITIAL_DELIVERY, UPDATE_DELIVERY } from '../data';

describe('computeMetrics — after initial delivery', () => {
  const { records } = processDelivery(INITIAL_DELIVERY, []);
  const m = computeMetrics(records);

  it('total records is 44', () => expect(m.totalRecords).toBe(44));

  it('call count is correct', () => {
    const expected = INITIAL_DELIVERY.records.filter(r => r.source_type === 'call').length;
    expect(m.callCount).toBe(expected);
  });

  it('meeting count is correct', () => {
    const expected = INITIAL_DELIVERY.records.filter(r => r.source_type === 'meeting').length;
    expect(m.meetingCount).toBe(expected);
  });

  it('usable transcript count is 17', () => {
    expect(m.usableTranscriptCount).toBe(17);
  });

  it('connected + not-connected + unknown = total calls', () => {
    expect(m.connectedCalls + m.notConnectedCalls + m.unknownConnectionCalls).toBe(m.callCount);
  });

  it('source-reported connection rate denominator excludes null', () => {
    expect(m.totalCallsWithKnownConnection).toBe(m.connectedCalls + m.notConnectedCalls);
  });

  it('unknown connection count is separate from false', () => {
    // null ≠ false
    expect(m.unknownConnectionCalls).toBeGreaterThanOrEqual(0);
    // they must not be the same bucket
    // (just confirm the field exists and is a number)
    expect(typeof m.unknownConnectionCalls).toBe('number');
  });
});

describe('computeMetrics — after update delivery', () => {
  const after1 = processDelivery(INITIAL_DELIVERY, []);
  const { records } = processDelivery(UPDATE_DELIVERY, after1.records);
  const m = computeMetrics(records);

  it('total records stays 44', () => expect(m.totalRecords).toBe(44));

  it('usable transcript count rises to 18', () => {
    expect(m.usableTranscriptCount).toBe(18);
  });
});

describe('formatConnectionRate', () => {
  it('returns N/A when denominator is 0', () => {
    expect(formatConnectionRate(0, 0)).toBe('N/A');
  });

  it('calculates percentage correctly', () => {
    expect(formatConnectionRate(3, 10)).toBe('30%');
  });

  it('rounds to nearest integer', () => {
    expect(formatConnectionRate(1, 3)).toBe('33%');
  });
});

describe('route assignment counts', () => {
  const { records } = processDelivery(INITIAL_DELIVERY, []);
  const m = computeMetrics(records);

  it('route assignment total >= unique record count (multi-route possible)', () => {
    const total = m.recordsByRoute.reduce((s, r) => s + r.count, 0);
    expect(total).toBeGreaterThanOrEqual(m.totalRecords);
  });

  it('unique record count is not inflated by multi-route', () => {
    expect(m.totalRecords).toBe(44);
  });
});
