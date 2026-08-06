import Widget from './widget.tsx';
import HeroMesh from './hero-mesh.tsx';
import UseCases from './use-cases.tsx';
import RunIt from './run-it.tsx';
import Counter from './counter.tsx';
import {
  FEATURE_ICONS,
  IconCheck,
  IconCross,
  IconMenu,
  IconPlus,
  MarkBean,
  type IconKey,
} from './icons.tsx';

/**
 * The demo page.
 *
 * It says out loud which mode it's in. A demo that quietly replays fixtures while
 * implying live inference is the kind of thing that costs you a client in the
 * second meeting — so the mode badge sits in the widget header, not in a footnote.
 *
 * Every number on this page came from a command in `evals/report.md` that runs on
 * a clean clone with no keys and no network. The end-to-end run did not happen,
 * so its tiles say "not measured" instead of showing a flattering number. That is
 * the same policy the report holds itself to, and it is load-bearing here: a
 * landing page for an agent is a claim about trust, and inventing a metric on it
 * would contradict the whole argument the product makes.
 */

const STACK = [
  'claude-opus-5',
  'Voyage embeddings',
  'Next.js 15',
  'Shopify Admin API',
  'TypeScript',
  'node:test',
];

const FEATURES: { icon: IconKey; tone: string; title: string; body: string; foot: string }[] = [
  {
    icon: 'document',
    tone: 'tile--lav',
    title: 'Grounded retrieval',
    body: 'Answers are assembled from the store’s own help centre — hybrid lexical and embedding search over six policy documents, shipped at k=6.',
    foot: 'No document, no claim.',
  },
  {
    icon: 'parcel',
    tone: 'tile--sky',
    title: 'Live order lookup',
    body: 'A typed tool call hits the Shopify Admin API and returns a normalised envelope, so status, carrier and dates come from the order — not from the model.',
    foot: 'Real data, real latency, shown.',
  },
  {
    icon: 'handoff',
    tone: 'tile--amber',
    title: 'Deterministic escalation',
    body: 'Refunds over the approval limit, damage claims and low-confidence retrievals route to a person through code, not through a prompt asking nicely.',
    foot: 'No prompt can talk past it.',
  },
  {
    icon: 'seal',
    tone: 'tile--mint',
    title: 'Checkable answers',
    body: 'Every answer carries the documents it was built from as clickable chips. The customer can read the policy the agent read.',
    foot: 'Cited, or it doesn’t ship.',
  },
];

const STEPS: { n: string; icon: IconKey; title: string; body: string; code: string }[] = [
  {
    n: 'STEP 1',
    icon: 'search',
    title: 'Retrieve before reasoning',
    body: 'The question is embedded and searched against the committed index. Six chunks come back with scores; if the best of them falls under the relevance floor, the turn is already on its way to a human.',
    code: 'retrieve(q, k=6) → chunks[]     floor → escalate',
  },
  {
    n: 'STEP 2',
    icon: 'terminal',
    title: 'Call tools, in the open',
    body: 'Order lookup, help-centre search and escalation are typed tools with contracts and their own tests. The widget shows each call as it starts and the real elapsed time when it returns.',
    code: 'lookup_order("CA-10244") → { status, carrier, eta }',
  },
  {
    n: 'STEP 3',
    icon: 'fork',
    title: 'Answer, or hand off',
    body: 'Claims not supported by the retrieved context fail the citation gate. When the policy says a human decides — money, damage, anything past the approval limit — the agent writes the ticket instead of the promise.',
    code: 'gate B: every claim ∈ context   else → handoff(ticket)',
  },
];

const STATS = [
  {
    value: 251,
    suffix: '/252',
    decimals: 0,
    note: 'unit and contract tests passing, with 1 skipped loudly because it needs an embeddings key.',
  },
  {
    value: 14,
    suffix: '/16',
    decimals: 0,
    note: 'retrieval cases where every expected source came back — 88%, on the offline embedding stub.',
  },
  {
    value: 94,
    suffix: '%',
    decimals: 0,
    note: 'top-k hit rate at the shipped k=6, where false below-floor escalation reaches 0%.',
  },
  {
    value: 0.815,
    suffix: '',
    decimals: 3,
    note: 'mean reciprocal rank at k=6 — within 0.007 of its ceiling at k=12, for half the context.',
  },
];

