import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEmbeddingProvider, hashEmbed, isSemantic, offlineProvider } from './embed.ts';
import { buildIndex } from './build-index.ts';
import type { EmbeddingProvider } from '../types.ts';

// A4 — "embed(['a','b']) → 2 vectors of equal length; provider swap needs no caller change"
test('A4: embed returns one equal-length vector per input', async () => {
  const provider = offlineProvider();
  const vectors = await provider.embed(['a', 'b']);

  assert.equal(vectors.length, 2);
  assert.equal(vectors[0]?.length, provider.dimensions);
  assert.equal(vectors[1]?.length, provider.dimensions);
  assert.notDeepEqual(vectors[0], vectors[1], 'different text, different vector');
});

test('A4: the offline provider is deterministic across calls and instances', async () => {
  const first = await offlineProvider().embed(['roast date', 'free shipping over $45']);
  const second = await offlineProvider().embed(['roast date', 'free shipping over $45']);
  assert.deepEqual(first, second);
});

test('A4: vectors are unit length, so cosine is a dot product', () => {
  const vector = hashEmbed('order by 11:00 AM ET Sunday', 256);
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9, `norm was ${norm}`);

  assert.deepEqual(hashEmbed('', 8), new Array(8).fill(0), 'empty text is the zero vector');
});

test('A4: swapping the provider needs no change at the call site', async () => {
  // A caller only ever sees the interface. This stand-in returns 4-dimensional vectors
  // from a different "model" and the pipeline takes it without modification.
  const fake: EmbeddingProvider = {
    id: 'voyage',
    model: 'stand-in',
    dimensions: 4,
    embed: async (texts) => texts.map((_, i) => [i, 0, 0, 1]),
  };

  const index = await buildIndex({ embedder: fake });

  assert.equal(index.embedding.provider, 'voyage');
  assert.equal(index.embedding.model, 'stand-in');
  assert.equal(index.embedding.dimensions, 4);
  for (const chunk of index.chunks) {
    assert.equal(chunk.embedding?.length, 4);
  }
});

test('A4: provider selection follows the environment', () => {
  assert.equal(createEmbeddingProvider({}).id, 'offline');
  assert.equal(createEmbeddingProvider({ VOYAGE_API_KEY: 'k' }).id, 'voyage');
  assert.equal(createEmbeddingProvider({ OPENAI_API_KEY: 'k' }).id, 'openai');
  assert.equal(
    createEmbeddingProvider({ VOYAGE_API_KEY: 'k', OPENAI_API_KEY: 'k' }).id,
    'voyage',
    'voyage is the recommended pairing, so it wins a tie',
  );
  assert.equal(
    createEmbeddingProvider({ EMBEDDING_PROVIDER: 'offline', VOYAGE_API_KEY: 'k' }).id,
    'offline',
    'an explicit choice beats key sniffing',
  );

  assert.equal(createEmbeddingProvider({ VOYAGE_API_KEY: 'k' }).model, 'voyage-3');
  assert.equal(createEmbeddingProvider({ OPENAI_API_KEY: 'k' }).model, 'text-embedding-3-small');

  assert.throws(() => createEmbeddingProvider({ EMBEDDING_PROVIDER: 'pinecone' }), /Unknown/);
  assert.throws(() => createEmbeddingProvider({ EMBEDDING_PROVIDER: 'voyage' }), /VOYAGE_API_KEY/);
});

test('A4: only real providers claim semantic vectors', () => {
  assert.equal(isSemantic('offline'), false);
  assert.equal(isSemantic('voyage'), true);
  assert.equal(isSemantic('openai'), true);
});
