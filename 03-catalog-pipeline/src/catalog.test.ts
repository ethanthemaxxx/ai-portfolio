import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import {
  CatalogError,
  DEFAULT_CATALOG_PATH,
  SHOWCASE_HANDLES,
  loadCatalog,
  parseCatalog,
} from './catalog.ts';

test('loads the 12 demo products', () => {
  const products = loadCatalog();
  assert.equal(products.length, 12);
  assert.equal(products[0].handle, 'huila-reserve');
});

test('every product arrives with empty body_html and empty seo (the "before" state)', () => {
  for (const product of loadCatalog()) {
    assert.equal(product.body_html, '', `${product.handle} body_html should start empty`);
    assert.equal(product.seo.title, '', `${product.handle} seo.title should start empty`);
    assert.equal(product.seo.description, '', `${product.handle} seo.description should start empty`);
  }
});

test('showcase handles all exist in the catalog', () => {
  const handles = new Set(loadCatalog().map((p) => p.handle));
  for (const handle of SHOWCASE_HANDLES) {
    assert.ok(handles.has(handle), `${handle} missing from catalog`);
  }
});

test('coffee products carry attributes; equipment and gifts do not', () => {
  const byHandle = new Map(loadCatalog().map((p) => [p.handle, p]));
  assert.equal(byHandle.get('huila-reserve')!.attributes.altitude_masl, 1750);
  assert.deepEqual(byHandle.get('gift-card')!.attributes, {});
  assert.deepEqual(byHandle.get('v60-dripper')!.attributes, {});
});

test('rejects malformed catalogs instead of guessing', () => {
  assert.throws(() => parseCatalog('not json'), CatalogError);
  assert.throws(() => parseCatalog('{}'), CatalogError);
  assert.throws(() => parseCatalog('[]'), CatalogError);
  assert.throws(() => parseCatalog('[{"title":"no handle"}]'), CatalogError);
  assert.throws(
    () => parseCatalog(JSON.stringify([{ handle: 'a', title: 'A', short_blurb: '', attributes: {}, variants: [], tags: [], seo: {} }])),
    CatalogError,
    'a product with no variants must be rejected',
  );
  assert.throws(
    () =>
      parseCatalog(
        JSON.stringify([
          { handle: 'a', title: 'A', short_blurb: '', attributes: {}, variants: [{ sku: 'x' }], tags: [], seo: {} },
          { handle: 'a', title: 'B', short_blurb: '', attributes: {}, variants: [{ sku: 'y' }], tags: [], seo: {} },
        ]),
      ),
    CatalogError,
    'duplicate handles must be rejected',
  );
});

test('AC-10: reading the catalog does not modify it', () => {
  const before = statSync(DEFAULT_CATALOG_PATH);
  const bytesBefore = readFileSync(DEFAULT_CATALOG_PATH, 'utf8');
  loadCatalog();
  const after = statSync(DEFAULT_CATALOG_PATH);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(readFileSync(DEFAULT_CATALOG_PATH, 'utf8'), bytesBefore);
});
