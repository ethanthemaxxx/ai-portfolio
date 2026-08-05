/**
 * A5 — the ingestion pipeline: read → parse → chunk → count → embed → write.
 *
 * The output is deterministic: keys are sorted, chunks are sorted, floats are rounded,
 * and nothing records when the build ran. Two runs produce byte-identical files, so a
 * diff on `data/index.json` only ever shows a corpus change.
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import type { Chunk, EmbeddingProvider, IndexFile, TokenCounter } from '../types.ts';
import { chunkDocument, MAX_CHUNK_CHARS } from './chunk.ts';
import { CORPUS_DIR } from './corpus-paths.ts';
import { createEmbeddingProvider, isSemantic } from './embed.ts';
import { parseDocument } from './frontmatter.ts';
import { createTokenCounter } from './tokens.ts';

export const SCHEMA_VERSION = 1;

/** Embeddings are stored at this precision so the file is stable and not enormous. */
const FLOAT_PRECISION = 6;

const HERE = dirname(fileURLToPath(import.meta.url));
export const INDEX_PATH = join(HERE, '..', '..', 'data', 'index.json');

export type BuildOptions = {
  /** Root of the brand demo. Only `policies/*.md` is indexed — see `corpusPaths`. */
  corpusDir?: string;
  embedder?: EmbeddingProvider;
  tokenCounter?: TokenCounter;
  maxChunkChars?: number;
};

export async function buildIndex(options: BuildOptions = {}): Promise<IndexFile> {
  const corpusDir = options.corpusDir ?? CORPUS_DIR;
  const embedder = options.embedder ?? createEmbeddingProvider();
  const tokenCounter = options.tokenCounter ?? createTokenCounter();
  const maxChunkChars = options.maxChunkChars ?? MAX_CHUNK_CHARS;

  const paths = await corpusPaths(corpusDir);
  const drafts = [];

  for (const path of paths) {
    const doc = parseDocument(await readFile(path, 'utf8'), path);
    drafts.push(
      ...chunkDocument(
        { docId: doc.docId, title: doc.title, authority: doc.authority, body: doc.body },
        maxChunkChars,
      ),
    );
  }

  const texts = drafts.map((d) => d.text);
  const [tokens, embeddings] = await Promise.all([
    tokenCounter.count(texts),
    embedder.embed(texts),
  ]);

  const chunks: Chunk[] = drafts.map((draft, i) => ({
    ...draft,
    tokens: tokens[i] ?? 0,
    embedding: (embeddings[i] ?? []).map(round),
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    docs: [...new Set(chunks.map((c) => c.docId))].sort(),
    embedding: {
      provider: embedder.id,
      model: embedder.model,
      dimensions: embedder.dimensions,
      semantic: isSemantic(embedder.id),
    },
    tokens: { mode: tokenCounter.mode },
    chunks: chunks.sort(compareChunks),
  };
}

/** `${docId}#${n}` sorts wrong lexically — #10 would land before #2. Sort the parts. */
function compareChunks(a: Chunk, b: Chunk): number {
  if (a.docId !== b.docId) return a.docId < b.docId ? -1 : 1;
  return chunkOrdinal(a.id) - chunkOrdinal(b.id);
}

function chunkOrdinal(id: string): number {
  return Number.parseInt(id.slice(id.lastIndexOf('#') + 1), 10);
}

function round(value: number): number {
  const factor = 10 ** FLOAT_PRECISION;
  // `+ 0` collapses -0 to 0, which JSON.stringify would otherwise write as "-0".
  return Math.round(value * factor) / factor + 0;
}

/**
 * The retrieval corpus is `policies/*.md` and nothing else.
 *
 * `brand.md` is deliberately not indexed, for two measured reasons. It restates
 * customer questions verbatim ("Asks: … how long does it stay fresh"), so it
 * outranked the freshness policy on freshness questions — 9.1 vs 3.6 BM25. And it
 * holds internal business figures (AOV, revenue share) that must never reach a
 * customer-facing answer (spec.md §8). It belongs in the agent's system prompt as
 * voice guidance, which is a different job from being citable evidence.
 */
async function corpusPaths(corpusDir: string): Promise<string[]> {
  const policiesDir = join(corpusDir, 'policies');
  const entries = await readdir(policiesDir);
  return entries
    .filter((name) => name.endsWith('.md') && !name.startsWith('.'))
    .sort()
    .map((name) => join(policiesDir, name));
}

/**
 * JSON with keys emitted in sorted order at every level. `JSON.stringify` preserves
 * insertion order, which is stable in practice but depends on how objects happen to be
 * built; sorting makes determinism a property of the serializer instead.
 */
export function serializeIndex(index: IndexFile): string {
  return stableStringify(index) + '\n';
}

function stableStringify(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => pad + stableStringify(v, indent + 1));
    return `[\n${items.join(',\n')}\n${closePad}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    if (entries.length === 0) return '{}';
    const items = entries.map(
      ([k, v]) => `${pad}${JSON.stringify(k)}: ${stableStringify(v, indent + 1)}`,
    );
    return `{\n${items.join(',\n')}\n${closePad}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

export async function main(outputPath = INDEX_PATH): Promise<void> {
  const index = await buildIndex();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeIndex(index), 'utf8');

  const totalTokens = index.chunks.reduce((sum, c) => sum + c.tokens, 0);
  process.stdout.write(
    `${index.chunks.length} chunks from ${index.docs.length} docs · ` +
      `${totalTokens} tokens (${index.tokens.mode}) · ` +
      `embeddings: ${index.embedding.provider}/${index.embedding.model}\n` +
      `wrote ${outputPath}\n`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
