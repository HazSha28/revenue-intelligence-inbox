/**
 * Evidence reference generation.
 * Meeting: source_id + 1-based turn number (or record_ref + turn number)
 * Call: exact short quote (≤10 words) + record_ref / source_id
 * Do NOT invent speaker timecodes or talk ratios.
 */

export interface EvidenceRef {
  display: string;       // human-readable label e.g. "[M01, turn 3]"
  sourceId: string;
  recordRef: string;
  turnIndex?: number;    // 1-based, meetings only
  quoteFragment?: string; // calls only
}

export function meetingEvidenceRef(
  recordRef: string,
  sourceId: string,
  turnIndex: number   // 1-based
): EvidenceRef {
  return {
    display: `[${recordRef}, turn ${turnIndex}]`,
    sourceId,
    recordRef,
    turnIndex,
  };
}

export function callEvidenceRef(
  recordRef: string,
  sourceId: string,
  quote: string
): EvidenceRef {
  // Truncate quote to max 10 words
  const words = quote.trim().split(/\s+/);
  const fragment = words.slice(0, 10).join(' ') + (words.length > 10 ? '…' : '');
  return {
    display: `[${recordRef}: "${fragment}"]`,
    sourceId,
    recordRef,
    quoteFragment: fragment,
  };
}

/**
 * Find all turns containing a keyword and return evidence refs.
 */
export function findTurnEvidence(
  recordRef: string,
  sourceId: string,
  turns: { text: string }[],
  keyword: string
): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  turns.forEach((turn, i) => {
    if (turn.text.toLowerCase().includes(keyword.toLowerCase())) {
      refs.push(meetingEvidenceRef(recordRef, sourceId, i + 1));
    }
  });
  return refs;
}
