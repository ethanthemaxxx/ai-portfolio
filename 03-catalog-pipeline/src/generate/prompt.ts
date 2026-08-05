import type { FactLedger, Locale, StyleGuide, Violation } from '../types.ts';
import type { GenerationRequest } from './types.ts';

/**
 * Prompt construction for the `claude-opus-5` path.
 *
 * Follows the conventions used across this portfolio: role first, context in
 * labelled blocks before the instruction, few-shot examples that include
 * counter-examples, and length given as a range.
 *
 * Note what is NOT here: no `temperature`, no `top_p`, no `top_k` — those were
 * removed on this model and sending one is a 400. Thinking is left on (adaptive
 * is the default); the latency lever is `output_config.effort`.
 */

export const MODEL = 'claude-opus-5';

export interface MessageRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: 'user'; content: string }>;
  thinking: { type: 'adaptive' };
  output_config: {
    effort: 'low' | 'medium' | 'high';
    format: { type: 'json_schema'; schema: Record<string, unknown> };
  };
}

export const COPY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    bodyHtml: { type: 'string', description: 'Product description as <p> paragraphs' },
    metaTitle: { type: 'string' },
    metaDescription: { type: 'string' },
    imageAlt: { type: 'string' },
    claims: {
      type: 'array',
      description: 'Each factual statement you made, mapped to the fact id it came from',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, factId: { type: 'string' } },
        required: ['text', 'factId'],
        additionalProperties: false,
      },
    },
  },
  required: ['bodyHtml', 'metaTitle', 'metaDescription', 'imageAlt', 'claims'],
  additionalProperties: false,
};

function renderLedger(ledger: FactLedger): string {
  const lines = ledger.entries.map(
    (e) => `- id: ${e.id}\n  source: ${e.source}\n  ${e.label}: ${e.value}`,
  );
  return lines.join('\n');
}

function renderStyleGuide(guide: StyleGuide): string {
  const c = guide.constraints;
  return [
    `Derived from ${guide.derivedFrom.exemplarIds.length} descriptions the merchant wrote and approved.`,
    `- Longest sentence they ever write: ${c.maxSentenceWords} words. Do not exceed it.`,
    `- Reading grade ceiling: ${c.readingGradeMax ?? 'not applicable for this language'}`,
    `- Body runs ${c.bodyParagraphRange[0]}–${c.bodyParagraphRange[1]} short paragraphs.`,
    `- Second person is required. Exclamation marks are forbidden.`,
    `- They open with taste, not origin (opening move: ${guide.openingMove}).`,
    `- Vocabulary observed in their own copy: ${guide.observedVocabulary.join(', ')}.`,
  ].join('\n');
}

function renderRules(locale: Locale, guide: StyleGuide): string {
  const c = guide.constraints;
  return [
    `1. Use ONLY the facts in <fact_ledger>. If a fact is not there, it does not exist. This is the rule that matters most.`,
    `2. Never state or imply a certification. Cerro Alto is not organic, not Fair Trade, not carbon neutral, not direct trade. Not even in passing.`,
    `3. Never use: artisanal, curated, elevated, journey, passion, handcrafted, liquid gold, exquisite, unlock.`,
    `4. metaTitle: at most ${c.metaTitleMaxChars} characters.`,
    `5. metaDescription: between ${c.metaDescriptionRange[0]} and ${c.metaDescriptionRange[1]} characters, second person, no exclamation marks.`,
    `6. imageAlt: ${c.altTextRange[0]}–${c.altTextRange[1]} characters, describes what is in the frame, names the product, and never begins with "image of" or "photo of".`,
    `7. Write in ${locale === 'en' ? 'English' : 'Spanish'}.`,
    `8. For every factual statement, add an entry to "claims" with the fact id it came from.`,
  ].join('\n');
}

const FEW_SHOT = `<example label="good">
Huila Reserve tastes like ripe plum, brown sugar and orange. Medium roast, washed,
from Huila, Colombia. Grown at 1,750 meters above sea level.
Why it is good: every claim maps to a fact id. Taste first, origin second. Short sentences.
</example>

<example label="violation: invented fact">
Grown at 2,100 meters on a smallholder farm, this Gesha lot is picked by hand.
Why it fails: the ledger says 1,750 meters. "Gesha", "smallholder farm" and
"picked by hand" appear nowhere in the data. Three fabrications in one sentence.
</example>

<example label="violation: implied certification">
Sustainably sourced from farms that care about the land.
Why it fails: "sustainably sourced" reads as a certification claim. Cerro Alto
holds none, and the phrasing is a legal exposure, not a stylistic preference.
</example>

<example label="violation: off-voice">
Unlock an artisanal journey through Colombia's most exquisite microlots!
Why it fails: four banned words and an exclamation mark.
</example>`;

export function buildSystemPrompt(locale: Locale, guide: StyleGuide): string {
  return `You are the copywriter for Cerro Alto Coffee, a small direct-to-consumer roaster.
You write catalog copy that sounds like the person behind the counter: plain words,
second person, specific before reassuring. You never write anything you cannot point
to a source for.

<style_guide>
${renderStyleGuide(guide)}
</style_guide>

<rules>
${renderRules(locale, guide)}
</rules>

${FEW_SHOT}`;
}

export function buildUserMessage(request: GenerationRequest): string {
  const { product, ledger, previousViolations, previousCopy } = request;
  const blocks = [
    `<product>\nhandle: ${product.handle}\ntitle: ${product.title}\ntype: ${product.product_type}\n</product>`,
    `<fact_ledger>\n${renderLedger(ledger)}\n</fact_ledger>`,
  ];

  if (previousViolations && previousViolations.length > 0) {
    blocks.push(
      `<previous_attempt>\n${JSON.stringify(previousCopy, null, 2)}\n</previous_attempt>`,
      `<violations>\n${previousViolations
        .map((v) => `- [${v.ruleId}] ${v.field}: ${v.message} — "${v.evidence}"`)
        .join('\n')}\n</violations>`,
      'Your previous attempt was rejected by the validator. Fix exactly these violations. Change nothing else.',
    );
  } else {
    blocks.push(
      'Write the description, meta title, meta description and image alt text for this product.',
    );
  }
  return blocks.join('\n\n');
}

export function buildRequest(request: GenerationRequest): MessageRequest {
  return {
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(request.locale, request.styleGuide),
    messages: [{ role: 'user', content: buildUserMessage(request) }],
    // Adaptive thinking is the default on this model and is deliberately left on.
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: COPY_SCHEMA },
    },
  };
}

export function violationsForRepair(violations: Violation[]): string {
  return violations.map((v) => `${v.ruleId}:${v.field}`).join(', ');
}
