import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeInRange, fitParts, type Fragment } from './compose.ts';

const frag = (text: string, id = 'f'): Fragment => ({ text, factIds: [id] });

test('T16: the result is always inside the range, or it is a declared failure', () => {
  const sets: Fragment[][] = [
    [frag('a'.repeat(50)), frag('b'.repeat(40)), frag('c'.repeat(70)), frag('d'.repeat(25))],
    [frag('x'.repeat(200))],
    [frag('y'.repeat(10)), frag('z'.repeat(12))],
    [],
  ];
  for (const set of sets) {
    for (const [min, max] of [[140, 160], [40, 125], [10, 20]] as const) {
      const result = composeInRange(set, { min, max });
      if (result.ok) {
        assert.ok(
          result.text.length >= min && result.text.length <= max,
          `length ${result.text.length} outside ${min}-${max}`,
        );
      } else {
        assert.ok(result.reason.length > 0);
      }
    }
  }
});

test('T16: an impossible range fails loudly instead of truncating', () => {
  const result = composeInRange([frag('short')], { min: 140, max: 160 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /no combination/);
});

test('T16: identical input gives identical output', () => {
  const set = [frag('a'.repeat(60), 'a'), frag('b'.repeat(50), 'b'), frag('c'.repeat(45), 'c')];
  const first = composeInRange(set, { min: 100, max: 120 });
  for (let i = 0; i < 100; i += 1) {
    assert.deepEqual(composeInRange(set, { min: 100, max: 120 }), first);
  }
});

test('T16: the highest-priority fragments win', () => {
  const set = [frag('AAAAAAAAAA', 'a'), frag('BBBBBBBBBB', 'b'), frag('CCCCCCCCCC', 'c')];
  const result = composeInRange(set, { min: 20, max: 21 });
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.text, 'AAAAAAAAAA BBBBBBBBBB');
});

test('T16: an extra constraint can be enforced during the search', () => {
  const set = [frag('aaaaaaaaaa'), frag('you bbbbbb'), frag('cccccccccc')];
  const result = composeInRange(set, {
    min: 20,
    max: 21,
    accept: (text) => text.includes('you'),
  });
  assert.ok(result.ok);
  if (result.ok) assert.ok(result.text.includes('you'));
});

test('T16: chosen fact ids are reported and de-duplicated', () => {
  const set = [frag('aaaaaaaaaa', 'x'), frag('bbbbbbbbbb', 'x'), frag('cccccccccc', 'y')];
  const result = composeInRange(set, { min: 20, max: 21 });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.factIds, ['x']);
});

test('T16: too many fragments is a configuration error, not a slow run', () => {
  const many = Array.from({ length: 20 }, (_, i) => frag(`f${i}`));
  assert.throws(() => composeInRange(many, { min: 1, max: 500 }), /cap is 16/);
});

test('fitParts drops trailing parts until the whole thing fits', () => {
  assert.equal(fitParts(['Huila Reserve', 'Medium Roast', 'Cerro Alto'], 60), 'Huila Reserve — Medium Roast — Cerro Alto');
  assert.equal(fitParts(['Huila Reserve', 'a'.repeat(60)], 60), 'Huila Reserve');
  assert.equal(fitParts(['a'.repeat(80)], 60).length, 60);
});
