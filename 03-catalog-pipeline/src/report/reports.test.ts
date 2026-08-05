import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOWCASE_HANDLES, loadCatalog } from '../catalog.ts';
import { loadExemplars } from '../brand/exemplars.ts';
import { extractStyleGuide } from '../brand/voice-extract.ts';
import { offlineGenerator } from '../generate/offline.ts';
import { runPipeline } from '../pipeline.ts';
import { renderBeforeAfter } from './before-after.ts';
import { renderValidationReport } from './validation-report.ts';
import { renderStyleGuideMarkdown } from './style-guide-md.ts';
import type { RunReport } from '../types.ts';

const products = loadCatalog();
const exemplars = loadExemplars();
const styleGuide = extractStyleGuide(exemplars, { locale: 'en' });

let cached: RunReport | null = null;
async function report(): Promise<RunReport> {
  if (cached === null) {
    cached = await runPipeline({
      products,
      generator: offlineGenerator,
      styleGuide,
      locale: 'en',
      anchorDate: '2026-08-04',
    });
  }
  return cached;
}

test('T23: before/after covers exactly the requested products and shows an empty "before"', async () => {
  const markdown = renderBeforeAfter(await report(), products, SHOWCASE_HANDLES);
  for (const handle of SHOWCASE_HANDLES) {
    assert.ok(markdown.includes(`\`${handle}\``), `${handle} missing from the comparison`);
  }
  assert.ok(!markdown.includes('casa-blend'), 'only the five showcase products');
  assert.equal((markdown.match(/### Before/g) ?? []).length, SHOWCASE_HANDLES.length);
  assert.ok(markdown.includes('| Description | *(empty)* |'));
  assert.ok(markdown.includes('Facts used'), 'the provenance list is the point of the document');
  assert.ok(markdown.includes('attributes.altitude_masl'));
});

test('T23: the validation report lists every rule, including the ones that passed', async () => {
  const markdown = renderValidationReport(await report(), styleGuide);
  for (const id of ['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05', 'AC-06', 'AC-07a', 'AC-07b', 'AC-08a', 'AC-09']) {
    assert.ok(markdown.includes(`\`${id}\``), `${id} missing from the report`);
  }
  assert.ok(markdown.includes('— none —'));
  assert.ok(markdown.includes('12 of 12 publishable'));
  assert.ok(markdown.includes('A gate that never fires'), 'a clean run must justify itself');
});

test('T23: a quarantined product appears in the report with its violation quoted', async () => {
  const run = structuredClone(await report());
  const target = run.products[0];
  target.status = 'quarantined';
  target.copy = null;
  target.violations = [
    {
      ruleId: 'AC-02',
      field: 'bodyHtml',
      message: 'certification claim "organic"',
      evidence: 'certified organic beans',
      offset: 10,
    },
  ];
  run.publishable -= 1;
  run.quarantined += 1;

  const markdown = renderValidationReport(run, styleGuide);
  assert.ok(markdown.includes('Quarantined, with evidence'));
  assert.ok(markdown.includes('certified organic beans'));
  assert.ok(markdown.includes(target.handle));

  const beforeAfter = renderBeforeAfter(run, products, [target.handle]);
  assert.ok(beforeAfter.includes('**Quarantined.** No copy was published'));
  assert.ok(!beforeAfter.includes('### After'), 'a quarantined product shows no copy at all');
});

test('T23: the style guide document reports the numbers and their source copy', () => {
  const markdown = renderStyleGuideMarkdown(styleGuide, exemplars);
  assert.ok(markdown.includes(`≤ ${styleGuide.constraints.maxSentenceWords} words`));
  assert.ok(markdown.includes('Tolima Sunrise'), 'the source descriptions are shown');
  assert.ok(markdown.includes(styleGuide.version));
  assert.ok(markdown.includes('This is not a mood board'));
});
