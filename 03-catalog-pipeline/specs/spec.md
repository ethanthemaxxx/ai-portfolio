# Spec — Catalog Enrichment Pipeline

**Phase 1 of 4.** This document states *what* is being built and *why*, and defines
the acceptance criteria. It contains no stack choices, no library names, and no
code. Those belong in `plan.md` (phase 2).

Anchor date for every dated artifact and test: **2026-08-04**. The system never
reads the wall clock; the date is injected.

---

## 1. Problem

Cerro Alto Coffee (a fictional demo brand — see `../00-brand-demo/brand.md`) has a
12-product Shopify catalog. Every product has a title, a merchant-written
`short_blurb`, structured `attributes`, and variants. Every product has an **empty
`body_html` and empty `seo` object**.

Someone has to write, for each product: a description, a meta title, a meta
description, and image alt text. Doing that by hand is slow. Doing it with a
generic "write me a product description" prompt is fast and produces copy that is
off-voice, over-claims, and — the expensive failure — **invents facts about the
coffee**.

Invented facts in a coffee catalog are not a style problem. "Organic," "Fair
Trade," and "carbon neutral" are regulated claims. Cerro Alto holds **no
certifications at all**. A single generated sentence implying one is a legal and
trust liability that outlives the copy.

## 2. What this system is

A pipeline that turns structured product records into publish-ready catalog copy,
where **every factual statement in the output is traceable to a field in the
input**, and where copy that cannot be traced is *blocked*, not published.

The selling point is not the generation. It is the gate.

## 3. Non-goals

- Not a general copywriting tool. It writes for one brand, from one style guide.
- Not variant-level copy. The catalog is 12 products / 75 SKUs; variants share the
  parent description. Variant data is used as *evidence*, not as a copy surface.
- Not an image generator. Alt text describes an image that the merchant supplies.
- Not a Shopify theme, app, or storefront change. It writes to the Admin API only.
- Not a scheduler. One-shot CLI run; orchestration is shown separately as an n8n
  workflow.

## 4. Users and journeys

### J1 — The merchant, first run
Has a catalog with empty descriptions and five older descriptions they like.
Wants copy in their own voice, not a model's voice.

1. Points the pipeline at the 5 descriptions they like → gets back a **style guide**
   with measured, named constraints (sentence length, reading level, person,
   structure, vocabulary), not adjectives.
2. Runs the pipeline over the catalog.
3. Gets a per-product report: what was generated, which facts it used, and which
   products failed which rule.
4. Reviews a side-by-side before/after.
5. Approves specific products. Only approved products are pushed.

### J2 — The merchant, a rule violation
One product's copy trips the certification rule.

1. The product does **not** appear in the publishable set.
2. The report names the rule, quotes the offending span, and gives its character
   offset.
3. Nothing is pushed to Shopify for that product, with or without approval.

### J3 — The merchant, a second market
Wants the same 5 products in Spanish.

1. Same pipeline, `--locale es`.
2. The same rule set runs with a Spanish rule pack (Spanish banned words, Spanish
   certification vocabulary, Spanish second-person markers, `¡` as well as `!`).
3. Fact traceability is locale-independent: the ledger is built from the data, not
   from the language.

### J4 — The reviewer, before publish
Nothing reaches the store without a human decision.

1. The pipeline emits a review queue: one entry per product, `approved: false`.
2. A person edits approvals.
3. The push step refuses any product whose entry is not explicitly approved **and**
   whose copy does not currently pass every hard rule.

## 5. Inputs

| Input | Source | Mutability |
|---|---|---|
| Product records (12) | `00-brand-demo/data/products.json` | **read-only**, never written |
| Brand voice + operating facts | `00-brand-demo/brand.md` | read-only |
| Voice exemplars (5) | this project, `data/voice-exemplars.json` | authored here |
| Locale | CLI flag | `en` \| `es` |
| Anchor date | CLI flag / parameter | required, never defaulted from the clock |

**Voice exemplars are synthetic and authored for this project.** They stand in for
"five descriptions the merchant already likes." They describe *past lots that are
not in the current catalog*, so the before/after comparison stays honest — no
product is "enriched" from copy that already existed for it.

## 6. Outputs

Per product, per locale:

