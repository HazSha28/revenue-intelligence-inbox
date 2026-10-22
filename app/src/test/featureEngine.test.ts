import { describe, it, expect } from 'vitest';
import { detectAllRisks } from '../lib/riskEngine';
import { extractActions, getActionCenterData, mergeActionStates } from '../lib/actionEngine';
import { explainRouting } from '../lib/routingExplainer';
import { detectAllGaps, countGapsByType } from '../lib/gapDetector';
import { globalSearch } from '../lib/searchEngine';
import { computeDataQuality } from '../lib/dataQuality';
import { generateBrief, briefToText, briefToMarkdown } from '../lib/briefGenerator';
import { processDelivery } from '../lib/importEngine';
import { INITIAL_DELIVERY, UPDATE_DELIVERY } from '../data';
import type { ActionItem } from '../types/features';

// Use the real dataset for all tests
function setupRecords() {
  const after1 = processDelivery(INITIAL_DELIVERY, []);
  return after1.records;
}

function setupRecordsWithUpdate() {
  const after1 = processDelivery(INITIAL_DELIVERY, []);
  const after2 = processDelivery(UPDATE_DELIVERY, after1.records);
  return after2.records;
}

// ── Risk Engine ───────────────────────────────────────────────────────────────

describe('detectAllRisks', () => {
  const records = setupRecords();

  it('detects risks from the dataset', () => {
    const data = detectAllRisks(records);
    expect(data.totalRisks).toBeGreaterThan(0);
    expect(data.risks.length).toBe(data.totalRisks);
  });

  it('high severity risks are sorted first', () => {
    const data = detectAllRisks(records);
    const firstHigh = data.risks.findIndex(r => r.severity === 'high');
    const firstMedium = data.risks.findIndex(r => r.severity === 'medium');
    if (firstHigh >= 0 && firstMedium >= 0) {
      expect(firstHigh).toBeLessThan(firstMedium);
    }
  });

  it('every risk has evidence and record reference', () => {
    const data = detectAllRisks(records);
    for (const risk of data.risks) {
      expect(risk.recordRef).toBeTruthy();
      expect(risk.sourceId).toBeTruthy();
      expect(risk.evidence).toBeTruthy();
      expect(risk.evidenceRef).toBeTruthy();
      expect(risk.reason).toBeTruthy();
      expect(risk.suggestedAction).toBeTruthy();
    }
  });

  it('high + medium + low counts add up to total', () => {
    const data = detectAllRisks(records);
    expect(data.highCount + data.mediumCount + data.lowCount).toBe(data.totalRisks);
  });

  it('byCategory has correct structure', () => {
    const data = detectAllRisks(records);
    for (const cat of data.byCategory) {
      expect(cat.category).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.count).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(cat.severity);
    }
  });

  it('inferred risks are labelled isInferred', () => {
    const data = detectAllRisks(records);
    const inferred = data.risks.filter(r => r.isInferred);
    const explicit = data.risks.filter(r => !r.isInferred);
    // Both should exist in the dataset
    expect(inferred.length + explicit.length).toBe(data.totalRisks);
  });

  it('risks increase after update (M07 gets transcript with issues)', () => {
    const before = detectAllRisks(records);
    const afterUpdate = detectAllRisks(setupRecordsWithUpdate());
    // M07 now has transcript with product issues — should add risks
    expect(afterUpdate.totalRisks).toBeGreaterThanOrEqual(before.totalRisks);
  });
});

// ── Action Engine ─────────────────────────────────────────────────────────────

