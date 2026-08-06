import { GateDemo } from './components/gate-demo.tsx';
import { Accordion, type QA } from './components/accordion.tsx';
import { Marquee } from './components/marquee.tsx';
import { Reveal, WordReveal } from './components/reveal.tsx';
import { SectionHead } from './components/section-head.tsx';
import { ArrowRight, Check, Ledger, Repeat, Ruler, Shield } from './components/icons.tsx';

/* Every number on this page is measured, and comes from the project's own
 * output/ directory or its test run. That is not incidental to the design — the
 * subject of the piece is copy that cannot make a claim it cannot source. */

const STATS = [
  { n: '246', l: 'Facts in the ledger' },
  { n: '11', l: 'Hard rules enforced' },
  { n: '123', l: 'Tests passing' },
  { n: '110ms', l: 'Full run, 12 products' },
];

const VALUES = [
  {
    n: '01',
    icon: <Ledger />,
    title: 'Facts before sentences',
    body:
      'Every product gets a ledger of what it is allowed to say, each entry carrying the field path it came from. The writer may only draw from that list.',
  },
  {
    n: '02',
    icon: <Ruler />,
    title: 'Voice measured, not described',
    body:
      'Five descriptions the merchant already likes go in; numbers come out — longest sentence, reading grade, paragraph count. The validator enforces those numbers.',
  },
  {
    n: '03',
    icon: <Shield />,
    title: 'Fails closed, every time',
    body:
      'A product that breaks one rule publishes nothing. Not a partial record, not a best-effort description. Quarantine is the safe state.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Extract the voice',
    body: 'Five approved descriptions are measured into a style guide of hard numbers, not adjectives.',
  },
  {
    n: '02',
    title: 'Build the fact ledger',
    body: 'Each product record is flattened into sayable facts, every one carrying its source path.',
  },
  {
    n: '03',
    title: 'Generate the copy',
    body: 'Description, meta title, meta description and alt text — offline template or Claude, same interface.',
  },
  {
    n: '04',
    title: 'Run the gate',
    body: 'Eleven rules, twelve violation codes. Anything untraceable, over-length or off-voice is quarantined.',
  },
  {
    n: '05',
    title: 'Queue for a human',
    body: 'Cleared copy waits for approval, then re-validates at push time before it reaches Shopify.',
  },
];

const OUTPUTS = [
  { title: 'Product description', body: '3–4 paragraphs, second person, reading grade ≤ 8, every claim sourced.' },
  { title: 'Meta title', body: 'Hard-capped at 60 characters. Over by one and the product is held.' },
  { title: 'Meta description', body: 'Held inside 140–160 characters, checked on the rendered string.' },
  { title: 'Image alt text', body: 'Describes the photograph. Never announces it — no “image of”, no “photo showing”.' },
];

const GUARANTEES = [
  'No claim without a source path',
  'No certification the brand lacks',
  'No number the data does not hold',
  'No push without a human approval',
];

const CAUGHT = [
  {
    rule: 'AC-02',
    title: 'The certification that was never held',
    body:
      'Cerro Alto holds no organic or Fair Trade certification. The rule catches the direct claim and the soft implication — “sustainably sourced”, “pesticide free” — because near-miss phrasing is how this failure actually reaches production.',
    metrics: [
      { n: '2', l: 'Phrase classes' },
      { n: '0', l: 'False negatives in tests' },
    ],
  },
  {
    rule: 'AC-06',
    title: 'The altitude nobody grew coffee at',
    body:
      'A plausible figure is the most dangerous output a generator produces. Every number and tasting note in the copy is matched back to a ledger entry; anything unmatched fails, however reasonable it reads.',
    metrics: [
      { n: '246', l: 'Facts indexed' },
      { n: '110', l: 'Cited in published copy' },
    ],
  },
  {
    rule: 'AC-08 / AC-09',
    title: 'The voice that drifted',
    body:
      'Sentence length, paragraph count and reading grade are measured from the brand’s own descriptions, so drift is caught as a number rather than argued about in review.',
    metrics: [
      { n: '18', l: 'Word sentence ceiling' },
      { n: '8', l: 'Reading grade ceiling' },
    ],
  },
];

const STACK = [
  'TypeScript',
  'Node 22',
  'Next.js',
  'node:test',
  'Shopify Admin API',
  'n8n',
  'Claude API',
  'Offline generator',
  'JSON Schema',
];

