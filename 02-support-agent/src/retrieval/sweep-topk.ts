/**
 * B6 — sweep top-k over {3, 4, 6, 8, 12}.
 *
 * plan.md §3 fixes top-k at 6 and calls the number "a finding, not a guess". This is
 * the script that has to earn that sentence. Run it with `npx tsx
 * src/retrieval/sweep-topk.ts`.
 */

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import type { IndexFile } from '../types.ts';
import { INDEX_PATH } from '../ingest/build-index.ts';
import { PROBES, type Probe } from './probes.ts';
import { HelpCenterIndex } from './search.ts';

export const SWEEP_VALUES = [3, 4, 6, 8, 12];

export type SweepRow = {
  k: number;
  /** Share of sourced probes whose expected document appears in the top k. */
  hitRate: number;
  /** Mean reciprocal rank of the first expected document. Rewards being right early. */
  mrr: number;
  /** Mean chunk tokens handed to the model. The cost side of the trade. */
  meanTokens: number;
  /** Sourced probes wrongly reported below the floor. spec.md A4 bounds this at 15%. */
  falseFloorRate: number;
  /** Out-of-corpus probes correctly reported below the floor. spec.md A1 wants 100%. */
  trueFloorRate: number;
};

export async function sweep(
  index: HelpCenterIndex,
  probes: Probe[] = PROBES,
  values: number[] = SWEEP_VALUES,
): Promise<SweepRow[]> {
  // A probe only measures retrieval if it names a document it expects back. Cases
  // answered entirely from a tool call, or handed straight to a human, have nothing to
  // retrieve and would otherwise drag the hit rate down for a reason that isn't k.
  const sourced = probes.filter((p) => p.expectDocs.length > 0);
  const outOfCorpus = probes.filter((p) => p.expectBelowFloor === true);
  const rows: SweepRow[] = [];

  for (const k of values) {
    let hits = 0;
    let reciprocalRankTotal = 0;
    let tokenTotal = 0;
    let falseFloor = 0;
    let trueFloor = 0;

    for (const probe of probes) {
      const result = await index.search(probe.question, { topK: k });
      tokenTotal += result.chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);

      if (probe.expectBelowFloor === true && result.belowFloor) trueFloor += 1;
      if (probe.expectDocs.length === 0) continue;

      if (result.belowFloor) falseFloor += 1;
      const position = result.chunks.findIndex((chunk) => probe.expectDocs.includes(chunk.docId));
      if (position !== -1) {
        hits += 1;
        reciprocalRankTotal += 1 / (position + 1);
      }
    }

    rows.push({
      k,
      hitRate: ratio(hits, sourced.length),
      mrr: ratio(reciprocalRankTotal, sourced.length),
      meanTokens: ratio(tokenTotal, probes.length),
      falseFloorRate: ratio(falseFloor, sourced.length),
      trueFloorRate: outOfCorpus.length === 0 ? 1 : trueFloor / outOfCorpus.length,
    });
  }

  return rows;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function formatSweep(rows: SweepRow[], source: string): string {
  const lines = [
    `Top-k sweep — ${source}`,
    '',
    '| k | hit rate | MRR | mean tokens | false below-floor | true below-floor |',
    '|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.k} | ${percent(row.hitRate)} | ${row.mrr.toFixed(3)} | ` +
        `${Math.round(row.meanTokens)} | ${percent(row.falseFloorRate)} | ${percent(row.trueFloorRate)} |`,
    );
  }
  return lines.join('\n');
}

function percent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

type DatasetCase = {
  question?: unknown;
  journey?: unknown;
  expected_sources?: unknown;
};

/**
 * Prefer the eval dataset (F1); fall back to the probes when it isn't there yet.
 * `expected_sources` is the only field a retrieval sweep can act on — the rest of a
 * case is about the answer, which is Group E's problem.
 */
export async function loadProbes(): Promise<{ probes: Probe[]; source: string }> {
  const datasetPath = new URL('../../evals/dataset.json', import.meta.url);
  try {
    const raw = JSON.parse(await readFile(datasetPath, 'utf8')) as { cases?: DatasetCase[] };
    const probes: Probe[] = [];

    for (const entry of raw.cases ?? []) {
      if (typeof entry.question !== 'string') continue;
      probes.push({
        question: entry.question,
        expectDocs: Array.isArray(entry.expected_sources)
          ? entry.expected_sources.filter((s): s is string => typeof s === 'string')
          : [],
        journey: isJourney(entry.journey) ? entry.journey : 'adversarial',
      });
    }

    if (probes.length > 0) {
      const sourced = probes.filter((p) => p.expectDocs.length > 0).length;
      return {
        probes,
        source: `evals/dataset.json — ${probes.length} cases, ${sourced} with an expected source`,
      };
    }
  } catch {
    // No dataset yet. Expected while Group F is unwritten.
  }
  return { probes: PROBES, source: `built-in retrieval probes — ${PROBES.length} cases` };
}

function isJourney(value: unknown): value is Probe['journey'] {
  return typeof value === 'string' && ['J1', 'J2', 'J3', 'J4', 'J5', 'adversarial'].includes(value);
}

export async function main(): Promise<void> {
  const index = new HelpCenterIndex(JSON.parse(await readFile(INDEX_PATH, 'utf8')) as IndexFile);
  const { probes, source } = await loadProbes();
  process.stdout.write(`${formatSweep(await sweep(index, probes), source)}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
