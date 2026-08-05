import type { BrandFact, FactEntry, FactLedger, Product, Variant } from '../types.ts';
import { BRAND_FACTS } from '../brand/brand-facts.ts';
import { canonicalizeNumber, extractNumberTokens, normalizedWords } from '../text.ts';

/**
 * The fact ledger: the complete, enumerated set of things that may be said about
 * a product, each carrying the path it came from.
 *
 * This is built BEFORE any copy exists (plan.md D2). The same object constrains
 * generation and verification, and it is what a reviewer reads when they ask
 * "where did that sentence come from".
 */

function entry(
  handle: string,
  sourceClass: FactEntry['sourceClass'],
  source: string,
  label: string,
  value: string | number,
  surfaces: string[],
): FactEntry {
  const unique = [...new Set(surfaces.map((s) => s.trim()).filter(Boolean))];
  return { id: `${handle}:${source}`, sourceClass, source, label, value, surfaces: unique };
}

/** "Huila + Tolima, Colombia" → ["Huila + Tolima, Colombia", "Huila", "Tolima", "Colombia"] */
function withParts(value: string): string[] {
  const parts = value
    .split(/[,+/]| and /i)
    .map((p) => p.trim())
    .filter(Boolean);
  return [value, ...parts];
}

function numberSurfaces(value: number): string[] {
  const plain = String(value);
  const surfaces = [plain];
  if (Number.isInteger(value) && value >= 1000) {
    surfaces.push(value.toLocaleString('en-US'));
  }
  if (!Number.isInteger(value)) {
    surfaces.push(value.toFixed(2));
    surfaces.push(`$${value.toFixed(2)}`);
  } else {
    surfaces.push(`$${plain}`);
  }
  return surfaces;
}

function distinct<T>(values: (T | undefined | null)[]): T[] {
  return [...new Set(values.filter((v): v is T => v !== undefined && v !== null))];
}

function variantValues(variants: Variant[], key: 'option1_grind' | 'option2_size' | 'option1'): string[] {
  return distinct(variants.map((v) => v[key] as string | undefined | null)).filter(
    (v) => typeof v === 'string' && v.length > 0,
  );
}

