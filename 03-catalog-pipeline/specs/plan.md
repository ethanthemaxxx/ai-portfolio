# Plan — Catalog Enrichment Pipeline

**Phase 2 of 4.** *How* the spec gets built. Every decision here carries its
reason and, where a real alternative existed, the alternative that was rejected.
No new requirements appear in this document; if something here is not traceable to
`spec.md`, it is a bug in the plan.

---

## 1. Stack

| Choice | Reason | Rejected alternative |
|---|---|---|
| TypeScript, strict, ESM, explicit `.ts` extensions on relative imports | Matches the repo convention and runs on Node 24 with no build step | A bundler — nothing here needs bundling, and a build step is one more thing that can rot |
| Node's built-in test runner (`node --test --experimental-strip-types`) | Zero dependencies, so `env -i node --test …` genuinely works with no network and no install | Vitest/Jest — both would make AC-12 depend on `node_modules` being present |
| **Zero runtime dependencies** | The pipeline must run, and its tests must pass, on a clean machine with no network. Every dependency is a reason the demo doesn't run in front of a client | Using the Anthropic SDK as a hard dependency (see §6) |
| Plain JSON + Markdown artifacts | A merchant can open them; a reviewer can diff them | A database — 12 products |

## 2. Architecture

```
                      00-brand-demo/  (read-only)
                    ┌──────────────────────────────┐
                    │ products.json     brand.md   │
                    └───────┬───────────────┬──────┘
                            │               │
   data/voice-exemplars.json│               │
             │              │               │
             ▼              │               ▼
   ┌──────────────────┐     │      ┌─────────────────┐
   │ voice extraction │     │      │  brand facts    │
   │  (measured)      │     │      │  (operating)    │
   └────────┬─────────┘     │      └────────┬────────┘
            │               │               │
       StyleGuide           ▼               │
       (constraints)   ┌─────────┐          │
            │          │ product │◄─────────┘
            │          └────┬────┘
            │               ▼
            │        ┌─────────────┐
            │        │ FACT LEDGER │  ← every sayable fact, with its source path
            │        └──────┬──────┘
            │               │
            ├───────────────┤
            ▼               ▼
   ┌────────────────────────────────┐
   │  CopyGenerator (interface)     │
   │   ├── offline (deterministic)  │  composes from ledger, templates + assembler
   │   └── anthropic (claude-opus-5)│  prompt carries ledger; returns JSON + claims
   └───────────────┬────────────────┘
                   ▼
          ┌─────────────────┐        violations
          │   RULE ENGINE   │─────────────────────┐
          │  AC-01 … AC-09  │                     │
          └────────┬────────┘                     ▼
                   │ pass                   repair loop (bounded)
                   ▼                              │
          ┌─────────────────┐   fail after budget │
          │ publishable set │◄─────────────────────┘
          └────────┬────────┘        │
                   │                 ▼
                   │           quarantine + evidence
                   ▼
          ┌─────────────────┐   human edits approved:true
          │  review queue   │──────────────────────────┐
          └─────────────────┘                          ▼
                                              ┌──────────────────┐
     output/  enriched-*.json                 │  Shopify push    │
              before-after*.md                │  (revalidates)   │
              validation-report*.md           └──────────────────┘
              style-guide.*                        never executed
              timing.json                          against a real store
```

### 2.1 Module map

| Path | Responsibility |
|---|---|
| `src/types.ts` | Every shared type. No logic. |
| `src/brand/exemplars.ts` | Loads voice exemplars |
| `src/brand/voice-extract.ts` | Measures exemplars → `StyleGuide` (constraints, not adjectives) |
| `src/brand/brand-facts.ts` | The operating facts from `brand.md`, as ledger-ready data |
| `src/ledger/fact-ledger.ts` | Product + brand facts → `FactLedger` |
| `src/validate/lexicon.ts` | Banned words, certification terms, domain lexicon, locale packs |
| `src/validate/provenance.ts` | AC-06: numeric + lexical grounding |
| `src/validate/rules.ts` | AC-01…AC-09 as a rule list; returns violations with offsets |
| `src/generate/types.ts` | `CopyGenerator` interface + request/response shapes |
| `src/generate/compose.ts` | Length-constrained assembler (subset search) |
| `src/generate/offline.ts` | Deterministic generator: ledger + templates → copy |
| `src/generate/prompt.ts` | Prompt construction for the model path |
| `src/generate/anthropic.ts` | `claude-opus-5` generator over an injectable client |
| `src/pipeline.ts` | Orchestration, repair loop, timing, quarantine |
| `src/shopify/client.ts` | Admin GraphQL calls over an injectable transport |
| `src/shopify/review-queue.ts` | Human approval gate |
| `src/report/*.ts` | before/after, validation report, style-guide markdown |
| `src/cli/run.ts` | The entry point that produces everything in `output/` |

