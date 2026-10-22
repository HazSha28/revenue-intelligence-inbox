import { describe, it, expect } from 'vitest';
import { meetingEvidenceRef, callEvidenceRef, findTurnEvidence } from '../lib/evidence';

describe('meetingEvidenceRef', () => {
  it('formats as [record_ref, turn N]', () => {
    const ref = meetingEvidenceRef('M01', 'source-abc', 3);
    expect(ref.display).toBe('[M01, turn 3]');
    expect(ref.turnIndex).toBe(3);
    expect(ref.sourceId).toBe('source-abc');
  });

  it('uses 1-based turn number', () => {
    const ref = meetingEvidenceRef('M07', 'source-xyz', 1);
    expect(ref.display).toBe('[M07, turn 1]');
  });
});

describe('callEvidenceRef', () => {
  it('formats as [record_ref: "fragment"]', () => {
    const ref = callEvidenceRef('C01', 'source-001', 'Hello, this is a test transcript string here.');
    expect(ref.display).toContain('[C01:');
    expect(ref.display).toContain('"');
    expect(ref.quoteFragment).toBeDefined();
  });

  it('truncates to max 10 words', () => {
    const longQuote = 'one two three four five six seven eight nine ten eleven twelve';
    const ref = callEvidenceRef('C01', 'source-001', longQuote);
    const words = ref.quoteFragment!.replace('…', '').trim().split(/\s+/);
    expect(words.length).toBeLessThanOrEqual(10);
  });

  it('short quotes not truncated', () => {
    const ref = callEvidenceRef('C01', 'source-001', 'Short quote');
    expect(ref.quoteFragment).toBe('Short quote');
    expect(ref.display).not.toContain('…');
  });
});

describe('findTurnEvidence', () => {
  const turns = [
    { text: 'Hello this is turn one' },
    { text: 'Turn two discusses API access' },
    { text: 'Turn three is about invoicing and payments' },
  ];

  it('returns matching turn evidence refs', () => {
    const refs = findTurnEvidence('M01', 'source-001', turns, 'API');
    expect(refs.length).toBe(1);
    expect(refs[0].turnIndex).toBe(2);
  });

  it('is case-insensitive', () => {
    const refs = findTurnEvidence('M01', 'source-001', turns, 'api');
    expect(refs.length).toBe(1);
  });

  it('returns empty when no match', () => {
    const refs = findTurnEvidence('M01', 'source-001', turns, 'nonexistent');
    expect(refs.length).toBe(0);
  });

  it('returns multiple matches', () => {
    const refs = findTurnEvidence('M01', 'source-001', turns, 'turn');
    expect(refs.length).toBe(3);
  });
});
