import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../catalog.ts';
import { buildFactLedger } from '../ledger/fact-ledger.ts';
import { checkLexicalGrounding, checkNumericGrounding, checkProvenance, indexLedger } from './provenance.ts';

const byHandle = new Map(loadCatalog().map((p) => [p.handle, p]));
const huila = indexLedger(buildFactLedger(byHandle.get('huila-reserve')!));
const mug = indexLedger(buildFactLedger(byHandle.get('ceramic-mug')!));

function numbers(text: string) {
  return checkNumericGrounding(text, 'bodyHtml', huila);
}
function terms(text: string) {
  return checkLexicalGrounding(text, 'bodyHtml', huila);
}

test('AC-06a: real figures pass, invented figures fail', () => {
  assert.deepEqual(numbers('Grown at 1,750 meters above sea level.'), []);
  assert.deepEqual(numbers('A 250g bag is $19.'), []);

  const bad = numbers('Grown at 2,100 meters above sea level.');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].ruleId, 'AC-06a');
  assert.ok(bad[0].evidence.includes('2,100'));

  assert.equal(numbers('A 250g bag is $21.').length, 1, 'wrong price must fail');
  assert.equal(numbers('Harvested in 2024.').length, 1, 'invented year must fail');
});

test('AC-06b: real tasting notes pass, invented ones fail', () => {
  assert.deepEqual(terms('It tastes like ripe plum, brown sugar and orange.'), []);

  const invented = terms('Notes of blueberry and jasmine.');
  assert.equal(invented.length, 2);
  assert.deepEqual(
    invented.map((v) => v.ruleId),
    ['AC-06b', 'AC-06b'],
  );
  assert.ok(invented.some((v) => v.message.includes('blueberry')));
});

test('AC-06b: invented varietals and processes fail', () => {
  assert.equal(terms('A Gesha lot from a single estate.').length >= 1, true);
  assert.equal(terms('This is a natural process coffee.').length, 1, 'Huila is washed, not natural');
  assert.deepEqual(terms('This is a washed coffee.'), []);
});

test('AC-06b: morphology is handled — "Colombian" is backed by an origin of "Colombia"', () => {
  assert.deepEqual(terms('A Colombian coffee.'), []);
  assert.equal(terms('An Ethiopian coffee.').length, 1);
});

test('AC-06b: materials are checked too — the mug never claims to be ceramic', () => {
  // The mug's data says "Thick walled, dishwasher safe" and nothing about ceramic.
  assert.equal(checkLexicalGrounding('A ceramic mug.', 'bodyHtml', mug).length, 1);
  assert.deepEqual(checkLexicalGrounding('Dishwasher safe.', 'bodyHtml', mug), []);
});

test('checkProvenance runs both checks together', () => {
  const violations = checkProvenance(
    'Grown at 2,100 meters, with notes of blueberry.',
    'bodyHtml',
    huila,
  );
  assert.deepEqual(
    violations.map((v) => v.ruleId).sort(),
    ['AC-06a', 'AC-06b'],
  );
});

test('every violation reports a usable offset', () => {
  const text = 'Grown at 2,100 meters above sea level.';
  const [violation] = checkNumericGrounding(text, 'bodyHtml', huila);
  assert.ok(text.slice(violation.offset).startsWith('2,100'));
});
