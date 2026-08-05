import type {
  CopyField,
  FactLedger,
  GeneratedCopy,
  Locale,
  StyleGuide,
  Violation,
} from '../types.ts';
import { fleschKincaidGrade, splitParagraphs, splitSentences, stripHtml, words } from '../brand/metrics.ts';
import { excerpt, findAllTerms, normalizedWords } from '../text.ts';
import { localePack, type LocalePack } from './lexicon.ts';
import { checkProvenance, indexLedger, type LedgerIndex } from './provenance.ts';

/**
 * The gate. Every rule here is an acceptance criterion from spec.md §8, and each
 * one returns violations with quoted evidence rather than a boolean, because a
 * merchant needs to see *what* tripped, not just *that* something did.
 */

export interface FieldText {
  field: CopyField;
  /** Plain text — HTML stripped — which is what every rule reads. */
  text: string;
}

export interface RuleContext {
  copy: GeneratedCopy;
  fields: FieldText[];
  index: LedgerIndex;
  styleGuide: StyleGuide;
  pack: LocalePack;
  productTitle: string;
}

export interface Rule {
  id: string;
  title: string;
  /** Which acceptance criterion this implements. */
  criterion: string;
  check(ctx: RuleContext): Violation[];
}

function fieldTexts(copy: GeneratedCopy): FieldText[] {
  return [
    { field: 'bodyHtml', text: stripHtml(copy.bodyHtml) },
    { field: 'metaTitle', text: copy.metaTitle },
    { field: 'metaDescription', text: copy.metaDescription },
    { field: 'imageAlt', text: copy.imageAlt },
  ];
}

function violation(
  ruleId: string,
  field: CopyField,
  message: string,
  evidence: string,
  offset = 0,
): Violation {
  return { ruleId, field, message, evidence, offset };
}

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'de', 'la', 'el', 'los', 'las', 'y']);

