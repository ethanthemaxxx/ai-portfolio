'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* The demo's whole argument is that the gate does not care who wrote the text.
 * So the copy fields are editable, and "Re-validate" runs the same rule engine
 * the test suite runs — the visitor is invited to try to beat it. */

type Locale = 'en' | 'es';

interface Violation {
  ruleId: string;
  field: string;
  message: string;
  evidence: string;
  offset: number;
}

interface Copy {
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  imageAlt: string;
  usedFactIds: string[];
}

interface RunResult {
  handle: string;
  title: string;
  locale: Locale;
  generator: string;
  styleGuideVersion: string;
  copy: Copy | null;
  violations: Violation[];
  status: 'publishable' | 'quarantined';
  ledger: Array<{ id: string; source: string; label: string; value: string }>;
  ms: number;
}

interface ProductRow {
  handle: string;
  title: string;
  kind: string;
  variants: number;
}

/** One-click ways to try to beat the gate. Each targets a specific rule. */
const ATTACKS: Array<{ label: string; hint: string; apply: (c: Copy) => Copy }> = [
  {
    label: 'Claim it is organic',
    hint: 'AC-02 — the brand holds no certification',
    apply: (c) => ({ ...c, bodyHtml: `${c.bodyHtml}\n<p>Certified organic and Fair Trade.</p>` }),
  },
  {
    label: 'Imply it, softly',
    hint: 'AC-02 — near-miss phrasing counts too',
    apply: (c) => ({ ...c, bodyHtml: `${c.bodyHtml}\n<p>Sustainably sourced and pesticide free.</p>` }),
  },
  {
    label: 'Invent a tasting note',
    hint: 'AC-06 — blueberry is not in the data',
    apply: (c) => ({ ...c, bodyHtml: `${c.bodyHtml}\n<p>You get blueberry and jasmine.</p>` }),
  },
  {
    label: 'Invent an altitude',
    hint: 'AC-06 — figures must trace to a field',
    apply: (c) => ({ ...c, bodyHtml: `${c.bodyHtml}\n<p>Grown at 2,100 meters above sea level.</p>` }),
  },
  {
    label: 'Add marketing filler',
    hint: 'AC-01 — banned brand words',
    apply: (c) => ({ ...c, bodyHtml: `${c.bodyHtml}\n<p>An artisanal, handcrafted journey.</p>` }),
  },
  {
    label: 'Get excited',
    hint: 'AC-07 — no exclamation marks',
    apply: (c) => ({ ...c, bodyHtml: `${c.bodyHtml}\n<p>You will love this coffee!</p>` }),
  },
  {
    label: 'Overrun the meta title',
    hint: 'AC-03 — 60 characters, exactly',
    apply: (c) => ({ ...c, metaTitle: `${c.metaTitle} — Single Origin Specialty Coffee Roasted To Order` }),
  },
  {
    label: 'Announce the image',
    hint: 'AC-05 — alt text describes, never announces',
    apply: (c) => ({ ...c, imageAlt: `Image of ${c.imageAlt}` }),
  },
];

const FIELD_LABEL: Record<string, string> = {
  bodyHtml: 'description',
  metaTitle: 'meta title',
  metaDescription: 'meta description',
  imageAlt: 'image alt text',
};

/* Rules report as sub-ids (AC-06a, AC-08b), so look up on the base id. */
const RULE_LABEL: Record<string, string> = {
  'AC-01': 'Banned brand word',
  'AC-02': 'Certification stated or implied',
  'AC-03': 'Meta title over 60 characters',
  'AC-04': 'Meta description outside 140–160',
  'AC-05': 'Alt text does not describe',
  'AC-06': 'Claim not traceable to the source data',
  'AC-07': 'Voice: second person, no exclamation marks',
  'AC-08': 'Sentence or paragraph shape off the brand',
  'AC-09': 'Reading grade above the brand ceiling',
  GEN: 'Generator failure',
};

function ruleLabel(id: string): string {
  return RULE_LABEL[id] ?? RULE_LABEL[id.replace(/[a-z]$/, '')] ?? '';
}

