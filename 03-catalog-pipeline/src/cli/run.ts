import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CATALOG_PATH, SHOWCASE_HANDLES, loadCatalog } from '../catalog.ts';
import { loadExemplars } from '../brand/exemplars.ts';
import { extractStyleGuide } from '../brand/voice-extract.ts';
import { offlineGenerator } from '../generate/offline.ts';
import { createAnthropicGenerator, loadAnthropicClient } from '../generate/anthropic.ts';
import { applyToCatalog, runPipeline } from '../pipeline.ts';
import { renderBeforeAfter } from '../report/before-after.ts';
import { renderValidationReport } from '../report/validation-report.ts';
import { renderStyleGuideMarkdown } from '../report/style-guide-md.ts';
import { buildReviewQueue, renderReviewQueueMarkdown } from '../shopify/review-queue.ts';
import { formatMinutes } from '../timing.ts';
import type { CopyGenerator } from '../generate/types.ts';
import type { Locale } from '../types.ts';

/**
 * One-shot run. Writes every artifact under `output/` and touches nothing else.
 *
 * The anchor date is a required flag with an explicit default, never
 * `new Date()` — see plan.md D11.
 */

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(here, '../..');

interface Args {
  locale: Locale;
  anchorDate: string;
  outDir: string;
  catalogPath: string;
  generator: 'offline' | 'anthropic';
  push: boolean;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    locale: 'en',
    anchorDate: '2026-08-04',
    outDir: resolve(PROJECT_ROOT, 'output'),
    catalogPath: DEFAULT_CATALOG_PATH,
    generator: 'offline',
    push: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--locale':
        if (value !== 'en' && value !== 'es') throw new Error(`--locale must be en or es, got "${value}"`);
        args.locale = value;
        i += 1;
        break;
      case '--date':
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('--date must be YYYY-MM-DD');
        args.anchorDate = value;
        i += 1;
        break;
      case '--out':
        args.outDir = resolve(value);
        i += 1;
        break;
      case '--products':
        args.catalogPath = resolve(value);
        i += 1;
        break;
      case '--generator':
        if (value !== 'offline' && value !== 'anthropic') {
          throw new Error(`--generator must be offline or anthropic, got "${value}"`);
        }
        args.generator = value;
        i += 1;
        break;
      case '--push':
        args.push = true;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }
  return args;
}

async function resolveGenerator(kind: Args['generator']): Promise<CopyGenerator> {
  if (kind === 'offline') return offlineGenerator;
  return createAnthropicGenerator(await loadAnthropicClient());
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const suffix = args.locale === 'en' ? '' : `-${args.locale}`;
  const out = (name: string) => resolve(args.outDir, name);
  mkdirSync(args.outDir, { recursive: true });

  const products = loadCatalog(args.catalogPath);
  const exemplars = loadExemplars();
  const styleGuide = extractStyleGuide(exemplars, { locale: args.locale });
  const generator = await resolveGenerator(args.generator);

  const report = await runPipeline({
    products,
    generator,
    styleGuide,
    locale: args.locale,
    anchorDate: args.anchorDate,
  });

  const queue = buildReviewQueue(report);
  const write = (name: string, contents: string) => {
    writeFileSync(out(name), contents.endsWith('\n') ? contents : `${contents}\n`, 'utf8');
    return name;
  };

  const written = [
    write(`style-guide${suffix}.json`, JSON.stringify(styleGuide, null, 2)),
    write(`style-guide${suffix}.md`, renderStyleGuideMarkdown(styleGuide, exemplars)),
    write(`enriched${suffix}.json`, JSON.stringify(applyToCatalog(products, report), null, 2)),
    write(`run-report${suffix}.json`, JSON.stringify(report, null, 2)),
    write(`validation-report${suffix}.md`, renderValidationReport(report, styleGuide)),
    write(`before-after${suffix}.md`, renderBeforeAfter(report, products, SHOWCASE_HANDLES)),
    write(`review-queue${suffix}.json`, JSON.stringify(queue, null, 2)),
    write(`review-queue${suffix}.md`, renderReviewQueueMarkdown(queue, report)),
    write(
      `timing${suffix}.json`,
      JSON.stringify(
        {
          anchorDate: args.anchorDate,
          locale: args.locale,
          generator: generator.id,
          productCount: products.length,
          stages: report.timing.stages,
          totalMs: report.timing.totalMs,
          totalMinutes: Number(formatMinutes(report.timing.totalMs)),
          note:
            'Wall-clock of this run only. It is attributed to the generator named above and is ' +
            'not presented as a figure for any other implementation.',
        },
        null,
        2,
      ),
    ),
  ];

  if (args.push) {
    // The push path is implemented and tested with a stub transport, and has
    // never been executed against a store. Running it for real needs explicit
    // credentials, which this project does not carry.
    throw new Error(
      '--push is not wired to the CLI on purpose. The push gate lives in src/shopify/push.ts ' +
        'and is exercised in src/shopify/push.test.ts against a stub transport. Nothing in this ' +
        'repository has ever contacted a Shopify store.',
    );
  }

  process.stdout.write(
    [
      `locale        ${args.locale}`,
      `generator     ${generator.id}`,
      `style guide   ${styleGuide.version}`,
      `products      ${products.length}`,
      `publishable   ${report.publishable}`,
      `quarantined   ${report.quarantined}`,
      `measured      ${report.timing.totalMs} ms (${formatMinutes(report.timing.totalMs)} min)`,
      `written       ${written.join(', ')}`,
      '',
    ].join('\n'),
  );

  return report.quarantined === 0 ? 0 : 1;
}

const isEntryPoint =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntryPoint) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exitCode = 2;
    });
}
