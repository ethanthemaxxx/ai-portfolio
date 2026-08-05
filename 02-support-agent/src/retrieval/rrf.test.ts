import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Ranked } from './bm25.ts';
import { reciprocalRankFusion, RRF_K } from './rrf.ts';

/** Build a ranking list from ids in rank order. Scores are irrelevant to RRF. */
function ranking(...ids: string[]): Ranked[] {
  return ids.map((id, i) => ({ id, score: 0, rank: i + 1 }));
}

/** Place one id at a given 1-based rank, padded with filler. */
function at(id: string, position: number): Ranked[] {
  const ids = Array.from({ length: 20 }, (_, i) => `filler-${position}-${i}`);
  ids[position - 1] = id;
  return ranking(...ids);
}

test('B3: k is 60, as plan.md §3 fixes it', () => {
  assert.equal(RRF_K, 60);
});

test('B3: score is the sum of 1/(k + rank) across the legs', () => {
  const [top] = reciprocalRankFusion([ranking('a', 'b'), ranking('a', 'c')]);
  assert.equal(top?.id, 'a');
  assert.ok(Math.abs((top?.score ?? 0) - (1 / 61 + 1 / 61)) < 1e-12);
  assert.deepEqual(top?.ranks, [1, 1]);
});

// B3 — tasks.md: "A chunk ranked #1 by one retriever and #8 by the other outranks a
// chunk ranked #4 by both."
//
// At k = 60 that is false, and it is false by arithmetic, not by implementation:
//
//   1/61 + 1/68 = 0.0310993…   (ranks 1 and 8)
//   1/64 + 1/64 = 0.0312500    (ranks 4 and 4)
//
// The crossover sits at exactly k = 20, where 1/21 + 1/28 = 2/24 = 1/12. Below it the
// task's example holds; above it, agreement beats a single strong opinion. Large k is
// what makes RRF conservative, and 60 is large. The example needs one more rank of
// separation — #1 and #8 does beat #5 and #5 — or a smaller k.
test('B3: at k=60, agreement between the legs outweighs one strong opinion', () => {
  const spiky = [at('spiky', 1), at('spiky', 8)];
  const agreed = [at('agreed', 4), at('agreed', 4)];

  const spikyScore = 1 / (RRF_K + 1) + 1 / (RRF_K + 8);
  const agreedScore = 2 / (RRF_K + 4);
  assert.ok(spikyScore < agreedScore, `${spikyScore} < ${agreedScore}`);

  const fused = reciprocalRankFusion([
    [...(spiky[0] ?? []), ...(agreed[0] ?? [])],
    [...(spiky[1] ?? []), ...(agreed[1] ?? [])],
  ]);
  const order = fused.filter((f) => f.id === 'spiky' || f.id === 'agreed').map((f) => f.id);
  assert.deepEqual(order, ['agreed', 'spiky']);
});

test('B3: #1 and #8 does beat #5 and #5 — the task example is one rank short', () => {
  const spiky = 1 / (RRF_K + 1) + 1 / (RRF_K + 8);
  const agreed = 2 / (RRF_K + 5);
  assert.ok(spiky > agreed, `${spiky} > ${agreed}`);
});

test('B3: k=20 is the exact crossover', () => {
  assert.ok(Math.abs(1 / 21 + 1 / 28 - 2 / 24) < 1e-15);
  assert.ok(1 / 11 + 1 / 18 > 2 / 14, 'below the crossover the spiky chunk wins');
});

test('B3: a chunk only one leg found still places, below one both found', () => {
  const fused = reciprocalRankFusion([ranking('both', 'lexical-only'), ranking('both')]);
  assert.deepEqual(fused.map((f) => f.id), ['both', 'lexical-only']);
  assert.deepEqual(fused[1]?.ranks, [2, null], 'missing legs are recorded as null');
});

test('B3: an empty leg is not a vote against anything', () => {
  const fused = reciprocalRankFusion([ranking('a', 'b'), []]);
  assert.deepEqual(fused.map((f) => f.id), ['a', 'b']);
  assert.deepEqual(reciprocalRankFusion([[], []]), []);
});

test('B3: smaller k sharpens fusion, larger k flattens it', () => {
  const legs = [at('spiky', 1), at('spiky', 8)];
  const lists = [
    [...(legs[0] ?? []), ...ranking('x', 'y', 'z', 'agreed')],
    [...(legs[1] ?? []), ...ranking('x', 'y', 'z', 'agreed')],
  ];

  const sharp = reciprocalRankFusion(lists, 5).map((f) => f.id);
  const flat = reciprocalRankFusion(lists, 60).map((f) => f.id);
  assert.ok(sharp.indexOf('spiky') < flat.indexOf('spiky'));
});
