import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeneratedCopy, Locale, Product } from '../types.ts';
import { splitSentences } from '../brand/metrics.ts';
import { normalizedWords } from '../text.ts';
import { localePack } from '../validate/lexicon.ts';
import { composeInRange, fitParts, type Fragment } from './compose.ts';
import type { CopyGenerator, GenerationRequest, GenerationResult } from './types.ts';

/**
 * The deterministic generator (plan.md D3, D4).
 *
 * Every string it emits is built from a fact ledger entry, a merchant-authored
 * blurb, or a brand operating fact. There is no free text: if the data does not
 * contain a claim, no template can produce it.
 *
 * This is the implementation that produced the published outputs, because this
 * environment has no ANTHROPIC_API_KEY. See README, "Which implementation wrote
 * this".
 */

const here = dirname(fileURLToPath(import.meta.url));

interface EsBlurbFile {
  blurbs: Record<string, string>;
}

let esBlurbCache: Record<string, string> | null = null;

function esBlurbs(): Record<string, string> {
  if (esBlurbCache === null) {
    const path = resolve(here, '../../data/blurbs-es.json');
    esBlurbCache = (JSON.parse(readFileSync(path, 'utf8')) as EsBlurbFile).blurbs;
  }
  return esBlurbCache;
}

/* ------------------------------------------------------------ translations ---
 * Enumerated attribute values only. A roast level of "Medium" and a roast level
 * of "medio" are the same fact; the provenance checker resolves one to the other
 * through DOMAIN_ALIASES, so translated copy is held to the same standard. */

const ROAST_ES: Record<string, string> = { Light: 'claro', Medium: 'medio', Dark: 'oscuro' };
const PROCESS_ES: Record<string, string> = {
  Washed: 'lavado',
  Natural: 'natural',
  'Sugarcane EA decaf': 'descafeinado con caña (EA)',
};
const GRIND_ES: Record<string, string> = {
  'Whole Bean': 'grano entero',
  Filter: 'filtro',
  Espresso: 'espresso',
  'French Press': 'prensa francesa',
};
const OPTION_NAME_ES: Record<string, string> = {
  Color: 'color',
  Finish: 'acabado',
  Glaze: 'esmalte',
  Grind: 'molienda',
  Value: 'valor',
  Option: 'opción',
};
const NOTE_ES: Record<string, string> = {
  'ripe plum': 'ciruela madura',
  'brown sugar': 'azúcar moreno',
  orange: 'naranja',
  raspberry: 'frambuesa',
  hibiscus: 'hibisco',
  'cane sugar': 'azúcar de caña',
  'dark chocolate': 'chocolate negro',
  molasses: 'melaza',
  'toasted walnut': 'nuez tostada',
  'milk chocolate': 'chocolate con leche',
  almond: 'almendra',
  'red apple': 'manzana roja',
  caramel: 'caramelo',
  'baked pear': 'pera al horno',
  cocoa: 'cacao',
};

export class TranslationError extends Error {}

function translate(map: Record<string, string>, value: string, what: string): string {
  const hit = map[value];
  if (hit === undefined) {
    // Fail loudly rather than emit an English word inside Spanish copy or, worse,
    // guess a translation that is not the same claim.
    throw new TranslationError(`no Spanish form on file for ${what}: "${value}"`);
  }
  return hit;
}

/* ----------------------------------------------------------------- helpers --- */

function listJoin(items: string[], conjunction: string): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

