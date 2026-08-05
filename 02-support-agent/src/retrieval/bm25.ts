/**
 * B1 — BM25, written out rather than pulled in.
 *
 * It is forty lines of arithmetic over 47 chunks. A dependency here would buy nothing
 * and would cost the property that makes the eval suite runnable on a plane: BM25 needs
 * no API key and no network (plan.md §2).
 */

import { tokenize } from './tokenize.ts';

export const K1 = 1.2;
export const B = 0.75;

export type Ranked = { id: string; score: number; rank: number };

type Posting = { docId: string; tf: number };

export class BM25 {
  readonly size: number;
  readonly averageLength: number;

  private readonly postings = new Map<string, Posting[]>();
  private readonly lengths = new Map<string, number>();
  private readonly terms = new Map<string, Set<string>>();
  private readonly k1: number;
  private readonly b: number;

  // Fields are declared, not shorthanded into the constructor signature: Node's
  // type-stripping runs the tests directly from `.ts`, and it rejects parameter
  // properties because erasing them would change behaviour.
  constructor(documents: { id: string; text: string }[], k1 = K1, b = B) {
    this.k1 = k1;
    this.b = b;
    let totalLength = 0;

    for (const document of documents) {
      const tokens = tokenize(document.text);
      const frequencies = new Map<string, number>();
      for (const token of tokens) {
        frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      }

      this.lengths.set(document.id, tokens.length);
      this.terms.set(document.id, new Set(frequencies.keys()));
      totalLength += tokens.length;

      for (const [term, tf] of frequencies) {
        const posting = this.postings.get(term);
        if (posting) posting.push({ docId: document.id, tf });
        else this.postings.set(term, [{ docId: document.id, tf }]);
      }
    }

    this.size = documents.length;
    this.averageLength = documents.length === 0 ? 0 : totalLength / documents.length;
  }

  /**
   * Robertson/Sparck-Jones IDF. Unseen terms get the maximum value, which is what makes
   * the relevance floor work: a query full of words the corpus has never heard of has
   * almost all of its IDF mass unmatched.
   */
  idf(term: string): number {
    const df = this.postings.get(term)?.length ?? 0;
    return Math.log(1 + (this.size - df + 0.5) / (df + 0.5));
  }

  /** The distinct terms this document contains, post-tokenization. */
  termsOf(id: string): ReadonlySet<string> {
    return this.terms.get(id) ?? new Set();
  }

  search(query: string, limit = 10): Ranked[] {
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    const scores = new Map<string, number>();

    for (const term of new Set(queryTerms)) {
      const postings = this.postings.get(term);
      if (!postings) continue;

      const idf = this.idf(term);
      for (const { docId, tf } of postings) {
        const length = this.lengths.get(docId) ?? 0;
        const normalization =
          this.averageLength === 0 ? 1 : 1 - this.b + (this.b * length) / this.averageLength;
        const contribution = (idf * (tf * (this.k1 + 1))) / (tf + this.k1 * normalization);
        scores.set(docId, (scores.get(docId) ?? 0) + contribution);
      }
    }

    return rank([...scores].map(([id, score]) => ({ id, score })), limit);
  }
}

/** Sort by score, break ties by id so results are reproducible, then number from 1. */
export function rank(scored: { id: string; score: number }[], limit: number): Ranked[] {
  return scored
    .sort((a, b) => (b.score === a.score ? (a.id < b.id ? -1 : 1) : b.score - a.score))
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}
