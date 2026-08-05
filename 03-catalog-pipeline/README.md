# Catalog Automation — 12 products enriched in 0.002 minutes measured, vs. ~6 hours by hand (estimated, method below)

A catalog enrichment pipeline for **Cerro Alto Coffee**, a fictional demo brand. It
turns 12 product records with empty descriptions into publish-ready copy —
description, meta title, meta description, image alt text — in English and
Spanish, and **blocks anything it cannot trace back to the source data**.

The generation is the easy part. The gate is the product.

---

## Results

> **The published outputs in `output/` were produced by the offline deterministic
> generator (`offline-template-v1`), not by a language model.** There is no
> `ANTHROPIC_API_KEY` in this environment. The `claude-opus-5` path is implemented,
> prompt-engineered and unit-tested against doubles, and has **never been executed
> against the live API**. Both generators sit behind one interface and are judged by
> the identical rule engine — see [Which implementation wrote this](#which-implementation-wrote-this).

| | |
|---|---|
| Products enriched | **12 of 12**, 0 quarantined |
| Locales | English + Spanish, same pipeline, same gate |
| Hard rules enforced | 11 rules / 12 violation codes, all green — [validation-report.md](output/validation-report.md) |
| Facts in the ledger | 246 across 12 products; 110 cited in the published copy |
| Tests | **123 passing**, `env -i` — no API key, no network |
| Measured run | **~110 ms** (0.002 min) end to end, offline generator — exact figures in [timing.json](output/timing.json) |
| Shopify pushes made | **0.** Implemented, tested with a stub transport, never executed |

**Read this first:** [output/before-after.md](output/before-after.md) — five products
side by side, with the source path of every fact used.

---

## What it does

1. **Extracts the brand voice — measurably.** Feed it five descriptions the merchant
   already likes. It returns a style guide of *numbers*: longest sentence 18 words,
   reading grade ≤ 8, 3–4 paragraphs, second person required, exclamation marks
   forbidden. Those numbers are wired straight into the validator.
   → [output/style-guide.md](output/style-guide.md)
2. **Builds a fact ledger per product** — every sayable fact with its source path.
3. **Generates** description + meta title + meta description + alt text.
4. **Validates** against 11 hard rules and quarantines anything that fails.
5. **Queues for human review**, then pushes to Shopify — only for products a person
   approved *and* that still pass validation at push time.

The same pipeline is also exported as an importable n8n workflow:
[`n8n-workflow.json`](n8n-workflow.json).

---

## The hard rules

These are the deliverable. Each is an acceptance criterion in
[`specs/spec.md`](specs/spec.md) with a test that plants a violation and asserts it
is caught — a gate that has never been shown to fire is not a gate.

| Rule | What it enforces | Where the adversarial test lives |
|---|---|---|
| `AC-01` | None of the brand's banned words (*artisanal, curated, elevated, journey, passion, handcrafted, liquid gold, exquisite, unlock*) | `src/validate/rules.test.ts` |
| `AC-02` | **No certification stated or implied.** Cerro Alto holds none. Eight near-miss phrasings tested in English, three in Spanish | `src/validate/rules.test.ts` |
| `AC-03` | Meta title ≤ 60 characters (60 passes, 61 fails) | `src/validate/rules.test.ts` |
| `AC-04` | Meta description 140–160 characters (139 and 161 fail, 140 and 160 pass) | `src/validate/rules.test.ts` |
| `AC-05` | Alt text is descriptive, names the product, and never says "image of" | `src/validate/rules.test.ts` |
| `AC-06a` | Every figure in the copy exists in the fact ledger | `src/validate/provenance.test.ts` |
| `AC-06b` | Every coffee-domain claim is backed by the ledger | `src/validate/provenance.test.ts` |
| `AC-07a` | No exclamation marks anywhere (`!` and `¡`) | `src/validate/rules.test.ts` |
| `AC-07b` | Second person in the body and the meta description | `src/validate/rules.test.ts` |
| `AC-08a/b` | Sentence length and paragraph shape, **derived from the merchant's own copy** | `src/validate/rules.test.ts` |
| `AC-09` | Reading grade ≤ the derived ceiling (English; skipped for Spanish, see limits) | `src/validate/rules.test.ts` |

`AC-02` is the one that would end a client relationship. "Organic", "Fair Trade" and
"carbon neutral" are regulated claims, and Cerro Alto holds none of them — so the
rule also catches the phrasings that imply a certification without naming one
("sustainably sourced", "ethically sourced", "pesticide free", and their Spanish
equivalents).

---

## The part that is actually hard: the fact ledger

Before any copy exists, the pipeline enumerates everything that may be said about a
product, each with its source path. Nothing outside that list can appear in the
output — not even when it is true.

For Huila Reserve the ledger holds 28 entries. Here are four:

```
huila-reserve:attributes.altitude_masl   Altitude: 1750   surfaces: "1750", "1,750"
huila-reserve:attributes.process         Process: Washed
huila-reserve:attributes.tasting_notes[0] Tasting note: ripe plum
brand.roast_days                          Roasting days: Monday and Thursday
```

Two independent mechanical checks then verify the output against it:

- **Numeric grounding.** Every digit-bearing token is normalized (`1,750` → `1750`,
  `$6.50` → `6.5`, `250g` → `250`) and must match a ledger value. Write "2,100
  meters" for a 1,750 m lot and the product is quarantined.
- **Lexical grounding.** A 201-term coffee vocabulary (plus 47 alias forms) — processes, varietals,
  regions, roast levels, tasting notes, sourcing claims, materials. If "blueberry"
  or "Gesha" or "smallholder" appears and the ledger does not back it, the product
  is quarantined.

Morphology is handled rather than punished: "Colombian" is backed by an origin of
"Colombia", and the Spanish "ciruela" is backed by a tasting note of "plum" — a
translation asserts the same fact, so it resolves to the same ledger entry. That is
also how the Spanish run is held to the same standard as the English one instead of
being waved through.

**The ceramic mug proves the rule works.** Its data says `"Thick walled, dishwasher
safe"` and nothing about the material. So the pipeline will not call it ceramic,
even though the product is named "Cerro Alto Mug" and it obviously is.
`src/validate/provenance.test.ts` pins that behaviour.

---

## Which implementation wrote this

The generation step is an interface with two implementations:

| | `offline-template-v1` | `anthropic-claude-opus-5` |
|---|---|---|
| What it does | Composes copy from ledger entries using a length-constrained assembler | Sends the ledger and the style guide to `claude-opus-5`, structured output |
| Ran here? | **Yes — it produced everything in `output/`** | **No. Never called the API.** |
| Tested | Full pipeline, 12 products × 2 locales, every rule green | 10 tests against fake clients: parsing, malformed JSON, refusal, repair loop, request shape |
| Can repair | No (deterministic — a retry reproduces the same violation, and the pipeline knows not to waste the budget) | Yes (violations are fed back, bounded) |

The offline generator does not template-fill. Meta descriptions have to land in a
20-character window, and padding to length is exactly where fabrication enters — so
it does a deterministic subset search over short, individually-true fragments and
takes the first combination that lands in range. If no combination fits, it reports
failure. It never invents a clause to reach 140 characters.

The model path's prompt carries the ledger with source paths, the measured style
guide, and four few-shot examples — three of which are **counter**-examples labelled
with why they fail. It asks the model to return a `claims` array mapping each
statement to the fact id it came from. That self-report is recorded in the run
report and **not trusted**: the provenance checker decides pass or fail
independently.

---

## What is generated and what is not

Being precise about this matters more than the demo looking impressive.

| Artifact | Origin |
|---|---|
| Descriptions, meta titles, meta descriptions, alt text | **Generated** by `offline-template-v1` from the fact ledger |
| The style guide numbers | **Computed** from the exemplars by `src/brand/voice-extract.ts` |
| `data/voice-exemplars.json` (5 descriptions) | **Input, hand-written for this project.** They stand in for "copy the merchant already likes", and describe past lots that are *not* in the catalog, so no product is enriched from copy that already existed for it |
| `data/blurbs-es.json` (12 Spanish blurbs) | **Input, hand-written.** Spanish versions of the merchant's own `short_blurb`, of the kind a client's translator signs off once. They pass the same fact gate |
| Product data | `00-brand-demo/data/products.json`, **read-only, never written** |

---

## The time metric

### N is measured

**~110 ms** end to end for 12 products — **0.002 minutes** — timed inside the run
with a monotonic clock and written to [output/timing.json](output/timing.json). The
exact figure varies by a few milliseconds per run, so this README deliberately does
not quote decimals: the committed `timing.json` holds the numbers for the committed
run (total and per stage — ledger, generation, validation), and regenerating the
outputs regenerates them together.

Two honest caveats:

1. That number belongs to the **offline generator**. The `claude-opus-5` path was
   never run, so its wall-clock is **not measured** and is not reported here. With a
   model in the loop the run is dominated by API latency, not by this code.
2. 0.002 minutes is a *machine* number and it is not the interesting one. The
   interesting one is the comparison below.

### M is reasoned, and it is an assumption, not a measurement

**Nobody was timed writing this copy by hand.** What follows is a decomposed
estimate so that you can replace any line of it with your own number, not a
benchmark dressed up as one.

Per product, writing all four surfaces to this brand's standard:

| Step | Minutes |
|---|---|
| Read the lot data and decide what is worth saying | 4 |
| Draft the description | 10 |
| Meta title ≤ 60 chars, meta description into the 140–160 window | 6 |
| Image alt text | 2 |
| Fact-check every claim against the source data | 3 |
| Editing pass for voice consistency | 5 |
| **Per product** | **30** |
| **× 12 products** | **360 min ≈ 6 hours** |

**Source of the assumption:** the builder's own estimate for this specific brief,
not an industry benchmark and not a stopwatch. The line most worth arguing with is
the 6 minutes for the meta fields — hitting a 20-character window by hand is
genuinely fiddly, which is why the pipeline solves it as a constraint problem rather
than a writing one.

**To turn it into a measurement:** time yourself writing one product by hand, then
multiply by 12. That number, whatever it is, is worth more than this table.

What *is* measured, and is arguably the better claim: **12 products, 4 surfaces
each, 110 fact citations, 11 rules verified per product — with zero unverified
statements, and evidence for every one.** Doing that by hand at all, at any speed,
is the part people do not actually do.

---

## What was not executed

Stated plainly because a portfolio that hides this is worth less than one that
doesn't:

- **No Shopify call was ever made.** The Admin GraphQL client takes an injected
  transport; every test passes a stub. `src/shopify/push.test.ts` asserts **zero**
  transport calls for an unapproved product and **zero** for an approved product
  whose copy fails validation at push time. Before a real run, re-check the API
  version (`2026-07`) and both mutation shapes against current Shopify docs — they
  were written from knowledge, not verified against a live schema.
- **`n8n-workflow.json` was never imported into a running n8n.** No instance is
  available here. `src/n8n-workflow.test.ts` proves it is valid JSON, that every
  node carries `id`/`name`/`type`/`typeVersion`/`position`/`parameters`, that ids and
  names are unique, that every connection points at a node that exists, that there
  are no orphans, and that it uses only core `n8n-nodes-base.*` nodes so it imports
  on a stock instance. "Imports and runs" is asserted only as far as "is a
  well-formed importable document".
- **The `claude-opus-5` path never called the API.** See above.

---

## Running it

```bash
node --test --experimental-strip-types "src/**/*.test.ts"     # 123 tests, no network needed
npm run run:en                                                 # writes output/*.md, *.json
npm run run:es                                                 # the Spanish run
```

Zero runtime dependencies. The suite passes under `env -i` — no API key, no network,
no `node_modules`. That is a deliberate constraint: a demo that needs an install to
run is a demo that does not run in front of a client.

```bash
env -i "$(command -v node)" --test --experimental-strip-types "src/**/*.test.ts"
```

---

## Repo map

```
specs/spec.md        phase 1 — what and why, 12 acceptance criteria, declared limits
specs/plan.md        phase 2 — how, 11 decisions each with the alternative rejected
specs/tasks.md       phase 3 — 30 tasks, each verifiable on its own
src/brand/           voice extraction: text metrics → measured style guide
src/ledger/          the fact ledger
src/validate/        the gate: lexicons, provenance, rules
src/generate/        interface + offline generator + prompt + claude-opus-5 adapter
src/shopify/         review queue, Admin API client, push gate
src/report/          before/after, validation report, style guide markdown
src/cli/run.ts       the entry point
n8n-workflow.json    the same pipeline as an importable n8n workflow
output/              everything the run produced
```

The gate (`src/validate/`) was built **before** any generator existed. That ordering
is why "it passes" is a measurement rather than a hope.

---

## Known limitations

Declared in [`specs/spec.md`](specs/spec.md) §11 and repeated here:

1. **Numeric checking covers digits only.** A model writing "three sizes" would not
   be checked, because a general spelled-numeral check false-positives on ordinary
   prose. The offline generator emits digits for every quantitative claim; a model
   might not. Real hole, stated rather than hidden.
2. **Reading grade is English-only.** Flesch–Kincaid is English-calibrated. The
   Spanish run enforces sentence length and skips the grade gate rather than
   printing a meaningless number.
3. **The domain lexicon is finite.** A fabrication that uses no lexicon term and no
   digits — "our most popular bag" — is caught by neither automated check. It is
   caught by the human review gate, which is why the review gate is not optional.
4. **The banned-word match is exact-word, accent-normalized.** "Artisanal" and
   "hand crafted" are caught; morphological variants like "artisanally",
   "passionate" or hyphenated "hand-crafted" are not, and fall to the human review
   gate. Widening the list is cheap; this states the boundary as shipped.
5. **Type checking was run with a `tsc` borrowed from a sibling project** in this
   repo, since there is no network here to `npm install` one. It passes clean.

---

## Data

All data is synthetic. Cerro Alto Coffee is a fictional brand created as a sandbox
for portfolio work. No customer data appears anywhere in this project, and the
pipeline reads only the product catalog and the brand brief.
