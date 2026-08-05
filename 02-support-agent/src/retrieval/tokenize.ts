/**
 * The one tokenizer. BM25 and the relevance floor must agree on what a term is, or the
 * floor will reject queries BM25 answered perfectly well.
 *
 * Numbers survive on purpose: "$45", "11:00 AM", "30 days" are the tokens that decide
 * the answer in this corpus (plan.md §2).
 */

const STOPWORDS = new Set([
  'a', 'about', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'being',
  'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'for', 'from', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'him', 'his', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'out', 'she',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'those', 'to', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you',
  'your', 'yours',
]);

/**
 * Order numbers belong to `lookup_order`, not to the document index. Left in, they
 * tokenize to "ca" and "10241" — two words the corpus has never seen — and every
 * "where is my order" question looks like a query about a topic we don't cover.
 */
const ORDER_NUMBER = /\b[a-z]{2}-\d{3,}\b/gi;

/** "hasn't" → "has", "it'll" → "it". Splitting on the apostrophe leaves "hasn". */
const NEGATION = /n['’]t\b/gi;
const CLITIC = /['’](ll|ve|re|d|m|s)\b/gi;

export function normalizeQuery(text: string): string {
  return text.replace(ORDER_NUMBER, ' ').replace(NEGATION, '').replace(CLITIC, '');
}

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of normalizeQuery(text).toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw === '' || STOPWORDS.has(raw)) continue;
    // Drop the stray letters contractions leave behind ("what's" → "what", "s") while
    // keeping single digits, which carry meaning here ("6 days", "$45").
    if (raw.length === 1 && raw >= 'a' && raw <= 'z') continue;
    tokens.push(singularize(raw));
  }
  return tokens;
}

/**
 * Plural stripping only — not a stemmer. "times"→"time" and "subscriptions"→
 * "subscription" are the cases that matter here; anything more aggressive starts
 * merging "roasting" with "roast" and costs precision on a corpus this small.
 */
function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}
