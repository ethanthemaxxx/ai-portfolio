'use client';

import { useMemo, useState } from 'react';
import { parseJob } from '../engine/parseJob.ts';
import { scoreJob, SUB_SCORE_MAX } from '../engine/scoring.ts';
import { NICHES } from '../engine/niches.ts';
import type { NicheKey, ScoreBreakdown } from '../engine/types.ts';
import {
  Accordion,
  CountUp,
  Reveal,
  RevealProvider,
  Roll,
  RollIcon,
  SmoothScroll,
  SplitText,
  Ticker,
  useNavSpy,
} from './motion.tsx';

/* Everything on this page runs in the browser. There is no API route, no
 * database and no network call — which is not a shortcut, it is the honest
 * shape of the thing: the scoring engine is pure functions, so the job post has
 * no reason to leave the visitor's machine. */

const SAMPLES: Array<{ label: string; niche: NicheKey; text: string }> = [
  {
    label: 'A good one',
    niche: 'ai_automation',
    text: `Build a RAG customer support agent over our help center (Python + vector DB)
Hourly: $55.00-$80.00
Payment verified · $150,000+ spent · United Kingdom · Hire rate, 92%
Proposals: 10 to 15

We need an ongoing, long-term partner to build a production RAG system over our help center.
Deliverables: ingestion pipeline, retrieval API, evaluation harness. Milestones are defined and
the budget and timeline are agreed. This is a system we intend to run and maintain, not a
one-off script, so we care about architecture and about being able to evaluate the thing.

Skills: Python, RAG, OpenAI API, vector database, API integration, LangChain`,
  },
  {
    label: 'A scam',
    niche: 'ai_automation',
    text: `URGENT!! AI Automation Specialist — start today, big long term project
Fixed-price - $120.00
United States · $0 spent · Proposals: less than 5

Send me a free test task first so we can see your skills. Contact me at hiring@gmail.com
or message me on WhatsApp. We pay in crypto. You can earn $500/day with us.
Start low and long term is guaranteed.`,
  },
  {
    label: 'A vague one',
    niche: 'ai_marketing',
    text: `Need someone to help with AI stuff for our marketing
Hourly: $18.00-$25.00
Payment verified · $900 spent · United States · Hire rate, 12%
Proposals: 30 to 40

help with ai marketing stuff`,
  },
  {
    label: 'Off your niche',
    niche: 'ai_automation',
    text: `Illustrator needed for a children's picture book (24 pages, watercolour style)
Fixed-price - $2,200.00
Payment verified · $18,000 spent · Canada · Hire rate, 81%
Proposals: 5 to 10

We are publishing a picture book and need a watercolour illustrator for 24 interior pages
plus a cover. Deliverables and milestones are defined, and we would like to work with the
same illustrator on the sequel next year.

Skills: illustration, watercolour, children's books, Procreate`,
  },
];

const BAR_LABEL: Record<keyof ScoreBreakdown, string> = {
  pay: 'pay',
  client: 'client',
  fit: 'fit',
  intent: 'intent',
  competition: 'competition',
};

const VERDICT_TEXT: Record<string, string> = {
  apply: 'Apply now',
  maybe: 'Maybe',
  skip: 'Skip',
  review: 'Review',
};

const STATS: Array<{ n: number; suffix?: string; l: string }> = [
  { n: 0, l: 'model calls' },
  { n: 0, l: 'bytes sent' },
  { n: 5, l: 'sub-scores' },
  { n: 72, l: 'parity scorings' },
];

/* The nine scam rules the engine actually runs, copied from RED_FLAG_RULES in
 * src/engine/scoring.ts. Not marketing copy — this is the list. */
const RED_FLAG_LABELS = [
  'Asks for a free test / unpaid work',
  'Pushes the chat off Upwork (WhatsApp/Telegram)',
  'Tries to move contact off the platform',
  'Mentions payment in crypto / gift cards',
  'Unrealistic earnings promise ($X/day)',
  "Generic 'easy and quick' work (low value / possible bait)",
  "Marked 'urgent' (can pressure price and timeline)",
  "Offers 'revenue share' / commission instead of pay",
  "Asks you to start cheap on a 'long term' promise",
];

