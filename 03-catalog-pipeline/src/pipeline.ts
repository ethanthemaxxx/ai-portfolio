import type {
  GeneratedCopy,
  Locale,
  Product,
  ProductResult,
  RunReport,
  StyleGuide,
  Violation,
} from './types.ts';
import { buildFactLedger } from './ledger/fact-ledger.ts';
import { validateCopy } from './validate/rules.ts';
import { indexLedger } from './validate/provenance.ts';
import { StageTimer } from './timing.ts';
import type { CopyGenerator } from './generate/types.ts';

/**
 * Orchestration (plan.md D7): generate → validate → bounded repair → publishable
 * or quarantined.
 *
 * Fail closed. A product that does not pass the gate produces no fields at all.
 * The repair loop is a quality feature; the gate is a safety property, and the
 * last word always belongs to the validator.
 */

export interface PipelineOptions {
  products: Product[];
  generator: CopyGenerator;
  styleGuide: StyleGuide;
  locale: Locale;
  anchorDate: string;
  /** How many times a repairable generator may try again. Default 2. */
  maxRepairAttempts?: number;
}

function generatorFailure(message: string): Violation {
  return {
    ruleId: 'GEN',
    field: 'bodyHtml',
    message,
    evidence: '',
    offset: 0,
  };
}

export async function runPipeline(options: PipelineOptions): Promise<RunReport> {
  const { products, generator, styleGuide, locale, anchorDate } = options;
  const maxRepairAttempts = options.maxRepairAttempts ?? 2;
  const timer = new StageTimer();
  const results: ProductResult[] = [];

  for (const product of products) {
    const ledger = timer.timeSync('ledger', () => buildFactLedger(product));
    const index = timer.timeSync('ledger', () => indexLedger(ledger));

    let attempts = 0;
    let copy: GeneratedCopy | null = null;
    let violations: Violation[] = [];

    // One initial attempt, plus repairs only if the generator says a retry could
    // differ. A deterministic generator would reproduce the same violation.
    const maxAttempts = generator.canRepair ? 1 + maxRepairAttempts : 1;

    while (attempts < maxAttempts) {
      attempts += 1;
      let generated;
      try {
        generated = await timer.time('generate', () =>
          generator.generate({
            product,
            ledger,
            styleGuide,
            locale,
            anchorDate,
            ...(copy && violations.length > 0
              ? { previousCopy: copy, previousViolations: violations }
              : {}),
          }),
        );
      } catch (error) {
        copy = null;
        violations = [generatorFailure(`generator threw: ${(error as Error).message}`)];
        break;
      }

      if (!generated.ok) {
        copy = null;
        violations = [generatorFailure(generated.reason)];
        break;
      }

      copy = generated.copy;
      violations = timer.timeSync('validate', () =>
        validateCopy(copy as GeneratedCopy, index, styleGuide, locale, product.title),
      );
      if (violations.length === 0) break;
    }

    const passed = copy !== null && violations.length === 0;
    results.push({
      handle: product.handle,
      title: product.title,
      status: passed ? 'publishable' : 'quarantined',
      // Fail closed: a quarantined product carries no copy forward.
      copy: passed ? copy : null,
      violations,
      attempts,
      ledgerEntryCount: ledger.entries.length,
    });
  }

  return {
    anchorDate,
    locale,
    generatorId: generator.id,
    styleGuideVersion: styleGuide.version,
    products: results,
    publishable: results.filter((r) => r.status === 'publishable').length,
    quarantined: results.filter((r) => r.status === 'quarantined').length,
    timing: timer.record(),
  };
}

export function publishableCopy(report: RunReport): GeneratedCopy[] {
  return report.products
    .filter((r) => r.status === 'publishable' && r.copy !== null)
    .map((r) => r.copy as GeneratedCopy);
}

/** Apply a run to a catalog without touching the source file (spec.md AC-10). */
export function applyToCatalog(products: Product[], report: RunReport): Product[] {
  const byHandle = new Map(
    report.products.filter((r) => r.copy !== null).map((r) => [r.handle, r.copy as GeneratedCopy]),
  );
  return products.map((product) => {
    const copy = byHandle.get(product.handle);
    if (!copy) return { ...product };
    return {
      ...product,
      body_html: copy.bodyHtml,
      seo: { title: copy.metaTitle, description: copy.metaDescription },
      image_alt: copy.imageAlt,
    } as Product & { image_alt: string };
  });
}
