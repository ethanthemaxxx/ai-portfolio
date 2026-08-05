/**
 * B4 — the relevance floor.
 *
 * "Nothing matched well enough" has to be a deterministic signal, because escalation
 * gates on it and you cannot gate a release on a probabilistic decision (plan.md §7).
 *
 * The measure is **term coverage over the assembled context**: of the content words the
 * customer used, how many appear anywhere in the chunks we're about to hand the model?
 * That is the question that matters, because the model sees all k chunks, not just the
 * best one.
 *
 * Two variants were measured against the 20 eval cases plus 7 out-of-corpus questions:
 *
 * | measure                          | min answerable | max out-of-corpus | margin |
 * |----------------------------------|---------------|-------------------|--------|
 * | term coverage over the context   | 0.500         | 0.333             | 0.167  |
 * | IDF-weighted coverage            | 0.253         | 0.240             | 0.013  |
 * | term coverage, best chunk only   | 0.250         | 0.333             | −0.083 |
 *
 * IDF weighting loses because one unseen proper noun swamps everything else: "I'm in
 * California" and "how do I fix my car transmission" both hang their weight on a word
 * the corpus has never seen, and only one of them is off-topic. Weighting every content
 * word equally is the cruder measure and the one with a real gap in it.
 *
 * RRF scores are deliberately not used here. They are scale-free — a query about
 * carburettors produces the same fused scores as one about roast dates, because both
 * are just 1/(k + rank).
 */

import { tokenize } from './tokenize.ts';

/** Midpoint of the measured gap. Below it, treat the retrieval as a miss. */
export const COVERAGE_FLOOR = 0.4;

/** A semantic hit this strong clears the floor on its own, with no lexical overlap. */
export const COSINE_FLOOR = 0.35;

export type FloorAssessment = {
  coverage: number;
  belowFloor: boolean;
  /** Query terms absent from the whole context, most informative first. */
  missing: string[];
};

export type FloorInput = {
  query: string;
  /** The chunks actually going into the context — not the wider candidate pool. */
  retrieved: { id: string }[];
  /** Distinct terms per chunk id, from the BM25 index. */
  termsOf: (id: string) => ReadonlySet<string>;
  /** Used only to order `missing` for the escalation ticket. */
  idf: (term: string) => number;
  /**
   * Best cosine among the candidates, or null when the index was built with the offline
   * provider. A hash embedding cannot be evidence of meaning, so it does not get a vote
   * — offline, an unmatched paraphrase falls below the floor and escalates, which is the
   * safe direction to be wrong in (spec.md §7.3).
   */
  topCosine: number | null;
  coverageFloor?: number;
  cosineFloor?: number;
};

/** Share of the query's distinct content terms present in `vocabulary`. 0–1. */
export function termCoverage(queryTerms: string[], vocabulary: ReadonlySet<string>): number {
  const unique = [...new Set(queryTerms)];
  if (unique.length === 0) return 0;
  return unique.filter((term) => vocabulary.has(term)).length / unique.length;
}

export function assessFloor(input: FloorInput): FloorAssessment {
  const coverageFloor = input.coverageFloor ?? COVERAGE_FLOOR;
  const cosineFloor = input.cosineFloor ?? COSINE_FLOOR;
  const queryTerms = tokenize(input.query);

  const vocabulary = new Set<string>();
  for (const chunk of input.retrieved) {
    for (const term of input.termsOf(chunk.id)) vocabulary.add(term);
  }

  const coverage = termCoverage(queryTerms, vocabulary);
  const semanticHit = input.topCosine !== null && input.topCosine >= cosineFloor;

  return {
    coverage,
    belowFloor: coverage < coverageFloor && !semanticHit,
    missing: [...new Set(queryTerms)]
      .filter((term) => !vocabulary.has(term))
      .sort((a, b) => input.idf(b) - input.idf(a)),
  };
}
