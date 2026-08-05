import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_FACTS, brandFactsAreCertificationFree } from './brand-facts.ts';

test('T07: every brand fact cites where it came from', () => {
  assert.ok(BRAND_FACTS.length > 0);
  for (const fact of BRAND_FACTS) {
    assert.ok(fact.source.startsWith('brand.md'), `${fact.id} must cite brand.md`);
    assert.ok(fact.surfaces.length > 0, `${fact.id} has no textual surfaces`);
    assert.ok(fact.id.startsWith('brand.'), `${fact.id} must be namespaced`);
  }
});

test('T07: brand facts contain no certification claim', () => {
  assert.equal(brandFactsAreCertificationFree(), true);
});

test('T07: brand fact ids are unique', () => {
  const ids = BRAND_FACTS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});
