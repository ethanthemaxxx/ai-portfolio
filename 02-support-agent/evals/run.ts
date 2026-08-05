/**
 * The eval runner.
 *
 * Two modes, and the second one is the reason this suite is worth anything to a
 * client evaluating the work:
 *
 *   npm run eval          full — runs the agent, grades, writes evals/report.md
 *   npm run eval:offline  retrieval only — no API key, no network, no spend
 *
 * The offline mode answers the question "does the retriever find the right
 * document?" without touching inference. That's the half of a RAG failure that is
 * cheapest to diagnose and most often the actual culprit, and it means someone can
 * clone this repo and get a real signal in ten seconds for free.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runTurn } from '../src/agent/loop.ts';
import { HelpCenterIndex } from '../src/retrieval/search.ts';
import { gradeCase, summarise, type EvalCase, type RecordedTurn } from './grade.ts';
import { renderReport } from './report.ts';
import { loadIndex, wire, ROOT } from './wire.ts';

interface Dataset {
  anchor_date: string;
  cases: EvalCase[];
}

async function loadDataset(): Promise<Dataset> {
  return JSON.parse(
    await readFile(path.join(ROOT, 'evals', 'dataset.json'), 'utf8'),
  ) as Dataset;
}

// ---------------------------------------------------------------------------
// Offline: retrieval only
// ---------------------------------------------------------------------------

async function runRetrievalOnly(): Promise<number> {
  const { cases } = await loadDataset();
  const index = new HelpCenterIndex(await loadIndex());

  // Cases with no expected_sources are answered from a tool or escalated outright;
  // there is no retrieval claim to check.
  const checkable = cases.filter((c) => c.expected_sources.length > 0);

  let hits = 0;
  const rows: string[] = [];

  for (const c of checkable) {
    const { chunks, belowFloor } = await index.search(c.question);
    const found = new Set(chunks.map((ch) => ch.docId));
    const missing = c.expected_sources.filter((s) => !found.has(s));
    const ok = missing.length === 0;
    if (ok) hits++;
    rows.push(
      `${ok ? '✔' : '✘'} ${c.id.padEnd(8)} ${belowFloor ? '[below floor] ' : ''}` +
        (ok ? [...found].join(', ') : `missing ${missing.join(', ')} — got ${[...found].join(', ') || 'nothing'}`),
    );
  }

  console.log('\nRetrieval-only (no API key, no network)\n');
  for (const r of rows) console.log('  ' + r);
  const pct = Math.round((hits / checkable.length) * 100);
  console.log(`\n  ${hits}/${checkable.length} cases retrieved every expected source (${pct}%)\n`);

  if (hits < checkable.length) {
    console.log(
      '  A miss here is a retrieval problem, not a model problem — no amount of\n' +
        '  prompting fixes a document that never reached the context window.\n',
    );
  }
  return hits === checkable.length ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Full: agent + grading + report
// ---------------------------------------------------------------------------

async function runFull(effort: string, topK: number): Promise<number> {
  const { anchor_date, cases } = await loadDataset();
  const deps = await wire(anchor_date);

  const results = [];

  for (const c of cases) {
    process.stdout.write(`  ${c.id.padEnd(8)} `);

    let turn: RecordedTurn = {
      answer: '',
      citations: [],
      escalated: false,
      escalationReason: null,
      toolCalls: [],
      latency: { firstTokenMs: 0, totalMs: 0 },
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      retrievedDocIds: [],
    };

    try {
      for await (const ev of runTurn(
        {
          client: deps.client,
          tools: deps.tools,
          executeTool: deps.executeTool,
          retrieve: deps.retrieve,
          evaluateEscalation: deps.evaluateEscalation,
          todayISO: anchor_date,
        },
        [],
        c.question,
      )) {
        if (ev.type === 'done') {
          turn = { ...ev.turn, retrievedDocIds: deps.lastRetrievedDocIds() };
        } else if (ev.type === 'error') {
          // Record it as an empty turn rather than aborting the run. One failed
          // case should not cost you the other nineteen.
          console.log(`error: ${ev.message}`);
        }
      }
    } catch (err) {
      console.log(`threw: ${err instanceof Error ? err.message : String(err)}`);
    }

    const graded = gradeCase(c, turn);
    results.push(graded);
    console.log(
      `${graded.passed ? '✔' : '✘'} ${Math.round(turn.latency.totalMs)}ms${turn.escalated ? ' (escalated)' : ''}`,
    );
  }

  const summary = summarise(results);
  const report = renderReport(results, summary, {
    model: 'claude-opus-5',
    effort,
    topK,
    // Stamped after the run, never read inside logic — the eval itself is
    // reproducible and must not depend on the clock.
    ranAt: new Date().toISOString().slice(0, 10),
  });

  const out = path.join(ROOT, 'evals', 'report.md');
  await writeFile(out, report, 'utf8');

  console.log(`\n  ${summary.passed}/${summary.total} cases passed`);
  for (const [id, g] of Object.entries(summary.gates)) {
    console.log(`  ${g.passed ? '✔' : '✘'} ${id}  ${g.detail}`);
  }
  console.log(
    `\n  ${summary.releasable ? 'RELEASABLE — both hard gates hold.' : 'NOT RELEASABLE — a hard gate failed.'}`,
  );
  console.log(`  Report written to ${path.relative(process.cwd(), out)}\n`);

  return summary.releasable ? 0 : 1;
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const offline = args.includes('--retrieval-only') || !process.env['ANTHROPIC_API_KEY'];

if (offline && !args.includes('--retrieval-only')) {
  console.log('\nNo ANTHROPIC_API_KEY set — running retrieval-only.');
  console.log('Set the key and re-run for the full suite and evals/report.md.');
}

process.exitCode = offline
  ? await runRetrievalOnly()
  : await runFull(arg('effort', 'low'), Number(arg('top-k', '6')));
