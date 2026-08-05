# Tasks — Catalog Enrichment Pipeline

**Phase 3 of 4.** Small tasks, each implementable and — the rule that makes this
work — **verifiable on its own**, before the next one exists. No code in this
document.

Every verification command is runnable from this directory and assumes
`env -i` (no keys, no network):

```
env -i "$(command -v node)" --test --experimental-strip-types 'src/**/*.test.ts'
```

Shorthand below: `TEST <file>` means run the suite restricted to that file.

---

## Group A — Foundations

### T01 · Project skeleton
`package.json` (type: module, no runtime deps, `test` + `run` scripts),
`tsconfig.json` (strict, ESM, `allowImportingTsExtensions`), `.gitignore`
(`node_modules/`, `._*`, `.DS_Store`, `.env*`).
**Verify:** `node --test` exits 0 with no test files; `.gitignore` contains `._*`.

### T02 · Shared types
`src/types.ts`: `Product`, `Variant`, `Attributes`, `Locale`, `FactEntry`,
`FactLedger`, `StyleGuide`, `GeneratedCopy`, `Violation`, `ProductResult`,
`RunReport`. Types only.
**Verify:** file loads under `--experimental-strip-types`; no runtime export.

### T03 · Catalog loader
`src/catalog.ts`: read the read-only source catalog, parse, validate shape,
return `Product[]`. Path is a parameter with a default pointing at
`../00-brand-demo/data/products.json`.
**Verify:** `TEST src/catalog.test.ts` — 12 products; all have empty `body_html`
and empty `seo`; loader throws on a malformed fixture; loader never opens the file
for writing.

---

## Group B — Voice extraction (spec §7, plan D1)

### T04 · Voice exemplars
`data/voice-exemplars.json`: 5 merchant-supplied descriptions for **past lots not
in the current catalog** (2 coffee, 1 equipment, 1 gift, 1 subscription), each
labeled synthetic. `src/brand/exemplars.ts` loads them.
**Verify:** `TEST src/brand/exemplars.test.ts` — exactly 5; none references a
handle present in the current catalog; none contains a banned word or an
exclamation mark (an exemplar that violates the brand's own rules would poison the
guide).

### T05 · Text metrics
`src/brand/metrics.ts`: sentence split, word count, syllable count,
Flesch–Kincaid grade, second-person marker count — all pure and locale-aware.
**Verify:** `TEST src/brand/metrics.test.ts` — known strings give known values;
FK grade of a fixed paragraph is stable; syllable counter handles `coffee`,
`espresso`, `Colombia`.

### T06 · Voice extractor
`src/brand/voice-extract.ts`: exemplars → `StyleGuide` with
`maxSentenceWords`, `meanSentenceWords`, `readingGradeMax` (English only),
`requiresSecondPerson`, `allowsExclamation: false`, `bodyParagraphRange`,
`openingMove`, `observedVocabulary`, plus the source metrics.
**Verify:** `TEST src/brand/voice-extract.test.ts` — running twice on the same
input gives byte-identical output; `maxSentenceWords` equals the longest sentence
actually present in the exemplars; feeding an exemplar set with a 40-word sentence
raises the derived ceiling (proving it is derived, not hard-coded).

### T07 · Brand facts
`src/brand/brand-facts.ts`: the operating facts from `brand.md` as structured data
(roast days, ship policy, cut-off, free-shipping threshold, flat rate, location,
support hours, subscription discount), each with a source label.
**Verify:** `TEST src/brand/brand-facts.test.ts` — every entry has a non-empty
`source`; no entry asserts a certification.

---

## Group C — The fact ledger (spec §7, plan D2)

### T08 · Ledger construction
`src/ledger/fact-ledger.ts`: `buildFactLedger(product, brandFacts)` → entries from
attributes, blurb, identity, variants, derived counts, brand facts. Each entry:
`id`, `source`, `label`, `value`, `surfaces[]`.
**Verify:** `TEST src/ledger/fact-ledger.test.ts` — Huila has an entry
`attributes.altitude_masl` with surfaces including `1750` and `1,750`; the gift
card (empty attributes) still yields entries from title/blurb/variants; no entry
has an empty `surfaces` array.

### T09 · Ledger text index
Same module: `ledgerText(ledger)` → the normalized concatenation used for lexical
backing, and `ledgerNumbers(ledger)` → the normalized numeric surface set.
**Verify:** same test file — `ledgerText` for Huila contains `washed`, `plum`,
`huila`; does **not** contain `natural`, `raspberry`, `organic`; `ledgerNumbers`
contains `1750`, `19`, `6.4`, `250`.

