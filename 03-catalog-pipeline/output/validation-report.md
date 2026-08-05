# Validation report — en

Generator: `offline-template-v1` · style guide `1.0.0+acceea92` · run date 2026-08-04

**12 of 12 publishable · 0 quarantined.**

A quarantined product publishes nothing at all. There is no partial publish and no
auto-softening of a violating phrase.

## Rules, and how each one did

| Rule | What it checks | Products failing |
|---|---|---|
| `AC-01` | No word from the brand’s banned list | — none — |
| `AC-02` | No certification stated or implied | — none — |
| `AC-03` | Meta title within the SEO limit | — none — |
| `AC-04` | Meta description within the SEO window | — none — |
| `AC-05` | Alt text is descriptive and names the product | — none — |
| `AC-06` | Every factual claim traces to the fact ledger | — none — |
| `AC-07a` | No exclamation marks | — none — |
| `AC-07b` | Written in the second person | — none — |
| `AC-08a` | Sentences no longer than the merchant’s own | — none — |
| `AC-08b` | Body paragraph count matches the merchant’s shape | — none — |
| `AC-09` | Reading grade at or below the derived ceiling | — none — |

## Constraints in force this run

| Constraint | Value | Where it came from |
|---|---|---|
| Max sentence length | 18 words | measured from the merchant’s own 5 descriptions |
| Reading grade ceiling | 8 | brand target of 8th grade, raised only if their own copy sits higher |
| Body paragraphs | 3–4 | measured from the exemplars |
| Second person | required | measured from the exemplars |
| Exclamation marks | forbidden | measured from the exemplars |
| Meta title | ≤ 60 chars | SEO convention |
| Meta description | 140–160 chars | SEO convention |
| Alt text | 40–125 chars | SEO/accessibility convention |

## Per product

| Product | Status | Ledger entries | Attempts | Violations |
|---|---|---|---|---|
| Huila Reserve | publishable | 28 | 1 | — |
| Nariño Microlot | publishable | 26 | 1 | — |
| Volcán Dark | publishable | 28 | 1 | — |
| Casa Blend | publishable | 28 | 1 | — |
| Sereno Decaf | publishable | 28 | 1 | — |
| Cerro Alto V60 Dripper | publishable | 16 | 1 | — |
| V60 Paper Filters (100 ct) | publishable | 15 | 1 | — |
| Gooseneck Kettle 1L | publishable | 18 | 1 | — |
| Digital Brew Scale | publishable | 13 | 1 | — |
| Cerro Alto Mug 10 oz | publishable | 15 | 1 | — |
| Origin Sampler (4 x 100g) | publishable | 17 | 1 | — |
| Gift Card | publishable | 14 | 1 | — |

## Quarantined, with evidence

Nothing was quarantined in this run.

That is a claim worth being suspicious of, so the adversarial tests in
`src/validate/rules.test.ts` and `src/validate/provenance.test.ts` plant violations of
every rule and assert that the gate catches them. A gate that never fires and has never
been shown to fire is not a gate.

## Timing

| Stage | ms |
|---|---|
| ledger | 9.202 |
| generate | 2.678 |
| validate | 95.54 |
| **total** | **107.69** |

Measured end to end: **0.002 minutes** for 12 products,
using `offline-template-v1`.