| Field | Surface |
|---|---|
| `body_html` | Product description, HTML paragraphs |
| `seo.title` | Meta title |
| `seo.description` | Meta description |
| `image_alt` | Image alt text |

Plus, per run:

| Artifact | Contents |
|---|---|
| Style guide | Measured constraints extracted from the exemplars, machine-readable + human-readable |
| Enriched catalog | Input records with the four fields populated; original file untouched |
| Validation report | Every rule, every product, pass/fail, with quoted evidence for failures |
| Review queue | One entry per product, approval flag defaulting to false |
| Before/after | Five products, side by side, readable by a non-technical person |
| Timing record | Measured wall-clock of the run, by stage |

## 7. The fact ledger — the core concept

Before any copy is generated for a product, the pipeline builds a **fact ledger**:
the complete, explicit set of things that may be said about that product, each with
its source path.

A ledger entry has: an id, a source path (e.g. `attributes.altitude_masl`), a
value, and the set of textual surfaces that value may legitimately take (e.g.
`1750` → `"1750"`, `"1,750"`).

Nothing outside the ledger may appear in the output as a factual claim.

### 7.1 Permitted sources

| Class | Source paths | Rationale |
|---|---|---|
| Product attributes | `attributes.*` | The brief's primary rule |
| Merchant blurb | `short_blurb` | Merchant-authored prose; already approved copy |
| Identity | `title`, `tags`, `product_type`, `vendor` | Cannot describe a product without naming it |
| Variants | `variants[].price`, `.option*`, `.weight_g`, `.inventory_quantity`, `.subscription_price` | Sizes, grinds, colors, prices are facts of record |
| Derived counts | count of distinct sizes / grinds / options | Deterministic functions of variant data |
| Brand facts | roasting days, shipping policy, location, subscription discount | From `brand.md`; merchant signs these off once, not per product |

### 7.2 Deviation from the brief, stated openly

The brief says *"every factual claim traces to a field of `attributes`."* That rule
is exactly right for the 5 coffee products. It is **impossible** for the other 7:
the V60 dripper, paper filters, kettle, scale, mug, sampler and gift card all ship
with `"attributes": {}`. Under a literal reading, nothing at all could be said
about them.

The ledger above is the resolution: `attributes` remains the **only** permitted
source of coffee facts (origin, process, altitude, tasting notes, roast level,
green price), and the other classes carry only facts that are equally
merchant-authored and equally checkable. The classes are explicit, enumerated, and
reported per claim, so a reviewer sees exactly which class each statement came
from. This is a widening of the rule and it is deliberate.

### 7.3 What is *not* a permitted source

Model knowledge. Colombian coffee generally. What other roasters say. What is
"typical" for a washed process at 1,700m. If it is not in the ledger it does not
appear, even when it is true.

## 8. Acceptance criteria

Each criterion is a hard gate with an automated test. A product failing any gate is
**quarantined**: excluded from the publishable set, excluded from the push, and
reported with evidence.

