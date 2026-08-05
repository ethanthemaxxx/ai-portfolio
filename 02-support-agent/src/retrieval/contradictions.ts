/**
 * B5 — contradiction detection over retrieved chunks (spec.md Q2, plan.md §3).
 *
 * Scope is deliberately narrow: quantities. Every rule in this corpus that could
 * disagree with another one is a number — $45, 30 days, 11:00 AM ET, 10%. A policy
 * conflict that isn't a number is a judgement call, and a lexical detector guessing at
 * those would produce a log nobody trusts.
 *
 * Two chunks conflict when they state a different value, in the same unit, next to at
 * least two of the same words. Canonical wins, the loser is dropped from the context,
 * and the pair goes in the log. The log is the deliverable — it tells the merchant
 * which help page has gone stale.
 *
 * Only pairs whose `authority` differs are considered, which is both what spec.md Q2
 * asks for and what the numbers support: run against every pair in this corpus, the
 * same heuristic flags 14 conflicts where there are none — "contact us within 7 days"
 * vs "within 30 days of delivery" share enough words to look like one rule stated
 * twice. Where authority can't decide the winner, this detector has nothing to offer
 * but noise, so it stays out.
 */

import type { Chunk, Contradiction, ContradictionSide, QuantityClaim } from '../types.ts';
import { tokenize } from './tokenize.ts';

/** How many words either side of a number count as its context. */
const ANCHOR_WINDOW = 5;

/** Below this, two numbers that happen to share a word aren't evidence of anything. */
const MIN_SHARED_ANCHORS = 2;