---

## Group D — The rule engine (spec §8)

### T10 · Normalization + lexicons
`src/validate/lexicon.ts`: NFD accent stripping, word-boundary matcher, the banned
list, the certification list (terms + phrases), the domain lexicon (~200 terms),
and the `en`/`es` locale packs.
**Verify:** `TEST src/validate/lexicon.test.ts` — `orgánico` normalizes to
`organico` and matches the Spanish certification term; `elevation` does **not**
match the banned word `elevated`; `unlocked` does not match `unlock` under
word-boundary matching, while `unlock the` does.

### T11 · Provenance checker (AC-06)
`src/validate/provenance.ts`: numeric grounding + lexical grounding, returning
violations with the offending token and its character offset.
**Verify:** `TEST src/validate/provenance.test.ts` — a sentence with `2,100
meters` against Huila's ledger fails with the token `2,100`; `1,750 meters`
passes; `notes of blueberry` fails; `notes of ripe plum` passes; `a Gesha lot`
fails; `$19` passes and `$21` fails.

### T12 · Rules AC-01…AC-05, AC-07
`src/validate/rules.ts`: banned words, certification, meta-title length,
meta-description range, alt-text shape, second person, exclamation marks. Each rule
is a named object with an id and a `check` function.
**Verify:** `TEST src/validate/rules.test.ts` — one passing and one failing case
per rule; the failing case's violation carries the rule id and a quoted span;
"Sustainably sourced from small farms" trips the certification rule; "Image of a
coffee bag" trips the alt rule; a 61-char title fails and a 60-char title passes;
139 and 161-char meta descriptions fail, 140 and 160 pass.

### T13 · Derived rules AC-08, AC-09
Same module, configured from the `StyleGuide`.
**Verify:** same test file — a sentence one word longer than
`styleGuide.maxSentenceWords` fails; passing a different style guide changes the
verdict on the identical text (proves the rule reads the guide); the grade rule is
skipped for `es` and reported as not-applicable rather than passing silently.

### T14 · Validator entry point
`validateCopy(copy, ledger, styleGuide, locale)` → `Violation[]` across all four
fields and all rules, ordered deterministically.
**Verify:** same test file — clean copy yields `[]`; copy with three distinct
violations yields exactly three, in rule-id order.

---

## Group E — Generation (plan D3, D4)

### T15 · Generator interface
`src/generate/types.ts`: `CopyGenerator { id, canRepair, generate(req) }`,
`GenerationRequest`, `GenerationResult`.
**Verify:** compiles; a two-line fake generator in a test satisfies the interface.

### T16 · Length-constrained assembler
`src/generate/compose.ts`: given ordered fragments and a `[min,max]` character
range, return the first deterministic combination in range, or a failure.
**Verify:** `TEST src/generate/compose.test.ts` — result length always in range or
result is a failure (checked over a table of fragment sets and ranges); identical
inputs give identical output across 100 repeats; an impossible range returns
failure rather than a truncated string.

### T17 · Offline generator, English
`src/generate/offline.ts`: per-product fragment sets built **only** from ledger
entries, assembled into body/meta-title/meta-description/alt.
**Verify:** `TEST src/generate/offline.test.ts` — for all 12 products the output
passes `validateCopy` with zero violations; output is byte-identical across two
runs; removing an attribute from a product removes the corresponding clause from
the output (proves the copy is data-driven, not hard-coded per handle).

### T18 · Offline generator, Spanish
Spanish fragment templates in the same module, selected by locale.
**Verify:** same test file — all 12 products pass under the `es` locale pack; the
Spanish output contains no `¡`; Spanish output for a product references the same
ledger ids as the English output for that product.

### T19 · Prompt builder
`src/generate/prompt.ts`: role-first system prompt, labeled context blocks, few-shot
with counterexamples, JSON schema for structured output.
**Verify:** `TEST src/generate/prompt.test.ts` — the rendered prompt contains every
ledger surface for the product and no fact outside the ledger; it contains at least
one labeled counterexample; the request object contains **no** `temperature`,
`top_p`, or `top_k` key and does not disable thinking; `model` is `claude-opus-5`.

### T20 · Anthropic generator over doubles
`src/generate/anthropic.ts`: adapter with an injectable client; dynamic optional
import for the real SDK.
**Verify:** `TEST src/generate/anthropic.test.ts` — with a fake client returning
valid JSON, `generate` returns parsed copy; with malformed JSON it throws a typed
error; the client receives exactly the parameters the prompt builder produced;
importing this module with no SDK installed does not throw.

