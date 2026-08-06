'use client';

/**
 * "Run it yourself", as a two-state switch over three cards.
 *
 * This occupies the slot a product page would give to pricing, and it is a
 * deliberate substitution. There is nothing to sell here — this is a portfolio
 * demo — so the question a visitor actually has is not *what does it cost* but
 * *what can I check without your help*. The switch answers that: **No keys** is
 * what a clean clone does offline, **With keys** is what only a live run can do.
 *
 * The mechanic earns its place rather than decorating: flipping it changes which
 * commands are real, and the "with keys" column is explicit that its numbers are
 * unmeasured. A toggle that only restyled three cards would be theatre.
 *
 * It is a radiogroup, not two buttons that happen to look joined: arrow keys move
 * between the options, `aria-checked` carries the state, and only the selected
 * option is in the tab order — the pattern a screen-reader user expects when two
 * choices are mutually exclusive.
 */

import { useRef, useState } from 'react';
import { IconCheck, IconCross } from './icons.tsx';

interface Plan {
  name: string;
  blurb: string;
  command: string;
  result: string;
  measured: boolean;
  items: string[];
}

const MODES = {
  offline: {
    label: 'No keys',
    note: 'Everything below ran on a machine with no API keys and no network.',
    plans: [
      {
        name: 'The test suite',
        blurb: 'Unit and contract tests over every module',
        command: 'npm test',
        result: '252 tests · 251 pass · 1 skipped',
        measured: true,
        items: [
          'Tool contracts, each with its own file',
          'Escalation triggers, one test per rule',
          'Date arithmetic against a fixed anchor',
          'The skipped one says out loud why it skipped',
        ],
      },
      {
        name: 'Retrieval evals',
        blurb: 'Sixteen labelled cases over the committed index',
        command: 'npx tsx evals/run.ts --retrieval-only',
        result: '14/16 retrieved every expected source',
        measured: true,
        items: [
          'Runs against the offline embedding stub',
          'Both misses are written up, not rounded away',
          'Expected sources are labelled in dataset.json',
          'No key, no network, no excuses',
        ],
      },
      {
        name: 'The top-k sweep',
        blurb: 'Why the shipped setting is k=6 and not k=8',
        command: 'npx tsx src/retrieval/sweep-topk.ts',
        result: '94% hit rate · MRR 0.815 · 0% false floor',
        measured: true,
        items: [
          'Recall plateaus at k=8, for a third more context',
          'k=6 is where false escalation reaches zero',
          'MRR within 0.007 of its ceiling',
          'The table in the case study is this command',
        ],
      },
    ] satisfies Plan[],
  },
  live: {
    label: 'With keys',
    note: 'This half has not been run. No number is printed for anything it would measure.',
    plans: [
      {
        name: 'Build the index',
        blurb: 'Re-embed the help centre with a real model',
        command: 'npm run ingest',
        result: 'Not run — needs VOYAGE_API_KEY',
        measured: false,
        items: [
          'Replaces the offline stub embeddings',
          'Expected to move J1-04, the grind-vocabulary miss',
          'Retrieval numbers above would be regenerated',
          'Not amended by hand afterwards',
        ],
      },
      {
        name: 'End-to-end evals',
        blurb: 'Twenty cases, graded, with two hard gates',
        command: 'npm run eval',
        result: 'Not run — needs ANTHROPIC_API_KEY',
        measured: false,
        items: [
          'Gate A — every must-escalate case escalates',
          'Gate B — zero claims unsupported by context',
          'Answer accuracy, latency and cost per turn',
          'Release verdict is undetermined until it runs',
        ],
      },
      {
        name: 'The live widget',
        blurb: 'The same demo, against real inference',
        command: 'ANTHROPIC_API_KEY=… npm run dev',
        result: 'Header switches from fixture to live',
        measured: false,
        items: [
          'Same UI, same states, no scripted timing',
          'Tool rows show the real elapsed milliseconds',
          'The public deploy stays on fixtures on purpose',
          'It works, you can click it, it spends nothing',
        ],
      },
    ] satisfies Plan[],
  },
} as const;

type ModeKey = keyof typeof MODES;
const ORDER: ModeKey[] = ['offline', 'live'];

export default function RunIt() {
  const [mode, setMode] = useState<ModeKey>('offline');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = MODES[mode];

  function onKeyDown(e: React.KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = ORDER[(ORDER.indexOf(mode) + delta + ORDER.length) % ORDER.length]!;
    setMode(next);
    refs.current[next]?.focus();
  }

  return (
    <>
      <div className="switch" role="radiogroup" aria-label="Which half of the project">
        {ORDER.map((key) => (
          <button
            key={key}
            className={`switch__opt ${mode === key ? 'is-on' : ''}`}
            role="radio"
            aria-checked={mode === key}
            tabIndex={mode === key ? 0 : -1}
            ref={(el) => {
              refs.current[key] = el;
            }}
            onClick={() => setMode(key)}
            onKeyDown={onKeyDown}
          >
            {MODES[key].label}
          </button>
        ))}
      </div>

      <p className="switch__note">{current.note}</p>

      <div className="grid grid--3 plans">
        {current.plans.map((p) => (
          <article className={`card plan ${p.measured ? '' : 'plan--unmeasured'}`} key={p.name}>
            <div className="plan__head">
              <h3 className="h-sub">{p.name}</h3>
              <p className="plan__blurb">{p.blurb}</p>
            </div>

            <code className="plan__cmd">$ {p.command}</code>

            <p className="plan__result">
              <span className={p.measured ? 'plan__ok' : 'plan__no'}>
                {p.measured ? <IconCheck /> : <IconCross />}
              </span>
              {p.result}
            </p>

            <ul className="plan__items">
              {p.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
