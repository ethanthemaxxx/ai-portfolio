# Eval report

**Run date:** 2026-08-04 · **Anchor date:** 2026-08-04 (fixed; nothing here reads the clock)

This report has two halves, and the split matters more than any single number in it.
The offline half **ran**. The live half **did not**, because no API key was available on
the machine that built this. Numbers that were not measured are not printed. That is the
whole policy.

---

## 1. Retrieval — ran offline, no key, no network

```
$ env -i npx tsx evals/run.ts --retrieval-only

Retrieval-only (no API key, no network)

  ✔ J1-02    subscriptions, brewing-grind-guide, shipping, freshness-storage
  ✔ J1-03    shipping, freshness-storage, faq, subscriptions
  ✘ J1-04    missing shipping, faq — got freshness-storage, subscriptions, returns-refunds, brewing-grind-guide
  ✔ J1-05    freshness-storage, shipping, returns-refunds, subscriptions
  ✔ J2-06    brewing-grind-guide, returns-refunds, subscriptions
  ✔ J2-07    brewing-grind-guide, freshness-storage, subscriptions
  ✔ J2-08    brewing-grind-guide, freshness-storage, subscriptions
  ✔ J3-09    subscriptions, returns-refunds
  ✔ J3-10    subscriptions, brewing-grind-guide, returns-refunds
  ✔ J4-11    returns-refunds, freshness-storage, brewing-grind-guide, shipping
  ✘ J4-12    missing returns-refunds — got freshness-storage, shipping, faq
  ✔ J4-13    returns-refunds, brewing-grind-guide
  ✔ J4-14    brewing-grind-guide, freshness-storage, returns-refunds, shipping, faq
  ✔ J4-15    returns-refunds, freshness-storage
  ✔ J5-17    shipping, faq
  ✔ ADV-20   shipping, returns-refunds, subscriptions, faq

  14/16 cases retrieved every expected source (88%)
```

### The two failures, not rounded away

Both run on the **offline embedding stub**, so the lexical leg is doing almost all the
work. Both misses have the same shape: the question's surface vocabulary points at one
document while the answer lives in another.

**J1-04** — *"Can I still change the grind on CA-10243? I picked espresso by mistake."*

| | |
|---|---|
| Expected | `shipping`, `faq` |
| Returned | `freshness-storage`, `subscriptions`, `returns-refunds`, `brewing-grind-guide` |

The answer is an order-modification cut-off, which is written in the shipping policy and
the FAQ. But the question's strongest terms are *grind* and *espresso*, and those pull the
brewing guide to the top. The retriever answered the question the words asked, not the
question the customer asked.

**J4-12** — *"The roast date printed on my CA-10247 bag is July 14th and it only showed up
yesterday. Is that normal?"*

| | |
|---|---|
| Expected | `returns-refunds`, `freshness-storage` |
| Returned | `freshness-storage`, `shipping`, `faq` |

`freshness-storage` came back; `returns-refunds` did not. The customer describes a date,
not a claim — nothing in the wording says *replacement* or *refund*, which is where the
14-day rule's remedy is written. The arithmetic (20 days off roast at delivery, over the
14-day rule) is what turns this into a claim, and arithmetic is not a retrieval signal.

### Neither of them fails safely, and that is the point worth publishing

The comfortable thing to write here would be that both misses fall below the relevance
floor and route to a human. They don't. Measured at the shipped k=6:

```
J1-04   belowFloor: false   coverage: 0.67   missing terms: picked, mistake
J4-12   belowFloor: false   coverage: 0.64   missing terms: july, 14th, showed, yesterday
```

The floor is a **confidence** gate, not a **correctness** gate. It fires when nothing
retrieved looks relevant. Here the retriever is confident and wrong: it returns six chunks
that score well and do not contain the rule the question needs. That is the failure mode
the floor cannot catch, by construction.

What still stands between that and a bad answer is the **citation gate** — hard eval gate
B, which fails any claim not present in the retrieved context. On J1-04 that gate is the
only thing left, and whether it holds is **not measured**, because it needs a live run
(see §4). J4-12 is labelled `must_escalate: true`, so a deterministic trigger is expected
to fire on it regardless of retrieval; which trigger, and whether it does, is likewise
unmeasured here.

**What this does and does not tell you.** Both are retrieval misses measured against the
labels in `dataset.json`, and the descriptions above are read off the returned-vs-expected
sets. Whether a real embeddings model closes either gap is untested — that needs a key.
No claim is made that the system degrades gracefully on these two cases, because that has
not been demonstrated.

## 2. Top-k sweep — ran offline

```
$ env -i npx tsx src/retrieval/sweep-topk.ts

Top-k sweep — evals/dataset.json — 20 cases, 16 with an expected source

| k | hit rate | MRR | mean tokens | false below-floor | true below-floor |
|---|---|---|---|---|---|
| 3 | 88% | 0.802 | 365 | 6% | 100% |
| 4 | 88% | 0.802 | 471 | 6% | 100% |
| 6 | 94% | 0.815 | 689 | 0% | 100% |
| 8 | 100% | 0.822 | 914 | 0% | 100% |
| 12 | 100% | 0.822 | 1315 | 0% | 100% |
```

k=6 is the shipped setting. Recall plateaus at k=8, but that last case costs a third more
context on every other question; k=6 is where false escalation reaches zero and MRR is
within 0.007 of its ceiling.

> The `hit rate` column here (94% at k=6) and the `14/16` above measure different things
> and are both correct. The sweep counts an expected document appearing anywhere in the
> top k; the retrieval run counts a case only when **every** expected source came back.

## 3. Unit and contract suite — ran offline

```
$ env -i npm test

ℹ tests    252
ℹ pass     251
ℹ fail       0
ℹ skipped    1
```

The skipped test documents itself: it needs an embeddings key to assert anything
meaningful, so it skips loudly rather than passing vacuously.

---

## 4. End-to-end run — NOT RUN

**Status: blocked. Requires `ANTHROPIC_API_KEY`, plus `VOYAGE_API_KEY` or `OPENAI_API_KEY`.**

The following are therefore **not measured, and no number is given for them**:

- Answer accuracy against the 20-case dataset
- Hard gate A — every must-escalate case escalates
- Hard gate B — zero claims unsupported by context
- Latency per turn
- Cost per conversation

The release verdict a full run produces (`releasable` / `not releasable`) is
**undetermined**, because the two hard gates it depends on have not been evaluated.

To run it:

```bash
export ANTHROPIC_API_KEY=...
export VOYAGE_API_KEY=...      # or OPENAI_API_KEY
npm run ingest && npm run eval
```

Rebuilding the index with real embeddings is expected to change the retrieval numbers
above — most likely upward on J1-04. **This report should be regenerated after that run,
not amended by hand.**

---

## Reading this report

Every number above came from a command printed next to it, and every one of those
commands runs on a clean clone with no keys and no network. The section that could not be
measured says so and gives no number at all. A report that claimed 20/20 would be easier
to sell and worth less, because anyone who has built one of these knows what 20/20 means.
