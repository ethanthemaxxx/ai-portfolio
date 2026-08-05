import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Product } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The shared demo catalog. READ-ONLY: nothing in this project ever opens this
 * path for writing (spec.md AC-10).
 */
export const DEFAULT_CATALOG_PATH = resolve(
  here,
  '../../00-brand-demo/data/products.json',
);

export class CatalogError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CatalogError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse and shape-check a catalog document. Throws `CatalogError` on anything odd. */
export function parseCatalog(raw: string): Product[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CatalogError(`catalog is not valid JSON: ${(error as Error).message}`);
  }
  assert(Array.isArray(parsed), 'catalog must be an array of products');
  assert(parsed.length > 0, 'catalog is empty');

  const seen = new Set<string>();
  for (const [index, item] of parsed.entries()) {
    assert(isRecord(item), `product ${index} is not an object`);
    const handle = item['handle'];
    assert(typeof handle === 'string' && handle.length > 0, `product ${index} has no handle`);
    assert(!seen.has(handle), `duplicate handle: ${handle}`);
    seen.add(handle);
    assert(typeof item['title'] === 'string', `${handle}: title must be a string`);
    assert(typeof item['short_blurb'] === 'string', `${handle}: short_blurb must be a string`);
    assert(isRecord(item['attributes']), `${handle}: attributes must be an object`);
    assert(Array.isArray(item['variants']), `${handle}: variants must be an array`);
    assert(item['variants'].length > 0, `${handle}: needs at least one variant`);
    assert(Array.isArray(item['tags']), `${handle}: tags must be an array`);
    assert(isRecord(item['seo']), `${handle}: seo must be an object`);
  }
  return parsed as Product[];
}

export function loadCatalog(path: string = DEFAULT_CATALOG_PATH): Product[] {
  return parseCatalog(readFileSync(path, 'utf8'));
}

/** The 5 products used for the side-by-side comparison (spec.md §6). */
export const SHOWCASE_HANDLES = [
  'huila-reserve',
  'narino-microlot',
  'sereno-decaf',
  'v60-dripper',
  'origin-sampler',
] as const;
