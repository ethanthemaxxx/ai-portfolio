/**
 * A4 — embeddings behind a one-function interface.
 *
 * Anthropic doesn't serve embeddings, so this is the one place the stack talks to
 * another vendor. Voyage is the recommended pairing, OpenAI is the fallback, and the
 * offline provider exists so the whole pipeline runs with no keys at all — a demo a
 * client can't run isn't a demo (plan.md §10).
 */

import type { EmbeddingProvider, EmbeddingProviderId } from '../types.ts';

const BATCH_SIZE = 128;
const OFFLINE_DIMENSIONS = 256;

/**
 * Picks a provider from the environment. Explicit `EMBEDDING_PROVIDER` wins; otherwise
 * whichever key is present; otherwise offline.
 */
export function createEmbeddingProvider(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProvider {
  const requested = env['EMBEDDING_PROVIDER'];
  const voyageKey = env['VOYAGE_API_KEY'];
  const openaiKey = env['OPENAI_API_KEY'];

  if (requested === 'voyage' || (requested === undefined && voyageKey)) {
    if (!voyageKey) throw new Error('EMBEDDING_PROVIDER=voyage but VOYAGE_API_KEY is not set');
    return voyageProvider(voyageKey);
  }
  if (requested === 'openai' || (requested === undefined && openaiKey)) {
    if (!openaiKey) throw new Error('EMBEDDING_PROVIDER=openai but OPENAI_API_KEY is not set');
    return openaiProvider(openaiKey);
  }
  if (requested !== undefined && requested !== 'offline') {
    throw new Error(`Unknown EMBEDDING_PROVIDER '${requested}' (voyage | openai | offline)`);
  }
  return offlineProvider();
}

/** True for providers whose cosine scores mean something. See IndexFile.embedding.semantic. */
export function isSemantic(id: EmbeddingProviderId): boolean {
  return id !== 'offline';
}

export function voyageProvider(apiKey: string, model = 'voyage-3'): EmbeddingProvider {
  return {
    id: 'voyage',
    model,
    dimensions: 1024,
    embed: (texts) =>
      batched(texts, async (batch) => {
        const body = { model, input: batch, input_type: 'document' };
        const json = await postJson('https://api.voyageai.com/v1/embeddings', apiKey, body);
        return readOpenAiShapedEmbeddings(json, batch.length);
      }),
  };
}

export function openaiProvider(
  apiKey: string,
  model = 'text-embedding-3-small',
): EmbeddingProvider {
  return {
    id: 'openai',
    model,
    dimensions: 1536,
    embed: (texts) =>
      batched(texts, async (batch) => {
        const body = { model, input: batch };
        const json = await postJson('https://api.openai.com/v1/embeddings', apiKey, body);
        return readOpenAiShapedEmbeddings(json, batch.length);
      }),
  };
}

/**
 * Deterministic hashed bag-of-words. Not semantic — "cardboard" and "papery" land in
 * unrelated dimensions — but it is stable across machines and runs, which is what the
 * offline index needs. Retrieval knows not to treat its cosine scores as evidence.
 */
export function offlineProvider(dimensions = OFFLINE_DIMENSIONS): EmbeddingProvider {
  return {
    id: 'offline',
    model: `hash-bow-${dimensions}`,
    dimensions,
    embed: async (texts) => texts.map((text) => hashEmbed(text, dimensions)),
  };
}

export function hashEmbed(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w !== '');

  for (const word of words) {
    const hash = fnv1a(word);
    const slot = hash % dimensions;
    const sign = (hash >>> 16) & 1 ? 1 : -1;
    vector[slot] = (vector[slot] ?? 0) + sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

async function batched(
  texts: string[],
  run: (batch: string[]) => Promise<number[][]>,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    out.push(...(await run(texts.slice(i, i + BATCH_SIZE))));
  }
  return out;
}

async function postJson(url: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/** Voyage and OpenAI both return `{ data: [{ index, embedding }] }`. */
function readOpenAiShapedEmbeddings(json: unknown, expected: number): number[][] {
  const data = (json as { data?: { index?: number; embedding?: number[] }[] }).data;
  if (!Array.isArray(data) || data.length !== expected) {
    throw new Error(`Embedding response had ${data?.length ?? 0} vectors, expected ${expected}`);
  }
  const out = new Array<number[]>(expected);
  data.forEach((item, i) => {
    const embedding = item.embedding;
    if (!Array.isArray(embedding)) throw new Error('Embedding response item had no vector');
    out[item.index ?? i] = embedding;
  });
  return out;
}
