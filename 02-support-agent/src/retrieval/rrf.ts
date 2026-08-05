/**
 * B3 — Reciprocal Rank Fusion.
 *
 *   score(d) = Σ 1 / (k + rank_i(d))
 *
 * Ranks, not scores: BM25 returns unbounded sums of IDF and cosine returns [-1, 1], and
 * normalising them onto a common scale is guesswork (plan.md §3). k = 60 is the value
 * the plan fixes; it is also what makes fusion conservative — see the note on the
 * crossover in `rrf.test.ts`.
 */

import { rank, type Ranked } from './bm25.ts';

export const RRF_K = 60;

export type Fused = Ranked & {
  /** 1-based rank contributed by each input list, in the order they were passed. */
  ranks: (number | null)[];
};

export function reciprocalRankFusion(rankings: Ranked[][], k = RRF_K): Fused[] {
  const scores = new Map<string, number>();
  const positions = new Map<string, (number | null)[]>();
  const width = rankings.length;

  rankings.forEach((ranking, leg) => {
    for (const entry of ranking) {
      scores.set(entry.id, (scores.get(entry.id) ?? 0) + 1 / (k + entry.rank));

      const slots = positions.get(entry.id) ?? new Array<number | null>(width).fill(null);
      slots[leg] = entry.rank;
      positions.set(entry.id, slots);
    }
  });

  const ranked = rank([...scores].map(([id, score]) => ({ id, score })), scores.size);
  return ranked.map((entry) => ({
    ...entry,
    ranks: positions.get(entry.id) ?? new Array<number | null>(width).fill(null),
  }));
}