const FAQ = [
  {
    q: 'Is there a language model anywhere in this?',
    a: 'No. The parser is regex and the scorer is arithmetic over the fields it found — both pure TypeScript functions. Nothing on this page calls an API, and there is no key to configure, because there is nothing to authenticate against.',
  },
  {
    q: 'What happens to the job post I paste?',
    a: 'Nothing leaves your browser. There is no server route to send it to, no database behind it and no analytics on the page. Close the tab and it is gone.',
  },
  {
    q: 'Why should scoring be rules rather than a model?',
    a: 'Because the same post has to produce the same score, or the ranked list stops being stable and you cannot trust yesterday’s triage. A rule engine also tells you which rule fired and what it was worth. A score you cannot audit is a score you will not act on.',
  },
  {
    q: 'What does the parser do when it cannot find a field?',
    a: 'It leaves it null, and the engine scores null as unknown — neutral — rather than guessing. Delete a line from the post above and watch a field go null and the score move.',
  },
  {
    q: 'Does the tool submit proposals to Upwork?',
    a: 'No, and not because a switch is turned off — there is no code path that sends one. Job data enters by manual paste or the official read-only API. Automation may prepare and assist; a human decides and sends.',
  },
];

const NAV = [
  { id: 'tool', label: 'The tool' },
  { id: 'breakdown', label: 'How it scores' },
  { id: 'parser', label: 'The parser' },
  { id: 'notes', label: 'Honest notes' },
  { id: 'faq', label: 'FAQ' },
];
const NAV_IDS = NAV.map((n) => n.id);

const Mark = () => (
  <span className="nav__mark" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 10.5L5.5 6.5L8 9L12 3.5" stroke="#9ff690" strokeWidth="1.6" />
    </svg>
  </span>
);

