import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildIndex, serializeIndex } from './build-index.ts';

// A5 — "Two runs produce byte-identical output"
test('A5: two builds serialize to byte-identical output', async () => {
  const first = serializeIndex(await buildIndex());
  const second = serializeIndex(await buildIndex());

  assert.equal(
    Buffer.byteLength(first),
    Buffer.byteLength(second),
    'same byte length',
  );
  assert.equal(first, second, 'same bytes');
});

test('A5: the index records nothing that changes on its own', async () => {
  const serialized = serializeIndex(await buildIndex());

  assert.doesNotMatch(serialized, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'no ISO timestamps');
  for (const key of ['generatedAt', 'builtAt', 'createdAt', 'timestamp']) {
    assert.ok(!serialized.includes(`"${key}"`), `no ${key} field`);
  }
});

test('A5: keys are sorted at every level', async () => {
  const index = await buildIndex();
  const serialized = serializeIndex(index);

  const topLevelKeys = [...serialized.matchAll(/^ {2}"(\w+)":/gm)].map((m) => m[1]);
  assert.deepEqual(topLevelKeys, [...topLevelKeys].sort());
  assert.deepEqual(topLevelKeys, ['chunks', 'docs', 'embedding', 'schemaVersion', 'tokens']);
});

test('A5: chunks are sorted by document then by ordinal, not lexically', async () => {
  const index = await buildIndex();
  const ids = index.chunks.map((c) => c.id);

  assert.deepEqual(index.docs, [...index.docs].sort());
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');

  const byDoc = new Map<string, number[]>();
  for (const chunk of index.chunks) {
    const ordinal = Number(chunk.id.split('#')[1]);
    byDoc.set(chunk.docId, [...(byDoc.get(chunk.docId) ?? []), ordinal]);
  }
  for (const [docId, ordinals] of byDoc) {
    assert.deepEqual(ordinals, ordinals.map((_, i) => i), `${docId} ordinals ascend from 0`);
  }

  // The trap this guards: "doc#10" sorts before "doc#2" as a string.
  const docOrder = [...new Set(index.chunks.map((c) => c.docId))];
  assert.deepEqual(docOrder, [...docOrder].sort(), 'documents grouped in sorted order');
});

test('A5: the index carries what retrieval needs to know about its own embeddings', async () => {
  const index = await buildIndex();

  assert.equal(index.schemaVersion, 1);
  assert.ok(index.chunks.length > 0);
  assert.deepEqual(index.docs, [
    'brewing-grind-guide',
    'faq',
    'freshness-storage',
    'returns-refunds',
    'shipping',
    'subscriptions',
  ]);
  assert.ok(
    !index.docs.includes('brand'),
    'brand.md is voice guidance, not citable evidence — see corpusPaths',
  );
  assert.equal(index.embedding.semantic, index.embedding.provider !== 'offline');
  for (const chunk of index.chunks) {
    assert.equal(chunk.embedding?.length, index.embedding.dimensions, `${chunk.id} dimensions`);
  }
});
