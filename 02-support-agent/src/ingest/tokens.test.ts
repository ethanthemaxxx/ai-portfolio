import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildIndex } from './build-index.ts';
import { createTokenCounter, estimateTokens } from './tokens.ts';

// A3 — "Chunk token counts are non-zero and sum within 5% of a whole-corpus count"
//
// Runs against whichever counter the environment gives us: the real
// `messages.countTokens` when ANTHROPIC_API_KEY is set, the chars/4 estimate when it
// isn't. The assertion is the same either way, which is the point of the fallback.
test('A3: per-chunk counts are non-zero and sum to the whole-corpus count within 5%', async () => {
  const counter = createTokenCounter();
  const index = await buildIndex({ tokenCounter: counter });

  for (const chunk of index.chunks) {
    assert.ok(chunk.tokens > 0, `${chunk.id} has a token count`);
  }

  const summed = index.chunks.reduce((total, c) => total + c.tokens, 0);
  const [whole] = await counter.count([index.chunks.map((c) => c.text).join('\n\n')]);
  assert.ok(whole !== undefined && whole > 0);

  const drift = Math.abs(summed - whole) / whole;
  assert.ok(drift <= 0.05, `sum ${summed} vs whole-corpus ${whole} drifts ${(drift * 100).toFixed(2)}%`);
});

test('A3: no key means the estimate counter, and it never returns zero for real text', () => {
  const counter = createTokenCounter({});
  assert.equal(counter.mode, 'estimate');

  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.ok(estimateTokens('Order by 11:00 AM ET Sunday') > 0);
});

test('A3: a key selects the API counter without calling it', () => {
  const counter = createTokenCounter({ ANTHROPIC_API_KEY: 'sk-not-a-real-key' });
  assert.equal(counter.mode, 'api');
});
