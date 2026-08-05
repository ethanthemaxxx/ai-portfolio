import type { Locale } from '../types.ts';

/**
 * Deterministic text measurements. Everything here is a pure function of its
 * input — no clock, no randomness, no locale detection. These are the numbers
 * the style guide is built from (plan.md D1).
 */

export function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .trim();
}

export function splitParagraphs(text: string): string[] {
  if (/<p[\s>]/i.test(text)) {
    const out: string[] = [];
    const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const inner = stripHtml(match[1]).trim();
      if (inner) out.push(inner);
    }
    return out;
  }
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Sentence split on terminal punctuation followed by whitespace. Decimal points
 * ("$7.10") are safe because they are not followed by a space. Abbreviations
 * ending in a period followed by a space would split incorrectly; the brand
 * voice does not use them, and this limitation is documented rather than
 * papered over with a heuristic that would be wrong in other ways.
 */
export function splitSentences(text: string): string[] {
  const plain = stripHtml(text).replace(/\s+/g, ' ').trim();
  if (!plain) return [];
  return plain
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-zÀ-ÿ0-9]/.test(s));
}

export function words(text: string): string[] {
  return stripHtml(text)
    .split(/\s+/)
    .map((w) => w.replace(/^[^0-9A-Za-zÀ-ÿ$]+|[^0-9A-Za-zÀ-ÿ%]+$/g, ''))
    .filter((w) => /[0-9A-Za-zÀ-ÿ]/.test(w));
}

/**
 * English syllable heuristic: count vowel groups, drop a silent trailing "e",
 * floor at one. Good enough for a readability score, which is itself an
 * approximation — and deterministic, which is what the gate needs.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch–Kincaid grade level. English only (spec.md §11.2). */
export function fleschKincaidGrade(text: string): number {
  const sentences = splitSentences(text);
  const wordList = words(text);
  if (sentences.length === 0 || wordList.length === 0) return 0;
  const syllables = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
  const grade =
    0.39 * (wordList.length / sentences.length) +
    11.8 * (syllables / wordList.length) -
    15.59;
  return Math.round(grade * 100) / 100;
}

const SECOND_PERSON: Record<Locale, string[]> = {
  en: ['you', 'your', 'yours', "you're", 'youre', 'yourself'],
  es: [
    'tu',
    'tú',
    'tus',
    'te',
    'ti',
    'tuyo',
    'tuya',
    'contigo',
    'usted',
    'ustedes',
    'puedes',
    'quieres',
    'tienes',
    'prefieres',
    'buscas',
    'pides',
    'eliges',
    'usas',
    'sabes',
    'necesitas',
    'notas',
    'pones',
  ],
};

export function secondPersonMarkers(locale: Locale): readonly string[] {
  return SECOND_PERSON[locale];
}

export function countSecondPerson(text: string, locale: Locale): number {
  const markers = new Set(SECOND_PERSON[locale]);
  return words(text).filter((w) => markers.has(w.toLowerCase())).length;
}

/** Flavour vocabulary used only to classify an opening move, never to validate. */
const TASTE_WORDS = [
  'taste',
  'tastes',
  'notes',
  'bright',
  'sweet',
  'juicy',
  'mellow',
  'rich',
  'smooth',
  'sharp',
  'chocolate',
  'cocoa',
  'caramel',
  'fruit',
  'grape',
  'plum',
  'apple',
  'berry',
  'citrus',
  'nutty',
  'sabe',
  'sabor',
  'notas',
  'dulce',
  'jugoso',
  'brillante',
];

export function opensWithTaste(text: string): boolean {
  const first = splitSentences(text)[0];
  if (!first) return false;
  const lowered = first.toLowerCase();
  return TASTE_WORDS.some((t) => new RegExp(`\\b${t}\\b`).test(lowered));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
