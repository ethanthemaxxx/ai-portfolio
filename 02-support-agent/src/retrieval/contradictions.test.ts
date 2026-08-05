import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Chunk } from '../types.ts';
import {
  applyContradictions,
  detectContradictions,
  extractClaims,
  formatContradiction,
} from './contradictions.ts';
import { corpusChunks } from './corpus.test-helper.ts';

function chunk(partial: Partial<Chunk> & Pick<Chunk, 'id' | 'text'>): Chunk {
  return {
    docId: partial.id.split('#')[0] ?? partial.id,
    title: 'Test',
    heading: 'Test',
    authority: 'canonical',
    tokens: 10,
    ...partial,
  };
}

/** The canonical rule, and a stale help-centre article that disagrees with it. */
const CANONICAL_SHIPPING = chunk({
  id: 'shipping#2',
  heading: 'Shipping cost',
  authority: 'canonical',
  text: '## Shipping cost\n\n- **Free standard shipping on orders of $45 or more**\n- Standard shipping under $45: **flat $6.50**',
});

const STALE_HELP_ARTICLE = chunk({
  id: 'help-shipping#0',
  heading: 'How much is shipping?',
  authority: 'informational',
  text: '## How much is shipping?\n\nWe offer free standard shipping on orders of $60 or more.',
});

// B5 — "Two chunks with conflicting rules → canonical wins, pair is logged"
test('B5: canonical wins, the stale chunk is dropped, the pair is logged', () => {
  const found = detectContradictions([CANONICAL_SHIPPING, STALE_HELP_ARTICLE]);

  assert.equal(found.length, 1);
  const [contradiction] = found;
  assert.equal(contradiction?.unit, 'usd');
  assert.equal(contradiction?.winner.chunkId, 'shipping#2');
  assert.equal(contradiction?.winner.value, 45);
  assert.equal(contradiction?.winner.authority, 'canonical');
  assert.equal(contradiction?.loser.chunkId, 'help-shipping#0');
  assert.equal(contradiction?.loser.value, 60);
  assert.ok((contradiction?.sharedAnchors.length ?? 0) >= 2, 'the pair records why it fired');

  const kept = applyContradictions([CANONICAL_SHIPPING, STALE_HELP_ARTICLE], found);
  assert.deepEqual(kept.map((c) => c.id), ['shipping#2'], 'the loser leaves the context');

  const line = formatContradiction(contradiction!);
  assert.match(line, /shipping/);
  assert.match(line, /45/);
  assert.match(line, /60/);
  assert.match(line, /canonical/);
});

test('B5: order does not decide the winner — authority does', () => {
  const reversed = detectContradictions([STALE_HELP_ARTICLE, CANONICAL_SHIPPING]);
  assert.equal(reversed[0]?.winner.chunkId, 'shipping#2');
  assert.equal(reversed[0]?.loser.chunkId, 'help-shipping#0');
});

test('B5: the same value stated twice is agreement, not a contradiction', () => {
  const agreeing = chunk({
    id: 'help-shipping#1',
    authority: 'informational',
    text: 'Free standard shipping on orders of $45 or more.',
  });
  assert.deepEqual(detectContradictions([CANONICAL_SHIPPING, agreeing]), []);
});

test('B5: numbers about different things are not a contradiction', () => {
  const unrelated = chunk({
    id: 'help-returns#0',
    authority: 'informational',
    text: 'Refunds above $150 need a supervisor to approve them.',
  });
  assert.deepEqual(
    detectContradictions([CANONICAL_SHIPPING, unrelated]),
    [],
    '$45 free-shipping and a $150 approval limit share no context',
  );
});

test('B5: different units never collide', () => {
  const days = chunk({
    id: 'help-shipping#2',
    authority: 'informational',
    text: 'Free standard shipping on orders takes 45 days to arrive.',
  });
  const found = detectContradictions([CANONICAL_SHIPPING, days]);
  for (const contradiction of found) {
    assert.notEqual(contradiction.unit, 'usd');
  }
});

test('B5: durations, percentages and clock times are all comparable', () => {
  const pairs: [string, string, string][] = [
    [
      'Contact us within 30 days of delivery to claim a replacement.',
      'Contact us within 14 days of delivery to claim a replacement.',
      'day',
    ],
    [
      'Subscribers get 10% off every shipment, forever.',
      'Subscribers get 15% off every shipment, forever.',
      'percent',
    ],
    [
      'The charge happens at 6:00 AM ET on the roast day.',
      'The charge happens at 9:00 AM ET on the roast day.',
      'clock',
    ],
  ];

  for (const [canonicalText, staleText, unit] of pairs) {
    const found = detectContradictions([
      chunk({ id: 'canonical#0', authority: 'canonical', text: canonicalText }),
      chunk({ id: 'stale#0', authority: 'informational', text: staleText }),
    ]);
    assert.equal(found[0]?.unit, unit, `${unit}: ${found.length} found`);
    assert.equal(found[0]?.winner.chunkId, 'canonical#0');
  }
});

// Same-authority pairs are out of scope, and this is why: run the same heuristic across
// every pair in the corpus and it flags 14 conflicts where there are none. "Contact us
// within 7 days of the delivery scan" and "within 30 days of delivery" are different
// rules that share enough words to look like one rule stated twice. Authority is what
// makes a resolution possible, so without it there is nothing to report but noise.
test('B5: the real corpus produces no contradictions', async () => {
  const chunks = await corpusChunks();
  const found = detectContradictions(chunks);
  assert.deepEqual(found, [], found.map(formatContradiction).join('\n'));
});

test('B5: claim extraction reads the quantity and what it is about', () => {
  const claims = extractClaims(
    'Free standard shipping on orders of $45 or more. Under that it is a flat $6.50.',
  );

  const values = claims.filter((c) => c.unit === 'usd').map((c) => c.value);
  assert.deepEqual(values, [45, 6.5]);

  const [first] = claims;
  assert.ok(first?.anchors.includes('shipping'));
  assert.ok(!first?.anchors.includes('more'), 'measurement words are not anchors');
  assert.match(first?.text ?? '', /Free standard shipping/);
});

test('B5: a clock time is normalised to minutes so AM and PM compare', () => {
  const [morning] = extractClaims('The cut-off is 11:00 AM ET.');
  const [evening] = extractClaims('The cut-off is 11:00 PM ET.');
  assert.equal(morning?.value, 11 * 60);
  assert.equal(evening?.value, 23 * 60);
});