---

## Group F — Pipeline (plan D7)

### T21 · Timing wrapper
`src/timing.ts`: monotonic stage timer producing `{stage, ms}[]` and a total.
**Verify:** `TEST src/timing.test.ts` — stage names and ordering are asserted;
**no assertion on any duration value**.

### T22 · Pipeline orchestration
`src/pipeline.ts`: for each product — ledger → generate → validate → bounded repair
→ publishable or quarantined; collects a `RunReport`.
**Verify:** `TEST src/pipeline.test.ts` — with a fake generator that always
violates, every product is quarantined and the publishable set is empty; with a
fake that violates once then succeeds, the repair loop is used exactly once and the
product is publishable; with `canRepair: false`, no second call is made; the report
counts add up to 12.

### T23 · Reports
`src/report/before-after.ts`, `src/report/validation-report.ts`,
`src/report/style-guide-md.ts`.
**Verify:** `TEST src/report/*.test.ts` — before/after contains exactly the 5
requested handles and shows an empty "before"; the validation report lists every
rule id including the ones that passed; a quarantined product appears in the report
with its violation quoted.

---

## Group G — Shopify (plan D8, D9, AC-11)

### T24 · Review queue
`src/shopify/review-queue.ts`: build the queue with `approved: false`, load an
edited queue, expose `approvedHandles`.
**Verify:** `TEST src/shopify/review-queue.test.ts` — a freshly built queue has
zero approvals; loading a hand-edited queue with unknown handles reports them
rather than ignoring them.

### T25 · Shopify client
`src/shopify/client.ts`: `productUpdate` + `fileUpdate` over an injectable
transport; typed errors on non-200 and on GraphQL `userErrors`.
**Verify:** `TEST src/shopify/client.test.ts` — a successful update issues one
POST with the expected mutation and variables; a `userErrors` response throws; the
Authorization header carries the token from the config object, never from a global.

### T26 · Push gate
`src/shopify/push.ts`: for each product — approved? valid *now*? → push, else skip
with a reason.
**Verify:** `TEST src/shopify/push.test.ts` — **zero transport calls** for an
unapproved product; **zero** for an approved product whose copy currently fails a
rule (and the skip reason names the rule); exactly the expected calls for an
approved, valid product; a run with no credentials configured throws before any
transport call.

---

## Group H — Delivery

### T27 · CLI
`src/cli/run.ts`: `--locale`, `--date`, `--out`, `--products`, `--generator`,
`--push`. Writes every artifact in `output/`.
**Verify:** run it for `en` and for `es`; assert the artifact set exists and that
`00-brand-demo/` mtimes are unchanged.

### T28 · n8n workflow
`n8n-workflow.json` + `src/n8n-workflow.test.ts`.
**Verify:** valid JSON; every node has `id`, `name`, `type`, `typeVersion`,
`position` (2 numbers); ids and names unique; every connection endpoint names an
existing node; no orphan nodes except the trigger; the HTTP node targeting the
Anthropic API sends `model: claude-opus-5` and no sampling parameters.

### T29 · Artifacts
`output/before-after.md`, `output/before-after-es.md`, enriched catalogs,
validation reports, style guide, `output/timing.json`, `output/review-queue.*`.
**Verify:** every file referenced by the README exists and is non-empty.

### T30 · README
Case study. **First line of the results section names the generator that produced
the published outputs.** Time metric: measured N from `timing.json`; reasoned M
with its derivation; explicit "not executed" statements for the Shopify push and
the n8n import.
**Verify:** read it against `spec.md` §10 and the honesty rules — every number in
it appears in an artifact under `output/`.

---

## Order and dependencies

```
T01 → T02 → T03
T02 → T04 → T05 → T06        (style guide)
T02 → T07 → T08 → T09        (ledger)
T06,T09 → T10 → T11 → T12 → T13 → T14   (gate)
T14 → T15 → T16 → T17 → T18  (offline generation)
T15 → T19 → T20              (model path, doubles only)
T14,T17 → T21 → T22 → T23    (pipeline + reports)
T14 → T24 → T25 → T26        (push gate)
T22,T23,T26 → T27 → T28 → T29 → T30
```

The gate (T10–T14) is built before any generator. That ordering is deliberate: the
generator is written against a validator that already exists and already fails
loudly, so "it passes" is a measurement rather than a hope.
