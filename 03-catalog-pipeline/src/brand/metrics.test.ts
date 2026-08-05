import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countSecondPerson,
  countSyllables,
  fleschKincaidGrade,
  opensWithTaste,
  splitParagraphs,
  splitSentences,
  stripHtml,
  words,
} from './metrics.ts';

test('stripHtml removes tags and keeps paragraph breaks', () => {
  assert.equal(stripHtml('<p>One</p><p>Two</p>'), 'One\n\nTwo');
  assert.equal(stripHtml('a &amp; b'), 'a & b');
});

test('splitParagraphs handles HTML and plain text', () => {
  assert.deepEqual(splitParagraphs('<p>One</p>\n<p>Two</p>'), ['One', 'Two']);
  assert.deepEqual(splitParagraphs('One\n\nTwo\n\nThree'), ['One', 'Two', 'Three']);
});

test('splitSentences does not split on decimal points', () => {
  assert.deepEqual(splitSentences('We paid $7.10 per kilo. That is the number.'), [
    'We paid $7.10 per kilo.',
    'That is the number.',
  ]);
});

test('words strips punctuation but keeps figures and currency', () => {
  assert.deepEqual(words('You pay $19, or 34.00 for 500g.'), [
    'You',
    'pay',
    '$19',
    'or',
    '34.00',
    'for',
    '500g',
  ]);
});

test('countSyllables handles the vocabulary this brand actually uses', () => {
  assert.equal(countSyllables('coffee'), 2);
  assert.equal(countSyllables('espresso'), 3);
  assert.equal(countSyllables('bag'), 1);
  assert.equal(countSyllables('roast'), 1);
  assert.equal(countSyllables('the'), 1);
});

test('fleschKincaidGrade is deterministic and ordered', () => {
  const simple = 'You pick the size. We roast it. It ships the same day.';
  const dense =
    'The organoleptic characteristics demonstrate considerable aromatic complexity throughout extraction.';
  const a = fleschKincaidGrade(simple);
  assert.equal(a, fleschKincaidGrade(simple), 'same input, same output');
  assert.ok(a < fleschKincaidGrade(dense), 'plain copy must score lower than dense copy');
  assert.ok(a < 6, `expected a low grade for plain copy, got ${a}`);
});

test('countSecondPerson works in both locales', () => {
  assert.equal(countSecondPerson('You can brew it your way.', 'en'), 2);
  assert.equal(countSecondPerson('We roast it here.', 'en'), 0);
  assert.equal(countSecondPerson('Puedes molerlo a tu gusto.', 'es'), 2);
  assert.equal(countSecondPerson('Lo tostamos aqui.', 'es'), 0);
});

test('opensWithTaste looks only at the first sentence', () => {
  assert.equal(opensWithTaste('It tastes like plum. It grows in Huila.'), true);
  assert.equal(opensWithTaste('It grows in Huila. It tastes like plum.'), false);
});