const MONEY = /\$\s?(\d+(?:\.\d+)?)/g;
const PERCENT = /(\d+(?:\.\d+)?)\s*%/g;
const CLOCK = /(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/gi;
const DURATION = /(\d+)(?:\s*[–—-]\s*\d+)?\s+(?:business\s+|calendar\s+)?(day|days|week|weeks|hour|hours)\b/gi;

/** Words that describe the measurement rather than what it's about. */
const UNIT_WORDS = new Set([
  'day', 'days', 'week', 'weeks', 'hour', 'hours', 'business', 'calendar', 'am', 'pm',
  'et', 'percent', 'flat', 'first', 'next', 'within', 'over', 'under', 'more', 'less',
  'least', 'up', 'per', 'each', 'every',
]);

export function extractClaims(text: string): QuantityClaim[] {
  const claims: QuantityClaim[] = [];

  const push = (unit: QuantityClaim['unit'], value: number, match: RegExpExecArray) => {
    claims.push({
      unit,
      value,
      anchors: anchorsAround(text, match.index, match.index + match[0].length),
      text: sentenceAround(text, match.index),
    });
  };

  for (const match of text.matchAll(MONEY)) {
    push('usd', Number(match[1]), match as RegExpExecArray);
  }
  for (const match of text.matchAll(PERCENT)) {
    push('percent', Number(match[1]), match as RegExpExecArray);
  }
  for (const match of text.matchAll(CLOCK)) {
    const hour = Number(match[1]) % 12;
    const meridiem = (match[3] ?? '').toLowerCase().startsWith('p') ? 12 : 0;
    push('clock', (hour + meridiem) * 60 + Number(match[2]), match as RegExpExecArray);
  }
  for (const match of text.matchAll(DURATION)) {
    const unit = (match[2] ?? '').toLowerCase().replace(/s$/, '') as 'day' | 'week' | 'hour';
    push(unit, Number(match[1]), match as RegExpExecArray);
  }

  return claims;
}

/** Distinctive words either side of the number — what it is a measurement *of*. */
function anchorsAround(text: string, start: number, end: number): string[] {
  const before = tokenize(text.slice(Math.max(0, start - 90), start)).slice(-ANCHOR_WINDOW);
  const after = tokenize(text.slice(end, end + 90)).slice(0, ANCHOR_WINDOW);
  return [...new Set([...before, ...after])].filter(
    (word) => !UNIT_WORDS.has(word) && !/^\d+$/.test(word),
  );
}

function sentenceAround(text: string, index: number): string {
  const newlineBefore = text.lastIndexOf('\n', index);
  const periodBefore = text.lastIndexOf('. ', index);
  const start = Math.max(
    newlineBefore === -1 ? 0 : newlineBefore + 1,
    periodBefore === -1 ? 0 : periodBefore + 2,
  );

  const newlineAfter = text.indexOf('\n', index);
  const periodAfter = text.indexOf('. ', index);
  const end = Math.min(
    newlineAfter === -1 ? text.length : newlineAfter,
    periodAfter === -1 ? text.length : periodAfter + 1,
  );

  return text.slice(start, Math.max(end, start + 1)).trim();
}

export function detectContradictions(chunks: Chunk[]): Contradiction[] {
  const claimsByChunk = chunks.map((chunk) => ({ chunk, claims: extractClaims(chunk.text) }));
  const found: Contradiction[] = [];

  for (let i = 0; i < claimsByChunk.length; i++) {
    for (let j = i + 1; j < claimsByChunk.length; j++) {
      const left = claimsByChunk[i];
      const right = claimsByChunk[j];
      if (!left || !right) continue;
      if (left.chunk.authority === right.chunk.authority) continue;

      const canonical = left.chunk.authority === 'canonical' ? left : right;
      const informational = canonical === left ? right : left;

      const contradiction = comparePair(canonical, informational);
      if (contradiction) found.push(contradiction);
    }
  }

  return found;
}

type Analysed = { chunk: Chunk; claims: QuantityClaim[] };

/**
 * At most one contradiction per pair of chunks. A chunk states several numbers about the
 * same rule — "$45 or more" and "under $45: flat $6.50" — and reporting every pairing of
 * them would turn one disagreement into four log lines saying the same thing.
 *
 * If any pairing of comparable claims agrees, the chunks agree. That is what stops
 * "free over $45, $6.50 below" from contradicting "free over $45": the $45s match, and
 * the $6.50 is the same rule seen from the other side.
 */
function comparePair(canonical: Analysed, informational: Analysed): Contradiction | null {
  let best: { a: QuantityClaim; b: QuantityClaim; shared: string[] } | null = null;

  for (const a of canonical.claims) {
    for (const b of informational.claims) {
      if (a.unit !== b.unit) continue;

      const shared = a.anchors.filter((anchor) => b.anchors.includes(anchor));
      if (shared.length < MIN_SHARED_ANCHORS) continue;
      if (a.value === b.value) return null;

      if (best === null || shared.length > best.shared.length) best = { a, b, shared };
    }
  }

  if (best === null) return null;
  return {
    unit: best.a.unit,
    sharedAnchors: best.shared,
    winner: side(canonical.chunk, best.a),
    loser: side(informational.chunk, best.b),
  };
}

function side(chunk: Chunk, claim: QuantityClaim): ContradictionSide {
  return {
    chunkId: chunk.id,
    docId: chunk.docId,
    heading: chunk.heading,
    authority: chunk.authority,
    value: claim.value,
    text: claim.text,
  };
}

/** Drop every chunk that lost a contradiction, preserving the order of the rest. */
export function applyContradictions<T extends Chunk>(
  chunks: T[],
  contradictions: Contradiction[],
): T[] {
  const dropped = new Set(contradictions.map((c) => c.loser.chunkId));
  return chunks.filter((chunk) => !dropped.has(chunk.id));
}

/** One line per pair, for the merchant-facing log. */
export function formatContradiction({
  unit,
  sharedAnchors,
  winner,
  loser,
}: Contradiction): string {
  return (
    `[${unit}] ${winner.docId} “${winner.heading}” says ${winner.value}, ` +
    `${loser.docId} “${loser.heading}” says ${loser.value} ` +
    `— shared context: ${sharedAnchors.join(', ')} — kept ${winner.docId} (canonical)`
  );
}
