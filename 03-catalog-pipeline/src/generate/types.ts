import type { FactLedger, GeneratedCopy, Locale, Product, StyleGuide, Violation } from '../types.ts';

/**
 * The seam between "the pipeline" and "whatever writes the words" (plan.md D3).
 * Two implementations exist: a deterministic offline composer and a
 * `claude-opus-5` adapter. Both are validated by the identical rule engine.
 */

export interface GenerationRequest {
  product: Product;
  ledger: FactLedger;
  styleGuide: StyleGuide;
  locale: Locale;
  /** Anchor date, injected. Nothing in this pipeline reads the clock. */
  anchorDate: string;
  /** Violations from the previous attempt, present only on a repair call. */
  previousViolations?: Violation[];
  previousCopy?: GeneratedCopy;
}

export type GenerationResult =
  | { ok: true; copy: GeneratedCopy }
  | { ok: false; reason: string };

export interface CopyGenerator {
  /** Stable identifier recorded on every artifact this generator produced. */
  readonly id: string;
  /**
   * Whether a second call with the violations attached could plausibly produce a
   * different result. A deterministic generator says false, and the pipeline
   * does not waste the repair budget on it.
   */
  readonly canRepair: boolean;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