export default function Page() {
  const [text, setText] = useState(SAMPLES[0]!.text);
  const [niche, setNiche] = useState<NicheKey>('ai_automation');
  const { active, stuck } = useNavSpy(NAV_IDS);

  // Pure functions, so there is nothing to await and nothing to cache.
  const { parsed, scored } = useMemo(() => {
    const p = parseJob(text);
    return { parsed: p, scored: scoreJob(p, niche) };
  }, [text, niche]);

  const load = (s: (typeof SAMPLES)[number]) => {
    setText(s.text);
    setNiche(s.niche);
  };

  const fields: Array<[string, string | number | boolean | null]> = [
    ['budgetType', parsed.budgetType],
    ['budgetMin', parsed.budgetMin],
    ['budgetMax', parsed.budgetMax],
    ['paymentVerified', parsed.paymentVerified],
    ['clientSpent', parsed.clientSpent],
    ['clientHireRate', parsed.clientHireRate],
    ['proposalsCount', parsed.proposalsCount],
    ['clientCountry', parsed.clientCountry || null],
    ['skills', parsed.skills.length ? parsed.skills.slice(0, 6).join(', ') : null],
  ];

  return (
    <RevealProvider>
      <SmoothScroll />

      <a className="skip-link" href="#tool">
        Skip to the tool
      </a>

      <div className="notice">
        <p className="notice__in">
          <b>Live demo — nothing you paste leaves your browser.</b>
          <span>
            The scoring engine is pure TypeScript running client-side: no server call, no
            database, no analytics, nothing stored. Not affiliated with Upwork.
          </span>
        </p>
      </div>

      <nav className={`nav${stuck ? ' is-stuck' : ''}`} aria-label="Primary">
        <div className="nav__in">
          <a className="nav__brand" href="#top">
            <Mark />
            UpRank
          </a>
          <div className="nav__links">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={active === n.id ? 'is-active' : undefined}
                aria-current={active === n.id ? 'true' : undefined}
              >
                {n.label}
              </a>
            ))}
          </div>
          <a className="btn btn--primary btn--icon nav__cta" href="#tool">
            <RollIcon />
            <Roll>Score a post</Roll>
          </a>
        </div>
      </nav>

      <main id="top">
        {/* ------------------------------------------------------------- hero */}
        <header className="hero">
          <div className="hero__art" aria-hidden="true">
            <span className="hero__glow" />
            <span className="slabs slabs--l">
              <span className="slabs__bloom" />
              <span className="slabs__col" />
            </span>
            <span className="slabs slabs--r">
              <span className="slabs__bloom" />
              <span className="slabs__col" />
            </span>
          </div>
          <div className="shell hero__in">
            <Reveal as="p" variant="up-sm" className="eyebrow">
              Portfolio piece · Decision engines
            </Reveal>

            <SplitText
              text="Score a job post the way a rule engine would, not the way a model would."
              stagger={14}
            />

            <Reveal as="p" variant="up" delay={120} className="lede">
              Paste any Upwork job post. You get a 0–100 score, the five sub-scores it is made
              of, a plain reason for each one, the scam signals it found, and an apply / maybe /
              skip verdict. <b>There is no language model anywhere in this.</b> A score you
              cannot audit is a score you will not trust, and the same post has to produce the
              same score or the ranked list stops being stable.
            </Reveal>

            <Reveal variant="up" delay={220} className="cta-row">
              <a className="btn btn--primary btn--icon" href="#tool">
                <RollIcon />
                <Roll>Try it now</Roll>
              </a>
              <a className="btn btn--ghost" href="#notes">
                <Roll>What is real here</Roll>
              </a>
            </Reveal>

            <Reveal variant="scale" delay={300} className="stats">
              {STATS.map((s) => (
                <div className="stat" key={s.l}>
                  <span className="stat__n">
                    <CountUp to={s.n} />
                  </span>
                  <span className="stat__l">{s.l}</span>
                </div>
              ))}
            </Reveal>
          </div>
        </header>

        {/* ----------------------------------------------------------- ticker */}
        <section className="section--strip" aria-labelledby="strip-h">
          <div className="shell">
            <Reveal as="p" variant="up-sm" className="strip__h shimmer" id="strip-h">
              Nine scam rules, run against every post you paste
            </Reveal>
          </div>
          <Reveal variant="up-sm" delay={100}>
            <Ticker items={RED_FLAG_LABELS} />
          </Reveal>
        </section>

        {/* ------------------------------------------------------------- tool */}
        <section className="section" id="tool">
          <div className="shell">
            <div className="section__head">
              <Reveal as="p" variant="up-sm" className="eyebrow">
                The tool
              </Reveal>
              <Reveal as="h2" variant="up" delay={80}>
                Paste a post. Watch every point get accounted for.
              </Reveal>
              <Reveal as="p" variant="up" delay={160} className="lede">
                Edit the text and the score moves as you type — there is nothing to submit,
                because there is nowhere to submit it to.
              </Reveal>
            </div>

            <Reveal variant="scale" className="card card--glow">
              <div className="field">
                <label className="micro" htmlFor="post">
                  Job post — paste one, or edit these
                  <span className="caret" aria-hidden="true" />
                </label>
                <textarea
                  id="post"
                  rows={12}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                  placeholder="Paste the whole post: title, description, budget, client stats, proposal count…"
                />
              </div>
              <div className="row">
                <div className="field" style={{ flex: '0 1 280px' }}>
                  <label className="micro" htmlFor="niche">
                    Your niche
                  </label>
                  <select
                    id="niche"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value as NicheKey)}
                  >
                    {Object.values(NICHES).map((n) => (
                      <option key={n.key} value={n.key}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="micro" id="samples-label">
                    Try one
                  </span>
                  <div className="chips" role="group" aria-labelledby="samples-label">
                    {SAMPLES.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="btn btn--chip"
                        aria-pressed={text === s.text}
                        onClick={() => load(s)}
                      >
                        <Roll>{s.label}</Roll>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="note">{NICHES[niche].tagline}</p>
            </Reveal>

            <div className="cols" style={{ marginTop: 16 }} id="breakdown">
              <Reveal variant="up-sm" className={`card card--verdict-${scored.recommendation}`}>
                <div
                  className={`verdict verdict--${scored.recommendation}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="verdict__n">{scored.score}</span>
                  <span className="verdict__t">
                    <span className="verdict__w">{VERDICT_TEXT[scored.recommendation]}</span>
                    <span className="verdict__s">out of 100 · scored in this browser</span>
                  </span>
                </div>

                <h3 className="micro">Where the points came from</h3>
                <div className="bars">
                  {(Object.keys(scored.breakdown) as (keyof ScoreBreakdown)[]).map((k) => {
                    const max = SUB_SCORE_MAX[k];
                    const pts = scored.breakdown[k];
                    return (
                      <div className="bar" key={k}>
                        <span className="bar__n">{BAR_LABEL[k]}</span>
                        <span className="bar__t">
                          <span className="bar__f" style={{ width: `${(pts / max) * 100}%` }} />
                        </span>
                        <span className="bar__v">
                          {pts}/{max}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <h3 className="micro">Why — one line per component</h3>
                <ul className="reasons">
                  {scored.reasons.map((r, i) => (
                    <li key={`${i}-${r.slice(0, 20)}`}>{r}</li>
                  ))}
                </ul>

                {scored.redFlags.length > 0 ? (
                  <div className="flags">
                    <h3 className="micro">
                      {scored.redFlags.length} red flag{scored.redFlags.length === 1 ? '' : 's'}
                    </h3>
                    <ul>
                      {scored.redFlags.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Reveal>

              <div className="stack">
                <Reveal variant="up-sm" delay={90} className="card" id="parser">
                  <h3>What the parser actually extracted</h3>
                  <p className="note">
                    This is the honest weak point, and the case study says so: it is regex over
                    an English post format. A field it cannot find stays <i>null</i>, and the
                    engine scores null as <b>unknown</b> — neutral — rather than guessing. Delete
                    a line above and watch a field go null and the score move.
                  </p>
                  <div className="parsed">
                    {fields.map(([k, v]) => (
                      <div className="parsed__r" key={k}>
                        <code className="parsed__k">{k}</code>
                        <span
                          className="parsed__v"
                          data-null={v === null || v === '' || v === 'unknown'}
                        >
                          {v === null || v === '' ? 'null' : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Reveal>

                <Reveal variant="up-sm" delay={160} className="card">
                  <h3>Where the model does belong</h3>
                  <p className="note">
                    In the full app, Claude writes the proposal draft and rewrites the profile
                    overview — tasks where the output is prose, there is no single right answer,
                    variation is a feature, and a human reads every word before it goes anywhere.
                    Text generation earns the API call. Scoring does not, and it also costs
                    nothing and runs instantly this way.
                  </p>
                  <p className="note">
                    The tool never submits anything to Upwork. There is no code path that sends a
                    proposal — absent, not disabled — and job data enters by manual paste or the
                    official read-only API. Automation may prepare and assist; a human decides
                    and sends.
                  </p>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ notes */}
        <section className="section section--tight" id="notes">
          <div className="shell">
            <div className="section__head">
              <Reveal as="p" variant="up-sm" className="eyebrow">
                Honest notes
              </Reveal>
              <Reveal as="h2" variant="up" delay={80}>
                What is real, what is not, and the bug left in on purpose.
              </Reveal>
            </div>
            <div className="trio">
              <Reveal as="article" variant="up" className="card card--invert">
                <h3 className="micro">What is real</h3>
                <p className="note">
                  The parser and the scoring engine are the source app&apos;s, copied unchanged
                  except for translating the strings a person reads. A parity script in the repo
                  runs both implementations over the same posts and compares score,
                  recommendation, sub-score breakdown and red-flag count — <b>72 scorings, zero
                  differences.</b>
                </p>
                <span className="card__idx" aria-hidden="true">01</span>
              </Reveal>
              <Reveal as="article" variant="up" delay={110} className="card card--invert">
                <h3 className="micro">What is not</h3>
                <p className="note">
                  The scoring weights are hand-tuned judgement and have never been validated
                  against real win rates, because there is not enough outcome data to validate
                  them with. They are <b>a defensible starting point, not a proven model</b> —
                  and a portfolio that claimed otherwise would be worth less.
                </p>
                <span className="card__idx" aria-hidden="true">02</span>
              </Reveal>
              <Reveal as="article" variant="up" delay={220} className="card card--invert">
                <h3 className="micro">A weakness this demo will show you</h3>
                <p className="note">
                  Load <i>Off your niche</i> — a watercolour illustration job, nothing to do with
                  AI automation. It scores in the fifties and comes back <i>Maybe</i>, because{' '}
                  <code>fit</code> is the only sub-score that collapses while pay, client and
                  competition all stay strong. Fit is worth 25 of 100, so a well-paid job from a
                  good client survives being completely wrong for you. The honest fix is not a
                  bigger fit weight, it is a gate: below a fit floor the verdict should be{' '}
                  <i>skip</i> whatever the other components say. <b>That is a real bug, found by
                  using the thing, and it is left visible here rather than tuned away before you
                  saw it.</b>
                </p>
                <span className="card__idx" aria-hidden="true">03</span>
              </Reveal>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- faq */}
        <section className="section section--tight" id="faq">
          <div className="shell shell--narrow">
            <div className="section__head">
              <Reveal as="p" variant="up-sm" className="eyebrow">
                FAQ
              </Reveal>
              <Reveal as="h2" variant="up" delay={80}>
                The questions this demo gets asked.
              </Reveal>
            </div>
            <Reveal variant="up-sm" delay={140}>
              <Accordion items={FAQ} />
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="foot__in">
          <div className="foot__brand">
            <a className="nav__brand" href="#top">
              <Mark />
              UpRank
            </a>
            <p className="note" style={{ maxWidth: '38ch' }}>
              The ranking engine of a local, single-user job-triage tool — unchanged, with its
              text in English, running in your browser.
            </p>
          </div>

          <nav className="foot__col" aria-label="On this page">
            <p className="micro">On this page</p>
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`}>
                {n.label}
              </a>
            ))}
          </nav>

          <div className="foot__col">
            <p className="micro">Privacy</p>
            <span>No server call</span>
            <span>No database</span>
            <span>No analytics</span>
            <span>Nothing stored</span>
          </div>

          <div className="foot__col">
            <p className="micro">Engine</p>
            <span>Pure TypeScript</span>
            <span>Deterministic</span>
            <span>5 sub-scores</span>
            <span>No LLM</span>
          </div>
        </div>
        <p className="foot__bar">
          Not affiliated with Upwork. Automation may prepare and assist; a human decides and
          sends.
        </p>
      </footer>
    </RevealProvider>
  );
}
