/**
 * Hybrid retrieval: BM25 + cosine, fused with RRF, floored, de-contradicted.
 *
 * This is the seam the agent and the eval runner both use. Everything below it works
 * with no API key — the only thing a key buys is a semantic vector leg (plan.md §2).
 */

import type {
  Chunk,
  EmbeddingProvider,
  IndexFile,
  RetrievedChunk,
  SearchResult,
} from '../types.ts';
import { createEmbeddingProvider } from '../ingest/embed.ts';
import { BM25 } from './bm25.ts';
import { applyContradictions, detectContradictions } from './contradictions.ts';
import { assessFloor } from './floor.ts';
import { reciprocalRankFusion, RRF_K } from './rrf.ts';
import { cosineSearch } from './vector.ts';

/**
 * Six chunks, ~1,800 tokens. Context is finite and every extra chunk dilutes attention
 * across the window (plan.md §3). The number comes from `sweep-topk.ts`.
 */
export const DEFAULT_TOP_K = 6;

/** How deep each leg looks before fusion. Wider than top-k so RRF has something to fuse. */
const CANDIDATE_DEPTH = 20;

export type SearchOptions = {
  topK?: number;
  coverageFloor?: number;
  rrfK?: number;
};

export class HelpCenterIndex {
  private readonly index: IndexFile;
  private readonly bm25: BM25;
  private readonly byId: Map<string, Chunk>;
  private readonly embedder: EmbeddingProvider | null;

  constructor(index: IndexFile, embedder?: EmbeddingProvider) {
    this.index = index;
    // Title and heading are part of the indexed text: "Address changes" is what makes
    // the cut-off rule under it findable.
    this.bm25 = new BM25(
      index.chunks.map((chunk) => ({ id: chunk.id, text: `${chunk.title}\n${chunk.text}` })),
    );
    this.byId = new Map(index.chunks.map((chunk) => [chunk.id, chunk]));
    this.embedder = embedder ?? matchingEmbedder(index);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const topK = options.topK ?? DEFAULT_TOP_K;
    const lexical = this.bm25.search(query, CANDIDATE_DEPTH);

    let semantic: ReturnType<typeof cosineSearch> = [];
    let topCosine: number | null = null;
    if (this.embedder) {
      const [queryVector] = await this.embedder.embed([query]);
      if (queryVector) {
        semantic = cosineSearch(queryVector, this.index.chunks, CANDIDATE_DEPTH);
        topCosine = semantic[0]?.score ?? 0;
      }
    }

    const fused = reciprocalRankFusion([lexical, semantic], options.rrfK ?? RRF_K);

    const ranked: RetrievedChunk[] = [];
    for (const entry of fused) {
      const chunk = this.byId.get(entry.id);
      if (!chunk) continue;
      ranked.push({
        ...chunk,
        score: entry.score,
        bm25Rank: entry.ranks[0] ?? null,
        vectorRank: entry.ranks[1] ?? null,
      });
      if (ranked.length >= topK) break;
    }

    const contradictions = detectContradictions(ranked);
    const chunks = applyContradictions(ranked, contradictions);

    // The floor reads the context the model will actually see, so a chunk dropped for
    // contradicting a canonical policy can't prop up the coverage number.
    const floor = assessFloor({
      query,
      retrieved: chunks,
      termsOf: (id) => this.bm25.termsOf(id),
      idf: (term) => this.bm25.idf(term),
      topCosine,
      ...(options.coverageFloor === undefined ? {} : { coverageFloor: options.coverageFloor }),
    });

    return {
      chunks,
      belowFloor: floor.belowFloor,
      coverage: floor.coverage,
      missing: floor.missing,
      topCosine,
      contradictions,
    };
  }
}

/**
 * The query has to be embedded by the same model that embedded the chunks, or cosine is
 * meaningless. If the index was built with a provider we no longer have a key for, drop
 * the vector leg rather than mix embedding spaces.
 *
 * An offline index gets no vector leg at all. Fusing the hash provider in is measurably
 * worse than leaving it out — on the 20 eval cases at k=6 it drops MRR from 0.815 to
 * 0.635 and pushes one answerable case below the relevance floor. RRF weights both legs
 * equally, so a leg that measures shared words rather than shared meaning is not a
 * second opinion, it's noise with a vote.
 */
function matchingEmbedder(index: IndexFile): EmbeddingProvider | null {
  if (!index.embedding.semantic) return null;
  try {
    const provider = createEmbeddingProvider();
    return provider.id === index.embedding.provider ? provider : null;
  } catch {
    return null;
  }
}
