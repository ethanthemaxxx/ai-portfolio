import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../catalog.ts';
import { loadExemplars } from './exemplars.ts';
import { extractStyleGuide, measureExemplars } from './voice-extract.ts';
import { splitSentences, words } from './metrics.ts';
import type { VoiceExemplar } from '../types.ts';

const exemplars = loadExemplars();

test('T04: there are exactly five exemplars and none is a current catalog product', () => {
  assert.equal(exemplars.length, 5);
  const catalogHandles = new Set(loadCatalog().map((p) => p.handle));
  for (const exemplar of exemplars) {
    assert.ok(
      !catalogHandles.has(exemplar.id),
      `${exemplar.id} must not be a product in the current catalog`,
    );
  }
});

test('T04: the exemplars themselves obey the brand rules they are teaching', () => {
  const banned = /\b(artisanal|curated|elevated|journey|passion|handcrafted|liquid gold|exquisite|unlock)\b/i;
  for (const exemplar of exemplars) {
    assert.ok(!banned.test(exemplar.body), `${exemplar.id} contains a banned word`);
    assert.ok(!/[!¡]/.test(exemplar.body), `${exemplar.id} contains an exclamation mark`);
  }
});

test('T06: extraction is deterministic', () => {
  const a = extractStyleGuide(exemplars, { locale: 'en' });
  const b = extractStyleGuide(exemplars, { locale: 'en' });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('T06: maxSentenceWords equals the longest sentence actually in the exemplars', () => {
  const guide = extractStyleGuide(exemplars, { locale: 'en' });
  let longest = 0;
  for (const exemplar of exemplars) {
    for (const sentence of splitSentences(exemplar.body)) {
      longest = Math.max(longest, words(sentence).length);
    }
  }
  assert.equal(guide.constraints.maxSentenceWords, longest);
});

test('T06: the constraint is DERIVED — different exemplars move the ceiling', () => {
  const wordy: VoiceExemplar[] = [
    {
      id: 'ex-wordy',
      title: 'Wordy',
      kind: 'coffee',
      note: 'test fixture',
      body:
        'This single sentence deliberately runs on and on and on for well past the length of anything ' +
        'the real merchant would ever write in their own product copy today.',
    },
  ];
  const tight = extractStyleGuide(exemplars, { locale: 'en' });
  const loose = extractStyleGuide(wordy, { locale: 'en' });
  assert.ok(
    loose.constraints.maxSentenceWords > tight.constraints.maxSentenceWords,
    'a wordier exemplar set must raise the derived ceiling',
  );
  assert.notEqual(loose.version, tight.version, 'the guide version tracks the exemplars');
});

test('T06: the brand rules that must never relax are pinned', () => {
  const guide = extractStyleGuide(exemplars, { locale: 'en' });
  assert.equal(guide.constraints.allowsExclamation, false);
  assert.equal(guide.constraints.requiresSecondPerson, true);
  assert.equal(guide.openingMove, 'taste-first');
  assert.ok(guide.observedVocabulary.includes('washed'));
  assert.ok(guide.observedVocabulary.includes('subscription'));
});

test('T06: reading grade gate applies to English and not to Spanish', () => {
  const en = extractStyleGuide(exemplars, { locale: 'en' });
  const es = extractStyleGuide(exemplars, { locale: 'es' });
  assert.ok(typeof en.constraints.readingGradeMax === 'number');
  assert.ok(en.constraints.readingGradeMax! >= 8);
  assert.equal(es.constraints.readingGradeMax, null);
});

test('T06: measured metrics are plausible for 8th-grade copy', () => {
  const metrics = measureExemplars(exemplars);
  assert.equal(metrics.exemplarCount, 5);
  assert.equal(metrics.exclamationCount, 0);
  assert.ok(metrics.maxReadingGrade < 12, `max grade ${metrics.maxReadingGrade} is too high for this brand`);
  assert.ok(metrics.secondPersonPer100Words > 0);
  assert.equal(metrics.tasteBeforeOriginRate, 1);
});
