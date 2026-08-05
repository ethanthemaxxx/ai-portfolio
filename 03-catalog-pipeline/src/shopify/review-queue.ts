import type { Locale, RunReport } from '../types.ts';

/**
 * The human gate (plan.md D8). The queue is data, not a UI: the pipeline writes
 * it with every entry unapproved, a person edits it, and the push step reads it
 * — and re-validates anyway, because approval and validity are different
 * properties.
 */

export interface ReviewEntry {
  handle: string;
  title: string;
  /** Always false when written. A human sets this. */
  approved: boolean;
  approvedBy: string | null;
  status: 'publishable' | 'quarantined';
  note: string;
}

export interface ReviewQueue {
  locale: Locale;
  generatorId: string;
  anchorDate: string;
  entries: ReviewEntry[];
}

export function buildReviewQueue(report: RunReport): ReviewQueue {
  return {
    locale: report.locale,
    generatorId: report.generatorId,
    anchorDate: report.anchorDate,
    entries: report.products.map((result) => ({
      handle: result.handle,
      title: result.title,
      approved: false,
      approvedBy: null,
      status: result.status,
      note:
        result.status === 'publishable'
          ? 'Read the copy, then set approved: true to allow this product to be pushed.'
          : `Quarantined: ${result.violations.map((v) => `${v.ruleId} ${v.message}`).join('; ')}`,
    })),
  };
}

export interface LoadedQueue {
  queue: ReviewQueue;
  /** Handles in the file that are not in this run — reported, never ignored. */
  unknownHandles: string[];
}

export function loadReviewQueue(raw: string, knownHandles: string[]): LoadedQueue {
  const queue = JSON.parse(raw) as ReviewQueue;
  if (!Array.isArray(queue.entries)) {
    throw new Error('review queue has no `entries` array');
  }
  const known = new Set(knownHandles);
  return {
    queue,
    unknownHandles: queue.entries.map((e) => e.handle).filter((h) => !known.has(h)),
  };
}

export function approvedHandles(queue: ReviewQueue): string[] {
  return queue.entries.filter((e) => e.approved === true).map((e) => e.handle);
}

export function renderReviewQueueMarkdown(queue: ReviewQueue, report: RunReport): string {
  const lines = [
    '# Review queue — nothing ships until a person says so',
    '',
    `Locale: \`${queue.locale}\` · Generator: \`${queue.generatorId}\` · Run date: ${queue.anchorDate}`,
    '',
    'Every entry starts at `approved: false` in `review-queue.json`. Edit that file, not this one.',
    'The push step re-runs the full validation for every approved product before it makes any',
    'API call, so an approval on copy that later fails a rule still does not ship.',
    '',
    '| Product | Status | Approved | Note |',
    '|---|---|---|---|',
  ];
  for (const entry of queue.entries) {
    const note = entry.note.replace(/\|/g, '\\|').slice(0, 160);
    lines.push(
      `| ${entry.title} | ${entry.status} | ${entry.approved ? 'yes' : 'no'} | ${note} |`,
    );
  }
  lines.push(
    '',
    `${report.publishable} publishable · ${report.quarantined} quarantined · ${queue.entries.length} total.`,
    '',
  );
  return lines.join('\n');
}
