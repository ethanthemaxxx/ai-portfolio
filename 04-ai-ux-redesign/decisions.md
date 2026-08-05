> **Speculative redesign — unaffiliated, unsolicited, not commissioned by anyone.** Independent UX
> concept, not client work, not paid work. No company's logo, brand or product assets are used. All
> data is synthetic.

# Design decisions

One section per problem. Each states what the runtime actually knows, the decision, the alternative
I discarded and why, and what the decision costs — because every one of them costs something, and a
case study that only lists upsides is a sales page.

A note that applies to all five: **the design is constrained to information a real agent runtime
already emits.** Plans, tool names, arguments, results, durations, token counts, stop reasons. Not
one element here needs a model to introspect about itself, and nothing needs a signal that does not
exist yet. A redesign that requires a model to reliably report its own uncertainty is a redesign
that cannot be built.

---

## 1. Streaming — what fills the gap before the first token

**The problem.** The model reasons before it emits anything. Then it calls three tools in sequence.
For this run that is roughly nine seconds during which the output pane, in the current design, is
empty except for a spinner. The operator cannot tell progress from a hang, cannot tell whether the
run is pointed at the right data, and therefore cannot make the only decision available during a
run: kill it early.

**What the runtime knows.** Which tool it is calling, with what arguments, how long each has taken,
and — for a planning agent — the plan itself, which is produced *before* the tool calls begin.

**The decision. Spend the wait on a commitment, not on an animation.**

The agent publishes its plan at 0.2 s, before any tool runs: the four things it intends to do. The
operator can read it and immediately tell whether the run is aimed correctly. Then each tool call
lands on the timeline as it happens, named, with its record count and duration. The pause always has
a subject.

Two details carry more weight than they look like they should:

- **The status line names the tool, not the state.** `shopify.inventory_levels — on-hand stock, all
  green lots` rather than `Thinking`. "Thinking" is a mood; a tool name is a fact the operator can
  check against the plan.
- **The last line of the plan is `Draft one purchase order per supplier — and stop there. Do not
  send.`** The agent stating the limit of its own authority, in its own plan, before it does
  anything. It sets the expectation that this run ends at a human, several seconds before the
  approval bar exists.

There is also a `first token 2.4s` marker. Latency becomes a number on the screen instead of a
feeling, which is what lets anyone argue about whether it is acceptable.

**Discarded: the spinner, the skeleton shimmer, the progress bar.**

A spinner is the honest version of nothing — it says only "something is happening", which the
operator already assumed. A skeleton shimmer is worse: it implies layout that is about to arrive and
gives a false sense of progress toward a shape nobody promised. A progress bar is worst, because an
agent run has no denominator — you cannot know how many tool calls remain until the model decides.
A bar that fills at an invented rate teaches people that the indicator means nothing, and once that
is learned it applies to every indicator in the product.

**What it costs.** The plan is text the model generates, which means it burns tokens before any work
happens, and a model that plans badly now advertises it. I think advertising it is correct — a run
pointed at the wrong data should be killed at 0.2 s, not at 9 s — but it is a real trade, and on a
model that plans poorly this design gets worse, not better.

---

## 2. Confidence — communicating uncertainty without sounding useless

**The problem.** Some of what an agent produces is traceable to a record, some is computed, and some
is the model filling a gap because the data was missing. All three render identically. The operator
has no way to tell which numbers to check.

**The decision. Uncertainty attaches to the claim, never to the message. Three states, and only one
of them gets colour.**

- **verified** — this value came from a record read this run. Here is the record.
- **derived** — computed from verified values. Here is the arithmetic, in full.
- **assumed** — the model filled a gap. Here is the gap, and what it would cost to be wrong.

The *assumed* item in the prototype is a new SKU with 19 days of sales history. Expanding it reads:

> `kg_per_week` — **assumed 5.1** — NOT IN DATA. Only 19 days of history for this SKU. I used the
> mean velocity of the other 340 g bags. If decaf sells slower than regular, this is over-ordered by
> roughly a month.

That is the whole design. It says what it did not know, what it substituted, and the consequence of
the substitution being wrong. It is specific enough to act on and it does not apologise.

**Only *assumed* is coloured.** *Verified* and *derived* are quiet. If every value is flagged, the
flag is wallpaper — the operator learns to skip the row of badges, and the one that mattered goes
with it. Visual weight is a budget, and it should be spent only where a human is actually needed.

**Discarded: the confidence percentage.**

Both discarded directions — this one and the banner from section 4 — are drawn out properly, side
by side with the winner, in [`explorations.html`](./explorations.html): the same run, the same
false sentence, one question asked of each. They are drawn as a competent team would ship them, so
the comparison is fair.

`87% confident` fails on three counts, any one of which is disqualifying. It is uncalibrated — the
number comes from a model that has no reliable access to its own reliability, so 87% and 62% do not
mean what the reader thinks. It applies to the whole message rather than the one clause that is
shaky, so it dilutes: a message with three solid facts and one invention averages to something
comfortable. And it is unactionable — nobody has ever known what to do differently at 87% versus
62%. It survives in products because it is trivial to render and it looks like rigour.

