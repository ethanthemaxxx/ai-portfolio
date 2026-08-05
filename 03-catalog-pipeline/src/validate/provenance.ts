import type { CopyField, FactLedger, Violation } from '../types.ts';
import { ledgerNumbers, ledgerText } from '../ledger/fact-ledger.ts';
import { excerpt, extractNumberTokens, findTerm, normalizedWords } from '../text.ts';
import { DOMAIN_ALIASES, DOMAIN_LEXICON } from './lexicon.ts';

/**
 * AC-06 — every factual claim traces to a ledger entry.
 *
 * Two independent mechanical checks (plan.md D5), because fabrications come in
 * two shapes: wrong numbers and wrong words.
 */

export interface LedgerIndex {
  handle: string;
  /** Normalized, space-padded concatenation of every ledger surface. */
  text: string;
  /** Canonical numeric values the ledger permits. */
  numbers: Set<string>;
}

export function indexLedger(ledger: FactLedger): LedgerIndex {
  return { handle: ledger.handle, text: ledgerText(ledger), numbers: ledgerNumbers(ledger) };
}

/**
 * Terms we scan the copy for: the lexicon plus every alias key, so a demonym
 * ("Colombian") is detected and then resolved to the fact it asserts.
 */
const DETECTABLE_TERMS: readonly string[] = [
  ...new Set<string>([...DOMAIN_LEXICON, ...Object.keys(DOMAIN_ALIASES)]),
];

/** Surface variants a term may take in the ledger (simple English/Spanish plurals). */
function variantsOf(term: string): string[] {
  const base = DOMAIN_ALIASES[term] ?? term;
  const forms = new Set<string>([term, base]);
  for (const form of [term, base]) {
    if (!form.endsWith('s')) {
      forms.add(`${form}s`);
      if (/[^aeiou]$/.test(form)) forms.add(`${form}es`);
    }
  }
  return [...forms];
}

function backedByLedger(term: string, index: LedgerIndex): boolean {
  return variantsOf(term).some((form) => index.text.includes(` ${normalizedWords(form).trim()} `));
}

/** Check 1: every digit-bearing token in the copy is a figure the ledger permits. */
export function checkNumericGrounding(
  text: string,
  field: CopyField,
  index: LedgerIndex,
): Violation[] {
  const violations: Violation[] = [];
  for (const token of extractNumberTokens(text)) {
    if (!index.numbers.has(token.canonical)) {
      violations.push({
        ruleId: 'AC-06a',
        field,
        message: `figure "${token.raw}" is not in the fact ledger for ${index.handle}`,
        evidence: excerpt(text, token.offset, token.raw.length),
        offset: token.offset,
      });
    }
  }
  return violations;
}

/** Check 2: every domain term used in the copy is backed by the ledger. */
export function checkLexicalGrounding(
  text: string,
  field: CopyField,
  index: LedgerIndex,
): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const term of DETECTABLE_TERMS) {
    // Look for the term and its simple plural in the copy.
    const hit = findTerm(term, text) ?? (term.endsWith('s') ? null : findTerm(`${term}s`, text));
    if (!hit) continue;
    if (backedByLedger(term, index)) continue;
    const base = DOMAIN_ALIASES[term] ?? term;
    if (seen.has(base)) continue;
    seen.add(base);
    violations.push({
      ruleId: 'AC-06b',
      field,
      message: `"${term}" is a claim about the product that nothing in the ledger for ${index.handle} supports`,
      evidence: hit.evidence,
      offset: hit.offset,
    });
  }
  return violations;
}

export function checkProvenance(text: string, field: CopyField, index: LedgerIndex): Violation[] {
  return [...checkNumericGrounding(text, field, index), ...checkLexicalGrounding(text, field, index)];
}