function money(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function distinctStrings(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

function withThousands(value: number): string {
  return value.toLocaleString('en-US');
}

interface ProductFacts {
  handle: string;
  title: string;
  isCoffee: boolean;
  blurb: string;
  blurbSentences: string[];
  roast?: string;
  origin?: string;
  originCountry?: string;
  process?: string;
  altitude?: number;
  notes: string[];
  greenPrice?: number;
  grinds: string[];
  sizes: string[];
  options: string[];
  optionName: string;
  prices: number[];
  singlePrice: number | null;
}

function readFacts(product: Product, locale: Locale): ProductFacts {
  const a = product.attributes;
  const blurb = locale === 'es' ? (esBlurbs()[product.handle] ?? product.short_blurb) : product.short_blurb;
  const origin = a.origin;
  const originCountry = origin ? origin.split(',').map((s) => s.trim()).pop() : undefined;
  const prices = [...new Set(product.variants.map((v) => v.price))].sort((x, y) => x - y);
  return {
    handle: product.handle,
    title: product.title,
    isCoffee: product.product_type === 'Coffee',
    blurb,
    blurbSentences: splitSentences(blurb),
    roast: a.roast_level,
    origin: origin?.replace(/\s*\+\s*/g, ' and '),
    originCountry,
    process: a.process,
    altitude: a.altitude_masl,
    notes: a.tasting_notes ?? [],
    greenPrice: a.green_price_per_kg_usd,
    grinds: distinctStrings(product.variants.map((v) => v.option1_grind)),
    sizes: distinctStrings(product.variants.map((v) => v.option2_size)),
    options: distinctStrings(product.variants.map((v) => v.option1)),
    optionName: product.variants.find((v) => v.option1_name)?.option1_name ?? 'Option',
    prices,
    singlePrice: prices.length === 1 ? prices[0] : null,
  };
}

const id = (handle: string, source: string) => `${handle}:${source}`;

/* ------------------------------------------------------------------- body --- */

function bodyParagraphs(f: ProductFacts, locale: Locale): { paragraphs: string[]; factIds: string[] } {
  const factIds: string[] = [];
  const paragraphs: string[] = [];

  if (f.isCoffee) {
    const notes = locale === 'en' ? f.notes : f.notes.map((n) => translate(NOTE_ES, n, 'tasting note'));
    const conj = locale === 'en' ? 'and' : 'y';
    factIds.push(...f.notes.map((_, i) => id(f.handle, `attributes.tasting_notes[${i}]`)));
    paragraphs.push(
      locale === 'en'
        ? `${f.title} tastes like ${listJoin(notes, conj)}.`
        : `${f.title} sabe a ${listJoin(notes, conj)}.`,
    );

    if (locale === 'en') {
      factIds.push(id(f.handle, 'short_blurb'));
      paragraphs.push(f.blurb);
    } else {
      paragraphs.push(f.blurb);
    }

    const sentences: string[] = [];
    if (f.roast && f.process && f.origin) {
      factIds.push(
        id(f.handle, 'attributes.roast_level'),
        id(f.handle, 'attributes.process'),
        id(f.handle, 'attributes.origin'),
      );
      const process = locale === 'en' ? (f.process.includes(' ') ? f.process : f.process.toLowerCase()) : translate(PROCESS_ES, f.process, 'process');
      sentences.push(
        locale === 'en'
          ? `${f.roast} roast, ${process}, from ${f.origin}.`
          : `Tueste ${translate(ROAST_ES, f.roast, 'roast level')}, ${process}, de ${f.origin}.`,
      );
    }
    if (typeof f.altitude === 'number') {
      factIds.push(id(f.handle, 'attributes.altitude_masl'));
      sentences.push(
        locale === 'en'
          ? `Grown at ${withThousands(f.altitude)} meters above sea level.`
          : `Cultivado a ${f.altitude} metros sobre el nivel del mar.`,
      );
    }
    if (typeof f.greenPrice === 'number') {
      factIds.push(id(f.handle, 'attributes.green_price_per_kg_usd'));
      sentences.push(
        locale === 'en'
          ? `We paid ${money(f.greenPrice)} per kilo for the green coffee.`
          : `Pagamos ${money(f.greenPrice)} por kilo de café verde.`,
      );
    }
    paragraphs.push(sentences.join(' '));

    const grinds = locale === 'en' ? f.grinds : f.grinds.map((g) => translate(GRIND_ES, g, 'grind'));
    factIds.push(
      id(f.handle, 'variants[].option1_grind'),
      id(f.handle, 'variants[].option2_size'),
      'brand.roast_days',
      'brand.ship_same_day',
    );
    paragraphs.push(
      locale === 'en'
        ? `You can pick ${listJoin(grinds, 'or')}, in ${listJoin(f.sizes, 'or')}. We roast Monday and Thursday and ship the same day.`
        : `Puedes elegir ${listJoin(grinds, 'o')}, en ${listJoin(f.sizes, 'o')}. Tostamos lunes y jueves y enviamos el mismo día.`,
    );
    return { paragraphs, factIds };
  }

  /* non-coffee: equipment and gifts, which carry no `attributes` at all */
  factIds.push(id(f.handle, 'short_blurb'));
  paragraphs.push(f.blurb);

  if (f.options.length > 1) {
    factIds.push(id(f.handle, 'variants[].option1'), id(f.handle, 'variants[].price'));
    const name = locale === 'en' ? f.optionName.toLowerCase() : translate(OPTION_NAME_ES, f.optionName, 'option name');
    const list = listJoin(f.options, locale === 'en' ? 'or' : 'o');
    const price =
      f.singlePrice !== null
        ? locale === 'en'
          ? ` Each one is ${money(f.singlePrice)}.`
          : ` Cada uno cuesta ${money(f.singlePrice)}.`
        : '';
    paragraphs.push(
      locale === 'en' ? `Pick ${name}: ${list}.${price}` : `Puedes elegir ${name}: ${list}.${price}`,
    );
  } else {
    factIds.push(id(f.handle, 'variants[].price'));
    const price = f.singlePrice ?? f.prices[0];
    paragraphs.push(locale === 'en' ? `It is ${money(price)}.` : `Cuesta ${money(price)}.`);
  }

  factIds.push('brand.free_shipping_threshold_usd', 'brand.location');
  paragraphs.push(
    locale === 'en'
      ? 'You get free shipping over $45, and we ship from Miami.'
      : 'Lo enviamos desde Miami y el envío es gratis si tu pedido pasa de $45.',
  );
  return { paragraphs, factIds };
}

/* ------------------------------------------------------------- meta title --- */

function metaTitle(f: ProductFacts, locale: Locale, max: number): string {
  if (f.isCoffee && f.roast && f.originCountry) {
    const subtitle =
      locale === 'en'
        ? `${f.roast} Roast Coffee from ${f.originCountry}`
        : `Café de tueste ${translate(ROAST_ES, f.roast, 'roast level')} de ${f.originCountry}`;
    return fitParts([f.title, subtitle], max);
  }
  const clause = (f.blurbSentences[0] ?? '').replace(/[.]$/, '');
  const withClause = fitParts([f.title, clause], max);
  if (withClause.includes(clause) && clause.length > 0) return withClause;
  return fitParts([f.title, 'Cerro Alto'], max, ' | ');
}

/* ------------------------------------------------- meta description + alt --- */

function metaFragments(f: ProductFacts, locale: Locale): Fragment[] {
  const fragments: Fragment[] = [];
  const push = (text: string, ...factIds: string[]) => fragments.push({ text, factIds });

  if (f.isCoffee) {
    if (f.roast && f.process && f.origin) {
      const process = locale === 'en' ? (f.process.includes(' ') ? f.process : f.process.toLowerCase()) : translate(PROCESS_ES, f.process, 'process');
      push(
        locale === 'en'
          ? `${f.title} is a ${f.roast.toLowerCase()} roast ${process} coffee from ${f.origin}.`
          : `${f.title} es un tueste ${translate(ROAST_ES, f.roast, 'roast level')} ${process} de ${f.origin}.`,
        id(f.handle, 'attributes.roast_level'),
        id(f.handle, 'attributes.process'),
        id(f.handle, 'attributes.origin'),
      );
    }
    if (f.notes.length > 0) {
      const notes = locale === 'en' ? f.notes : f.notes.map((n) => translate(NOTE_ES, n, 'tasting note'));
      push(
        locale === 'en'
          ? `You get ${listJoin(notes, 'and')}.`
          : `Sabe a ${listJoin(notes, 'y')}.`,
        ...f.notes.map((_, i) => id(f.handle, `attributes.tasting_notes[${i}]`)),
      );
    }
    push(
      locale === 'en'
        ? 'Roasted Monday and Thursday, shipped the same day.'
        : 'Tostamos lunes y jueves y enviamos el mismo día.',
      'brand.roast_days',
      'brand.ship_same_day',
    );
    if (f.sizes.length > 0) {
      push(
        locale === 'en'
          ? `You can order it in ${listJoin(f.sizes, 'or')}.`
          : `Puedes pedirlo en ${listJoin(f.sizes, 'o')}.`,
        id(f.handle, 'variants[].option2_size'),
      );
    }
    if (typeof f.altitude === 'number') {
      push(
        locale === 'en'
          ? `Grown at ${withThousands(f.altitude)} meters above sea level.`
          : `Cultivado a ${f.altitude} metros sobre el nivel del mar.`,
        id(f.handle, 'attributes.altitude_masl'),
      );
    }
    push(
      locale === 'en' ? 'Free shipping over $45.' : 'Envío gratis desde $45.',
      'brand.free_shipping_threshold_usd',
    );
    if (typeof f.greenPrice === 'number') {
      push(
        locale === 'en'
          ? `We paid ${money(f.greenPrice)} per kilo for the green coffee.`
          : `Pagamos ${money(f.greenPrice)} por kilo de café verde.`,
        id(f.handle, 'attributes.green_price_per_kg_usd'),
      );
    }
    return fragments;
  }

  const [first, ...rest] = f.blurbSentences;
  if (first) push(`${f.title}: ${first}`, id(f.handle, 'title'), id(f.handle, 'short_blurb'));
  for (const sentence of rest) push(sentence, id(f.handle, 'short_blurb'));
  if (f.options.length > 1) {
    const name = locale === 'en' ? f.optionName.toLowerCase() : translate(OPTION_NAME_ES, f.optionName, 'option name');
    push(
      locale === 'en'
        ? `Pick ${name}: ${f.options.join(', ')}.`
        : `Puedes elegir ${name}: ${f.options.join(', ')}.`,
      id(f.handle, 'variants[].option1'),
    );
  }
  const price = f.singlePrice;
  push(
    price !== null
      ? locale === 'en'
        ? `You pay ${money(price)}.`
        : `Pagas ${money(price)}.`
      : locale === 'en'
        ? `You pay from ${money(f.prices[0])} to ${money(f.prices[f.prices.length - 1])}.`
        : `Pagas desde ${money(f.prices[0])} hasta ${money(f.prices[f.prices.length - 1])}.`,
    id(f.handle, 'variants[].price'),
  );
  push(
    locale === 'en' ? 'Free shipping over $45.' : 'Envío gratis desde $45.',
    'brand.free_shipping_threshold_usd',
  );
  push(
    locale === 'en'
      ? 'We ship from Miami, and you can add it to any order.'
      : 'Enviamos desde Miami y puedes añadirlo a cualquier pedido.',
    'brand.location',
  );
  return fragments;
}

function altText(f: ProductFacts, locale: Locale): { text: string; factIds: string[] } {
  if (f.isCoffee) {
    const grind = f.grinds[0] ?? '';
    const grindText = locale === 'en' ? grind : translate(GRIND_ES, grind, 'grind');
    return {
      text:
        locale === 'en'
          ? `Cerro Alto ${f.title} coffee bag, ${f.sizes[0]}, ${grindText}`
          : `Bolsa de café Cerro Alto ${f.title}, ${f.sizes[0]}, ${grindText}`,
      factIds: [
        id(f.handle, 'title'),
        id(f.handle, 'variants[].option2_size'),
        id(f.handle, 'variants[].option1_grind'),
      ],
    };
  }
  const clause = (f.blurbSentences[0] ?? '').replace(/[.]$/, '');
  const option = f.options[0] ? `, ${f.options[0]}` : '';
  return {
    text: `${f.title}, ${clause}${option}`,
    factIds: [
      id(f.handle, 'title'),
      id(f.handle, 'short_blurb'),
      ...(option ? [id(f.handle, 'variants[].option1')] : []),
    ],
  };
}

/* ---------------------------------------------------------------- generator --- */

export const OFFLINE_GENERATOR_ID = 'offline-template-v1';

async function generate(request: GenerationRequest): Promise<GenerationResult> {
  const { product, locale, styleGuide } = request;
  const facts = readFacts(product, locale);
  const pack = localePack(locale);

  const { paragraphs, factIds } = bodyParagraphs(facts, locale);
  const bodyHtml = paragraphs.map((p) => `<p>${p}</p>`).join('\n');

  const title = metaTitle(facts, locale, styleGuide.constraints.metaTitleMaxChars);

  const [metaMin, metaMax] = styleGuide.constraints.metaDescriptionRange;
  const hasSecondPerson = (text: string) => {
    const hay = normalizedWords(text);
    return pack.secondPersonMarkers.some((m) => hay.includes(` ${normalizedWords(m).trim()} `));
  };
  const composed = composeInRange(metaFragments(facts, locale), {
    min: metaMin,
    max: metaMax,
    accept: hasSecondPerson,
  });
  if (!composed.ok) {
    return {
      ok: false,
      reason: `${product.handle}: could not build a meta description from the facts on file — ${composed.reason}`,
    };
  }

  const alt = altText(facts, locale);
  const [altMin, altMax] = styleGuide.constraints.altTextRange;
  if (alt.text.length < altMin || alt.text.length > altMax) {
    return {
      ok: false,
      reason: `${product.handle}: alt text is ${alt.text.length} characters, outside ${altMin}-${altMax}`,
    };
  }

  const copy: GeneratedCopy = {
    handle: product.handle,
    locale,
    bodyHtml,
    metaTitle: title,
    metaDescription: composed.text,
    imageAlt: alt.text,
    generator: OFFLINE_GENERATOR_ID,
    usedFactIds: [...new Set([...factIds, ...composed.factIds, ...alt.factIds])].sort(),
  };
  return { ok: true, copy };
}

export const offlineGenerator: CopyGenerator = {
  id: OFFLINE_GENERATOR_ID,
  /**
   * Deterministic: a second call with the same input produces the same output,
   * so a repair attempt would produce the identical violation. The pipeline
   * reads this and does not waste the budget.
   */
  canRepair: false,
  generate,
};