| ID | Criterion | Applies to | Verification |
|---|---|---|---|
| **AC-01** | No word from the brand's banned list appears (`artisanal, curated, elevated, journey, passion, handcrafted, liquid gold, game-changing, exquisite, unlock`, plus locale equivalents) | all four fields | Word-boundary match over accent-normalized text; test asserts zero matches for all 12 products, and asserts a planted violation is caught |
| **AC-02** | **No certification is stated or implied** — organic, Fair Trade, carbon neutral, direct trade, Rainforest Alliance, Bird Friendly, "certified", "sustainably/ethically sourced", and locale equivalents | all four fields | Term list + phrase list over normalized text; test asserts zero matches across the run, and asserts each planted near-miss phrasing is caught |
| **AC-03** | Meta title ≤ 60 characters | `seo.title` | Length assertion, all products, both locales |
| **AC-04** | Meta description between 140 and 160 characters inclusive | `seo.description` | Length assertion, all products, both locales |
| **AC-05** | Alt text is descriptive, 40–125 characters, contains the product name, and does not open with or contain "image of" / "photo of" / "picture of" (and locale equivalents) | `image_alt` | Pattern + length assertion; planted "Image of a coffee bag" is caught |
| **AC-06** | **Every factual claim traces to a ledger entry.** Concretely: (a) every digit-bearing token in the output matches a ledger surface after unit/separator normalization; (b) every term from the coffee-domain lexicon that appears in the output is backed by ledger text | all four fields | Two independent checks; test asserts clean run for all 12 products, and asserts that a fabricated altitude, a fabricated tasting note, a fabricated varietal and a fabricated price are each caught |
| **AC-07** | Second person present; no exclamation marks anywhere | body + meta description (second person); all fields (`!`, `¡`) | Marker-set match; planted first-person-only copy and planted `!` are caught |
| **AC-08** | Sentence length ≤ the maximum observed in the merchant's own exemplars (`AC-08a`), and body paragraph count within the range observed there (`AC-08b`) | body, meta description | Both constraints are *derived* by the style extractor, not hard-coded; a test runs identical text against two different style guides and asserts the verdict changes |
| **AC-09** | Reading grade ≤ the ceiling derived from the exemplars and the brand's stated 8th-grade target (English only — see §11) | body | Flesch–Kincaid grade, deterministic |
| **AC-10** | The source catalog file is never written | `00-brand-demo/data/products.json` | Test asserts the pipeline's write set contains no path outside this project |
| **AC-11** | Nothing is pushed to Shopify without (a) an explicit human approval flag and (b) a currently-passing validation | push step | Test with a stub transport asserts zero HTTP calls for unapproved and for failing products |
| **AC-12** | The full suite passes with `env -i` — no API key, no network | whole suite | Run the suite under `env -i` in CI and locally |

### 8.1 Scoping notes on AC-07 and AC-05

Second person is required in the **body and the meta description**, and is
deliberately *not* required in alt text: alt text is read by screen readers to
describe an image, and "you" in that position is wrong. Exclamation marks are
banned everywhere, without exception.

## 9. Failure behavior

Fail closed. A product that fails a gate produces **no output fields** in the
publishable set. There is no "best effort" mode, no auto-softening of a violating
phrase, and no partial publish. A run in which 3 of 12 products fail is a
successful run that reports 9 publishable and 3 quarantined.

The generation layer may attempt a bounded number of repairs (feeding the
violations back to the generator). The repair budget is configuration; the gate is
not.

## 10. Measurement

The headline claim is `12 products enriched in N minutes vs. ~M hours manual`.

- **N is measured.** The pipeline times itself with a monotonic clock, by stage,
  and writes the result. The reported N comes from that file and from no other
  place. The measured number is attributed to the generator implementation that
  produced it (see §11) — an offline-generator N is **not** presented as an
  LLM-generator N.
- **M is reasoned and documented, not measured.** The derivation — minutes per
  product per surface, times 12, with the assumption named as an assumption — is
  published next to the number. If the derivation cannot be defended, the artifact
  says "not measured" instead of printing a number.

No other performance number is reported.

## 11. Known limitations, declared up front

1. **The numeric provenance check covers digits only.** Spelled-out numerals
   ("three sizes") are not checked, because a general spelled-numeral check
   false-positives on ordinary prose ("the one we hand people"). Mitigation: the
   offline generator emits digits for every quantitative claim. A model-generated
   spelled numeral would pass the numeric check — that is a real hole and it is
   stated here rather than hidden.
2. **Reading grade (AC-09) is English-only.** Flesch–Kincaid is calibrated on
   English. The Spanish run enforces the sentence-length constraint (AC-08) and
   skips the grade gate rather than reporting a meaningless number.
3. **The domain lexicon is finite.** It catches invented coffee facts drawn from a
   curated ~200-term vocabulary. A fabricated claim using no lexicon term and no
   digits — "this is our most popular bag" — is caught by neither automated check.
   It is caught by the human review gate, which is why the review gate is not
   optional.
4. **The Shopify push is never executed against a real store.** It is implemented
   and tested with a stub transport. No credentials exist in this project and none
   are required to run anything.

## 12. Privacy and data handling

All data is synthetic. Cerro Alto is fictional. No customer records, orders, or
personal data are read by this pipeline — it reads the product catalog and the
brand brief only. No secrets are committed; the Shopify and Anthropic paths read
credentials from the environment and are inert when unset.