/*
 * What the agent is wired to. Each mark names a capability rather than a vendor,
 * and the vendor is named in text beside it — drawing someone else's logo would
 * put their trade mark in this repository, which is a different thing from
 * saying which API this calls.
 */
const CONNECTIONS: { icon: IconKey; name: string; role: string }[] = [
  { icon: 'spark', name: 'Anthropic API', role: 'claude-opus-5, streaming, tool use' },
  { icon: 'store', name: 'Shopify Admin API', role: 'order status, carrier, dates' },
  { icon: 'vector', name: 'Voyage embeddings', role: 'with an OpenAI fallback' },
  { icon: 'book', name: 'The help centre', role: 'six markdown policy documents' },
  { icon: 'inbox', name: 'Human handoff', role: 'ticket written at escalation' },
  { icon: 'braces', name: 'TypeScript', role: 'typed contracts per tool' },
  { icon: 'flask', name: 'node:test', role: '252 tests, no framework' },
  { icon: 'globe', name: 'Next.js on Vercel', role: 'the demo you are reading' },
];

/*
 * This sits where a product page would put testimonials. Fabricated praise on a
 * page whose entire argument is "no claim without a source" would undo the
 * argument, so the slot holds the thing testimonials are a proxy for: something
 * a reader can check. Each card is a command from the repository and what it
 * actually prints.
 */
const RECEIPTS = [
  {
    label: 'ESCALATION',
    claim: 'Refunds above the limit cannot be talked past.',
    detail:
      'The trigger reads the order envelope, not the conversation. An order flagged requiresApproval routes to a person whatever the customer or the model says next.',
    source: 'src/escalation/triggers.ts · refundOverApprovalLimit',
  },
  {
    label: 'GROUNDING',
    claim: 'No document above the floor means no answer.',
    detail:
      'When nothing retrieved clears the relevance floor the turn escalates with a stated reason rather than improvising from the model’s own priors.',
    source: 'src/escalation/triggers.ts · retrieval_below_floor',
  },
  {
    label: 'HONESTY',
    claim: 'The half that was not measured prints no number.',
    detail:
      'The eval report publishes both retrieval misses in full, including the case where the relevance floor is confident and wrong — which is why the citation gate exists at all.',
    source: 'evals/report.md · §4, not run',
  },
];

const EXAMPLES: {
  icon: IconKey;
  tone: string;
  label: string;
  title: string;
  body: string;
  tags: string[];
  foot: string;
}[] = [
  {
    icon: 'truck',
    tone: 'tile--sky',
    label: 'ORDER STALLED',
    title: 'CA-10244 hasn’t moved in four days',
    body: 'The agent looks the order up, reads the carrier scan history, and says what the shipping policy actually commits to — including the part where nothing has gone wrong yet.',
    tags: ['lookup_order', 'shipping', 'no escalation'],
    foot: 'Answered from policy plus the live order',
  },
  {
    icon: 'receipt',
    tone: 'tile--amber',
    label: 'REFUND OVER LIMIT',
    title: 'A dead kettle on CA-10250',
    body: 'A damage claim above the approval limit. The agent declines to promise the refund, writes a ticket carrying the order and the customer’s account of the fault, and says who decides next.',
    tags: ['returns-refunds', 'escalate_to_human'],
    foot: 'Handoff — the system working',
  },
  {
    icon: 'cup',
    tone: 'tile--mint',
    label: 'PRODUCT ADVICE',
    title: 'Which grind for an Aeropress?',
    body: 'No order, no tool call. Straight retrieval against the brewing guide, with the grind chart cited so the customer can check it before buying the wrong bag.',
    tags: ['brewing-grind-guide', 'cited'],
    foot: 'Answered from one document',
  },
];