export function buildFactLedger(
  product: Product,
  brandFacts: BrandFact[] = BRAND_FACTS,
): FactLedger {
  const h = product.handle;
  const entries: FactEntry[] = [];
  const a = product.attributes;

  /* ---------------------------------------------------------- attributes ---
   * The only permitted source of coffee facts. */
  if (a.roast_level) {
    entries.push(entry(h, 'attributes', 'attributes.roast_level', 'Roast level', a.roast_level, [
      a.roast_level,
    ]));
  }
  if (a.origin) {
    entries.push(entry(h, 'attributes', 'attributes.origin', 'Origin', a.origin, withParts(a.origin)));
  }
  if (a.process) {
    entries.push(entry(h, 'attributes', 'attributes.process', 'Process', a.process, withParts(a.process)));
  }
  if (typeof a.altitude_masl === 'number') {
    entries.push(
      entry(h, 'attributes', 'attributes.altitude_masl', 'Altitude (m above sea level)', a.altitude_masl, [
        ...numberSurfaces(a.altitude_masl),
      ]),
    );
  }
  if (a.tasting_notes && a.tasting_notes.length > 0) {
    a.tasting_notes.forEach((note, index) => {
      entries.push(
        entry(h, 'attributes', `attributes.tasting_notes[${index}]`, 'Tasting note', note, withParts(note)),
      );
    });
  }
  if (typeof a.green_price_per_kg_usd === 'number') {
    entries.push(
      entry(
        h,
        'attributes',
        'attributes.green_price_per_kg_usd',
        'Green coffee price per kilo (USD)',
        a.green_price_per_kg_usd,
        numberSurfaces(a.green_price_per_kg_usd),
      ),
    );
  }
  if (a.last_roast_date) {
    entries.push(
      entry(h, 'attributes', 'attributes.last_roast_date', 'Last roast date', a.last_roast_date, [
        a.last_roast_date,
      ]),
    );
  }

  /* --------------------------------------------------------------- blurb --- */
  if (product.short_blurb) {
    entries.push(
      entry(h, 'blurb', 'short_blurb', 'Merchant blurb', product.short_blurb, [product.short_blurb]),
    );
    for (const token of extractNumberTokens(product.short_blurb)) {
      entries.push(
        entry(h, 'blurb', `short_blurb#${token.canonical}`, 'Figure in the merchant blurb', token.raw, [
          token.raw,
          token.canonical,
        ]),
      );
    }
  }

  /* ------------------------------------------------------------ identity --- */
  entries.push(entry(h, 'identity', 'title', 'Product title', product.title, [product.title]));
  entries.push(
    entry(h, 'identity', 'product_type', 'Product type', product.product_type, [product.product_type]),
  );
  entries.push(entry(h, 'identity', 'vendor', 'Vendor', product.vendor, [product.vendor]));
  if (product.tags.length > 0) {
    entries.push(
      entry(h, 'identity', 'tags', 'Tags', product.tags.join(', '), [
        ...product.tags,
        ...product.tags.map((t) => t.replace(/-/g, ' ')),
      ]),
    );
  }
  for (const token of extractNumberTokens(product.title)) {
    entries.push(
      entry(h, 'identity', `title#${token.canonical}`, 'Figure in the product title', token.raw, [
        token.raw,
        token.canonical,
      ]),
    );
  }

  /* ------------------------------------------------------------ variants --- */
  const grinds = variantValues(product.variants, 'option1_grind');
  if (grinds.length > 0) {
    entries.push(
      entry(h, 'variants', 'variants[].option1_grind', 'Grind options', grinds.join(', '), grinds),
    );
  }
  const sizes = variantValues(product.variants, 'option2_size');
  if (sizes.length > 0) {
    entries.push(
      entry(h, 'variants', 'variants[].option2_size', 'Size options', sizes.join(', '), [
        ...sizes,
        ...sizes.map((s) => s.replace(/(\d)([a-z])/i, '$1 $2')),
      ]),
    );
  }
  const options = variantValues(product.variants, 'option1');
  if (options.length > 0) {
    const optionName = product.variants.find((v) => v.option1_name)?.option1_name ?? 'Option';
    entries.push(
      entry(h, 'variants', 'variants[].option1', `${optionName} options`, options.join(', '), options),
    );
  }
  const prices = distinct(product.variants.map((v) => v.price));
  if (prices.length > 0) {
    entries.push(
      entry(h, 'variants', 'variants[].price', 'Prices', prices.join(', '), prices.flatMap(numberSurfaces)),
    );
  }
  const subPrices = distinct(product.variants.map((v) => v.subscription_price ?? null));
  if (subPrices.length > 0) {
    entries.push(
      entry(
        h,
        'variants',
        'variants[].subscription_price',
        'Subscription prices',
        subPrices.join(', '),
        subPrices.flatMap(numberSurfaces),
      ),
    );
  }
  const weights = distinct(product.variants.map((v) => v.weight_g));
  if (weights.length > 0) {
    entries.push(
      entry(
        h,
        'variants',
        'variants[].weight_g',
        'Weights (g)',
        weights.join(', '),
        weights.flatMap(numberSurfaces),
      ),
    );
  }

  /* ------------------------------------------------------------- derived --- */
  if (sizes.length > 0) {
    entries.push(
      entry(h, 'derived', 'derived.size_count', 'Number of sizes', sizes.length, [String(sizes.length)]),
    );
  }
  if (grinds.length > 0) {
    entries.push(
      entry(h, 'derived', 'derived.grind_count', 'Number of grinds', grinds.length, [String(grinds.length)]),
    );
  }
  if (options.length > 0) {
    entries.push(
      entry(h, 'derived', 'derived.option_count', 'Number of options', options.length, [
        String(options.length),
      ]),
    );
  }
  const firstSub = product.variants.find(
    (v) => typeof v.subscription_price === 'number' && v.subscription_price > 0,
  );
  if (firstSub && typeof firstSub.subscription_price === 'number') {
    const pct = Math.round((1 - firstSub.subscription_price / firstSub.price) * 100);
    entries.push(
      entry(h, 'derived', 'derived.subscription_discount_pct', 'Subscription discount (%)', pct, [
        String(pct),
        `${pct}%`,
      ]),
    );
  }

  /* --------------------------------------------------------------- brand --- */
  for (const fact of brandFacts) {
    entries.push({
      id: fact.id,
      sourceClass: 'brand',
      source: fact.source,
      label: fact.label,
      value: fact.value,
      surfaces: fact.surfaces,
    });
  }

  return { handle: h, entries };
}

/**
 * Normalized concatenation of every surface in the ledger. This is the corpus a
 * domain term must appear in to count as "backed" (plan.md D5, check 2).
 * Labels are deliberately excluded: a label is a category name, not a claim.
 */
export function ledgerText(ledger: FactLedger): string {
  return normalizedWords(
    ledger.entries.flatMap((e) => [...e.surfaces, String(e.value)]).join(' | '),
  );
}

/** Canonical numeric values the ledger permits (plan.md D5, check 1). */
export function ledgerNumbers(ledger: FactLedger): Set<string> {
  const numbers = new Set<string>();
  for (const entry_ of ledger.entries) {
    for (const surface of [...entry_.surfaces, String(entry_.value)]) {
      for (const token of extractNumberTokens(surface)) numbers.add(token.canonical);
      const direct = canonicalizeNumber(surface);
      if (direct !== null) numbers.add(direct);
    }
  }
  return numbers;
}

export function findEntry(ledger: FactLedger, source: string): FactEntry | undefined {
  return ledger.entries.find((e) => e.source === source);
}