const FAQS: QA[] = [
  {
    q: 'Is a language model writing this copy?',
    a: 'Not on this page. The demo runs the offline deterministic generator, so it costs nothing to host and behaves identically for every visitor. The Claude path is implemented, prompt-engineered and unit-tested against doubles, but it has never been executed against the live API — and the gate judges both generators with exactly the same rules.',
  },
  {
    q: 'What happens when a product fails?',
    a: 'It publishes nothing. There is no partial record and no best-effort description; the product is quarantined with a list of violations, each naming the rule, the field and the offending text. Failing closed is the deliverable — a pipeline that degrades gracefully into wrong copy is worse than one that stops.',
  },
  {
    q: 'Can I beat the gate?',
    a: 'Please try. The copy fields in the demo are editable and Re-validate runs the same rule engine the test suite runs, imported directly rather than reimplemented for the web. The one-click attacks are shortcuts to the obvious exploits; typing your own is more interesting.',
  },
  {
    q: 'Which rules exist, exactly?',
    a: 'Eleven, producing twelve violation codes: banned brand words, stated or implied certification, meta title length, meta description length, alt-text shape, fact traceability, voice constraints, sentence and paragraph shape, and reading grade. Each one has an adversarial test that plants a violation and asserts it is caught — a gate that has never been shown to fire is not a gate.',
  },
  {
    q: 'What is not real here?',
    a: 'Cerro Alto Coffee is a fictional brand and all catalogue data is synthetic. No data is stored — reload and it is gone. The anchor date is fixed at 2026-08-04 so a run never depends on the clock, and zero products have ever been pushed to a real Shopify store: that transport is implemented and tested against a stub.',
  },
];

