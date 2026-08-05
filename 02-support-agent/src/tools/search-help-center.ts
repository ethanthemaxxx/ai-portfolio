/**
 * C6 — the `search_help_center` tool.
 *
 * The retrieval layer is owned elsewhere, so this tool depends on exactly one
 * function: `(query: string) => Promise<Chunk[]>`. That seam is the whole
 * integration surface. It also means every test in this file runs with no index,
 * no embeddings and no API key.
 *
 * The relevance floor lives in retrieval (task B4), not here. An empty result
 * array *is* the below-floor signal — re-deriving a threshold this module
 * doesn't own would put two different numbers in play and guarantee they drift.
 */

import type { Chunk, SearchChunks } from "./types.ts";

/**
 * Four, not twenty. Context is a finite resource with diminishing returns
 * (plan.md §3) — and this is a *second-pass* search on top of the six chunks
 * already in the window, so the cap is tighter than the pre-retrieval top-k.
 */
export const MAX_HELP_CENTER_RESULTS = 4;

export type SearchHelpCenterInput = {
  query: string;
};

export type HelpCenterResult = {
  doc_id: string;
  heading: string;
  text: string;
  authority: "canonical" | "informational";
};

export type SearchHelpCenterResult = {
  results: HelpCenterResult[];
  below_relevance_floor: boolean;
};

export function createSearchHelpCenter(
  search: SearchChunks,
  limit: number = MAX_HELP_CENTER_RESULTS,
): (input: SearchHelpCenterInput) => Promise<SearchHelpCenterResult> {
  return async function searchHelpCenter(
    input: SearchHelpCenterInput,
  ): Promise<SearchHelpCenterResult> {
    const query = input.query?.trim() ?? "";
    if (!query) return { results: [], below_relevance_floor: true };

    let chunks: Chunk[];
    try {
      chunks = await search(query);
    } catch {
      // A broken index collapses into the below-floor signal, which routes to
      // escalation. That is the safe direction to fail in: a human reads the
      // ticket, rather than the model answering from pretrained knowledge about
      // coffee or consumer law (contracts/tools.md §2).
      return { results: [], below_relevance_floor: true };
    }

    const results = chunks.slice(0, limit).map(toResult);
    return { results, below_relevance_floor: results.length === 0 };
  };
}

function toResult(chunk: Chunk): HelpCenterResult {
  return {
    doc_id: chunk.docId,
    heading: chunk.heading,
    text: chunk.text,
    authority: chunk.authority,
  };
}
