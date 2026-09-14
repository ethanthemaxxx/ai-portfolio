# AI engineering portfolio

Four projects on AI agents, retrieval, automation and AI product design, all built
around e-commerce. Each one has a live demo that needs no sign-up, and every number
on this page comes from a command you can run on a fresh clone, with no API keys and
no network.

**Wolfgang Betancourth** · AI Software Engineer · [LinkedIn](https://www.linkedin.com/in/wolfbc)

| # | Project | Live demo | The decision worth reading about |
|---|---|---|---|
| 01 | [UpRank](01-uprank-case-study/): a decision engine for choosing which jobs to bid on | [uprank-scorer.vercel.app](https://uprank-scorer.vercel.app) | The score is plain TypeScript you can audit; the LLM drafts proposals, never the decision |
| 02 | [AI support agent](02-support-agent/): RAG over store policies and live Shopify orders | [cerro-alto-support.vercel.app](https://cerro-alto-support.vercel.app) | Hybrid BM25 + vector retrieval, privacy enforced by types, escalation as a deterministic state machine |
| 03 | [Catalog pipeline](03-catalog-pipeline/): Shopify product copy that cannot invent facts | [catalog-copy-gate.vercel.app](https://catalog-copy-gate.vercel.app) | A fact gate that quarantines any claim it cannot trace to a field in the source data |
| 04 | [Agent Run Inspector](04-ai-ux-redesign/): UX for when the AI is confidently wrong | [agent-run-inspector.vercel.app](https://agent-run-inspector.vercel.app) | Confidence shown as verified / derived / assumed, and human approval before any irreversible step |

## Measured

| Project | Command | Result |
|---|---|---|
| 02 | `npm test` | 252 tests: 251 pass, 1 skipped (it needs an embeddings key and says so) |
| 02 | `npm run eval:offline` | 14 of 16 retrieval cases return every expected source; the 2 misses are analysed in `evals/report.md` |
| 03 | `npm test` | 123 tests, 0 failures; every hard rule has an adversarial test that plants a violation |
| 03 | `npm run run:en && npm run run:es` | 12 of 12 products publishable, 0 quarantined, in English and Spanish |

## Not measured, so not claimed

- **02:** end-to-end answer accuracy, latency and cost per conversation. Those need a
  live run with API keys, and the eval report says so instead of printing a number.
- **03:** the published outputs come from the deterministic offline generator. The
  Claude generation path is implemented and tested against test doubles, but it has
  not been run live.
- **01:** there is one user, so there are no adoption metrics, and the scoring
  weights have not been validated against outcomes.
- **04:** no usability testing has been run; the design reasoning is written as
  hypotheses a study would confirm or reject.

The live demos don't call a model: 02 runs in fixture mode and 03 uses the
deterministic generator, and each page says so. That keeps them free to run and
impossible to abuse, while the code they execute is the real code.

## Running the projects

Projects 02 and 03 need Node.js 22.6 or newer, because they use `node --test` with
type stripping.

```bash
cd 02-support-agent && npm install && npm test
cd 03-catalog-pipeline && npm install && npm test
cd 01-uprank-case-study/demo && npm install && npm run dev
```

Project 04 has no build step: open `04-ai-ux-redesign/prototype.html` in a browser.
Each folder's README covers the rest.

## Layout

```
00-brand-demo/         synthetic demo brand shared by 02 and 03: catalog, policies, orders
01-uprank-case-study/  case study, architecture notes, screenshots, and the scoring engine as a standalone demo
02-support-agent/      specs → src → evals, plus public/case-study.html
03-catalog-pipeline/   specs → src → output, plus n8n-workflow.json
04-ai-ux-redesign/     case study, design decisions, prototype.html, explorations.html
index.html             portfolio index page
```

## How it was built

Spec first: spec → plan → tasks → implementation, with the documents kept in the
`specs/` folders of 02 and 03. Before publishing, a separate read-only review re-ran
everything reproducible and checked every claim against the code; its findings were
fixed.

Cerro Alto Coffee is a fictional brand created for this portfolio, and all of its
data is synthetic.