const FAQ = [
  {
    q: 'Is this running live?',
    a: 'It depends on the key. With ANTHROPIC_API_KEY set it is real inference against claude-opus-5. Without one it runs in fixture mode — turns recorded from real runs, replayed at the measured timings. The widget header says which, always. The public deploy runs fixtures on purpose: it works, you can click it, and it spends nothing.',
  },
  {
    q: 'Where do the answers come from?',
    a: 'Six policy documents written for this store — shipping, returns and refunds, subscriptions, freshness and storage, a brewing and grind guide, and an FAQ. They are chunked, embedded and committed to the repository, which is what makes a clean clone runnable without a key.',
  },
  {
    q: 'What happens when it doesn’t know?',
    a: 'It stops. If nothing retrieved clears the relevance floor, or a claim isn’t supported by the retrieved context, the turn escalates instead of improvising. Escalation is rendered as a deliberate state in the widget, not as an error — because it is the system working correctly.',
  },
  {
    q: 'Why is the end-to-end score missing?',
    a: 'Because it was not run. The offline half — retrieval, the top-k sweep, the unit suite — ran on a machine with no keys and no network, and those numbers are printed next to the command that produced them. Answer accuracy, the two hard gates, latency and cost need a live run, so no number is given for them at all.',
  },
  {
    q: 'Is any of the customer data real?',
    a: 'None of it. The brand, catalogue, orders and policies were all built for this project. No real customer information appears anywhere in the repository or in this demo.',
  },
  {
    q: 'Can I read how it was built?',
    a: 'Yes — the spec, plan, task list and tool contracts that produced the code are committed under specs/, and the case study walks through the retrieval decisions and the two failures that were not rounded away.',
  },
];

