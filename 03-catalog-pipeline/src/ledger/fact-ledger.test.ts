import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../catalog.ts';
import { buildFactLedger, findEntry, ledgerNumbers, ledgerText } from './fact-ledger.ts';

const byHandle = new Map(loadCatalog().map((p) => [p.handle, p]));
const huila = buildFactLedger(byHandle.get('huila-reserve')!);
const giftCard = buildFactLedger(byHandle.get('gift-card')!);
const dripper = buildFactLedger(byHandle.get('v60-dripper')!);

test('T08: attributes become entries with their source path', () => {
  const altitude = findEntry(huila, 'attributes.altitude_masl');
  assert.ok(altitude);
  assert.equal(altitude.sourceClass, 'attributes');
  assert.equal(altitude.value, 1750);
  assert.ok(altitude.surfaces.includes('1750'));
  assert.ok(altitude.surfaces.includes('1,750'));
  assert.equal(altitude.id, 'huila-reserve:attributes.altitude_masl');
});

test('T08: every entry carries at least one surface', () => {
  for (const product of loadCatalog()) {
    for (const e of buildFactLedger(product).entries) {
      assert.ok(e.surfaces.length > 0, `${e.id} has no surfaces`);
      assert.ok(e.source.length > 0, `${e.id} has no source`);
    }
  }
});

test('T08: products with empty attributes still get a usable ledger', () => {
  // spec.md §7.2 — 7 of 12 products have `"attributes": {}`.
  assert.deepEqual(byHandle.get('gift-card')!.attributes, {});
  assert.ok(giftCard.entries.length >= 6, 'a gift card must still have facts to work from');
  assert.ok(findEntry(giftCard, 'short_blurb'));
  assert.ok(findEntry(giftCard, 'variants[].price'));
  assert.ok(findEntry(giftCard, 'variants[].option1'));
});

test('T09: ledgerText backs the product’s real vocabulary and nothing else', () => {
  const text = ledgerText(huila);
  for (const backed of ['washed', 'huila', 'colombia', 'plum', 'brown sugar', 'orange', 'medium']) {
    assert.ok(text.includes(` ${backed} `), `expected "${backed}" to be backed`);
  }
  for (const notBacked of ['natural', 'raspberry', 'organic', 'gesha', 'hibiscus']) {
    assert.ok(!text.includes(` ${notBacked} `), `"${notBacked}" must NOT be backed for Huila`);
  }
});

test('T09: ledgerNumbers holds every figure the copy is allowed to use', () => {
  const numbers = ledgerNumbers(huila);
  for (const n of ['1750', '19', '34', '62', '6.4', '250', '500', '1000', '45']) {
    assert.ok(numbers.has(n), `expected ${n} to be permitted`);
  }
  for (const n of ['2100', '21', '9.1']) {
    assert.ok(!numbers.has(n), `${n} must not be permitted for Huila`);
  }
});

test('T09: figures inside titles and blurbs are captured', () => {
  const numbers = ledgerNumbers(dripper);
  assert.ok(numbers.has('60'), 'V60 in the title');
  assert.ok(numbers.has('2'), 'size 02 in the blurb');
  assert.ok(numbers.has('24'), 'the $24 price');
  const kettle = ledgerNumbers(buildFactLedger(byHandle.get('gooseneck-kettle')!));
  assert.ok(kettle.has('60') && kettle.has('100'), 'the 60-100 C range from the blurb');
  assert.ok(kettle.has('1'), 'the 1L in the title');
});

test('T08: brand facts are attached to every product and carry no certification', () => {
  for (const product of loadCatalog()) {
    const ledger = buildFactLedger(product);
    const brand = ledger.entries.filter((e) => e.sourceClass === 'brand');
    assert.ok(brand.length > 0);
    const text = ledgerText(ledger);
    for (const banned of ['organic', 'fair trade', 'carbon neutral', 'certified']) {
      assert.ok(!text.includes(` ${banned} `), `${product.handle} ledger implies "${banned}"`);
    }
  }
});

test('T08: the ledger is deterministic', () => {
  const a = JSON.stringify(buildFactLedger(byHandle.get('casa-blend')!));
  const b = JSON.stringify(buildFactLedger(byHandle.get('casa-blend')!));
  assert.equal(a, b);
});

test('T08: subscription discount is derived, not asserted', () => {
  const entry = findEntry(huila, 'derived.subscription_discount_pct');
  assert.ok(entry);
  assert.equal(entry.value, 10); // 17.10 / 19.00
  assert.equal(
    findEntry(buildFactLedger(byHandle.get('narino-microlot')!), 'derived.subscription_discount_pct'),
    undefined,
    'Nariño is not available on subscription, so there is no discount to claim',
  );
});
