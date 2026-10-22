import { describe, it, expect } from 'vitest';
import { buildManifest, manifestToCSV } from '../lib/export';
import { processDelivery } from '../lib/importEngine';
import { INITIAL_DELIVERY, UPDATE_DELIVERY } from '../data';

describe('buildManifest', () => {
  const { records } = processDelivery(INITIAL_DELIVERY, []);
  const manifest = buildManifest(records);

  it('total_records matches record count', () => {
    expect(manifest.total_records).toBe(records.length);
    expect(manifest.records.length).toBe(records.length);
  });

  it('every record has required fields', () => {
    for (const r of manifest.records) {
      expect(r.source_type).toBeDefined();
      expect(r.source_id).toBeDefined();
      expect(r.record_ref).toBeDefined();
      expect(typeof r.applied_revision).toBe('number');
      expect(r.suggested_route).toBeDefined();
      expect(r.effective_route).toBeDefined();
      expect(typeof r.manual_override).toBe('boolean');
      expect(Array.isArray(r.output_paths)).toBe(true);
      expect(r.output_paths.length).toBeGreaterThan(0);
      expect(r.processing_state).toBeDefined();
      expect(r.review_state).toBeDefined();
      expect(['current', 'stale', 'pending']).toContain(r.analysis_freshness);
      expect(r.conversation_date).toBeDefined();
    }
  });

  it('output paths are relative (no absolute paths)', () => {
    for (const r of manifest.records) {
      for (const path of r.output_paths) {
        expect(path.startsWith('/')).toBe(false);
        expect(path).not.toMatch(/^[A-Za-z]:\\/);
        expect(path.startsWith('outputs/')).toBe(true);
      }
    }
  });

  it('no duplicate active output paths across records', () => {
    const allPaths = manifest.records.flatMap(r => r.output_paths);
    const unique = new Set(allPaths);
    expect(unique.size).toBe(allPaths.length);
  });

  it('repeated buildManifest call produces same paths (idempotent)', () => {
    const m2 = buildManifest(records);
    const paths1 = manifest.records.map(r => r.output_paths[0]).sort();
    const paths2 = m2.records.map(r => r.output_paths[0]).sort();
    expect(paths1).toEqual(paths2);
  });
});

describe('buildManifest — after update', () => {
  const after1 = processDelivery(INITIAL_DELIVERY, []);
  const { records } = processDelivery(UPDATE_DELIVERY, after1.records);
  const manifest = buildManifest(records);

  it('M07 shows applied_revision 2', () => {
    const m07 = manifest.records.find(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a');
    expect(m07!.applied_revision).toBe(2);
  });

  it('M07 analysis_freshness is stale', () => {
    const m07 = manifest.records.find(r => r.source_id === '4f304fff-fd40-5cfc-a366-0a134c445c2a');
    expect(m07!.analysis_freshness).toBe('stale');
  });
});

describe('manifestToCSV', () => {
  const { records } = processDelivery(INITIAL_DELIVERY, []);
  const manifest = buildManifest(records);
  const csv = manifestToCSV(manifest);

  it('produces non-empty CSV string', () => {
    expect(csv.length).toBeGreaterThan(0);
  });

  it('has a header row', () => {
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('source_type');
    expect(firstLine).toContain('source_id');
    expect(firstLine).toContain('record_ref');
    expect(firstLine).toContain('applied_revision');
    expect(firstLine).toContain('effective_route');
    expect(firstLine).toContain('manual_override');
  });

  it('has correct number of data rows', () => {
    const lines = csv.split('\n').filter(l => l.trim().length > 0);
    expect(lines.length).toBe(records.length + 1); // +1 for header
  });
});
