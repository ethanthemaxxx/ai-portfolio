import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../catalog.ts';
import { loadExemplars } from '../brand/exemplars.ts';
import { extractStyleGuide } from '../brand/voice-extract.ts';
import { buildFactLedger } from '../ledger/fact-ledger.ts';
import { RULES, validateCopy } from './rules.ts';
import type { GeneratedCopy, Locale, StyleGuide } from '../types.ts';

const exemplars = loadExemplars();
const guideEn = extractStyleGuide(exemplars, { locale: 'en' });
const guideEs = extractStyleGuide(exemplars, { locale: 'es' });
const huila = loadCatalog().find((p) => p.handle === 'huila-reserve')!;
const ledger = buildFactLedger(huila);

/** A hand-written baseline that satisfies every rule. Every test below mutates it. */
const BASELINE: GeneratedCopy = {
  handle: 'huila-reserve',
  locale: 'en',
  bodyHtml: [
    '<p>Huila Reserve tastes like ripe plum, brown sugar and orange.</p>',
    '<p>The one we hand people who say they do not like black coffee.</p>',
    '<p>Medium roast, washed, from Huila, Colombia. Grown at 1,750 meters above sea level.</p>',
    '<p>You can pick whole bean, filter, espresso or French press, in 250g, 500g or 1kg.</p>',
  ].join('\n'),
  metaTitle: 'Huila Reserve — Medium Roast Coffee from Colombia',
  metaDescription:
    'Huila Reserve is a medium roast washed coffee from Huila, Colombia. You get ripe plum, brown sugar and orange. Roasted Monday and Thursday, shipped same day.',
  imageAlt: 'Cerro Alto Huila Reserve coffee bag, 250g, whole bean',
  generator: 'test-baseline',
  usedFactIds: [],
};

function check(patch: Partial<GeneratedCopy>, guide: StyleGuide = guideEn, locale: Locale = 'en') {
  return validateCopy({ ...BASELINE, ...patch }, ledger, guide, locale, huila.title);
}

function ids(patch: Partial<GeneratedCopy>, guide?: StyleGuide, locale?: Locale) {
  return [...new Set(check(patch, guide, locale).map((v) => v.ruleId))];
}

test('the baseline passes every rule (otherwise nothing below means anything)', () => {
  const violations = check({});
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
});

test('AC-01: banned brand words are caught in any field', () => {
  assert.deepEqual(ids({ bodyHtml: '<p>An artisanal cup.</p><p>Two</p><p>Three</p>' }).includes('AC-01'), true);
  assert.ok(ids({ metaTitle: 'Huila Reserve — a curated lot' }).includes('AC-01'));
  assert.ok(ids({ imageAlt: 'Cerro Alto Huila Reserve bag, handcrafted in Miami' }).includes('AC-01'));
});

test('AC-02: certification claims and their near-misses are all caught', () => {
  const nearMisses = [
    'Certified organic beans.',
    'Fair Trade coffee.',
    'We are carbon neutral.',
    'Direct trade from the farm.',
    'Rainforest Alliance approved.',
    'Sustainably sourced coffee.',
    'Ethically sourced from smallholders.',
    'Grown pesticide free.',
  ];
  for (const phrase of nearMisses) {
    const violations = check({ metaDescription: `${phrase} ${BASELINE.metaDescription}` });
    assert.ok(
      violations.some((v) => v.ruleId === 'AC-02'),
      `"${phrase}" must trip the certification rule`,
    );
  }
});

test('AC-02: the Spanish pack catches the Spanish phrasings', () => {
  for (const phrase of ['Café orgánico certificado.', 'De comercio justo.', 'Tostado sostenible.']) {
    const violations = check({ metaDescription: phrase }, guideEs, 'es');
    assert.ok(violations.some((v) => v.ruleId === 'AC-02'), `"${phrase}" must trip AC-02`);
  }
});

test('AC-03: meta title boundary is exact', () => {
  assert.ok(!ids({ metaTitle: 'x'.repeat(60) }).includes('AC-03'));
  assert.ok(ids({ metaTitle: 'x'.repeat(61) }).includes('AC-03'));
  assert.ok(ids({ metaTitle: '' }).includes('AC-03'));
});

test('AC-04: meta description window is exact at both ends', () => {
  const pad = (n: number) => `You get ${'a'.repeat(n - 8)}`;
  assert.ok(ids({ metaDescription: pad(139) }).includes('AC-04'));
  assert.ok(!ids({ metaDescription: pad(140) }).includes('AC-04'));
  assert.ok(!ids({ metaDescription: pad(160) }).includes('AC-04'));
  assert.ok(ids({ metaDescription: pad(161) }).includes('AC-04'));
});