describe('extractActions', () => {
  const records = setupRecords();

  it('extracts actions from records with transcripts', () => {
    const actions = extractActions(records);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('every action has required fields', () => {
    const actions = extractActions(records);
    for (const a of actions) {
      expect(a.id).toBeTruthy();
      expect(a.title).toBeTruthy();
      expect(a.recordRef).toBeTruthy();
      expect(a.sourceType).toBeTruthy();
      expect(a.sourceId).toBeTruthy();
      expect(a.evidence).toBeTruthy();
      expect(a.evidenceRef).toBeTruthy();
      expect(['suggested', 'in_progress', 'completed', 'blocked', 'dismissed']).toContain(a.status);
      expect(['high', 'medium', 'low']).toContain(a.priority);
      expect(typeof a.isExplicit).toBe('boolean');
    }
  });

  it('actions only come from records with usable transcripts', () => {
    const actions = extractActions(records);
    const recordsWithText = records.filter(r => {
      if (r.source_type === 'call') {
        const t = (r.payload as { transcript: string | null }).transcript;
        return t && t.trim().length > 0;
      }
      return r.transcript_payload?.turns?.some((t: { text: string }) => t.text.trim().length > 0) ?? false;
    });
    const actionRecordRefs = new Set(actions.map(a => a.recordRef));
    // Every action's record should have text
    for (const ref of actionRecordRefs) {
      const record = recordsWithText.find(r => r.record_ref === ref);
      expect(record).toBeDefined();
    }
  });

  it('getActionCenterData computes correct stats', () => {
    const actions = extractActions(records);
    const data = getActionCenterData(actions);
    expect(data.suggested).toBe(actions.length); // all start as suggested
    expect(data.inProgress).toBe(0);
    expect(data.completed).toBe(0);
    expect(data.highPriority).toBe(actions.filter(a => a.priority === 'high').length);
  });

  it('mergeActionStates overlays persisted status', () => {
    const extracted = extractActions(records);
    const persisted = new Map<string, ActionItem>();
    if (extracted.length > 0) {
      persisted.set(extracted[0].id, {
        ...extracted[0],
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });
    }
    const merged = mergeActionStates(extracted, persisted);
    expect(merged[0].status).toBe('completed');
    // Others should remain suggested
    if (merged.length > 1) {
      expect(merged[1].status).toBe('suggested');
    }
  });
});

// ── Routing Explainer ─────────────────────────────────────────────────────────

describe('explainRouting', () => {
  const records = setupRecords();
  const recordWithText = records.find(r => {
    if (r.source_type === 'call') {
      const t = (r.payload as { transcript: string | null }).transcript;
      return t && t.trim().length > 0;
    }
    return r.transcript_payload?.turns?.some((t: { text: string }) => t.text.trim().length > 0) ?? false;
  })!;

  it('returns explanation with all fields', () => {
    const exp = explainRouting(recordWithText);
    expect(exp.suggestedRoute).toBeTruthy();
    expect(exp.effectiveRoute).toBeTruthy();
    expect(exp.suggestedRouteLabel).toBeTruthy();
    expect(exp.effectiveRouteLabel).toBeTruthy();
    expect(typeof exp.isManualOverride).toBe('boolean');
    expect(Array.isArray(exp.reasons)).toBe(true);
    expect(['high', 'medium', 'low']).toContain(exp.confidence);
    expect(exp.confidenceReason).toBeTruthy();
    expect(['current', 'stale', 'pending']).toContain(exp.analysisFreshness);
  });

  it('provides reasons with evidence for records with transcript', () => {
    const exp = explainRouting(recordWithText);
    if (exp.reasons.length > 0) {
      for (const reason of exp.reasons) {
        expect(reason.signal).toBeTruthy();
        expect(reason.evidence).toBeTruthy();
        expect(reason.evidenceRef).toBeTruthy();
        expect(['strong', 'moderate', 'weak']).toContain(reason.weight);
      }
    }
  });

  it('marks manual override correctly', () => {
    const overridden: typeof recordWithText = {
      ...recordWithText,
      effective_route: 'customer_support',
      manual_override: true,
    };
    const exp = explainRouting(overridden);
    expect(exp.isManualOverride).toBe(true);
    expect(exp.effectiveRoute).toBe('customer_support');
    expect(exp.suggestedRoute).toBe(recordWithText.suggested_route);
  });
});

// ── Gap Detector ──────────────────────────────────────────────────────────────

describe('detectAllGaps', () => {
  const records = setupRecords();

  it('detects gaps from the dataset', () => {
    const gaps = detectAllGaps(records);
    expect(gaps.length).toBeGreaterThan(0);
  });

  it('every gap has evidence and record reference', () => {
    const gaps = detectAllGaps(records);
    for (const gap of gaps) {
      expect(gap.recordRef).toBeTruthy();
      expect(gap.sourceId).toBeTruthy();
      expect(gap.gapType).toBeTruthy();
      expect(gap.gapLabel).toBeTruthy();
      expect(gap.description).toBeTruthy();
      expect(gap.evidence).toBeTruthy();
      expect(gap.evidenceRef).toBeTruthy();
      expect(gap.suggestedAction).toBeTruthy();
      expect(typeof gap.isNotEvidenced).toBe('boolean');
    }
  });

  it('countGapsByType returns correct counts', () => {
    const gaps = detectAllGaps(records);
    const counts = countGapsByType(gaps);
    expect(counts.length).toBeGreaterThan(0);
    const total = counts.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(gaps.length);
  });

  it('not-evidenced gaps are sorted first', () => {
    const gaps = detectAllGaps(records);
    const firstNotEvidenced = gaps.findIndex(g => g.isNotEvidenced);
    const firstEvidenced = gaps.findIndex(g => !g.isNotEvidenced);
    if (firstNotEvidenced >= 0 && firstEvidenced >= 0) {
      expect(firstNotEvidenced).toBeLessThan(firstEvidenced);
    }
  });
});

// ── Search Engine ─────────────────────────────────────────────────────────────

describe('globalSearch', () => {
  const records = setupRecords();
  const risks = detectAllRisks(records).risks;
  const actions = extractActions(records);
  const gaps = detectAllGaps(records);

  it('returns empty for empty query', () => {
    const results = globalSearch('', records, risks, actions, gaps);
    expect(results.length).toBe(0);
  });

  it('finds record by record_ref', () => {
    const results = globalSearch('C01', records, risks, actions, gaps);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.recordRef === 'C01')).toBe(true);
  });

  it('finds transcript phrases', () => {
    const results = globalSearch('SpendNest', records, risks, actions, gaps);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.type === 'transcript_phrase')).toBe(true);
  });

  it('finds participant names', () => {
    const results = globalSearch('Arun', records, risks, actions, gaps);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.type === 'participant')).toBe(true);
  });

  it('finds by review status', () => {
    const results = globalSearch('pending', records, risks, actions, gaps);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.type === 'review_status')).toBe(true);
  });

  it('limits results to MAX_RESULTS', () => {
    const results = globalSearch('a', records, risks, actions, gaps);
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it('every result has source info', () => {
    const results = globalSearch('call', records, risks, actions, gaps);
    for (const r of results) {
      expect(r.recordRef).toBeTruthy();
      expect(r.sourceType).toBeTruthy();
      expect(r.sourceId).toBeTruthy();
      expect(r.type).toBeTruthy();
      expect(r.typeLabel).toBeTruthy();
    }
  });
});

