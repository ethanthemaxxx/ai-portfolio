/**
 * Shared data model. Mirrors plan.md §8 — that section is binding, so the shapes
 * here match it field for field rather than "improving" on it.
 */

/**
 * Which document wins when two chunks disagree. `canonical` is a policy page the
 * merchant maintains; `informational` is everything else (help articles, brand
 * notes) that may have gone stale. See spec.md Q2.
 */
export type Authority = 'canonical' | 'informational';

/** A source document after frontmatter has been split off the body. */
export type PolicyDoc = {
  docId: string;
  title: string;
  category: string;
  lastUpdated: string | null;
  authority: Authority;
  /** Markdown body with the frontmatter block removed. */
  body: string;
  /** Path the document was read from, for error messages and citations. */
  sourcePath: string;
};

/** A chunk before token counting and embedding — what the chunker can know on its own. */
export type ChunkDraft = {
  id: string;
  docId: string;
  title: string;
  heading: string;
  authority: Authority;
  text: string;
};

export type Chunk = {
  id: string; // `${doc_id}#${index}`
  docId: string;
  title: string;
  heading: string;
  authority: Authority;
  text: string;
  tokens: number;
  embedding?: number[];
};

/** A chunk plus why retrieval returned it. */
export type RetrievedChunk = Chunk & {
  /** Fused RRF score. Scale-free — comparable within one result set, not across queries. */
  score: number;
  /** 1-based rank from each leg, or null if that leg didn't return the chunk. */
  bm25Rank: number | null;
  vectorRank: number | null;
};

export type SearchResult = {
  chunks: RetrievedChunk[];
  /**
   * True when nothing retrieved clears the relevance floor. Escalation reads this
   * signal directly — plan.md §7, trigger 1.
   */
  belowFloor: boolean;
  /** Share of the query's content terms present anywhere in `chunks`. 0–1. */
  coverage: number;
  /** Query terms absent from the whole context. Goes into the escalation ticket. */
  missing: string[];
  /** Highest cosine similarity seen, or null when embeddings aren't semantic. */
  topCosine: number | null;
  /** Conflicting pairs found among the returned chunks, losers already removed. */
  contradictions: Contradiction[];
};

/** A quantity asserted by a chunk, e.g. "$45", "30 days", "10%". */
export type QuantityClaim = {
  unit: 'usd' | 'percent' | 'day' | 'week' | 'hour' | 'clock';
  value: number;
  /** Distinctive words next to the number — what the quantity is *about*. */
  anchors: string[];
  /** The matched span, for the contradiction log. */
  text: string;
};

export type ContradictionSide = {
  chunkId: string;
  docId: string;
  heading: string;
  authority: Authority;
  value: number;
  /** The sentence the number came from, so the log is readable by a human. */
  text: string;
};

export type Contradiction = {
  unit: QuantityClaim['unit'];
  /** Anchor terms both chunks share — why we believe they're stating the same rule. */
  sharedAnchors: string[];
  /** The canonical side. Stays in the context. */
  winner: ContradictionSide;
  /** The informational side. Dropped from the context, kept in the log. */
  loser: ContradictionSide;
};

export type EmbeddingProviderId = 'voyage' | 'openai' | 'offline';

export interface EmbeddingProvider {
  readonly id: EmbeddingProviderId;
  readonly model: string;
  readonly dimensions: number;
  /** Batching is the provider's problem, not the caller's. */
  embed(texts: string[]): Promise<number[][]>;
}

export type TokenCountMode = 'api' | 'estimate';

export interface TokenCounter {
  readonly mode: TokenCountMode;
  count(texts: string[]): Promise<number[]>;
}

/** The on-disk shape of `data/index.json`. */
export type IndexFile = {
  schemaVersion: number;
  /** Source doc ids, sorted. Lets retrieval report what it was built from. */
  docs: string[];
  embedding: {
    provider: EmbeddingProviderId;
    model: string;
    dimensions: number;
    /**
     * False for the offline hash provider. Retrieval uses this to decide whether a
     * cosine score is evidence of meaning or just of shared words.
     */
    semantic: boolean;
  };
  tokens: { mode: TokenCountMode };
  chunks: Chunk[];
};

/** What `lookup_order` returns — never the raw order. Privacy rule from spec.md §8. */
export type OrderEnvelope = {
  orderNumber: string;
  status: 'unfulfilled' | 'in_transit' | 'fulfilled' | 'cancelled';
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  estimatedDelivery: string | null;
  trackingState: 'none' | 'label_created' | 'moving' | 'stalled' | 'delivered';
  daysSinceLastMovement: number | null;
  lineItems: { title: string; qty: number }[];
  isGift: boolean;
  subscriptionId: string | null;
  refundEligible: boolean; // computed, not raw
  requiresApproval: boolean; // total > $150
};

export type AgentTurn = {
  answer: string;
  citations: { docId: string; heading: string }[];
  escalated: boolean;
  escalationReason: string | null;
  toolCalls: { name: string; ms: number }[];
  latency: { firstTokenMs: number; totalMs: number };
  usage: { input: number; output: number; cacheRead: number };
};
