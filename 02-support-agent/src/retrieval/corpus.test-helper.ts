/**
 * Test fixtures built from the real corpus. Every retrieval test runs against the
 * documents the agent will actually answer from — a synthetic corpus would let the
 * retriever look better than it is.
 *
 * The index is built in memory, not read from `data/index.json`, so the tests don't
 * depend on someone having run `npm run ingest` first.
 */

import type { Chunk, IndexFile } from '../types.ts';
import { buildIndex } from '../ingest/build-index.ts';
import { BM25 } from './bm25.ts';
import { HelpCenterIndex } from './search.ts';

let cached: Promise<IndexFile> | null = null;

export function corpusIndex(): Promise<IndexFile> {
  cached ??= buildIndex();
  return cached;
}

export async function corpusChunks(): Promise<Chunk[]> {
  return (await corpusIndex()).chunks;
}

export async function corpusBm25(): Promise<BM25> {
  const chunks = await corpusChunks();
  return new BM25(chunks.map((chunk) => ({ id: chunk.id, text: `${chunk.title}\n${chunk.text}` })));
}

export async function corpusSearch(): Promise<HelpCenterIndex> {
  return new HelpCenterIndex(await corpusIndex());
}

/** True when a real embedding provider is configured, so cosine means something. */
export async function hasSemanticVectors(): Promise<boolean> {
  return (await corpusIndex()).embedding.semantic;
}
