import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeNumber,
  containsTerm,
  extractNumberTokens,
  findTerm,
  normalizeText,
} from './text.ts';

test('normalizeText folds accents and case', () => {
  assert.equal(normalizeText('Orgánico'), 'organico');
  assert.equal(normalizeText('Nariño'), 'narino');
  assert.equal(normalizeText('Fair-Trade'), 'fair trade');
});

test('term matching is on word boundaries', () => {
  assert.equal(containsTerm('unlock', 'unlock the flavour'), true);
  assert.equal(containsTerm('unlock', 'the door was unlocked'), false);
  assert.equal(containsTerm('elevated', 'grown at that elevation'), false);
  assert.equal(containsTerm('elevated', 'an elevated experience'), true);
});

test('term matching handles multi-word terms across separators', () => {
  assert.equal(containsTerm('fair trade', 'we are Fair-Trade certified'), true);
  assert.equal(containsTerm('carbon neutral', 'Carbon   Neutral roasting'), true);
  assert.equal(containsTerm('comercio justo', 'de comercio justo'), true);
});

test('term hits report a usable offset and excerpt', () => {
  const text = 'This coffee is certified organic and lovely.';
  const hit = findTerm('organic', text);
  assert.ok(hit);
  assert.equal(text.slice(hit.offset, hit.offset + 7), 'organic');
  assert.ok(hit.evidence.includes('organic'));
});

test('canonicalizeNumber normalizes the shapes copy actually uses', () => {
  assert.equal(canonicalizeNumber('1,750'), '1750');
  assert.equal(canonicalizeNumber('$6.50'), '6.5');
  assert.equal(canonicalizeNumber('250g'), '250');
  assert.equal(canonicalizeNumber('02'), '2');
  assert.equal(canonicalizeNumber('1kg'), '1');
  assert.equal(canonicalizeNumber('nope'), null);
});

test('extractNumberTokens finds every digit-bearing token', () => {
  const tokens = extractNumberTokens('Grown at 1,750 meters. $19 for 250g, or $34 for 500g.');
  assert.deepEqual(
    tokens.map((t) => t.canonical),
    ['1750', '19', '250', '34', '500'],
  );
  assert.equal(tokens[0].raw, '1,750');
});

test('extractNumberTokens sees digits embedded in words like V60', () => {
  assert.deepEqual(
    extractNumberTokens('The V60 dripper, size 02').map((t) => t.canonical),
    ['60', '2'],
  );
});
