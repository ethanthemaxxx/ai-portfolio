import type { StyleGuide, VoiceExemplar } from '../types.ts';

/**
 * The style guide, rendered for a human. The machine-readable version
 * (`style-guide.json`) is what the validators actually read; this file exists so
 * the merchant can check that the numbers describe their voice.
 */
export function renderStyleGuideMarkdown(guide: StyleGuide, exemplars: VoiceExemplar[]): string {
  const m = guide.metrics;
  const c = guide.constraints;
  return [
    '# Brand voice, measured',
    '',
    `Version \`${guide.version}\` · derived from ${m.exemplarCount} descriptions the merchant wrote and approved.`,
    '',
    'This is not a mood board. Every number below was computed from the merchant’s own copy,',
    'and the ones under **Constraints** are wired straight into the validator — they are the',
    'gate that generated copy has to pass. Change the source descriptions and these move.',
    '',
    '## What was measured',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Descriptions analysed | ${m.exemplarCount} |`,
    `| Sentences | ${m.sentenceCount} |`,
    `| Words | ${m.wordCount} |`,
    `| Mean sentence length | ${m.meanSentenceWords} words |`,
    `| Median sentence length | ${m.medianSentenceWords} words |`,
    `| Longest sentence | ${m.maxSentenceWords} words |`,
    `| Mean reading grade (Flesch–Kincaid) | ${m.meanReadingGrade} |`,
    `| Highest reading grade | ${m.maxReadingGrade} |`,
    `| Second-person words per 100 words | ${m.secondPersonPer100Words} |`,
    `| Exclamation marks | ${m.exclamationCount} |`,
    `| Paragraphs per description | ${m.minParagraphs}–${m.maxParagraphs} |`,
    `| Coffee descriptions that open with taste | ${Math.round(m.tasteBeforeOriginRate * 100)}% |`,
    '',
    '## Constraints the validator enforces',
    '',
    '| Constraint | Value |',
    '|---|---|',
    `| Sentence length | ≤ ${c.maxSentenceWords} words |`,
    `| Reading grade | ${c.readingGradeMax === null ? 'not applicable for this language' : `≤ ${c.readingGradeMax}`} |`,
    `| Body paragraphs | ${c.bodyParagraphRange[0]}–${c.bodyParagraphRange[1]} |`,
    `| Second person | ${c.requiresSecondPerson ? 'required' : 'optional'} |`,
    `| Exclamation marks | ${c.allowsExclamation ? 'allowed' : 'forbidden'} |`,
    `| Meta title | ≤ ${c.metaTitleMaxChars} characters |`,
    `| Meta description | ${c.metaDescriptionRange[0]}–${c.metaDescriptionRange[1]} characters |`,
    `| Alt text | ${c.altTextRange[0]}–${c.altTextRange[1]} characters |`,
    '',
    `**Opening move:** ${guide.openingMove}. **Vocabulary observed in their copy:** ${guide.observedVocabulary.join(', ')}.`,
    '',
    '## The descriptions this came from',
    '',
    ...exemplars.flatMap((exemplar) => [
      `### ${exemplar.title}`,
      '',
      `*${exemplar.note}*`,
      '',
      ...exemplar.body.split('\n\n').map((paragraph) => `> ${paragraph}`),
      '',
    ]),
  ].join('\n');
}
