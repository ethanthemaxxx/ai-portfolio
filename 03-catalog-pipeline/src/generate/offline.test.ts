import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../catalog.ts';
import { loadExemplars } from '../brand/exemplars.ts';
import { extractStyleGuide } from '../brand/voice-extract.ts';
import { buildFactLedger } from '../ledger/fact-ledger.ts';
import { validateCopy } from '../validate/rules.ts';
import { offlineGenerator } from './offline.ts';
import type { Locale, Product } from '../types.ts';

const ANCHOR = '2026-08-04';
const products = loadCatalog();
const exemplars = loadExemplars();

async function generateFor(product: Product, locale: Locale) {
  const styleGuide = extractStyleGuide(exemplars, { locale });
  const ledger = buildFactLedger(product);
  const result = await offlineGenerator.generate({
    product,
    ledger,
    styleGuide,
    locale,
    anchorDate: ANCHOR,
  });
  return { result, ledger, styleGuide };
}

for (const locale of ['en', 'es'] as const) {
  test(`T17/T18 (${locale}): all 12 products generate and pass every rule`, async () => {
    const failures: string[] = [];
    for (const product of products) {
      const { result, ledger, styleGuide } = await generateFor(product, locale);
      if (!result.ok) {
        failures.push(`${product.handle}: generation failed — ${result.reason}`);
        continue;
      }
      const violations = validateCopy(result.copy, ledger, styleGuide, locale, product.title);
      for (const v of violations) {
        failures.push(`${product.handle} [${v.ruleId}/${v.field}] ${v.message} — “${v.evidence}”`);
      }
    }
    assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
  });
}

test('T17: output is byte-identical across runs', async () => {
  const first = await generateFor(products[0], 'en');
  const second = await generateFor(products[0], 'en');
  assert.deepEqual(first.result, second.result);
});

test('T17: the copy is data-driven — removing a fact removes the clause', async () => {
  const huila = products.find((p) => p.handle === 'huila-reserve')!;
  const { result: withAltitude } = await generateFor(huila, 'en');
  assert.ok(withAltitude.ok);
  if (!withAltitude.ok) return;
  assert.match(withAltitude.copy.bodyHtml, /1,750 meters/);

  const stripped: Product = {
    ...huila,
    attributes: { ...huila.attributes, altitude_masl: undefined },
  };
  const { result: without } = await generateFor(stripped, 'en');
  assert.ok(without.ok);
  if (!without.ok) return;
  assert.ok(
    !/meters above sea level/.test(without.copy.bodyHtml),
    'with no altitude on file, no altitude sentence may appear',
  );
  assert.ok(
    !without.copy.usedFactIds.some((f) => f.includes('altitude')),
    'and no altitude fact may be cited',
  );
});

test('T17: every cited fact id exists in the ledger', async () => {
  for (const product of products) {
    const { result, ledger } = await generateFor(product, 'en');
    assert.ok(result.ok);
    if (!result.ok) continue;
    const known = new Set(ledger.entries.map((e) => e.id));
    for (const factId of result.copy.usedFactIds) {
      assert.ok(known.has(factId), `${product.handle} cites unknown fact ${factId}`);
    }
  }
});

test('T18: Spanish output draws on the same facts as the English output', async () => {
  for (const product of products) {
    const en = await generateFor(product, 'en');
    const es = await generateFor(product, 'es');
    assert.ok(en.result.ok && es.result.ok, product.handle);
    if (!en.result.ok || !es.result.ok) continue;
    assert.ok(!/[¡!]/.test(es.result.copy.bodyHtml), `${product.handle} Spanish body has an exclamation`);
    const enFacts = new Set(en.result.copy.usedFactIds.map((f) => f.split(':')[1]));
    const esFacts = new Set(es.result.copy.usedFactIds.map((f) => f.split(':')[1]));
    const onlyInEs = [...esFacts].filter((f) => !enFacts.has(f));
    assert.deepEqual(
      onlyInEs,
      [],
      `${product.handle}: Spanish copy uses facts the English copy did not: ${onlyInEs.join(', ')}`,
    );
  }
});

test('T18: an untranslated attribute value fails loudly rather than leaking English', async () => {
  const odd: Product = {
    ...products[0],
    attributes: { ...products[0].attributes, roast_level: 'Extra Dark' },
  };
  await assert.rejects(
    async () => {
      const out = await generateFor(odd, 'es');
      if (!out.result.ok) throw new Error(out.result.reason);
    },
    /no Spanish form on file/,
  );
});

test('the generator declares that it cannot repair', () => {
  assert.equal(offlineGenerator.canRepair, false);
  assert.equal(offlineGenerator.id, 'offline-template-v1');
});