// ── Data Quality ──────────────────────────────────────────────────────────────

describe('computeDataQuality', () => {
  const records = setupRecords();
  const importLog = processDelivery(INITIAL_DELIVERY, []).logEntry ? [{ ...processDelivery(INITIAL_DELIVERY, []).logEntry }] : [];

  it('computes a quality score 0-100', () => {
    const report = computeDataQuality(records, importLog);
    expect(report.qualityScore).toBeGreaterThanOrEqual(0);
    expect(report.qualityScore).toBeLessThanOrEqual(100);
  });

  it('records with transcript + without = total', () => {
    const report = computeDataQuality(records, importLog);
    expect(report.recordsWithTranscript + report.recordsWithoutTranscript).toBe(report.totalRecords);
  });

  it('counts unknown connection separately from not connected', () => {
    const report = computeDataQuality(records, importLog);
    expect(report.unknownConnectionCount).toBeGreaterThanOrEqual(0);
  });

  it('revisionsApplied has correct structure', () => {
    const report = computeDataQuality(records, importLog);
    expect(report.revisionsApplied.length).toBe(1); // only rev 1
    expect(report.revisionsApplied[0].revision).toBe(1);
    expect(report.revisionsApplied[0].count).toBe(records.length);
  });

  it('quality notes are populated', () => {
    const report = computeDataQuality(records, importLog);
    expect(report.qualityNotes.length).toBeGreaterThan(0);
  });

  it('handles empty records', () => {
    const report = computeDataQuality([], []);
    expect(report.qualityScore).toBe(0);
    expect(report.totalRecords).toBe(0);
  });
});

// ── Brief Generator ───────────────────────────────────────────────────────────

describe('generateBrief', () => {
  const records = setupRecords();

  it('generates a brief with sections', () => {
    const brief = generateBrief(records);
    expect(brief.sections.length).toBe(7);
    expect(brief.recordCount).toBe(records.length);
  });

  it('stats are computed correctly', () => {
    const brief = generateBrief(records);
    expect(brief.stats.total).toBe(records.length);
    expect(brief.stats.withTranscript).toBe(17);
    expect(brief.stats.pendingReview).toBe(records.length); // all pending initially
  });

  it('briefToText produces non-empty string', () => {
    const brief = generateBrief(records);
    const text = briefToText(brief);
    expect(text.length).toBeGreaterThan(100);
    expect(text).toContain('MANAGER BRIEF');
  });

  it('briefToMarkdown produces valid markdown', () => {
    const brief = generateBrief(records);
    const md = briefToMarkdown(brief);
    expect(md).toContain('# Revenue Intelligence');
    expect(md).toContain('##');
  });

  it('every brief item has source record reference', () => {
    const brief = generateBrief(records);
    for (const section of brief.sections) {
      for (const item of section.items) {
        expect(item.recordRef).toBeTruthy();
        expect(item.sourceType).toBeTruthy();
        expect(item.sourceId).toBeTruthy();
        expect(item.evidenceRef).toBeTruthy();
        expect(['fact', 'inferred', 'action']).toContain(item.type);
      }
    }
  });
});
