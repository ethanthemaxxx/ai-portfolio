import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cosine, cosineSearch, dot, norm } from './vector.ts';
import { corpusIndex, corpusSearch, hasSemanticVectors } from './corpus.test-helper.ts';

test('B2: cosine is 1 for parallel, 0 for orthogonal, -1 for opposite', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([1, 0], [-1, 0]), -1);
  assert.ok(Math.abs(cosine([3, 4], [6, 8]) - 1) < 1e-12, 'magnitude does not matter');
  assert.equal(cosine([0, 0], [1, 1]), 0, 'a zero vector is not similar to anything');

  assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
  assert.equal(norm([3, 4]), 5);
  assert.throws(() => cosine([1, 2], [1, 2, 3]), /length mismatch/);
});

// B2 — tasks.md: "'my coffee tastes like cardboard' ranks a freshness chunk top-3
// (paraphrase, zero lexical overlap)".
//
// That is a claim about the embeddings, not about this function: "cardboard" and
// "papery" only sit near each other in a model that has read enough English to know it.
// So the ranking is tested here against a hand-built concept space standing in for
// voyage-3, and against the real index below when a real provider is configured.
test('B2: cosine search ranks a paraphrase above lexical neighbours', () => {
  // Dimensions: [staleness, brewing, shipping, billing].
  const chunks = [
    { id: 'freshness-storage#4', embedding: [0.92, 0.15, 0.0, 0.0] },
    { id: 'freshness-storage#1', embedding: [0.80, 0.05, 0.0, 0.0] },
    { id: 'brewing-grind-guide#4', embedding: [0.35, 0.90, 0.0, 0.0] },
    { id: 'shipping#1', embedding: [0.0, 0.0, 0.95, 0.10] },
    { id: 'subscriptions#2', embedding: [0.0, 0.0, 0.10, 0.95] },
  ];
  const query = [0.88, 0.20, 0.0, 0.0]; // "my coffee tastes like cardboard"

  const top3 = cosineSearch(query, chunks, 3).map((r) => r.id);
  assert.ok(top3.some((id) => id.startsWith('freshness-storage')), `got ${top3.join(', ')}`);
  assert.equal(top3[0], 'freshness-storage#4');
  assert.ok(!top3.includes('shipping#1'), 'unrelated topics stay out');
});

test('B2: chunks without an embedding are skipped, not scored as zero', () => {
  const results = cosineSearch([1, 0], [
    { id: 'has-one', embedding: [1, 0] },
    { id: 'has-none' },
  ]);
  assert.deepEqual(results.map((r) => r.id), ['has-one']);
});

test('B2: results are ranked from 1 and capped at the limit', () => {
  const chunks = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, embedding: [1, i / 10] }));
  const results = cosineSearch([1, 0], chunks, 4);
  assert.equal(results.length, 4);
  assert.deepEqual(results.map((r) => r.rank), [1, 2, 3, 4]);
  assert.ok((results[0]?.score ?? 0) >= (results[3]?.score ?? 0));
});

test('B2: the acceptance case against the real index', async (t) => {
  if (!(await hasSemanticVectors())) {
    t.skip(
      'index built with the offline hash provider — cosine measures shared words, not ' +
        'shared meaning. Set VOYAGE_API_KEY or OPENAI_API_KEY, re-run ingest, and this runs.',
    );
    return;
  }

  const index = await corpusSearch();
  const result = await index.search('my coffee tastes like cardboard', { topK: 3 });
  assert.ok(
    result.chunks.some((chunk) => chunk.docId === 'freshness-storage'),
    `top 3 were ${result.chunks.map((c) => c.id).join(', ')}`,
  );
});

test('B2: an offline index carries embeddings but declares them non-semantic', async () => {
  const index = await corpusIndex();
  for (const chunk of index.chunks.slice(0, 3)) {
    assert.equal(chunk.embedding?.length, index.embedding.dimensions);
  }
  assert.equal(index.embedding.semantic, index.embedding.provider !== 'offline');
});