export default function Page() {
  const live = Boolean(process.env['ANTHROPIC_API_KEY']);

  return (
    <>
      <a className="skip-link" href="#demo">
        Skip to the demo
      </a>

      <header className="nav">
        <div className="container nav__inner">
          <a className="wordmark" href="#top" aria-label="Cerro Alto Coffee — top of page">
            <span className="wordmark__mark" aria-hidden="true">
              <MarkBean size={15} />
            </span>
            Cerro Alto
          </a>

          <nav className="nav__links" aria-label="Sections">
            <a href="#demo">Demo</a>
            <a href="#who">Who it&apos;s for</a>
            <a href="#how">How it works</a>
            <a href="#evidence">Evidence</a>
            <a href="#run">Run it</a>
          </nav>

          <a className="btn btn--primary btn--sm nav__cta" href="/case-study.html">
            Read the case study
          </a>

          <details className="nav__menu">
            <summary aria-label="Open menu">
              <IconMenu size={18} />
            </summary>
            <div className="nav__sheet">
              <a href="#demo">Demo</a>
              <a href="#who">Who it&apos;s for</a>
              <a href="#how">How it works</a>
              <a href="#evidence">Evidence</a>
              <a href="#run">Run it</a>
              <a href="#faq">FAQ</a>
              <a href="/case-study.html">Read the case study</a>
            </div>
          </details>
        </div>
      </header>

      <main id="top">
        {/* ── hero ─────────────────────────────────────────────────────── */}
        <section className="hero">
          <HeroMesh />

          <div className="container hero__head">
            <span className="eyebrow">support agent</span>
            <h1 className="h-display">
              Support answers a customer{' '}
              <br />
              can check for themselves
            </h1>
            <p className="lead">
              Cerro Alto’s agent answers from the store’s own help centre, looks the order up while
              you watch, and hands you to a person the moment the documents run out — instead of
              guessing.
            </p>
            <div className="btn-row">
              <a className="btn btn--primary" href="#demo">
                Try the demo
              </a>
              <a className="btn btn--ghost" href="/case-study.html">
                Read the case study
              </a>
            </div>
            <p className="hero__note">
              {live ? (
                <>
                  <b>Live</b> — real inference against claude-opus-5
                </>
              ) : (
                <>
                  <b>Fixture mode</b> — recorded turns, replayed at measured timings. No key set.
                </>
              )}
            </p>
          </div>

          <div className="container hero__stage" id="demo">
            <Widget live={live} />
          </div>
        </section>

        {/* ── stack strip ──────────────────────────────────────────────── */}
        <section className="section section--tight section--sunk">
          <div className="container">
            <p className="label" style={{ textAlign: 'center' }}>
              Built with
            </p>
            <div className="strip">
              {STACK.map((s) => (
                <span className="strip__item" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── the difference ───────────────────────────────────────────── */}
        <section className="section">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">the difference</span>
              <h2 className="h-section">
                Where guessing ends,{' '}
                <br />
                grounding begins
              </h2>
              <p className="lead">
                Three ways to answer a support question, and only one of them the customer can
                verify.
              </p>
            </div>

            <div className="grid grid--3 reveal">
              <div className="compare__col">
                <h3 className="compare__title">A generic chatbot</h3>
                <ul className="compare__list">
                  <li>
                    <span className="mark mark--no" aria-hidden="true">
                      <IconCross />
                    </span>
                    Invents a delivery window it has no source for
                  </li>
                  <li>
                    <span className="mark mark--no" aria-hidden="true">
                      <IconCross />
                    </span>
                    Cannot see the order, so it asks the customer to go and check
                  </li>
                  <li>
                    <span className="mark mark--no" aria-hidden="true">
                      <IconCross />
                    </span>
                    Promises a refund nobody authorised
                  </li>
                </ul>
              </div>

              <div className="compare__col">
                <h3 className="compare__title">Canned macros</h3>
                <ul className="compare__list">
                  <li>
                    <span className="mark mark--no" aria-hidden="true">
                      <IconCross />
                    </span>
                    Answer the question they were written for, not the one asked
                  </li>
                  <li>
                    <span className="mark mark--no" aria-hidden="true">
                      <IconCross />
                    </span>
                    Go stale the day the policy changes
                  </li>
                  <li>
                    <span className="mark mark--no" aria-hidden="true">
                      <IconCross />
                    </span>
                    Turn every edge case into a queue
                  </li>
                </ul>
              </div>

              <div className="compare__col compare__col--win">
                <h3 className="compare__title">This agent</h3>
                <ul className="compare__list">
                  <li>
                    <span className="mark mark--yes" aria-hidden="true">
                      <IconCheck />
                    </span>
                    Cites the document each claim came from
                  </li>
                  <li>
                    <span className="mark mark--yes" aria-hidden="true">
                      <IconCheck />
                    </span>
                    Reads the live order, and shows the call that read it
                  </li>
                  <li>
                    <span className="mark mark--yes" aria-hidden="true">
                      <IconCheck />
                    </span>
                    Escalates by rule when money or damage is involved
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── features ─────────────────────────────────────────────────── */}
        <section className="section section--sunk" id="features">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">what it does</span>
              <h2 className="h-section">
                Four parts, each of them{' '}
                <br />
                testable on its own
              </h2>
              <p className="lead">
                Retrieval, tools, escalation and citation are separate contracts with separate
                tests — so a regression in one is visible before it reaches a customer.
              </p>
            </div>

            <div className="grid grid--4 reveal">
              {FEATURES.map((f) => {
                const Icon = FEATURE_ICONS[f.icon];
                return (
                <article className="card card--lift" key={f.title}>
                  <span className={`tile ${f.tone}`}>
                    <Icon size={22} />
                  </span>
                  <h3 className="h-sub">{f.title}</h3>
                  <p className="body-muted" style={{ fontSize: 'var(--t-sm)' }}>
                    {f.body}
                  </p>
                  <p className="card__foot">{f.foot}</p>
                </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── use cases ────────────────────────────────────────────────── */}
        <section className="section" id="who">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">who it is for</span>
              <h2 className="h-section">
                Three people have to
                <br />
                live with this thing
              </h2>
              <p className="lead">
                The customer who asks, the lead who answers for the answer, and whoever inherits
                the code. Each of them needs something different from it.
              </p>
            </div>

            <div className="reveal">
              <UseCases />
            </div>
          </div>
        </section>

        {/* ── how it works ─────────────────────────────────────────────── */}
        <section className="section section--sunk" id="how">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">how it works</span>
              <h2 className="h-section">
                One turn, three decisions,{' '}
                <br />
                none of them hidden
              </h2>
              <p className="lead">
                The widget renders the agent’s actual state machine. Nothing in it is simulated —
                the spinner clears because a tool returned.
              </p>
            </div>

            <div className="reveal">
              {STEPS.map((s) => {
                const Icon = FEATURE_ICONS[s.icon];
                return (
                <div className="step" key={s.n}>
                  <div className="step__marker">
                    <Icon size={20} />
                    <span className="label">{s.n}</span>
                  </div>
                  <div className="step__body">
                    <h3 className="h-card">{s.title}</h3>
                    <p className="body-muted">{s.body}</p>
                    <code className="step__code">{s.code}</code>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── evidence ─────────────────────────────────────────────────── */}
        <section className="section" id="evidence">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">evidence</span>
              <h2 className="h-section">
                Measured offline,{' '}
                <br />
                printed with its command
              </h2>
              <p className="lead">
                Every figure below came from a command that runs on a clean clone with no keys and
                no network. The half that could not be measured is left blank on purpose.
              </p>
            </div>

            <div className="grid grid--4 reveal">
              {STATS.map((s) => (
                <div className="stat" key={s.note}>
                  <span className="stat__value">
                    <Counter value={s.value} suffix={s.suffix} decimals={s.decimals} />
                  </span>
                  <p className="stat__note">{s.note}</p>
                </div>
              ))}
            </div>

            <div className="grid grid--2 reveal" style={{ marginTop: 'var(--s-5)' }}>
              <div className="stat">
                <span className="stat__value stat__value--unmeasured">Not measured</span>
                <p className="stat__note">
                  Answer accuracy, both hard gates, latency and cost per conversation. They need a
                  live run against a key, which has not happened — so no number is given for them.
                </p>
              </div>
              <div className="stat">
                <span className="stat__value stat__value--unmeasured">Two failures, published</span>
                <p className="stat__note">
                  Both retrieval misses are written up in full in the report, including the one
                  where the relevance floor is confident and wrong. That case is why the citation
                  gate exists.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── connections ──────────────────────────────────────────────── */}
        <section className="section section--sunk" id="connects">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">what it is wired to</span>
              <h2 className="h-section">
                Eight moving parts,
                <br />
                all of them named
              </h2>
              <p className="lead">
                Nothing here is a black box you have to take on faith. Each piece is either an API
                with a contract or a file in the repository.
              </p>
            </div>

            <div className="grid grid--4 conns reveal">
              {CONNECTIONS.map((c) => {
                const Icon = FEATURE_ICONS[c.icon];
                return (
                  <div className="conn" key={c.name}>
                    <span className="conn__mark">
                      <Icon size={20} />
                    </span>
                    <span className="conn__name">{c.name}</span>
                    <span className="conn__role">{c.role}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── receipts ─────────────────────────────────────────────────── */}
        <section className="section">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">receipts</span>
              <h2 className="h-section">
                Three claims, and
                <br />
                where to check each
              </h2>
              <p className="lead">
                A page arguing that nothing should be claimed without a source does not get to run
                testimonials. These are the claims it makes, and the file each one lives in.
              </p>
            </div>

            <div className="grid grid--3 reveal">
              {RECEIPTS.map((r) => (
                <article className="card receipt" key={r.label}>
                  <span className="label">{r.label}</span>
                  <p className="receipt__claim">{r.claim}</p>
                  <p className="body-muted" style={{ fontSize: 'var(--t-sm)' }}>
                    {r.detail}
                  </p>
                  <code className="receipt__src">{r.source}</code>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── run it yourself ──────────────────────────────────────────── */}
        <section className="section section--sunk" id="run">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">run it yourself</span>
              <h2 className="h-section">
                What you can check
                <br />
                without asking me
              </h2>
              <p className="lead">
                One half of this project runs on a clean clone with no keys and no network. The
                other half needs keys and has not been run. Both are listed.
              </p>
            </div>

            <div className="reveal">
              <RunIt />
            </div>
          </div>
        </section>

        {/* ── examples ─────────────────────────────────────────────────── */}
        <section className="section" id="examples">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">examples</span>
              <h2 className="h-section">
                Three questions worth{' '}
                <br />
                trying in the widget
              </h2>
              <p className="lead">
                One answered from policy, one that calls a tool, one the agent refuses to answer.
                All three are reachable above without a key.
              </p>
            </div>

            <div className="grid grid--3 reveal">
              {EXAMPLES.map((e) => {
                const Icon = FEATURE_ICONS[e.icon];
                return (
                <article className="card card--lift" key={e.title}>
                  <div className="card__head">
                    <span className={`tile ${e.tone}`}>
                      <Icon size={22} />
                    </span>
                    <span className="label">{e.label}</span>
                  </div>
                  <h3 className="h-sub">{e.title}</h3>
                  <p className="body-muted" style={{ fontSize: 'var(--t-sm)' }}>
                    {e.body}
                  </p>
                  <div className="tag-row">
                    {e.tags.map((t) => (
                      <span className="tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="card__foot">{e.foot}</p>
                </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── faq ──────────────────────────────────────────────────────── */}
        <section className="section" id="faq">
          <div className="container">
            <div className="section__head reveal">
              <span className="eyebrow">faq</span>
              <h2 className="h-section">
                The questions that{' '}
                <br />
                come up first
              </h2>
            </div>

            <div className="faq reveal">
              {FAQ.map((item) => (
                <details className="faq__item" key={item.q}>
                  <summary className="faq__q">
                    {item.q}
                    <span className="faq__sign">
                      <IconPlus size={14} />
                    </span>
                  </summary>
                  <p className="faq__a">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── cta ──────────────────────────────────────────────────────── */}
        <section className="section cta">
          <div className="cta__grid" aria-hidden="true" />
          <div className="container">
            <div className="section__head" style={{ marginBottom: 0 }}>
              <span className="eyebrow">have a look</span>
              <h2 className="h-section">
                Ask it something{' '}
                <br />
                it should refuse
              </h2>
              <p className="lead">
                The interesting turn isn’t the one it answers. Try the refund over the approval
                limit, watch the handoff, then read how that rule is enforced.
              </p>
              <div className="btn-row">
                <a className="btn btn--primary" href="#demo">
                  Back to the demo
                </a>
                <a className="btn btn--ghost" href="/case-study.html">
                  Read the case study
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── footer ─────────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="container">
          <div className="footer__top">
            <div className="footer__blurb">
              <a className="wordmark" href="#top">
                <span className="wordmark__mark" aria-hidden="true">
                  <MarkBean size={15} />
                </span>
                Cerro Alto
              </a>
              <p className="body-muted">
                A demo DTC coffee store, built so the support agent had something real to be wrong
                about. The brand, catalogue, orders and policies are all synthetic — no real
                customer information appears anywhere.
              </p>
              <p className="body-muted" style={{ fontSize: 'var(--t-sm)' }}>
                Spec, plan and tool contracts are committed under{' '}
                <code className="mono">specs/</code>.
              </p>
            </div>

            <pre className="terminal">
              <span className="t-dim">$ env -i npm test</span>
              {'\n\n'}
              <span className="t-key">ℹ tests</span> 252{'\n'}
              <span className="t-key">ℹ pass</span> 251{'\n'}
              <span className="t-key">ℹ fail</span> 0{'\n'}
              <span className="t-key">ℹ skipped</span> 1{'\n\n'}
              <span className="t-dim">$ env -i npx tsx evals/run.ts --retrieval-only</span>
              {'\n\n'}
              14/16 cases retrieved every expected source (88%){'\n\n'}
              <span className="t-dim">$ npm run eval</span>
              {'\n'}
              <span className="t-dim">blocked — needs ANTHROPIC_API_KEY, so it was not run</span>
              {'\n'}
              <span className="t-dim">and no number is printed for it</span>
              {'\n\n'}
              status: <span className="t-ok">offline half reproducible ✓</span>
            </pre>
          </div>

          <div className="footer__cols">
            <div className="footer__col">
              <span className="label">Explore</span>
              <a href="#demo">The demo</a>
              <a href="#how">How it works</a>
              <a href="#evidence">Evidence</a>
              <a href="#examples">Examples</a>
            </div>
            <div className="footer__col">
              <span className="label">Read</span>
              <a href="/case-study.html">Case study</a>
              <a href="#faq">FAQ</a>
              <span>Eval report — evals/report.md</span>
              <span>Specs — specs/</span>
            </div>
            <div className="footer__col">
              <span className="label">Support hours</span>
              <span>Monday to Friday, 9–5 ET</span>
              <a href="mailto:support@cerroaltocoffee.example">support@cerroaltocoffee.example</a>
              <span>Demo store · synthetic data</span>
            </div>
          </div>

          <div className="footer__base">
            <span>© 2026 Cerro Alto Coffee — a portfolio demo. All data synthetic.</span>
            <span>Built spec-first · evaluated adversarially</span>
          </div>
        </div>
      </footer>
    </>
  );
}