**Also discarded: hedging in the prose.** Making the model write "it appears that" and "you may want
to verify" is the failure mode the brief names — it sounds useless, it is unscannable, and it cannot
be attached to a specific value, so it degrades every sentence to protect one.

**What it costs.** Provenance has to be plumbed. The runtime must tag output fields with the tool
result they came from, which is real engineering, not a CSS change — and for a model that free-forms
prose rather than emitting structured output, it is hard. This design assumes structured output with
field-level provenance. That assumption is the price of admission, and it is worth naming out loud
rather than hiding in a mockup.

---

## 3. Tool call transparency — showing the work without burying the answer

**The problem.** Two failure modes, opposite directions. Show everything, and you get the current
design: a nested JSON tree where a tool's result is an escaped string four levels down, at the same
visual weight as everything else. Show nothing, and the run is unauditable — the operator is asked
to trust an answer whose sources they cannot see.

**The decision. One line per call: verb, object, count, duration. The payload is one click away and
it is never the default.**

`shopify.inventory_levels · on-hand stock, all green lots · 12 records · 310 ms`

That line answers *did it look, what did it look at, did it come back, was it slow* — which is the
whole audit at a glance. Critically, it scales: this run has three calls, but the same treatment
survives a run with forty, because each is one row and the eye can skim a column of durations for
the outlier. The expanded JSON tree does not survive forty calls, and forty is a normal agent run.

**The payload is the same object the model saw.** Not a summary, not a prettified version — the
actual tool result. A "helpful" rendering is a place for a discrepancy to hide.

**Then the detail that makes it more than a log.** The tool rows are the anchor for provenance from
section 2: the evidence drawer on every line item cites the exact tool and field, so the audit trail
runs both directions. And the third tool call in the prototype contains the record that contradicts
the answer, highlighted, sitting in plain sight *before the answer has even been written*. The
information was always there. The old design just gave nobody a reason to open it.

**Discarded: the full nested tree, expanded by default.** Technically complete and cognitively
useless. It optimises for the developer debugging the workflow at build time, which is a real user —
but not the one on this screen at 6 a.m. on a Monday.

**Discarded: hiding tool calls behind a single "show details" link.** Cleaner, and it destroys the
thing that makes an agent's output checkable. The point of surfacing tool calls is not decoration;
it is that a claim with a visible source can be falsified and a claim without one cannot.

**What it costs.** Collapsed-by-default means the operator has to choose to look, and most will not.
This design accepts that, and compensates in section 4: the contradiction is caught by a check that
runs whether or not anyone opened the payload. Transparency is for the operator who *does* look;
correctness cannot depend on them.

---

## 4. Graceful failure — when the model is confidently wrong

The hard one, and the one most redesigns quietly skip by showing a nice error state instead.

**The problem.** The failure that matters is not the API timeout. It is this sentence:

> Volcán Dark ships from Cooperativa Tolima in **14 days**, so the 120 kg lands before you run dry
> on day 17.

Fluent, specific, checkable, and false — the supplier record the run read at 1.8 s says 28 days. The
model was not hedging and not confused. It produced its most confident-looking output while being
wrong, and there is no signal *inside* the model's output that distinguishes this sentence from the
three correct ones around it.

**Which forces the central decision: the model gets no vote on whether it was right.**

Anything that asks the model to grade its own output — a self-check pass, a confidence score, a
"review your answer" step — fails on exactly the inputs that matter, because a model confident
enough to write that sentence is confident enough to approve it. So the check is deterministic and
independent: it re-reads the records the run read and compares them to the claims the run made. Four
checks; one fails.

**How the failure is presented, and why each choice is deliberate:**

- **Both values, side by side, with their sources.** `the run wrote: lead_time_days = 14` next to
  `the record says: lead_time_days = 28`, and the record's provenance underneath. The screen does
  not assert who is right — it shows the contradiction and lets the operator resolve it. Sometimes
  the record is the stale one, and a design that assumes the record always wins is wrong in a
  different direction.
- **The consequence, in plain words.** *"The order arrives on day 28. Stock runs out on day 17.
  Eleven days of the house dark roast, unroastable."* A field-level diff tells you what differs; it
  does not tell you whether to care. The operator is deciding, so the operator needs the stakes.
- **The claim is struck through, not deleted.** Keeping what the agent said visible is what makes it
  possible to judge how much to trust it next week. An interface that silently repairs the model's
  output destroys the only evidence anyone has about how reliable it is.
- **The copy reports; it does not apologise.** No "Sorry, I may have made a mistake." An apology is
  not information, it invites the reader to reassure rather than check, and at volume it is
  irritating.
- **The failure is scoped.** One bad line item is quarantined; the other three stay approvable. This
  is the single most consequential choice in the section. All-or-nothing failure makes the bad line
  the enemy of the good ones, and an operator who must discard four correct items to reject one
  wrong one will eventually stop rejecting.