function titleContentWords(title: string): string[] {
  return normalizedWords(title)
    .trim()
    .split(' ')
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export const RULES: Rule[] = [
  {
    id: 'AC-01',
    criterion: 'AC-01',
    title: 'No word from the brand’s banned list',
    check: ({ fields, pack }) =>
      fields.flatMap(({ field, text }) =>
        findAllTerms(pack.bannedWords, text).map((hit) =>
          violation(
            'AC-01',
            field,
            `banned brand word "${hit.term}"`,
            hit.evidence,
            hit.offset,
          ),
        ),
      ),
  },
  {
    id: 'AC-02',
    criterion: 'AC-02',
    title: 'No certification stated or implied',
    check: ({ fields, pack }) =>
      fields.flatMap(({ field, text }) =>
        findAllTerms(pack.certificationTerms, text).map((hit) =>
          violation(
            'AC-02',
            field,
            `certification claim "${hit.term}" — Cerro Alto holds no certification of any kind`,
            hit.evidence,
            hit.offset,
          ),
        ),
      ),
  },
  {
    id: 'AC-03',
    criterion: 'AC-03',
    title: 'Meta title within the SEO limit',
    check: ({ copy, styleGuide }) => {
      const max = styleGuide.constraints.metaTitleMaxChars;
      const length = copy.metaTitle.length;
      if (length === 0) {
        return [violation('AC-03', 'metaTitle', 'meta title is empty', '')];
      }
      return length <= max
        ? []
        : [
            violation(
              'AC-03',
              'metaTitle',
              `meta title is ${length} characters, limit is ${max}`,
              copy.metaTitle,
            ),
          ];
    },
  },
  {
    id: 'AC-04',
    criterion: 'AC-04',
    title: 'Meta description within the SEO window',
    check: ({ copy, styleGuide }) => {
      const [min, max] = styleGuide.constraints.metaDescriptionRange;
      const length = copy.metaDescription.length;
      return length >= min && length <= max
        ? []
        : [
            violation(
              'AC-04',
              'metaDescription',
              `meta description is ${length} characters, must be between ${min} and ${max}`,
              copy.metaDescription,
            ),
          ];
    },
  },
  {
    id: 'AC-05',
    criterion: 'AC-05',
    title: 'Alt text is descriptive and names the product',
    check: ({ copy, styleGuide, pack, productTitle }) => {
      const out: Violation[] = [];
      const alt = copy.imageAlt;
      const [min, max] = styleGuide.constraints.altTextRange;
      if (alt.length < min || alt.length > max) {
        out.push(
          violation(
            'AC-05',
            'imageAlt',
            `alt text is ${alt.length} characters, must be between ${min} and ${max}`,
            alt,
          ),
        );
      }
      for (const hit of findAllTerms(pack.imagePrefixes, alt)) {
        out.push(
          violation(
            'AC-05',
            'imageAlt',
            `alt text says "${hit.term}" — screen readers already announce that it is an image`,
            hit.evidence,
            hit.offset,
          ),
        );
      }
      const content = titleContentWords(productTitle);
      const altWords = normalizedWords(alt);
      const present = content.filter((w) => altWords.includes(` ${w} `)).length;
      if (content.length > 0 && present < Math.ceil(content.length * 0.6)) {
        out.push(
          violation(
            'AC-05',
            'imageAlt',
            `alt text does not name the product (matched ${present} of ${content.length} title words)`,
            alt,
          ),
        );
      }
      return out;
    },
  },
  {
    id: 'AC-06',
    criterion: 'AC-06',
    title: 'Every factual claim traces to the fact ledger',
    check: ({ fields, index }) =>
      fields.flatMap(({ field, text }) => checkProvenance(text, field, index)),
  },
  {
    id: 'AC-07a',
    criterion: 'AC-07',
    title: 'No exclamation marks',
    check: ({ fields, styleGuide, pack }) => {
      if (styleGuide.constraints.allowsExclamation) return [];
      return fields.flatMap(({ field, text }) => {
        const match = pack.exclamationPattern.exec(text);
        return match
          ? [
              violation(
                'AC-07a',
                field,
                'exclamation mark — the brand writes warmth without them',
                excerpt(text, match.index, 1),
                match.index,
              ),
            ]
          : [];
      });
    },
  },
  {
    id: 'AC-07b',
    criterion: 'AC-07',
    title: 'Written in the second person',
    check: ({ fields, styleGuide, pack }) => {
      if (!styleGuide.constraints.requiresSecondPerson) return [];
      // Alt text is exempt: it describes an image to a screen reader, and
      // "you" has no place there (spec.md §8.1).
      const required: CopyField[] = ['bodyHtml', 'metaDescription'];
      return fields
        .filter((f) => required.includes(f.field))
        .flatMap(({ field, text }) => {
          const hay = normalizedWords(text);
          const found = pack.secondPersonMarkers.some((m) =>
            hay.includes(` ${normalizedWords(m).trim()} `),
          );
          return found
            ? []
            : [
                violation(
                  'AC-07b',
                  field,
                  'no second-person address — the brand speaks to the reader, not about the product',
                  text.slice(0, 80),
                ),
              ];
        });
    },
  },
  {
    id: 'AC-08a',
    criterion: 'AC-08',
    title: 'Sentences no longer than the merchant’s own',
    check: ({ fields, styleGuide }) => {
      const max = styleGuide.constraints.maxSentenceWords;
      const scoped: CopyField[] = ['bodyHtml', 'metaDescription'];
      return fields
        .filter((f) => scoped.includes(f.field))
        .flatMap(({ field, text }) =>
          splitSentences(text)
            .filter((sentence) => words(sentence).length > max)
            .map((sentence) =>
              violation(
                'AC-08a',
                field,
                `sentence runs to ${words(sentence).length} words; the merchant’s own copy never exceeds ${max}`,
                sentence,
              ),
            ),
        );
    },
  },
  {
    id: 'AC-08b',
    criterion: 'AC-08',
    title: 'Body paragraph count matches the merchant’s shape',
    check: ({ copy, styleGuide }) => {
      const [min, max] = styleGuide.constraints.bodyParagraphRange;
      const count = splitParagraphs(copy.bodyHtml).length;
      return count >= min && count <= max
        ? []
        : [
            violation(
              'AC-08b',
              'bodyHtml',
              `body has ${count} paragraphs; the merchant’s own copy runs ${min}–${max}`,
              stripHtml(copy.bodyHtml).slice(0, 80),
            ),
          ];
    },
  },
  {
    id: 'AC-09',
    criterion: 'AC-09',
    title: 'Reading grade at or below the derived ceiling',
    check: ({ copy, styleGuide }) => {
      const ceiling = styleGuide.constraints.readingGradeMax;
      if (ceiling === null) return []; // not applicable outside English (spec.md §11.2)
      const grade = fleschKincaidGrade(copy.bodyHtml);
      return grade <= ceiling
        ? []
        : [
            violation(
              'AC-09',
              'bodyHtml',
              `reading grade ${grade} is above the ceiling of ${ceiling}`,
              stripHtml(copy.bodyHtml).slice(0, 80),
            ),
          ];
    },
  },
];

export function buildRuleContext(
  copy: GeneratedCopy,
  ledger: FactLedger | LedgerIndex,
  styleGuide: StyleGuide,
  locale: Locale,
  productTitle: string,
): RuleContext {
  const index = 'entries' in ledger ? indexLedger(ledger) : ledger;
  return {
    copy,
    fields: fieldTexts(copy),
    index,
    styleGuide,
    pack: localePack(locale),
    productTitle,
  };
}

/** Run every rule. Deterministically ordered so reports diff cleanly. */
export function validateCopy(
  copy: GeneratedCopy,
  ledger: FactLedger | LedgerIndex,
  styleGuide: StyleGuide,
  locale: Locale,
  productTitle: string,
): Violation[] {
  const ctx = buildRuleContext(copy, ledger, styleGuide, locale, productTitle);
  const violations = RULES.flatMap((rule) => rule.check(ctx));
  return violations.sort(
    (a, b) =>
      a.ruleId.localeCompare(b.ruleId) ||
      a.field.localeCompare(b.field) ||
      a.offset - b.offset ||
      a.message.localeCompare(b.message),
  );
}
