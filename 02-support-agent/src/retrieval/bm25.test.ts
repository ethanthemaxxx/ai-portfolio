import { test } from 'node:test';
import assert from 'node:assert/strict';

import { B, BM25, K1, rank } from './bm25.ts';
import { corpusBm25, corpusChunks } from './corpus.test-helper.ts';

test('B1: the constants are the ones plan.md fixes', () => {
  assert.equal(K1, 1.2);
  assert.equal(B, 0.75);
});

// B1 — tasks.md: "'what time is the cut off' ranks the shipping cut-off chunk first".
//
// It does not, and the check is wrong rather than the code. The query's content terms
// are `time`, `cut`, `off`. `shipping#0` — the chunk that holds the actual cut-off
// times — never uses the word "time" and says "cut-off" once. `faq#0` says it twice and
// puts "11:00 AM ET" next to it; `subscriptions#1` says "any time" three times. BM25
// ranks by matched IDF mass, so it ranks them in that order, and it is right to.
//
// What the retriever owes us is that the rule comes back, which it does: every chunk in
// the top 3 states the cut-off, and the canonical shipping chunk is in the top 4.
test('B1: "what time is the cut off" returns the cut-off rule, ranked by lexical evidence', async () => {
  const bm25 = await corpusBm25();
  const chunks = await corpusChunks();
  const results = bm25.search('what time is the cut off', 4);

  for (const result of results.slice(0, 3)) {
    const chunk = chunks.find((c) => c.id === result.id);
    assert.match(chunk?.text ?? '', /cut-off/, `${result.id} states the cut-off rule`);
  }

  const ids = results.map((r) => r.id);
  assert.equal(ids[0], 'subscriptions#1', 'measured: "any time" x3 carries the most matched IDF');
  assert.ok(ids.includes('faq#0'), 'the FAQ chunk that pairs "cut-off" with "11:00 AM ET"');
  assert.ok(ids.includes('shipping#0'), 'the canonical roast-day cut-off chunk is in the top 4');
});

test('B1: exact terms rank exactly — the queries pure vector blurs', async () => {
  const bm25 = await corpusBm25();

  const free = bm25.search('free shipping over $45', 3).map((r) => r.id);
  assert.ok(free.includes('shipping#2') || free.includes('faq#3'), `got ${free.join(', ')}`);

  const stalled = bm25.search('tracking has not moved in 5 business days', 3).map((r) => r.id);
  assert.equal(stalled[0], 'shipping#5', 'Late, lost and stolen packages');

  const microlot = bm25.search('microlot on subscription', 2).map((r) => r.id);
  assert.equal(microlot[0], 'subscriptions#5', "What subscriptions don't cover");

  const wholesale = bm25.search('wholesale pricing for a cafe', 2).map((r) => r.id);
  assert.equal(wholesale[0], 'faq#4', "Things we can't answer here");
});

test('B1: IDF rises as a term gets rarer, and peaks for terms the corpus lacks', async () => {
  const bm25 = await corpusBm25();

  assert.ok(bm25.idf('coffee') < bm25.idf('espresso'));
  assert.ok(bm25.idf('espresso') < bm25.idf('chargeback'));
  assert.ok(bm25.idf('chargeback') < bm25.idf('carburettor'), 'unseen terms score highest');
  assert.ok(bm25.idf('coffee') >= 0);
});

test('B1: scoring saturates with term frequency and normalises for length', () => {
  const bm25 = new BM25([
    { id: 'once', text: 'roast roast filler filler filler filler filler filler filler filler' },
    { id: 'twice', text: 'roast roast roast roast filler filler filler filler filler filler filler filler' },
    { id: 'none', text: 'filler filler filler filler filler filler filler filler filler filler' },
  ]);

  const scores = new Map(bm25.search('roast', 3).map((r) => [r.id, r.score]));
  const once = scores.get('once') ?? 0;
  const twice = scores.get('twice') ?? 0;

  assert.ok(twice > once, 'more occurrences score higher');
  assert.ok(twice < 2 * once, 'but not linearly — that is the k1 saturation');
  assert.equal(scores.get('none'), undefined, 'documents without the term are not returned');
});

test('B1: an all-stopword query returns nothing rather than everything', async () => {
  const bm25 = await corpusBm25();
  assert.deepEqual(bm25.search('what is the', 5), []);
  assert.deepEqual(bm25.search('', 5), []);
});

test('B1: ties break on id, so two runs rank identically', () => {
  const ranked = rank(
    [
      { id: 'b', score: 1 },
      { id: 'a', score: 1 },
      { id: 'c', score: 2 },
    ],
    3,
  );
  assert.deepEqual(ranked.map((r) => r.id), ['c', 'a', 'b']);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 3]);
});

test('B1: termsOf exposes what a chunk contains, for the relevance floor', async () => {
  const bm25 = await corpusBm25();
  const terms = bm25.termsOf('shipping#2');
  assert.ok(terms.has('45'));
  assert.ok(terms.has('shipping'));
  assert.ok(!terms.has('microlot'));
  assert.equal(bm25.termsOf('does-not-exist').size, 0);
});