**Discarded: the "AI can make mistakes, verify important information" banner.**

It is on every screen, so it is read on none. It is liability text wearing an interface's clothes: it
transfers responsibility to the user without giving them a single specific thing to check. Worse, it
is *indistinguishable between runs* — the run that is fine and the run with a false lead time carry
the identical warning, so the warning carries no information. A warning that never varies is not a
warning.

**Discarded: voiding the entire run on any failed check.** Safe, simple, and it trains people to
override the checks wholesale, which is worse than not having them.

**What it costs.** The checks are bespoke. "Every cited number traces to a record read this run" is
general, but "unit price within 25% of the last three POs" is domain knowledge someone has to write
and maintain. This design does not pretend that is free: it is the actual work, and it is why the
check panel names all four checks rather than showing a green tick. If the checks are weak, the
screen is confident theatre — the same failure it was built to prevent, one level up.

---

## 5. Human-in-the-loop — where a person actually intervenes

**The problem.** The workflow's last node emails a purchase order to a supplier. That is
irreversible, it spends money, and in the current design it happens automatically the moment the
agent finishes. The run inspector is where a person would find out — afterwards.

**The decision. The pause goes before the irreversible step, and the side effect becomes a separate,
human-owned commit.**

`gmail.send` appears on the timeline **as the step that did not run**, in its place, with the reason.
Showing the absence is the point: an operator scanning the run sees where it stopped and why, rather
than having to infer that something was withheld.

Five decisions hang off that, and they are where the design earns its keep:

**Partial approval.** *Approve 3 items* — not *Approve run*. Three items are clear and one is
contradicted; forcing a single verdict on the bundle means the bad line holds the good ones hostage.
The operator approves what is clear and holds what is not, and the receipt records exactly that
split.

**Editing is a first-class verb, next to approving.** Not a rejection loop, not "reject and re-run
with feedback". The operator changes a quantity in place, the original is preserved and displayed
(`was 60 kg · edited`), and the receipt attributes the change to a person. An audit trail that
quietly rewrites what the agent proposed is worse than no audit trail — the edits are the highest-
signal data in the whole system about where the agent is systematically wrong, and overwriting them
throws that away.

**The pending state has a named owner.** *Waiting on Ana R. · Operations.* "Awaiting approval"
without a name is how approvals rot for three weeks: everyone assumes someone else has it.

**The expiry defaults to not sending, and says so.** *If nobody acts by Tue 06:00 the run expires
unsent — doing nothing is the safe outcome, not the ambiguous one.* Whatever happens on timeout,
the screen must state it. The unacceptable version is the operator having to guess what silence
does, because silence is the most common input any approval queue receives.

**A five-minute recall window.** Approving queues the send with a live countdown and a *Recall*
button. This is the cheapest safety feature in the design: approval is the exact moment attention
collapses, and the mistake surfaces about ten seconds later. It converts an irreversible action into
a reversible one for the only five minutes that matter, and it costs a queue and a timer.

**Discarded: post-hoc review.** Let it send, log what it sent, add an audit page. Far cheaper to
build, which is why it is what most agent products ship. For anything irreversible the review is a
eulogy — you are reading about money that has already been committed. Post-hoc review is correct for
reversible actions, and this workflow does not have any.

**Discarded: a modal confirm dialog.** *"Send 3 purchase orders? Cancel / Confirm."* It strips away
the evidence at the exact moment the evidence is needed — the provenance, the arithmetic, the
contradiction all vanish behind the overlay, leaving a yes/no with no basis for either. And modals
train people to click through: a dialog that appears every Monday is muscle memory by week three.
The approval bar is deliberately *in* the page, pinned to the bottom while the operator scrolls the
evidence, so the decision is made next to the reasons for it.

**What it costs.** Latency and human attention — the automation stops being unattended, which is
what most people bought it for. The honest framing is that this is not overhead added to
automation; it is the price of letting automation touch anything irreversible. The design tries to
make it cheap rather than pretending it is free: partial approval means one bad item does not cost
you four decisions, the phone layout means the approval can happen from a supermarket queue, and the
expiry means an ignored approval fails safe instead of blocking the week.

---

## What I would test first

No usability testing has been run, so everything above is reasoning, not evidence. The three
assumptions I would most want to break:

1. **Does anyone open the evidence drawer?** The whole provenance system assumes an operator who
   clicks *why this number*. If nobody does, the design's real value collapses back to the
   deterministic checks and the *assumed* flag — and I would rather learn that from a test than
   defend a drawer nobody opens.
2. **Does *assumed* stay meaningful, or become wallpaper?** It works here because exactly one of
   four items carries it. At a realistic hit rate — a third of items, every week — the flag may
   train the same blindness as the banner I discarded.
3. **Does the recall window get used, or does it just delay every send by five minutes?** If nobody
   ever recalls, it is pure latency and should be cut.