test('AC-05: alt text must describe, not announce', () => {
  assert.ok(ids({ imageAlt: 'Image of a Huila Reserve coffee bag on a wooden table' }).includes('AC-05'));
  assert.ok(ids({ imageAlt: 'Photo of the Huila Reserve bag, 250g, whole bean' }).includes('AC-05'));
  assert.ok(ids({ imageAlt: 'Coffee bag' }).includes('AC-05'), 'too short');
  assert.ok(ids({ imageAlt: 'A brown bag sitting on a table next to a white ceramic cup' }).includes('AC-05'), 'does not name the product');
});

test('AC-05: the Spanish pack catches "imagen de"', () => {
  const violations = check(
    { imageAlt: 'Imagen de la bolsa de Huila Reserve, 250g, grano entero' },
    guideEs,
    'es',
  );
  assert.ok(violations.some((v) => v.ruleId === 'AC-05'));
});

test('AC-06: fabricated facts are caught in every field', () => {
  const traceability = (patch: Partial<GeneratedCopy>) =>
    ids(patch).filter((id) => id.startsWith('AC-06'));

  assert.deepEqual(
    traceability({ bodyHtml: BASELINE.bodyHtml.replace('1,750', '2,100') }),
    ['AC-06a'],
    'fabricated altitude',
  );
  assert.deepEqual(
    traceability({ bodyHtml: BASELINE.bodyHtml.replace('orange', 'blueberry') }),
    ['AC-06b'],
    'fabricated tasting note',
  );
  assert.ok(
    traceability({ metaTitle: 'Huila Reserve — Gesha Microlot' }).includes('AC-06b'),
    'fabricated varietal',
  );
  assert.ok(
    traceability({ imageAlt: 'Cerro Alto Huila Reserve coffee bag, 300g, whole bean' }).includes('AC-06a'),
    'fabricated weight',
  );
});

test('AC-07a: exclamation marks are banned everywhere, including ¡', () => {
  assert.ok(ids({ metaTitle: 'Huila Reserve!' }).includes('AC-07a'));
  assert.ok(ids({ imageAlt: 'Cerro Alto Huila Reserve coffee bag, 250g, whole bean!' }).includes('AC-07a'));
  assert.ok(check({ metaDescription: `¡${BASELINE.metaDescription}` }, guideEs, 'es').some((v) => v.ruleId === 'AC-07a'));
});

test('AC-07b: copy that never addresses the reader is caught', () => {
  const noYou = BASELINE.metaDescription.replace('You get', 'It has');
  assert.ok(ids({ metaDescription: noYou }).includes('AC-07b'));
  const bodyNoYou = BASELINE.bodyHtml.replace('You can pick', 'It comes in');
  assert.ok(ids({ bodyHtml: bodyNoYou }).includes('AC-07b'));
});

test('AC-08a: the sentence-length gate reads the style guide, not a constant', () => {
  const long =
    '<p>Huila Reserve tastes like ripe plum, brown sugar and orange, and it also happens to be the coffee we hand to people who say that they do not like black coffee at all.</p><p>Two</p><p>Three</p>';
  assert.ok(ids({ bodyHtml: long }).includes('AC-08a'));

  const permissive: StyleGuide = {
    ...guideEn,
    constraints: { ...guideEn.constraints, maxSentenceWords: 60 },
  };
  assert.ok(
    !validateCopy({ ...BASELINE, bodyHtml: long }, ledger, permissive, 'en', huila.title)
      .some((v) => v.ruleId === 'AC-08a'),
    'the identical text must pass under a looser guide — proving the rule is derived',
  );
});

test('AC-08b: paragraph shape follows the merchant’s own', () => {
  assert.ok(ids({ bodyHtml: '<p>Just one paragraph, which is not this brand’s shape.</p>' }).includes('AC-08b'));
});

test('AC-09: reading grade gate applies in English and is skipped in Spanish', () => {
  const dense =
    '<p>The organoleptic characteristics demonstrate considerable aromatic complexity throughout extraction.</p><p>You get more.</p><p>And more.</p>';
  assert.ok(ids({ bodyHtml: dense }).includes('AC-09'));
  const spanish = validateCopy({ ...BASELINE, bodyHtml: dense }, ledger, guideEs, 'es', huila.title);
  assert.ok(!spanish.some((v) => v.ruleId === 'AC-09'), 'AC-09 does not apply outside English');
});

test('violations are ordered deterministically and carry evidence', () => {
  const messy = check({
    metaTitle: 'An artisanal, certified organic Gesha lot from Huila that goes on and on',
  });
  assert.ok(messy.length >= 3);
  const sorted = [...messy].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  assert.deepEqual(messy.map((v) => v.ruleId), sorted.map((v) => v.ruleId));
  for (const v of messy) {
    assert.ok(v.evidence.length > 0, `${v.ruleId} has no evidence`);
    assert.ok(v.message.length > 0);
  }
});

test('every acceptance criterion in the spec has at least one rule', () => {
  const criteria = new Set(RULES.map((r) => r.criterion));
  for (const ac of ['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05', 'AC-06', 'AC-07', 'AC-08', 'AC-09']) {
    assert.ok(criteria.has(ac), `${ac} has no rule implementing it`);
  }
});
