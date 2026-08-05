/**
 * Shared types. No runtime exports — this module is fully erased at load time,
 * so every import of it must be `import type { ... }`.
 */

export type Locale = 'en' | 'es';

/* ------------------------------------------------------------------ catalog */

export interface Variant {
  sku: string;
  price: number;
  inventory_quantity: number;
  option1_grind?: string;
  option2_size?: string;
  option1?: string | null;
  option1_name?: string;
  subscription_price?: number | null;
  weight_g?: number;
}

export interface Attributes {
  roast_level?: string;
  origin?: string;
  process?: string;
  altitude_masl?: number;
  tasting_notes?: string[];
  green_price_per_kg_usd?: number;
  last_roast_date?: string;
}

export interface Product {
  handle: string;
  title: string;
  product_type: string;
  vendor: string;
  tags: string[];
  available_on_subscription: boolean;
  attributes: Attributes;
  short_blurb: string;
  body_html: string;
  seo: { title: string; description: string };
  variants: Variant[];
}

/* ------------------------------------------------------------------- ledger */

/**
 * Where a fact is allowed to come from. See spec.md §7.1. `attributes` is the
 * only class permitted to carry coffee facts (origin, process, altitude,
 * tasting notes, roast level, green price).
 */
export type FactSourceClass =
  | 'attributes'
  | 'blurb'
  | 'identity'
  | 'variants'
  | 'derived'
  | 'brand';

export interface FactEntry {
  /** `<handle>:<source>` — stable, quotable in a report. */
  id: string;
  sourceClass: FactSourceClass;
  /** Dotted path into the source record, e.g. `attributes.altitude_masl`. */
  source: string;
  label: string;
  value: string | number;
  /** Every textual rendering this value may legitimately take in copy. */
  surfaces: string[];
}

export interface FactLedger {
  handle: string;
  entries: FactEntry[];
}

/* --------------------------------------------------------------- brand data */

export interface BrandFact {
  id: string;
  label: string;
  value: string | number;
  surfaces: string[];
  source: string;
}

/* -------------------------------------------------------------- style guide */

export interface StyleMetrics {
  exemplarCount: number;
  sentenceCount: number;
  wordCount: number;
  meanSentenceWords: number;
  medianSentenceWords: number;
  maxSentenceWords: number;
  meanReadingGrade: number;
  maxReadingGrade: number;
  secondPersonPer100Words: number;
  exclamationCount: number;
  minParagraphs: number;
  maxParagraphs: number;
  tasteBeforeOriginRate: number;
}

export interface StyleConstraints {
  /** Derived: longest sentence observed in the merchant's own exemplars. */
  maxSentenceWords: number;
  /** Derived (English only); `null` means the gate does not apply. */
  readingGradeMax: number | null;
  requiresSecondPerson: boolean;
  allowsExclamation: boolean;
  bodyParagraphRange: [number, number];
  /** SEO convention, not derived from exemplars. */
  metaTitleMaxChars: number;
  metaDescriptionRange: [number, number];
  altTextRange: [number, number];
}

export interface StyleGuide {
  version: string;
  locale: Locale;
  derivedFrom: { exemplarIds: string[]; brandDoc: string };
  metrics: StyleMetrics;
  constraints: StyleConstraints;
  openingMove: 'taste-first' | 'origin-first' | 'mixed';
  observedVocabulary: string[];
}

export interface VoiceExemplar {
  id: string;
  title: string;
  kind: 'coffee' | 'equipment' | 'gift' | 'subscription';
  note: string;
  body: string;
}

/* ---------------------------------------------------------------- generation */

export type CopyField = 'bodyHtml' | 'metaTitle' | 'metaDescription' | 'imageAlt';

export interface GeneratedCopy {
  handle: string;
  locale: Locale;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  imageAlt: string;
  /** Which generator implementation produced this. */
  generator: string;
  /** Fact ledger ids the generator drew on. */
  usedFactIds: string[];
  /** The model's own claim→fact mapping. Recorded, never trusted. */
  modelClaims?: Array<{ text: string; factId: string }>;
}

/* ---------------------------------------------------------------- validation */

export interface Violation {
  ruleId: string;
  field: CopyField;
  message: string;
  evidence: string;
  offset: number;
}

/* ------------------------------------------------------------------ pipeline */

export interface StageTiming {
  stage: string;
  ms: number;
}

export interface TimingRecord {
  stages: StageTiming[];
  totalMs: number;
}

export interface ProductResult {
  handle: string;
  title: string;
  status: 'publishable' | 'quarantined';
  copy: GeneratedCopy | null;
  violations: Violation[];
  attempts: number;
  ledgerEntryCount: number;
}

export interface RunReport {
  anchorDate: string;
  locale: Locale;
  generatorId: string;
  styleGuideVersion: string;
  products: ProductResult[];
  publishable: number;
  quarantined: number;
  timing: TimingRecord;
}
