/**
 * B2 — cosine similarity search.
 *
 * This is the leg that catches paraphrase: "my coffee tastes like cardboard" shares no
 * word with the freshness policy that answers it (plan.md §2). It is only as good as
 * the embeddings behind it — with the offline hash provider it degrades to a weak
 * lexical signal, which `search.ts` accounts for.
 */

import { rank, type Ranked } from './bm25.ts';

export function dot(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return total;
}

export function norm(vector: readonly number[]): number {
  return Math.sqrt(dot(vector, vector));
}

/** Returns 0 for a zero vector rather than NaN — an empty chunk is not "similar". */
export function cosine(a: readonly number[], b: readonly number[]): number {
  const denominator = norm(a) * norm(b);
  return denominator === 0 ? 0 : dot(a, b) / denominator;
}

export function cosineSearch(
  query: readonly number[],
  documents: { id: string; embedding?: number[] }[],
  limit = 10,
): Ranked[] {
  const scored: { id: string; score: number }[] = [];
  for (const document of documents) {
    if (!document.embedding) continue;
    scored.push({ id: document.id, score: cosine(query, document.embedding) });
  }
  return rank(scored, limit);
}
