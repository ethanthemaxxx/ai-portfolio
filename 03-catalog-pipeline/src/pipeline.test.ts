import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from './catalog.ts';
import { loadExemplars } from './brand/exemplars.ts';
import { extractStyleGuide } from './brand/voice-extract.ts';
import { offlineGenerator } from './generate/offline.ts';
import { applyToCatalog, runPipeline } from './pipeline.ts';
import type { CopyGenerator, GenerationRequest, GenerationResult } from './generate/types.ts';
import type { GeneratedCopy } from './types.ts';

const products = loadCatalog();
const styleGuide = extractStyleGuide(loadExemplars(), { locale: 'en' });
const base = { products, styleGuide, locale: 'en' as const, anchorDate: '2026-08-04' };

function fakeCopy(handle: string, bodyHtml: string): GeneratedCopy {
  return {
    handle,
    locale: 'en',
    bodyHtml,
    metaTitle: 'A title',
    metaDescription: 'x'.repeat(150),
    imageAlt: 'An alt text long enough to satisfy the minimum length rule here',
    generator: 'fake',
    usedFactIds: [],
  };
}

function fake(
  id: string,
  canRepair: boolean,
  reply: (request: GenerationRequest, call: number) => GenerationResult,
): CopyGenerator & { calls: number } {
  const generator = {
    id,
    canRepair,
    calls: 0,
    async generate(request: GenerationRequest) {
      generator.calls += 1;
      return reply(request, generator.calls);
    },
  };
  return generator;
}

test('T22: the real run enriches all 12 with nothing quarantined', async () => {
  const report = await runPipeline({ ...base, generator: offlineGenerator });
  assert.equal(report.products.length, 12);
  assert.equal(report.publishable + report.quarantined, 12);
  assert.equal(report.quarantined, 0, JSON.stringify(report.products.filter((p) => p.violations.length), null, 2));
  assert.equal(report.generatorId, 'offline-template-v1');
  assert.equal(report.styleGuideVersion, styleGuide.version);
});

test('T22: a generator that always violates quarantines everything, and publishes nothing', async () => {
  const generator = fake('always-bad', true, (request) => ({
    ok: true,
    copy: fakeCopy(request.product.handle, '<p>An artisanal journey!</p>'),
  }));
  const report = await runPipeline({ ...base, generator, maxRepairAttempts: 2 });
  assert.equal(report.publishable, 0);
  assert.equal(report.quarantined, 12);
  for (const result of report.products) {
    assert.equal(result.copy, null, 'a quarantined product must carry no copy forward');
    assert.ok(result.violations.length > 0);
    assert.equal(result.attempts, 3, 'one attempt plus two repairs');
  }
});

test('T22: the repair loop is used exactly as far as it needs to be', async () => {
  const clean = [
    '<p>Huila Reserve tastes like ripe plum, brown sugar and orange.</p>',
    '<p>The one we hand people who say they do not like black coffee.</p>',
    '<p>Medium roast, washed, from Huila, Colombia.</p>',
    '<p>You can pick Whole Bean or Filter, in 250g or 500g.</p>',
  ].join('\n');

  const generator = fake('repairs-once', true, (request, call) => ({
    ok: true,
    copy:
      call === 1
        ? fakeCopy(request.product.handle, '<p>An artisanal cup.</p>')
        : {
            ...fakeCopy(request.product.handle, clean),
            metaTitle: 'Huila Reserve — Medium Roast Coffee from Colombia',
            metaDescription:
              'Huila Reserve is a medium roast washed coffee from Huila, Colombia. You get ripe plum, brown sugar and orange. Roasted Monday and Thursday, shipped same day.',
            imageAlt: 'Cerro Alto Huila Reserve coffee bag, 250g, Whole Bean',
          },
  }));

  const huila = products.filter((p) => p.handle === 'huila-reserve');
  const report = await runPipeline({ ...base, products: huila, generator });
  assert.equal(report.publishable, 1);
  assert.equal(report.products[0].attempts, 2);
  assert.equal(generator.calls, 2);
});

test('T22: a repair call receives the violations from the failed attempt', async () => {
  const seen: string[][] = [];
  const generator = fake('records-violations', true, (request) => {
    seen.push((request.previousViolations ?? []).map((v) => v.ruleId));
    return { ok: true, copy: fakeCopy(request.product.handle, '<p>An artisanal journey!</p>') };
  });
  await runPipeline({
    ...base,
    products: products.slice(0, 1),
    generator,
    maxRepairAttempts: 1,
  });
  assert.deepEqual(seen[0], [], 'the first call has no previous violations');
  assert.ok(seen[1].includes('AC-01'), 'the repair call is told what failed');
});

test('T22: a generator that cannot repair is called exactly once', async () => {
  const generator = fake('deterministic-bad', false, (request) => ({
    ok: true,
    copy: fakeCopy(request.product.handle, '<p>An artisanal journey!</p>'),
  }));
  const report = await runPipeline({ ...base, products: products.slice(0, 3), generator });
  assert.equal(generator.calls, 3, 'three products, one call each — the budget is not burned');
  assert.equal(report.quarantined, 3);
});

test('T22: a generator that throws quarantines instead of crashing the run', async () => {
  const generator: CopyGenerator = {
    id: 'explodes',
    canRepair: true,
    async generate() {
      throw new Error('model returned text that is not JSON');
    },
  };
  const report = await runPipeline({ ...base, products: products.slice(0, 2), generator });
  assert.equal(report.quarantined, 2);
  assert.equal(report.products[0].violations[0].ruleId, 'GEN');
  assert.match(report.products[0].violations[0].message, /not JSON/);
});

test('T21: timing is recorded by stage and never asserted on', async () => {
  const report = await runPipeline({ ...base, generator: offlineGenerator });
  assert.deepEqual(
    report.timing.stages.map((s) => s.stage),
    ['ledger', 'generate', 'validate'],
  );
  assert.equal(typeof report.timing.totalMs, 'number');
});

test('AC-10: applying a run returns a new catalog and leaves the input untouched', async () => {
  const report = await runPipeline({ ...base, generator: offlineGenerator });
  const before = JSON.stringify(products);
  const enriched = applyToCatalog(products, report);
  assert.equal(JSON.stringify(products), before, 'the input array must not be mutated');
  assert.notEqual(enriched[0].body_html, '');
  assert.notEqual(enriched[0].seo.title, '');
  assert.equal(products[0].body_html, '', 'the original stays empty');
});
