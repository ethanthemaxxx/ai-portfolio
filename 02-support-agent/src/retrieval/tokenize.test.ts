import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isStopword, normalizeQuery, tokenize } from './tokenize.ts';

test('numbers and prices survive tokenization', () => {
  assert.deepEqual(tokenize('Free shipping over $45'), ['free', 'shipping', 'over', '45']);
  // "by" and "am" are stopwords — "11" and "00" are what make the cut-off findable.
  assert.deepEqual(tokenize('Order by 11:00 AM ET'), ['order', '11', '00', 'et']);
});

test('plurals collapse, but only the safe ones', () => {
  assert.deepEqual(tokenize('times days orders subscriptions'), ['time', 'day', 'order', 'subscription']);
  assert.deepEqual(tokenize('business address press us'), ['business', 'address', 'press', 'us']);
  assert.deepEqual(tokenize('policies'), ['policy']);
});

test('order numbers are stripped — they route to lookup_order, not to the index', () => {
  assert.deepEqual(tokenize('Where is my order CA-10241?'), ['order']);
  assert.equal(normalizeQuery('CA-10241 arrived damaged').trim(), 'arrived damaged');
  assert.deepEqual(tokenize('CA-10250 refund'), ['refund']);
});

test('contractions resolve to real words instead of fragments', () => {
  assert.deepEqual(tokenize("it hasn't moved"), ['moved']);
  assert.deepEqual(tokenize("the kettle doesn't heat"), ['kettle', 'heat']);
  assert.deepEqual(tokenize("any idea when it'll get here"), ['idea', 'get']);
  for (const fragment of ['hasn', 'isn', 'doesn', 'wasn', 'll', 've']) {
    assert.ok(!tokenize("it hasn't, it isn't, it doesn't, it wasn't, it'll, I've").includes(fragment));
  }
});

test('single stray letters are dropped, single digits are not', () => {
  assert.deepEqual(tokenize("what's the b setting"), ['setting']);
  assert.deepEqual(tokenize('6 days'), ['6', 'day']);
});

test('stopwords are the question words, not the policy words', () => {
  assert.ok(isStopword('what'));
  assert.ok(isStopword('the'));
  assert.ok(!isStopword('off'), '"10% off" and "days off roast" both matter');
  assert.ok(!isStopword('ship'));
});