export default function Page() {
  return (
    <>
      {/* ============================================================== hero */}
      <section className="hero">
        <div className="hero__media" aria-hidden>
          <video
            src="/media/silk-hero.mp4"
            poster="/media/silk-hero.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        </div>
        <div className="hero__scrim" aria-hidden />

        <div className="hero__inner">
          <Reveal>
            <span className="badge">
              <span className="badge__dot" aria-hidden />
              Catalogue automation · Shopify / DTC
            </span>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="display grad-text">
              Try to sneak a fabrication
              <br />
              past the gate.
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="hero__sub">
              A pipeline writes a product&apos;s description, meta title, meta description and alt
              text from its catalogue record — then checks its own output against eleven rules.
              Edit the words yourself and run it again.
            </p>
          </Reveal>

          <Reveal delay={260} className="hero__actions">
            <a className="btn btn--halo" href="#demo">
              Open the live demo
              <span className="btn__arrow">
                <ArrowRight />
              </span>
            </a>
            <a className="btn btn--glass btn--pad" href="#how">
              How it works
            </a>
          </Reveal>
        </div>

        <div className="hero__scroll" aria-hidden>
          <span>Scroll</span>
        </div>
      </section>

      {/* ======================================================= 001 problem */}
      <section className="section">
        <div className="container">
          <SectionHead num="001" label="The problem" title="Generation is the easy half" />
          <Reveal>
            <WordReveal
              className="h3"
              text="A model will happily write that a coffee is certified organic, grown at 2,100 metres, and tasting of blueberry — none of which appears anywhere in the product record. It reads beautifully. It is also a compliance incident waiting for a screenshot."
            />
          </Reveal>

          <Reveal delay={120}>
            <div
              className="card"
              style={{ marginTop: 40, padding: 12, borderRadius: 'var(--r-lg)' }}
            >
              <div
                style={{
                  position: 'relative',
                  borderRadius: 'var(--r-card)',
                  overflow: 'hidden',
                  aspectRatio: '16 / 7',
                }}
              >
                <video
                  src="/media/silk-panel.mp4"
                  poster="/media/silk-panel.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  aria-hidden
                />
                <span className="badge" style={{ position: 'absolute', left: 20, bottom: 20 }}>
                  <span className="badge__dot" aria-hidden />
                  12 products · 2 locales · 0 quarantined
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- stat rail */}
      <section className="section" style={{ paddingBlock: 0 }} aria-label="Measured results">
        <Marquee duration={46} gap={72}>
          {STATS.map((s) => (
            <div className="stat" key={s.l}>
              <span className="stat__n">{s.n}</span>
              <span className="label stat__l">{s.l}</span>
            </div>
          ))}
        </Marquee>
      </section>

      {/* ========================================================= 002 value */}
      <section className="section">
        <div className="container">
          <SectionHead
            num="002"
            label="Value"
            title="Why this exists"
            lede="Three decisions separate a pipeline you can put in front of a merchant from a demo that writes nice sentences."
          />
          <div className="grid grid--3">
            {VALUES.map((v, i) => (
              <Reveal key={v.n} delay={i * 90}>
                <article className="card card--arch">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <span className="card__icon">{v.icon}</span>
                    <span className="card__num">{v.n}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h3 className="h4">{v.title}</h3>
                    <p className="body" style={{ fontSize: 'var(--t-sm)' }}>
                      {v.body}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================= 003 process */}
      <section className="section" id="how">
        <div className="container">
          <SectionHead
            num="003"
            label="Process"
            title="How it works"
            lede="Five stages, each one testable on its own. The interesting one is the fourth."
          />
          <div>
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 60}>
                <div className="step">
                  <span className="step__n">{s.n}</span>
                  <h3 className="h4">{s.title}</h3>
                  <p className="body" style={{ fontSize: 'var(--t-sm)' }}>
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div
              className="card card--dark"
              style={{
                marginTop: 40,
                borderRadius: 'var(--r-lg)',
                padding: 'clamp(28px, 4vw, 56px)',
                alignItems: 'center',
                textAlign: 'center',
                gap: 20,
              }}
            >
              <h3 className="h3">Fails closed. Always.</h3>
              <p className="lede" style={{ maxWidth: '54ch', textAlign: 'center' }}>
                Four guarantees hold whichever generator is wired in — the offline template or the
                model.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  justifyContent: 'center',
                  marginTop: 8,
                }}
              >
                {GUARANTEES.map((g) => (
                  <span
                    key={g}
                    className="chip"
                    style={{ background: 'rgba(255,255,255,.1)', boxShadow: 'none', color: '#fff' }}
                  >
                    <Check size={13} />
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================================================== 004 capabilities */}
      <section className="section">
        <div className="container">
          <SectionHead
            num="004"
            label="Capabilities"
            title="What the pipeline produces"
            lede="Four fields per product, per locale. Each one has its own rule, and its own way of failing."
          />
          <div className="grid grid--4">
            {OUTPUTS.map((o, i) => (
              <Reveal key={o.title} delay={i * 70}>
                <article className="card" style={{ minHeight: 200 }}>
                  <span className="card__icon" style={{ width: 44, height: 44 }}>
                    <Repeat size={20} />
                  </span>
                  <h3 className="h4">{o.title}</h3>
                  <p className="body" style={{ fontSize: 'var(--t-sm)' }}>
                    {o.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================== 005 demo */}
      <section className="section" id="demo">
        <div className="container">
          <SectionHead
            num="005"
            label="Live demo"
            title="The gate does not care who wrote the words"
            lede="Pick a product, edit the copy the pipeline produced — or use a one-click attack — then re-validate. The rule engine below is the same module the test suite runs."
          />
          <Reveal>
            <GateDemo />
          </Reveal>
          <Reveal delay={80}>
            <p className="body" style={{ fontSize: 'var(--t-sm)', marginTop: 24, maxWidth: '80ch' }}>
              <b>What is real here:</b> the generator, the fact ledger and all eleven rules are the
              same modules the project&apos;s 123 tests run against, imported directly — not a
              reimplementation for the web. <b>What is not:</b> no language model is called on this
              page, and no data is stored. Reload and it is gone.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ========================================================= 006 rules */}
      <section className="section" id="rules">
        <div className="container">
          <SectionHead
            num="006"
            label="The rules"
            title="What the gate actually catches"
            lede="Each rule exists because a specific failure reached production somewhere, and each one has an adversarial test that plants the violation and asserts it fires."
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {CAUGHT.map((c, i) => (
              <Reveal key={c.rule} delay={i * 80}>
                <article
                  className="card"
                  style={{ borderRadius: 'var(--r-lg)', padding: 'clamp(24px, 3vw, 40px)' }}
                >
                  <div className="rule-grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <span className="badge badge--light mono">{c.rule}</span>
                      <h3 className="h3">{c.title}</h3>
                      <p className="body" style={{ fontSize: 'var(--t-sm)', maxWidth: '62ch' }}>
                        {c.body}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                      {c.metrics.map((m) => (
                        <div key={m.l} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span
                            className="stat__n"
                            style={{ fontSize: 'clamp(2.25rem, 4vw, 3.25rem)' }}
                          >
                            {m.n}
                          </span>
                          <span className="label" style={{ maxWidth: '16ch' }}>
                            {m.l}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= 007 stack */}
      <section className="section">
        <div className="container">
          <SectionHead
            num="007"
            label="Stack"
            title="What it is built on"
            lede="No framework magic in the pipeline itself — it runs unbundled under node --experimental-strip-types, which is why the web demo can import the rules directly."
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Marquee duration={38} gap={16}>
            {STACK.map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
          </Marquee>
          <Marquee duration={44} gap={16}>
            {[...STACK].reverse().map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* =========================================================== 008 faq */}
      <section className="section" id="faq">
        <div className="container container--narrow">
          <SectionHead num="008" label="FAQs" title="Common questions" />
          <Accordion items={FAQS} />
        </div>
      </section>
    </>
  );
}
