import type { BrandFact } from '../types.ts';

/**
 * Operating facts from 00-brand-demo/brand.md, "Operating facts (source of truth
 * for support)". These are brand-level claims the merchant signs off once rather
 * than per product, and they are the ONLY facts in the ledger that are not
 * derived from the product record (spec.md §7.1).
 *
 * The list is deliberately short. Every entry here widens what generated copy is
 * allowed to say about every product, so anything not actually used in copy is
 * left out.
 *
 * There is no certification here, because Cerro Alto holds none.
 */
export const BRAND_FACTS: BrandFact[] = [
  {
    id: 'brand.roast_days',
    label: 'Roasting days',
    value: 'Monday and Thursday',
    surfaces: ['Monday', 'Thursday', 'lunes', 'jueves'],
    source: 'brand.md · Operating facts · "Roasting days: Monday and Thursday"',
  },
  {
    id: 'brand.ship_same_day',
    label: 'Ships the day it is roasted',
    value: 'same day',
    surfaces: ['same day', 'mismo dia'],
    source: 'brand.md · Operating facts · "Orders ship the same day they\'re roasted"',
  },
  {
    id: 'brand.location',
    label: 'Roastery location',
    value: 'Miami, FL',
    surfaces: ['Miami'],
    source: 'brand.md · Operating facts · "Warehouse and roastery: Miami, FL"',
  },
  {
    id: 'brand.free_shipping_threshold_usd',
    label: 'Free shipping threshold',
    value: 45,
    surfaces: ['45', '$45'],
    source: 'brand.md · Operating facts · "Free shipping over $45"',
  },
  {
    id: 'brand.flat_shipping_usd',
    label: 'Flat shipping below the threshold',
    value: 6.5,
    surfaces: ['6.50', '$6.50', '6.5'],
    source: 'brand.md · Operating facts · "flat $6.50 below that"',
  },
  {
    id: 'brand.us_only',
    label: 'Ships within the United States only',
    value: 'United States',
    surfaces: ['United States', 'Estados Unidos'],
    source: 'brand.md · Operating facts · "We ship to all 50 US states. No international shipping"',
  },
];

/** Certification vocabulary must never appear in a brand fact. */
export function brandFactsAreCertificationFree(): boolean {
  const text = BRAND_FACTS.map((f) => `${f.label} ${f.value} ${f.surfaces.join(' ')}`)
    .join(' ')
    .toLowerCase();
  return !/(organic|fair\s*trade|carbon\s*neutral|certified|rainforest|direct\s*trade)/.test(text);
}
