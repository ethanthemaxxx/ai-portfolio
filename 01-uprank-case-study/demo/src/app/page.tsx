'use client';

import { useMemo, useState } from 'react';
import { parseJob } from '../engine/parseJob.ts';
import { scoreJob, SUB_SCORE_MAX } from '../engine/scoring.ts';
import { NICHES } from '../engine/niches.ts';
import type { NicheKey, ScoreBreakdown } from '../engine/types.ts';

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

export default function Page() {
  const [text, setText] = useState(SAMPLES[0]!.text);
  const [niche, setNiche] = useState<NicheKey>('ai_automation');

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
    <>
      <div className="banner">
        <b>Live demo of a personal tool — nothing you paste leaves your browser.</b> The
        scoring engine is pure TypeScript running client-side: no server call, no database,
        no analytics, nothing stored. Not affiliated with Upwork. The full app is a local
        single-user tool; this page is its ranking engine, unchanged, with its text in English.
      </div>

      <div className="wrap">
        <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="eyebrow">Portfolio piece · Decision engines · Full-stack + AI</p>
          <h1>Score a job post the way a rule engine would, not the way a model would.</h1>
          <p className="lede">
            Paste any Upwork job post. You get a 0–100 score, the five sub-scores it is made
            of, a plain reason for each one, the scam signals it found, and an apply / maybe /
            skip verdict. <b>There is no language model anywhere in this.</b> That is the
            argument the case study makes: a score you cannot audit is a score you will not
            trust, and the same post has to produce the same score or the ranked list stops
            being stable.
          </p>
        </header>

        <div className="card">
          <div className="row">
            <div className="grow" style={{ flexBasis: '100%' }}>
              <label htmlFor="post">Job post — paste one, or edit these</label>
              <textarea
                id="post"
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                placeholder="Paste the whole post: title, description, budget, client stats, proposal count…"
              />
            </div>
          </div>
          <div className="row">
            <div className="grow" style={{ maxWidth: 280 }}>
              <label htmlFor="niche">Your niche</label>
              <select id="niche" value={niche} onChange={(e) => setNiche(e.target.value as NicheKey)}>
                {Object.values(NICHES).map((n) => (
                  <option key={n.key} value={n.key}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grow">
              <label>Try one</label>
              <div className="samples">
                {SAMPLES.map((s) => (
                  <button key={s.label} className="ghost" onClick={() => load(s)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="note">{NICHES[niche].tagline}</p>
        </div>

        <div className="cols">
          <div className="card">
            <div className={`score ${scored.recommendation}`}>
              <span className="num">{scored.score}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="verdict">{VERDICT_TEXT[scored.recommendation]}</span>
                <span className="of">out of 100 · scored in this browser</span>
              </span>
            </div>

            <h3>Where the points came from</h3>
            <div className="bars">
              {(Object.keys(scored.breakdown) as (keyof ScoreBreakdown)[]).map((k) => {
                const max = SUB_SCORE_MAX[k];
                const pts = scored.breakdown[k];
                return (
                  <div className="bar" key={k}>
                    <span className="name">{BAR_LABEL[k]}</span>
                    <span className="track">
                      <span className="fill" style={{ width: `${(pts / max) * 100}%` }} />
                    </span>
                    <span className="val">
                      {pts}/{max}
                    </span>
                  </div>
                );
              })}
            </div>

            <h3>Why — one line per component</h3>
            <ul className="reasons">
              {scored.reasons.map((r, i) => (
                <li key={`${i}-${r.slice(0, 20)}`}>{r}</li>
              ))}
            </ul>

            {scored.redFlags.length > 0 ? (
              <div className="flags">
                <h3>
                  {scored.redFlags.length} red flag{scored.redFlags.length === 1 ? '' : 's'}
                </h3>
                <ul>
                  {scored.redFlags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <h2>What the parser actually extracted</h2>
              <p className="note">
                This is the honest weak point, and the case study says so: it is regex over an
                English post format. A field it cannot find stays <i>null</i>, and the engine
                scores null as <b>unknown</b> — neutral — rather than guessing. Delete a line
                above and watch a field go null and the score move.
              </p>
              <div className="parsed">
                {fields.map(([k, v]) => (
                  <div className="p" key={k}>
                    <code>{k}</code>
                    <span className="v" data-null={v === null || v === '' || v === 'unknown'}>
                      {v === null || v === '' ? 'null' : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Where the model does belong</h2>
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
                official read-only API. Automation may prepare and assist; a human decides and
                sends.
              </p>
            </div>
          </div>
        </div>

        <div className="foot">
          <p>
            <b>What is real here:</b> the parser and the scoring engine are the source app&apos;s,
            copied unchanged except for translating the strings a person reads. A parity script
            in the repo runs both implementations over the same posts and compares score,
            recommendation, sub-score breakdown and red-flag count — 72 scorings, zero
            differences.
          </p>
          <p>
            <b>What is not:</b> the scoring weights are hand-tuned judgement and have never been
            validated against real win rates, because there is not enough outcome data to
            validate them with. They are a defensible starting point, not a proven model — and
            a portfolio that claimed otherwise would be worth less.
          </p>
          <p>
            <b>A weakness this demo will show you.</b> Load <i>Off your niche</i> — a watercolour
            illustration job, with nothing to do with AI automation. It scores in the fifties and
            comes back <i>Maybe</i>, because <code>fit</code> is the only sub-score that collapses
            while pay, client and competition all stay strong. Fit is worth 25 of 100, so a
            well-paid job from a good client survives being completely wrong for you. The honest
            fix is not a bigger fit weight, it is a gate: below a fit floor the verdict should be
            <i>skip</i> whatever the other components say. That is a real bug, found by using the
            thing, and it is left visible here rather than tuned away before you saw it.
          </p>
        </div>
      </div>
    </>
  );
}