Tests live next to each module as `*.test.ts`.

## 3. Key decisions

### D1 — The style guide is *measured*, not written

**Decision.** The voice extractor computes numbers from the exemplars — sentence
length distribution, Flesch–Kincaid grade, second-person density, exclamation
count, paragraph shape, opening move (taste-first vs origin-first), observed
vocabulary — and emits a `StyleGuide` object whose fields are **the validator's
configuration**.

**Why this and not an LLM-written style guide.** A prose style guide ("warm,
plain-spoken, confident") cannot be enforced. A `maxSentenceWords: 22` derived
from the merchant's own copy can. Deriving the constraint from the merchant's
exemplars is also the answer to "why is this worth paying for": the pipeline is
calibrated to *their* voice, measurably, and the calibration is re-runnable when
their voice changes.

**Rejected.** Asking the model to summarize the voice and pasting that into the
prompt. It reads well and enforces nothing; two runs give two guides.

**Consequence.** AC-08 and AC-09 assert against derived values. If the merchant
supplies longer exemplars, the gate moves — which is correct, and is the behavior
the test pins.

### D2 — Fact ledger before generation, not fact-checking after

**Decision.** Build the ledger first; give the generator only the ledger; validate
the output against the ledger.

**Why.** Post-hoc fact-checking of free text needs a source of truth to check
against — which is the ledger. Building it first means the same object constrains
generation *and* verification, and the ledger is what gets shown to the reviewer.
It also makes the offline generator possible at all.

**Rejected.** Passing the raw product JSON to the model and checking the output
against the same JSON. It works for the model path and gives no leverage: no
enumerable claim set, no per-claim source path in the report, and no way to build
a deterministic generator.

### D3 — Two generator implementations behind one interface

**Decision.** `CopyGenerator` has exactly two implementations:
`OfflineTemplateGenerator` (deterministic, composes from the ledger) and
`AnthropicGenerator` (`claude-opus-5`). Both take the same request and return the
same shape. Both are validated by the identical rule engine.

**Why.** There is no `ANTHROPIC_API_KEY` in this environment. The honest options
were: (a) ship nothing, (b) hand-write copy and present it as model output, or (c)
build the pipeline so the generation step is swappable and ship it running on the
implementation that actually ran. (c) is the only one that survives a client
asking "did the model write this?".

**Consequence, stated in the README's first results line.** The published outputs
were produced by the offline generator. The model path is implemented and unit-
tested against doubles; it has **never** been executed against the live API.

**Rejected.** A "mock mode" that returns canned model-shaped strings. That is (b)
with extra steps.

### D4 — The offline generator is a constraint solver, not a template fill

**Decision.** Copy is assembled from a per-product list of short fact-bearing
fragments (each fragment already traceable, each already within the sentence-length
constraint) by a deterministic subset search that finds a combination landing in the
required character range. Meta description must land in 140–160; alt text in
40–125; meta title is greedy-truncated at part boundaries to ≤60.

**Why.** A fixed template cannot hit a 20-character window across 12 products with
wildly different fact densities (a gift card has 3 facts; a coffee has 15). Padding
to length is exactly where fabrication enters. The assembler either finds a
combination of *true* fragments that fits, or it reports failure — it never invents
a clause to reach 140.

**Rejected.** Generating long and truncating at 160. Truncation makes ungrammatical
copy and can cut a sentence into a claim the data doesn't support ("…grown at
1,7").

**Cost.** Subset search is 2^n; n is capped (fragments per surface ≤ 14) and the
enumeration is deterministic and ordered, so output is stable across runs.

### D5 — Provenance is checked two ways, both mechanical

**Decision.** AC-06 is enforced by two independent checks:

1. **Numeric grounding.** Every digit-bearing token in the output is normalized
   (strip `,` `$` `%`, unit suffixes `g/kg/oz/ml/l/m/c/f/ct`, trailing zeros) and
   must match a ledger surface.
2. **Lexical grounding.** A curated coffee-domain lexicon (~200 terms: processes,
   varietals, regions, roast levels, tasting notes, sourcing claims, materials). If
   a lexicon term appears in the output, it must appear in the ledger's own text.

**Why two.** Fabrications come in two shapes: wrong numbers ("2,100 meters" for a
1,750 m lot) and wrong words ("notes of blueberry" for a plum/brown-sugar coffee).
A single check catches one and misses the other.

**Rejected.** An LLM-as-judge fact checker. It needs a key (violating AC-12), it is
non-deterministic, and "the fact checker is also a model" is the exact objection a
buyer raises.

**Known hole.** Non-numeric, non-lexicon fabrications. Declared in `spec.md` §11.3
and mitigated by the human gate, not hidden.

### D6 — Locale is a rule pack, not a fork

**Decision.** `en` and `es` share the pipeline, the ledger, and the rule *engine*.
They differ only in a `LocalePack`: banned words, certification vocabulary, "image
of" prefixes, second-person markers, exclamation characters, and the fragment
templates. Text is matched accent- and case-insensitively (NFD, strip combining
marks) so `orgánico` and `organico` both trip AC-02.

**Why.** Fact traceability must be language-independent — the ledger is built from
data. Only the *surface* rules are language-dependent. Forking the pipeline per
language duplicates the gate, and duplicated gates drift.

**Consequence.** AC-09 (reading grade) is English-only, since Flesch–Kincaid is
English-calibrated; the Spanish pack sets it to `null` and the report says
"not applicable" rather than printing a meaningless grade.

### D7 — Fail closed, with a bounded repair loop

**Decision.** Generate → validate → if violations and repair budget remains, ask
the generator to repair with the violations attached → validate again → on
exhaustion, quarantine. Quarantined products emit no fields.

**Why.** The repair loop is a quality feature for the model path (a model *can* fix
"you used the word 'artisanal'"). The gate is a safety property and must not be
weakened by the loop: the last word always belongs to the validator.

**Consequence.** The offline generator declares `canRepair: false` — it is
deterministic, so a second identical call would produce the identical violation.
The pipeline respects that flag instead of burning the budget.

### D8 — Human review is a data gate, not a UI

**Decision.** The pipeline writes `output/review-queue.json` with
`approved: false` on every entry and a human-readable
`output/review-queue.md`. The push step reads the queue, and for each entry
**re-runs the full validation** before making any call. Unapproved → skipped.
Approved but failing → skipped, and reported as an override attempt.

**Why.** Approval and validity are different properties, and a human can approve
copy that a later rule change invalidates. Re-validating at push time means the
gate holds even if the queue is stale or hand-edited.

**Rejected.** Trusting the approval flag alone. It makes the review file a
security boundary, which a text file cannot be.

### D9 — Shopify: GraphQL Admin API over an injectable transport

**Decision.** `ShopifyClient` takes a `Transport` function (`(url, init) =>
Promise<{status, json}>`). Production would pass `fetch`; every test passes a
recording stub. Two mutations: `productUpdate` for `descriptionHtml` + `seo`, and
`fileUpdate` for image `alt`.

**Why injectable.** It makes AC-11 testable without network, and makes "we never
called a real store" a property of the test suite rather than a promise.

**Why GraphQL.** The REST Admin API is legacy for products; `productUpdate` is the
supported path and carries `seo` natively.

**Declared risk.** The API version string (`2026-07`) and the exact mutation shapes
are configuration, and were written from knowledge rather than verified against
live docs (no network in this environment). Before any real run, re-check the
version and both mutation signatures. This is stated in the README too.

### D10 — n8n mirrors the pipeline, and is validated as data

**Decision.** `n8n-workflow.json` expresses the same stages as importable n8n
nodes, using only core nodes (`manualTrigger`, `readWriteFile`, `code`, `if`,
`splitInBatches`, `httpRequest`, `wait`, `noOp`) so it imports on a stock instance
with no community packages. It is validated by a test that parses it and asserts
node/connection well-formedness.

**Why core nodes only.** A workflow that needs a community node fails to import on
the client's instance, which is the only place it matters.

**Declared limit.** The test proves the JSON is structurally valid and internally
consistent. It does **not** prove it runs — no n8n instance is available here. The
README says so.

### D11 — Time is injected, everywhere

**Decision.** No module calls `Date.now()` for logic or content. The anchor date
`2026-08-04` is a required parameter. The *only* clock read is
`performance.now()` inside the timing wrapper, and no test asserts on it.

**Why.** A suite that reads the wall clock rots. Also, dated copy in a catalog is a
liability: descriptions are cached by Shopify and by search engines, so roast dates
belong in a live PDP field, never in `body_html`.

## 4. Model configuration for the Anthropic path

Fixed by repo convention and by the API's current shape:

- `model: "claude-opus-5"`.
- **No `temperature`, `top_p`, or `top_k`** — these were removed on this model and
  sending them is a 400.
- Thinking is **not disabled**. Adaptive thinking is the default on this model; the
  latency lever is `output_config: { effort: "low" }`.
- Structured output via `output_config.format` with a JSON schema, so the response
  is parsed, not regex-scraped.
- The model is asked to return, alongside the copy, a `claims` array mapping each
  factual statement to the ledger id it came from. **This self-report is not
  trusted** — it is recorded in the report as the model's own account, while the
  independent provenance checker decides pass/fail.

Prompt construction follows the Zapier prompt-guide conventions used across this
portfolio: role first, then labeled context blocks (`<style_guide>`,
`<fact_ledger>`, `<rules>`), then the instruction, with few-shot examples that
include **counter**-examples (a fabricated-altitude sentence labeled as a
violation), and length given as a range.

## 5. Test strategy

| Level | What it covers |
|---|---|
| Unit | Each rule in isolation, on hand-written passing and failing strings |
| Adversarial | A planted-violation corpus: fabricated altitude, invented tasting note, invented varietal, wrong price, banned word, each certification near-miss, `!`, "Image of…", 61-char meta title, 139/161-char meta description |
| Property-ish | Assembler output length is always in range or the assembler reports failure — never out of range |
| Integration | Full pipeline over all 12 products, both locales, asserting every AC |
| Doubles | `AnthropicGenerator` against a fake client (success, malformed JSON, repair-on-second-call, violation-always); `ShopifyClient` against a stub transport (approved+valid → 2 calls; unapproved → 0; approved+invalid → 0) |
| Data | `n8n-workflow.json` structural validation |

Every test runs with `env -i`. No test asserts on a duration.

## 6. Dependency posture for the Anthropic path

`@anthropic-ai/sdk` is declared as an **optional** dependency and imported
dynamically, inside the adapter, at call time. The pipeline's types describe the
minimal client surface the adapter needs, so nothing in the repo fails to load when
the SDK is absent.

**Why.** AC-12 requires the suite to pass with no network and no install. A static
import of an uninstalled package breaks module loading for the whole suite.

**Rejected.** Hand-rolling HTTP against `api.anthropic.com`. It would remove the
optional dependency, and it would also mean maintaining request shapes by hand
against an API that changes — the SDK exists precisely to avoid that.

## 7. What could go wrong

| Risk | Mitigation |
|---|---|
| The assembler can't hit 140–160 for a sparse product (gift card) | Fragment sets include short brand-fact sentences; failure is a reported quarantine, never a padded lie |
| The domain lexicon flags a legitimate word | Backing is checked against the full ledger text, which includes the blurb and title; false positives surface as quarantines in the report, not as silent edits |
| Derived style constraints are too tight for the generator | Both are derived from the same exemplars the templates were written against; the integration test is the check |
| Someone runs the push with real credentials | The push requires an explicit `--push` flag, a shop domain, and a token; with none set it refuses and exits non-zero |
