import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IndexFile } from '../types.ts';
import { corpusIndex, corpusSearch } from './corpus.test-helper.ts';
import { DEFAULT_TOP_K, HelpCenterIndex } from './search.ts';

test('search returns top-k chunks with the ranks that produced them', async () => {
  const index = await corpusSearch();
  const result = await index.search('which grind should I use in an aeropress');

  assert.ok(result.chunks.length > 0 && result.chunks.length <= DEFAULT_TOP_K);
  assert.equal(result.chunks[0]?.docId, 'brewing-grind-guide');

  for (const chunk of result.chunks) {
    assert.ok(chunk.score > 0);
    assert.ok(chunk.heading !== '');
    assert.ok(chunk.tokens > 0);
    assert.ok(chunk.bm25Rank !== null || chunk.vectorRank !== null, 'some leg found it');
  }
});

test('topK is respected exactly', async () => {
  const index = await corpusSearch();
  for (const topK of [1, 3, 6, 12]) {
    const result = await index.search('how long does coffee stay fresh', { topK });
    assert.ok(result.chunks.length <= topK, `asked for ${topK}, got ${result.chunks.length}`);
  }
});

test('the whole pipeline runs with no API key', async () => {
  const index = await corpusIndex();
  assert.equal(index.embedding.provider, 'offline', 'this suite runs unconfigured');
  assert.equal(index.embedding.semantic, false);

  const result = await (await corpusSearch()).search('can I pause my subscription');
  assert.equal(result.topCosine, null, 'no semantic leg means no cosine to report');
  assert.equal(result.belowFloor, false);
  assert.equal(result.chunks[0]?.docId, 'subscriptions');
});

test('an index whose provider we have no key for loses the vector leg, not the search', async () => {
  const offline = await corpusIndex();
  const pretendVoyage: IndexFile = {
    ...offline,
    embedding: { provider: 'voyage', model: 'voyage-3', dimensions: 256, semantic: true },
  };

  const result = await new HelpCenterIndex(pretendVoyage).search('is shipping free over $45');
  assert.equal(result.topCosine, null, 'we do not mix embedding spaces');
  assert.ok(result.chunks.length > 0, 'BM25 still answers');
});

test('every retrieved chunk carries what a citation needs', async () => {
  const index = await corpusSearch();
  const result = await index.search('my bag arrived split open');

  for (const chunk of result.chunks) {
    assert.match(chunk.id, /^[a-z-]+#\d+$/);
    assert.ok(['canonical', 'informational'].includes(chunk.authority));
    assert.ok(chunk.title !== '');
    assert.ok(chunk.text.includes(chunk.heading), 'the heading is in the text the model reads');
  }
});

test('a question with no query terms returns nothing and says so', async () => {
  const index = await corpusSearch();
  const result = await index.search('what is the');

  assert.deepEqual(result.chunks, []);
  assert.equal(result.belowFloor, true);
  assert.equal(result.coverage, 0);
});