export default function Page() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [handle, setHandle] = useState('huila-reserve');
  const [locale, setLocale] = useState<Locale>('en');
  const [run, setRun] = useState<RunResult | null>(null);
  const [copy, setCopy] = useState<Copy | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [status, setStatus] = useState<'publishable' | 'quarantined' | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verdictRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/run')
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setError('Could not load the catalog.'));
  }, []);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle, locale }),
      });
      const d: RunResult = await res.json();
      if (!res.ok) throw new Error('generation failed');
      setRun(d);
      setCopy(d.copy);
      setViolations(d.violations);
      setStatus(d.status);
      setMs(d.ms);
      setEdited(false);
    } catch {
      setError('That run failed. Try another product.');
    } finally {
      setBusy(false);
    }
  }, [handle, locale]);

  useEffect(() => {
    void generate();
  }, [generate]);

  const revalidate = useCallback(async () => {
    if (!copy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle, locale, ...copy }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error();
      setViolations(d.violations);
      setStatus(d.status);
      setMs(d.ms);
      verdictRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch {
      setError('Validation failed.');
    } finally {
      setBusy(false);
    }
  }, [copy, handle, locale]);

  const patch = (next: Partial<Copy>) => {
    setCopy((c) => (c ? { ...c, ...next } : c));
    setEdited(true);
  };

  const attack = (fn: (c: Copy) => Copy) => {
    setCopy((c) => (c ? fn(c) : c));
    setEdited(true);
  };

  const titleLen = copy?.metaTitle.length ?? 0;
  const descLen = copy?.metaDescription.length ?? 0;

  return (
    <>
      <div className="banner">
        <b>Live demo — deliberately runs without an API key.</b> Copy is produced by the
        project&apos;s deterministic generator, not by a language model, so this page costs
        nothing to run and behaves identically for everyone. The part worth testing is the{' '}
        <b>gate</b>: every factual claim has to trace back to the product data. Cerro Alto
        Coffee is a fictional brand and all data is synthetic.
      </div>

      <div className="wrap">
        <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="eyebrow">Portfolio piece · Catalogue automation · Shopify / DTC</p>
          <h1>Try to sneak a fabrication past the gate.</h1>
          <p className="lede">
            Pick a product. The pipeline writes its description, meta title, meta description
            and image alt text from the catalogue record — then checks its own output against
            eleven rules. Now edit the text yourself, or use a preset below, and re-validate.
            The gate does not care who wrote the words.
          </p>
        </header>

        <div className="bar">
          <div className="fieldset fieldset--grow">
            <label htmlFor="product">Product</label>
            <select
              id="product"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={busy}
            >
              {products.map((p) => (
                <option key={p.handle} value={p.handle}>
                  {p.title}
                  {p.kind === 'equipment' ? ' · equipment' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="fieldset">
            <label htmlFor="loc">Language</label>
            <div className="seg" id="loc">
              {(['en', 'es'] as Locale[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={locale === l}
                  onClick={() => setLocale(l)}
                  disabled={busy}
                >
                  {l === 'en' ? 'English' : 'Español'}
                </button>
              ))}
            </div>
          </div>

          <button className="primary" onClick={generate} disabled={busy}>
            {busy ? <span className="spin" aria-hidden /> : null} Regenerate
          </button>
        </div>

        {error ? <p className="note" style={{ color: 'var(--fail)' }}>{error}</p> : null}

        <div className="cols">
          {/* ------------------------------------------------ generated copy */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <h2>{run?.title ?? 'Loading…'}</h2>
              <span className="eyebrow">{edited ? 'edited by you' : run?.generator ?? ''}</span>
            </div>

            <div className="fieldrow">
              <div className="fieldhead">
                <h3>Description</h3>
              </div>
              <textarea
                rows={9}
                value={copy?.bodyHtml ?? ''}
                onChange={(e) => patch({ bodyHtml: e.target.value })}
                spellCheck={false}
                aria-label="Product description"
              />
            </div>

            <div className="fieldrow">
              <div className="fieldhead">
                <h3>Meta title</h3>
                <span className="count" data-over={titleLen > 60}>
                  {titleLen} / 60 max
                </span>
              </div>
              <textarea
                rows={2}
                value={copy?.metaTitle ?? ''}
                onChange={(e) => patch({ metaTitle: e.target.value })}
                spellCheck={false}
                aria-label="Meta title"
              />
            </div>

            <div className="fieldrow">
              <div className="fieldhead">
                <h3>Meta description</h3>
                <span className="count" data-over={descLen < 140 || descLen > 160}>
                  {descLen} / 140–160
                </span>
              </div>
              <textarea
                rows={3}
                value={copy?.metaDescription ?? ''}
                onChange={(e) => patch({ metaDescription: e.target.value })}
                spellCheck={false}
                aria-label="Meta description"
              />
            </div>

            <div className="fieldrow">
              <div className="fieldhead">
                <h3>Image alt text</h3>
                <span className="count" data-over={false}>
                  {copy?.imageAlt.length ?? 0} chars
                </span>
              </div>
              <textarea
                rows={2}
                value={copy?.imageAlt ?? ''}
                onChange={(e) => patch({ imageAlt: e.target.value })}
                spellCheck={false}
                aria-label="Image alt text"
              />
            </div>

            <div className="fieldrow">
              <h3>One-click attacks</h3>
              <div className="attacks">
                {ATTACKS.map((a) => (
                  <button key={a.label} className="ghost" title={a.hint} onClick={() => attack(a.apply)}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="primary" onClick={revalidate} disabled={busy || !copy}>
              {busy ? <span className="spin" aria-hidden /> : null} Re-validate
            </button>
          </div>

          {/* ----------------------------------------------------- verdict */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <div ref={verdictRef} className={`verdict ${status === 'publishable' ? 'pass' : 'fail'}`}>
                <span className="dot" aria-hidden />
                {status === 'publishable' ? 'Publishable' : 'Quarantined'}
                <small>
                  {violations.length} violation{violations.length === 1 ? '' : 's'}
                  {ms !== null ? ` · ${ms} ms` : ''}
                </small>
              </div>

              {status === 'publishable' ? (
                <p className="note">
                  Every rule passed and every factual claim traced to a field in the product
                  record. In the full pipeline this is what reaches a human for review before
                  anything is pushed to Shopify — the gate clears it, a person still signs it off.
                </p>
              ) : (
                <p className="note">
                  The product is held back. In the full pipeline a quarantined product publishes{' '}
                  <b>nothing</b> — not a partial record, not a best-effort description. Failing
                  closed is the point.
                </p>
              )}

              {violations.map((v, i) => (
                <div className="viol" key={`${v.ruleId}-${v.field}-${v.offset}-${i}`}>
                  <div className="top">
                    <code className="rule">{v.ruleId}</code>
                    <span className="where">{FIELD_LABEL[v.field] ?? v.field}</span>
                    <span className="where">{ruleLabel(v.ruleId)}</span>
                  </div>
                  <p className="msg">{v.message}</p>
                  {v.evidence ? <div className="ev">{v.evidence}</div> : null}
                </div>
              ))}
            </div>

            <div className="card">
              <h3>The fact ledger — everything this product may claim</h3>
              <p className="note">
                {run?.ledger.length ?? 0} entries. If a statement in the copy cannot be traced
                to one of these, rule AC-06 fails it. This is what stops a model from writing a
                plausible altitude.
              </p>
              <div className="ledger">
                {run?.ledger.map((e) => (
                  <div className="row" key={e.id}>
                    <code>{e.source}</code>
                    <span className="val">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="foot">
          <p>
            <b>What is real here:</b> the generator, the fact ledger and all eleven rules are
            the same modules the project&apos;s 123 tests run against, imported directly — not a
            reimplementation for the web. Style constraints are derived from five of the
            brand&apos;s own descriptions, so the rules are measured from its voice rather than
            invented.
          </p>
          <p>
            <b>What is not:</b> no language model is called on this page, and no data is stored
            — reload and it is gone. Anchor date is fixed at 2026-08-04 so the run never depends
            on the clock. The known limits, including the ones the gate does not catch, are
            listed in the project README.
          </p>
        </div>
      </div>
    </>
  );
}
