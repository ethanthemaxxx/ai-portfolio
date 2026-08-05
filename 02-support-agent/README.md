# Cerro Alto support agent

A RAG support agent for a demo DTC coffee store: answers grounded in the store's
own policy documents, live order lookup through the Shopify Admin API, and
deterministic escalation to a human. Built spec-first — the spec, plan and task
documents that produced this code are in [`specs/`](specs/).

**Case study:** [`public/case-study.html`](public/case-study.html) ·
**Eval report:** [`evals/report.md`](evals/report.md)

## Run it

Everything below works on a clean clone with **no API keys and no network**:

```bash
npm install
npm test                                  # 252 tests, 251 pass, 1 skipped
npx tsx evals/run.ts --retrieval-only     # retrieval evals: 14/16
npx tsx src/retrieval/sweep-topk.ts       # the top-k table from the case study
npm run dev                               # the widget, in fixture mode
```

With no `ANTHROPIC_API_KEY` the widget runs in **fixture mode** — scripted turns
with realistic timing, declared in the UI. That is the mode the public demo runs
in, on purpose: it works, you can click it, and it spends nothing.

The end-to-end evals need keys and are the one thing not run here:

```bash
export ANTHROPIC_API_KEY=...
export VOYAGE_API_KEY=...       # or OPENAI_API_KEY
npm run ingest && npm run eval
```

## Layout

```
specs/     spec → plan → tasks → tool contracts   ← start here to see the method
src/       ingest · retrieval · tools · escalation · agent · app
evals/     dataset (20 cases) → runner → grader → report.md
data/      the committed index — what makes the clone runnable
public/    the case study page, served at /case-study.html
```

All data is synthetic. The brand, catalogue, orders and policies were built for
this project; no real customer information appears anywhere.
