import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assessFloor, COVERAGE_FLOOR, termCoverage } from './floor.ts';
import { corpusSearch } from './corpus.test-helper.ts';

test('B4: termCoverage is the share of distinct query terms present', () => {
  const vocabulary = new Set(['roast', 'date', 'bag']);
  assert.equal(termCoverage(['roast', 'date'], vocabulary), 1);
  assert.equal(termCoverage(['roast', 'transmission'], vocabulary), 0.5);
  assert.equal(termCoverage(['transmission'], vocabulary), 0);
  assert.equal(termCoverage([], vocabulary), 0);
  assert.equal(termCoverage(['roast', 'roast', 'roast', 'car'], vocabulary), 0.5, 'distinct terms');
});

test('B4: coverage is measured over the whole context, not the best chunk', () => {
  const terms = new Map([
    ['a', new Set(['skip'])],
    ['b', new Set(['shipment'])],
  ]);
  const assess = (retrieved: string[]) =>
    assessFloor({
      query: 'skip shipment',
      retrieved: retrieved.map((id) => ({ id })),
      termsOf: (id) => terms.get(id) ?? new Set(),
      idf: () => 1,
      topCosine: null,
    });

  assert.equal(assess(['a']).coverage, 0.5, 'one chunk covers half the question');
  assert.equal(assess(['a', 'b']).coverage, 1, 'together they cover all of it');
});

// B4 — "nothing found" must be deterministic, because escalation gates on it.
test('B4: questions the corpus does not cover fall below the floor', async () => {
  const index = await corpusSearch();

  for (const question of [
    'what is the resale value of a 1998 ford transmission',
    'who won the world cup in 1998',
    'how do I fix my car transmission',
    'what is your policy on unicorn grooming',
    'what is the capital of peru',
    'can you help me install a dishwasher',
  ]) {
    const result = await index.search(question);
    assert.equal(result.belowFloor, true, `${question} — coverage ${result.coverage.toFixed(3)}`);
  }
});

test('B4: questions the corpus does cover clear the floor', async () => {
  const index = await corpusSearch();

  for (const question of [
    'which grind should I order for my aeropress',
    'can I skip my next subscription shipment',
    'my bag arrived split open and there is coffee everywhere',
    'how much is shipping under $45',
    'the roast date on my bag is three weeks old',
    'still waiting on the refund, when will it land',
  ]) {
    const result = await index.search(question);
    assert.equal(result.belowFloor, false, `${question} — coverage ${result.coverage.toFixed(3)}`);
  }
});

// tasks.md B4: "'what's your wholesale pricing' returns below-floor, triggering
// escalation". It does not, and it shouldn't. The corpus answers that question — faq.md
// has a "Things we can't answer here" section that names wholesale explicitly — so
// retrieval finds it with high coverage and is right to. Wholesale escalates through
// the can't-answer-here category rule (plan.md §7, trigger 5), which is Group D's job.
// Making the floor fire here would mean rewarding the retriever for missing a chunk
// that exists.
test('B4: wholesale is above the floor because the corpus has a hand-off for it', async () => {
  const index = await corpusSearch();
  const result = await index.search("what's your wholesale pricing");

  assert.equal(result.belowFloor, false);
  assert.ok(
    result.chunks.some((chunk) => chunk.heading === "Things we can't answer here"),
    'the hand-off chunk is what retrieval returns',
  );
});

test('B4: the missing-terms list names what we could not find, most informative first', async () => {
  const index = await corpusSearch();
  const result = await index.search('how do I fix my car transmission');

  assert.equal(result.belowFloor, true);
  assert.ok(result.missing.includes('transmission'), `missing: ${result.missing.join(', ')}`);
  assert.ok(result.missing.includes('car'));
});

test('B4: a strong semantic hit clears the floor with no lexical overlap', () => {
  const assess = (topCosine: number | null) =>
    assessFloor({
      query: 'cardboard',
      retrieved: [{ id: 'freshness-storage#4' }],
      termsOf: () => new Set(['papery', 'flat', 'age']),
      idf: () => 1,
      topCosine,
    });

  assert.equal(assess(null).belowFloor, true, 'no semantic vote available');
  assert.equal(assess(0.1).belowFloor, true, 'a weak hit is not evidence');
  assert.equal(assess(0.7).belowFloor, false, 'a strong hit is');
});

test('B4: the threshold sits in the measured gap', () => {
  // Measured over the 20 eval cases plus 7 out-of-corpus questions: the lowest
  // answerable case scores 0.500 and the highest out-of-corpus one 0.333.
  assert.ok(COVERAGE_FLOOR > 0.333 && COVERAGE_FLOOR < 0.5, `floor is ${COVERAGE_FLOOR}`);
});
