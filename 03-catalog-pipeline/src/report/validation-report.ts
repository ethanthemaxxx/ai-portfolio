import type { RunReport, StyleGuide } from '../types.ts';
import { RULES } from '../validate/rules.ts';
import { formatMinutes } from '../timing.ts';

/**
 * The report that publishes the failures (spec.md §9). Every rule appears,
 * including the ones that passed — a report that only lists problems gives no
 * evidence that the rest of the gate ran at all.
 */
export function renderValidationReport(report: RunReport, styleGuide: StyleGuide): string {
  const total = report.products.length;
  const lines: string[] = [
    `# Validation report — ${report.locale}`,
    '',
    `Generator: \`${report.generatorId}\` · style guide \`${report.styleGuideVersion}\` · run date ${report.anchorDate}`,
    '',
    `**${report.publishable} of ${total} publishable · ${report.quarantined} quarantined.**`,
    '',
    'A quarantined product publishes nothing at all. There is no partial publish and no',
    'auto-softening of a violating phrase.',
    '',
    '## Rules, and how each one did',
    '',
    '| Rule | What it checks | Products failing |',
    '|---|---|---|',
  ];

  const failuresByRule = new Map<string, string[]>();
  for (const result of report.products) {
    for (const violation of result.violations) {
      const list = failuresByRule.get(violation.ruleId) ?? [];
      if (!list.includes(result.handle)) list.push(result.handle);
      failuresByRule.set(violation.ruleId, list);
    }
  }

  for (const rule of RULES) {
    const failing = failuresByRule.get(rule.id) ?? [];
    // AC-06 is implemented as two sub-checks; surface both under its row.
    const extra =
      rule.id === 'AC-06'
        ? [...(failuresByRule.get('AC-06a') ?? []), ...(failuresByRule.get('AC-06b') ?? [])]
        : [];
    const all = [...new Set([...failing, ...extra])];
    lines.push(
      `| \`${rule.id}\` | ${rule.title} | ${all.length === 0 ? '— none —' : all.join(', ')} |`,
    );
  }

  const generatorFailures = failuresByRule.get('GEN') ?? [];
  if (generatorFailures.length > 0) {
    lines.push(`| \`GEN\` | The generator could not produce copy at all | ${generatorFailures.join(', ')} |`);
  }

  lines.push(
    '',
    '## Constraints in force this run',
    '',
    '| Constraint | Value | Where it came from |',
    '|---|---|---|',
    `| Max sentence length | ${styleGuide.constraints.maxSentenceWords} words | measured from the merchant’s own 5 descriptions |`,
    `| Reading grade ceiling | ${styleGuide.constraints.readingGradeMax ?? 'not applicable'} | brand target of 8th grade, raised only if their own copy sits higher |`,
    `| Body paragraphs | ${styleGuide.constraints.bodyParagraphRange.join('–')} | measured from the exemplars |`,
    `| Second person | ${styleGuide.constraints.requiresSecondPerson ? 'required' : 'optional'} | measured from the exemplars |`,
    `| Exclamation marks | ${styleGuide.constraints.allowsExclamation ? 'allowed' : 'forbidden'} | measured from the exemplars |`,
    `| Meta title | ≤ ${styleGuide.constraints.metaTitleMaxChars} chars | SEO convention |`,
    `| Meta description | ${styleGuide.constraints.metaDescriptionRange.join('–')} chars | SEO convention |`,
    `| Alt text | ${styleGuide.constraints.altTextRange.join('–')} chars | SEO/accessibility convention |`,
    '',
    '## Per product',
    '',
    '| Product | Status | Ledger entries | Attempts | Violations |',
    '|---|---|---|---|---|',
  );

  for (const result of report.products) {
    lines.push(
      `| ${result.title} | ${result.status} | ${result.ledgerEntryCount} | ${result.attempts} | ${
        result.violations.length === 0 ? '—' : result.violations.map((v) => `\`${v.ruleId}\``).join(' ')
      } |`,
    );
  }

  const quarantined = report.products.filter((r) => r.status === 'quarantined');
  if (quarantined.length > 0) {
    lines.push('', '## Quarantined, with evidence', '');
    for (const result of quarantined) {
      lines.push(`### ${result.title} (\`${result.handle}\`)`, '');
      for (const violation of result.violations) {
        lines.push(
          `- **${violation.ruleId}** · ${violation.field} · ${violation.message}`,
          violation.evidence ? `  - evidence: “${violation.evidence}”` : '',
        );
      }
      lines.push('');
    }
  } else {
    lines.push(
      '',
      '## Quarantined, with evidence',
      '',
      'Nothing was quarantined in this run.',
      '',
      'That is a claim worth being suspicious of, so the adversarial tests in',
      '`src/validate/rules.test.ts` and `src/validate/provenance.test.ts` plant violations of',
      'every rule and assert that the gate catches them. A gate that never fires and has never',
      'been shown to fire is not a gate.',
      '',
    );
  }

  lines.push(
    '## Timing',
    '',
    '| Stage | ms |',
    '|---|---|',
    ...report.timing.stages.map((s) => `| ${s.stage} | ${s.ms} |`),
    `| **total** | **${report.timing.totalMs}** |`,
    '',
    `Measured end to end: **${formatMinutes(report.timing.totalMs)} minutes** for ${total} products,`,
    `using \`${report.generatorId}\`.`,
    '',
  );

  return lines.join('\n');
}
