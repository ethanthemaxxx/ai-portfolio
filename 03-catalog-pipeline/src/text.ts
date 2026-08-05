/**
 * Text primitives shared by the ledger and the validators. Kept in one place so
 * that "does this term appear" means exactly the same thing when building the
 * ledger and when checking output against it.
 */

const COMBINING_MARKS_G = /[̀-ͯ]/g;
const COMBINING_MARK = /[̀-ͯ]/;

/** Lowercase, strip accents, collapse everything non-alphanumeric to a space. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS_G, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface NormalizedWithMap {
  /** Normalized text, space-padded at both ends so word boundaries are simple. */
  padded: string;
  /** For each character of `padded`, the index it came from in the original. */
  map: number[];
}

/**
 * Normalize while remembering where every character came from, so a match can be
 * reported at its real offset in the original copy.
 */
function normalizeWithMap(input: string): NormalizedWithMap {
  const chars: string[] = [' '];
  const map: number[] = [0];
  let lastWasSpace = true;
  const decomposed = input.normalize('NFD');
  let originalIndex = 0;
  // NFD can expand a character into several; walk the decomposed string but
  // track the original index by counting non-combining characters.
  for (const ch of decomposed) {
    if (COMBINING_MARK.test(ch)) continue;
    const lower = ch.toLowerCase();
    const isAlnum = /[a-z0-9]/.test(lower);
    if (isAlnum) {
      chars.push(lower);
      map.push(originalIndex);
      lastWasSpace = false;
    } else if (!lastWasSpace) {
      chars.push(' ');
      map.push(originalIndex);
      lastWasSpace = true;
    }
    originalIndex += 1;
  }
  if (!lastWasSpace) {
    chars.push(' ');
    map.push(input.length);
  }
  return { padded: chars.join(''), map };
}

/** Normalized, space-padded form used for word-boundary lookups. */
export function normalizedWords(input: string): string {
  return normalizeWithMap(input).padded;
}

/**
 * Reduce a numeric token to a canonical value string.
 * `"1,750"` → `"1750"`, `"$6.50"` → `"6.5"`, `"250g"` → `"250"`, `"02"` → `"2"`.
 * Returns `null` when there is no parsable number.
 */
export function canonicalizeNumber(raw: string): string | null {
  const cleaned = raw.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const trimmed = cleaned.replace(/^\.+/, '').replace(/\.+$/, '');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) return null;
  return String(value);
}

export interface NumberToken {
  /** The token exactly as it appears in the text. */
  raw: string;
  /** Canonical numeric value, e.g. `"1750"`. */
  canonical: string;
  offset: number;
}

// A unit suffix only counts when it ends the word: "250g" is 250 grams, but the
// "m" of "1,750 meters" must not be swallowed as a unit.
const NUMBER_TOKEN = /\$?\d[\d.,]*(?:\s?(?:kg|g|oz|ml|mm|cm|ct|%|l|m))?(?![a-z0-9])/gi;

/** Every digit-bearing token in a piece of text, with its offset. */
export function extractNumberTokens(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  NUMBER_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NUMBER_TOKEN.exec(text)) !== null) {
    const raw = match[0].trim();
    const canonical = canonicalizeNumber(raw);
    if (canonical !== null) out.push({ raw, canonical, offset: match.index });
  }
  return out;
}

export interface TermHit {
  term: string;
  offset: number;
  evidence: string;
}

/**
 * Find a term in text on word boundaries, accent- and case-insensitively.
 * Multi-word terms match across any run of separators, so `fair-trade`,
 * `Fair Trade` and `fair   trade` are the same term.
 */
export function findTerm(term: string, text: string): TermHit | null {
  const { padded, map } = normalizeWithMap(text);
  const needle = normalizedWords(term);
  if (needle.trim().length === 0) return null;
  const index = padded.indexOf(needle);
  if (index === -1) return null;
  const offset = map[index + 1] ?? 0;
  return { term, offset, evidence: excerpt(text, offset, needle.trim().length) };
}

export function findAllTerms(terms: readonly string[], text: string): TermHit[] {
  const hits: TermHit[] = [];
  for (const term of terms) {
    const hit = findTerm(term, text);
    if (hit) hits.push(hit);
  }
  return hits.sort((a, b) => a.offset - b.offset || a.term.localeCompare(b.term));
}

export function containsTerm(term: string, text: string): boolean {
  return findTerm(term, text) !== null;
}

export function excerpt(text: string, offset: number, length: number): string {
  const start = Math.max(0, offset - 20);
  const end = Math.min(text.length, offset + length + 20);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
