/**
 * Report generation. Pure: results in, markdown out.
 *
 * `evals/report.md` is the portfolio artifact — the thing a client reads before
 * they read any code. Two rules govern what goes in it:
 *
 *   1. Failures are shown, with the actual answer that failed. A report claiming
 *      20/20 is not believed by anyone who has built one of these, and rightly so.
 *   2. The ship decision is stated in one line at the top. Everything else is
 *      supporting detail.
 */

import type { CaseResult, Summary } from './grade.ts';

const pass = (ok: boolean) => (ok ? '✅' : '❌');

export function renderReport(
  results: CaseResult[],
  summary: Summary,
  meta: { model: string; effort: string; topK: number; ranAt: string },
): string {
  const lines: string[] = [];

  lines.push('# Evaluation report — Cerro Alto Support Agent');
  lines.push('');
  lines.push(
    summary.releasable
      ? '> **Releasable.** Both hard gates hold.'
      : '> **Not releasable.** A hard gate failed — see below. This build does not ship.',
  );
  lines.push('');
  lines.push(
    `\`${meta.model}\` · effort \`${meta.effort}\` · top-k ${meta.topK} · ${summary.total} cases · ${meta.ranAt}`,
  );
  lines.push('');

  // --- Gates
  lines.push('## Release gates');
  lines.push('');
  lines.push('| | Gate | Result | |');
  lines.push('|---|---|---|---|');
  const gateNames: Record<string, string> = {
    A1: 'Every must-escalate case escalates',
    A2: 'No unsupported factual claims',
    A3: '≥85% of answerable cases correct',
    A4: '≤15% false escalations',
    A5: '100% of policy answers cited',
    A6: 'Median latency under 6s',
  };
  const hard = new Set(['A1', 'A2']);
  for (const [id, g] of Object.entries(summary.gates)) {
    lines.push(
      `| ${pass(g.passed)} | **${id}**${hard.has(id) ? ' *(hard)*' : ''} — ${gateNames[id]} | ${g.detail} | |`,
    );
  }
  lines.push('');
  lines.push(
    'Only **A1** and **A2** decide shippability. A build can miss its latency target and still ship; a build that answers confidently and wrongly cannot.',
  );
  lines.push('');

  // --- Headline numbers
  lines.push('## Numbers');
  lines.push('');
  lines.push('| | |');
  lines.push('|---|---|');
  lines.push(`| Cases passed | **${summary.passed}/${summary.total}** |`);
  lines.push(`| Median first token | ${Math.round(summary.latency.medianFirstToken)} ms |`);
  lines.push(`| Median end-to-end | ${Math.round(summary.latency.medianTotal)} ms |`);
  lines.push(`| p95 end-to-end | ${Math.round(summary.latency.p95Total)} ms |`);
  lines.push(`| Cost per conversation | $${summary.cost.perConversationUsd.toFixed(4)} |`);
  lines.push(`| Prompt cache hit rate | ${Math.round(summary.cost.cacheHitRate * 100)}% |`);
  lines.push('');

  // --- Failures first. Not buried at the bottom.
  const failures = [...summary.hardFailures, ...summary.softFailures];
  if (failures.length > 0) {
    lines.push('## What failed');
    lines.push('');
    lines.push(
      'Shown in full, with the answer that produced the failure. These are the cases worth reading — the passes tell you much less.',
    );
    lines.push('');
    for (const r of failures) {
      const isHard = summary.hardFailures.includes(r);
      lines.push(`### ${r.case.id} — ${isHard ? '**hard failure**' : 'soft failure'}`);
      lines.push('');
      lines.push(`**Asked:** ${r.case.question}`);
      lines.push('');
      lines.push(`**Answered:**`);
      lines.push('');
      lines.push('> ' + (r.turn.answer.trim() || '*(empty)*').replace(/\n/g, '\n> '));
      lines.push('');
      for (const k of r.checks.filter((c) => !c.passed)) {
        lines.push(`- \`${k.check}\`${k.hard ? ' *(hard)*' : ''} — ${k.detail ?? 'failed'}`);
      }
      lines.push('');
      lines.push(`*Why this case exists:* ${r.case.notes}`);
      lines.push('');
    }
  } else {
    lines.push('## What failed');
    lines.push('');
    lines.push(
      'Nothing, on this run. That is a claim worth distrusting on a 20-case suite — the honest reading is that the suite has not yet found this build\'s failure mode, not that there isn\'t one. The adversarial set is where to add cases next.',
    );
    lines.push('');
  }

  // --- Full table
  lines.push('## All cases');
  lines.push('');
  lines.push('| | Case | Journey | Adversarial | Escalated | Cited | ms |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(
      `| ${pass(r.passed)} | ${r.case.id} | ${r.case.journey} | ${r.case.adversarial ? 'yes' : ''} | ${r.turn.escalated ? 'yes' : ''} | ${r.turn.citations.map((c) => c.docId).join(', ') || '—'} | ${Math.round(r.turn.latency.totalMs)} |`,
    );
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(
    'Reproduce: `npm run eval`. Retrieval-only (no API key needed): `npm run eval:offline`.',
  );
  lines.push('');

  return lines.join('\n');
}
