/**
 * Server-side entry point for the public demo.
 *
 * The CLI reads the catalog and the exemplars from disk. A serverless function
 * has no reliable filesystem, so this module imports both as static JSON — the
 * bundler traces them, and the deployed demo runs the *same* pipeline modules the
 * tests run, not a reimplementation.
 *
 * The generator is `offlineGenerator` and nothing else. No API key exists in this
 * deployment on purpose: the thing worth demonstrating is the gate, and the gate
 * is deterministic.
 */

import catalogJson from '../../data/catalog-snapshot.json' with { type: 'json' };
import exemplarsJson from '../../data/voice-exemplars.json' with { type: 'json' };

import { parseCatalog } from '../catalog.ts';
import { extractStyleGuide } from '../brand/voice-extract.ts';
import { buildFactLedger } from '../ledger/fact-ledger.ts';
import { offlineGenerator } from '../generate/offline.ts';
import { validateCopy } from '../validate/rules.ts';
import type { GeneratedCopy, Locale, Product, StyleGuide, Violation } from '../types.ts';
import type { VoiceExemplar } from '../types.ts';

/** The anchor date the whole project is pinned to. Never read the clock. */
export const ANCHOR_DATE = '2026-08-04';

export const PRODUCTS: Product[] = parseCatalog(JSON.stringify(catalogJson));

// The exemplars file wraps its array in an `exemplars` key, alongside a `_note`.
// `loadExemplars` unwraps it when reading from disk; the static import gets the
// whole object, so unwrap it here rather than assuming the shape.
const EXEMPLARS = (exemplarsJson as { exemplars: VoiceExemplar[] }).exemplars;

const guides = new Map<Locale, StyleGuide>();
export function styleGuideFor(locale: Locale): StyleGuide {
  let g = guides.get(locale);
  if (!g) {
    g = extractStyleGuide(EXEMPLARS, { locale });
    guides.set(locale, g);
  }
  return g;
}

export function productByHandle(handle: string): Product | undefined {
  return PRODUCTS.find((p) => p.handle === handle);
}

export interface GenerateResult {
  handle: string;
  title: string;
  locale: Locale;
  generator: string;
  styleGuideVersion: string;
  copy: GeneratedCopy | null;
  violations: Violation[];
  status: 'publishable' | 'quarantined';
  /** Every fact the product is *allowed* to draw on, with its source path. */
  ledger: Array<{ id: string; source: string; label: string; value: string }>;
  ms: number;
}

/** Generate copy for one product, then run the same gate the pipeline runs. */
export async function generateOne(handle: string, locale: Locale): Promise<GenerateResult> {
  const product = productByHandle(handle);
  if (!product) throw new Error(`unknown handle: ${handle}`);

  const started = performance.now();
  const styleGuide = styleGuideFor(locale);
  const ledger = buildFactLedger(product);

  const result = await offlineGenerator.generate({
    product,
    ledger,
    styleGuide,
    locale,
    anchorDate: ANCHOR_DATE,
  });

  const copy = result.ok ? result.copy : null;
  const violations = copy
    ? validateCopy(copy, ledger, styleGuide, locale, product.title)
    : [
        {
          ruleId: 'GEN',
          field: 'bodyHtml' as const,
          message: result.ok ? 'unknown' : result.reason,
          evidence: '',
          offset: 0,
        },
      ];

  return {
    handle: product.handle,
    title: product.title,
    locale,
    generator: offlineGenerator.id,
    styleGuideVersion: styleGuide.version,
    copy,
    violations,
    status: copy && violations.length === 0 ? 'publishable' : 'quarantined',
    ledger: ledger.entries.map((e) => ({
      id: e.id,
      source: e.source,
      label: e.label,
      value: String(e.value),
    })),
    ms: Math.round((performance.now() - started) * 100) / 100,
  };
}

export interface ValidateInput {
  handle: string;
  locale: Locale;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  imageAlt: string;
}

/**
 * Validate copy a visitor typed. This is the demo that matters: the gate does not
 * care who wrote the text — a model, a template, or a person trying to sneak a
 * certification claim past it.
 */
export function validateEdited(input: ValidateInput): {
  violations: Violation[];
  status: 'publishable' | 'quarantined';
  ms: number;
} {
  const product = productByHandle(input.handle);
  if (!product) throw new Error(`unknown handle: ${input.handle}`);

  const started = performance.now();
  const styleGuide = styleGuideFor(input.locale);
  const ledger = buildFactLedger(product);

  const copy: GeneratedCopy = {
    handle: product.handle,
    locale: input.locale,
    bodyHtml: input.bodyHtml,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    imageAlt: input.imageAlt,
    generator: 'human-edited',
    usedFactIds: [],
  };

  const violations = validateCopy(copy, ledger, styleGuide, input.locale, product.title);
  return {
    violations,
    status: violations.length === 0 ? 'publishable' : 'quarantined',
    ms: Math.round((performance.now() - started) * 100) / 100,
  };
}

/** Rule id → what a reader needs to know, in one line. */
export const RULE_LABELS: Record<string, string> = {
  'AC-01': 'Banned brand word',
  'AC-02': 'Certification stated or implied',
  'AC-03': 'Meta title over 60 characters',
  'AC-04': 'Meta description outside 140–160',
  'AC-05': 'Alt text does not describe',
  'AC-06': 'Claim not traceable to the source data',
  'AC-07': 'Voice: second person, no exclamation marks',
  'AC-08': 'Sentence or paragraph shape off the brand',
  'AC-09': 'Reading grade above the brand ceiling',
  GEN: 'Generator failure',
};
