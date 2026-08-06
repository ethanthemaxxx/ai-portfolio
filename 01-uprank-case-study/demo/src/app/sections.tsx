'use client';

/* ===========================================================================
   The reference's section components, rebuilt.

   Three patterns are borrowed structurally: its tabbed solutions block (a row
   of tab buttons over one swapping panel), its icon feature grid, and its
   numbered process steps. Each is filled with what this page actually has to
   say — the engine's real thresholds, the real pipeline, the real guarantees —
   rather than with the template's copy about AI agents.

   Icons are Phosphor at the 256 grid, which is the set the reference itself
   uses (Framer ships it) and is MIT licensed, so this is the same icon system
   rather than a lookalike.
   =========================================================================== */

import { useId, useRef, useState } from 'react';
import {
  Brain,
  CloudSlash,
  CurrencyDollar,
  Eye,
  Function as FunctionIcon,
  Lightning,
  type Icon,
  Repeat,
  Scales,
  SealCheck,
  Target,
  Textbox,
  Users,
} from '@phosphor-icons/react';
import { Reveal } from './motion.tsx';

/* ------------------------------------------------------------------- tabs
   The reference's tab row: buttons along a hairline, the active one in the
   accent with a sliding underline, one panel below. Built on the WAI-ARIA
   tabs pattern — roving tabindex, arrow keys, Home/End — which the reference's
   version does not do. */

export type TabItem = {
  key: string;
  label: string;
  max: number;
  blurb: string;
  rules: Array<[string, string]>;
};

export function Tabs({ items }: { items: TabItem[] }) {
  const [active, setActive] = useState(0);
  const uid = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: React.KeyboardEvent) => {
    const last = items.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = active === last ? 0 : active + 1;
    if (e.key === 'ArrowLeft') next = active === 0 ? last : active - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  const item = items[active]!;

  return (
    <div className="tabs">
      <div className="tabs__bar" role="tablist" aria-label="Sub-scores" onKeyDown={onKey}>
        {items.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${uid}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            className={`tabs__btn${i === active ? ' is-active' : ''}`}
            onClick={() => setActive(i)}
          >
            {t.label}
            <span className="tabs__max">{t.max}</span>
          </button>
        ))}
      </div>

      <div
        className="tabs__panel"
        role="tabpanel"
        id={`${uid}-panel-${active}`}
        aria-labelledby={`${uid}-tab-${active}`}
        tabIndex={0}
        key={item.key}
      >
        <div className="tabs__lede">
          <p className="micro">
            {item.label} · worth {item.max} of 100
          </p>
          <p className="note">{item.blurb}</p>
        </div>
        <ul className="rules">
          {item.rules.map(([cond, pts]) => (
            <li key={cond}>
              <span className="rules__c">{cond}</span>
              <span className="rules__p">{pts}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- icon grid
   The reference's feature card: a bordered square holding the icon, a title,
   a line of copy. Icons are decorative here — the heading carries the meaning
   — so they are hidden from assistive tech. */

export type Feature = { icon: Icon; title: string; body: string };

export const PRIVACY_FEATURES: Feature[] = [
  {
    icon: CloudSlash,
    title: 'No server call',
    body: 'There is no API route to send the post to. The page is static; the engine runs in the tab you are reading this in.',
  },
  {
    icon: Brain,
    title: 'No language model',
    body: 'No key to configure and nothing to authenticate against. The parser is regex, the scorer is arithmetic.',
  },
  {
    icon: Eye,
    title: 'No analytics',
    body: 'Nothing is stored and nothing is measured. Close the tab and the post you pasted is gone with it.',
  },
  {
    icon: Repeat,
    title: 'Deterministic',
    body: 'The same post produces the same score every time. Without that the ranked list stops being stable.',
  },
  {
    icon: FunctionIcon,
    title: 'Pure functions',
    body: 'Nothing to await, nothing to cache, nothing to mock in a test. Input in, score out.',
  },
  {
    icon: Lightning,
    title: 'Instant, and free',
    body: 'Scoring costs nothing per run, so it can happen on every keystroke instead of behind a button.',
  },
];

export function IconGrid({ features }: { features: Feature[] }) {
  return (
    <div className="feats">
      {features.map((f, i) => (
        <Reveal
          as="article"
          variant="up-sm"
          delay={i * 70}
          className="card feat"
          key={f.title}
        >
          <span className="feat__icon" aria-hidden="true">
            <f.icon size={20} weight="regular" />
          </span>
          <h3>{f.title}</h3>
          <p className="note">{f.body}</p>
        </Reveal>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- process
   The reference's numbered steps, with the big ghosted numeral and a rule
   running between them. Here they are the actual pipeline the post goes
   through, which is the one thing the page never spelled out in order. */

export type Step = { icon: Icon; n: string; title: string; body: string };

export const STEPS: Step[] = [
  {
    icon: Textbox,
    n: '01',
    title: 'Paste',
    body: 'The whole post, as copied: title, description, budget line, client stats, proposal count. Nothing is uploaded — the string never leaves the tab.',
  },
  {
    icon: Scales,
    n: '02',
    title: 'Parse',
    body: 'Regex pulls out nine fields. Anything it cannot find stays null, and null is scored as unknown rather than guessed at. This is the part most likely to be wrong, and it is shown to you.',
  },
  {
    icon: SealCheck,
    n: '03',
    title: 'Score',
    body: 'Five sub-scores are added, nine scam rules subtract, and the total lands on apply, maybe or skip. Every point has a line of prose next to it saying where it came from.',
  },
];

export function Process({ steps }: { steps: Step[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <Reveal as="li" variant="up" delay={i * 110} className="card step" key={s.n}>
          <span className="step__top">
            <span className="feat__icon" aria-hidden="true">
              <s.icon size={20} weight="regular" />
            </span>
            <span className="step__n" aria-hidden="true">
              {s.n}
            </span>
          </span>
          <h3>{s.title}</h3>
          <p className="note">{s.body}</p>
        </Reveal>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------- cta band
   The reference closes on a bordered band with a headline and two buttons.
   Same shape, with the accent glow pulled up behind it. */

export function CtaBand({ children }: { children: React.ReactNode }) {
  return (
    <Reveal variant="scale" className="cta">
      <span className="cta__glow" aria-hidden="true" />
      <div className="cta__in">{children}</div>
    </Reveal>
  );
}

/* Icons re-exported so the page can label its own bits without importing the
   whole set twice. */
export { CurrencyDollar, Target, Users };
