> **Speculative redesign — unaffiliated, unsolicited, not commissioned by anyone.** This is an
> independent UX concept for a screen pattern common to AI agent nodes in workflow automation tools
> (n8n, Make, Zapier and similar). It uses no company's logo, brand or product assets. It is not a
> product of, or endorsed by, any of them, it was not paid work, and it has never been presented as
> client work. All data is synthetic.

# Agent Run Inspector

**A redesign of one screen: the panel an operator opens when an AI agent has just run against their
real business data and something now has to leave the building.**

[**→ Open the interactive prototype**](./prototype.html) — one HTML file, no build, no dependencies.
Press *Run workflow*. The streaming, the uncertainty, the tool calls, the failure and the human gate
are all live.

---

## Why this screen

Every workflow automation tool has shipped an AI Agent node. They are genuinely useful and they are
now wired into things that spend money and send email. The node's *run inspector* — the pane that
shows what came out — was inherited unchanged from the panel that shows what a "format date" node
returned. That inheritance is the whole problem.

A deterministic node has one honest question: *what came out?* A JSON viewer answers it completely.

An agent run raises four more, and the JSON viewer answers none of them:

1. Is it still going, or is it stuck?
2. Can I trust this number?
3. Where did it come from?
4. What happens if I do nothing?

I chose this screen over the more obvious candidates — a chat UI, a prompt playground — for three
reasons. It is where the consequential decision actually happens: chat is a conversation, but this
panel sits directly upstream of an irreversible side effect. It is under-designed relative to its
blast radius, because it was never designed for this job in the first place. And it is one screen,
so the redesign can go deep instead of wide.

**The thesis in one line: this is not a data viewer, it is a decision surface.** Everything else
follows from that.

## The scenario

A small coffee roaster runs a weekly reorder agent. It reads on-hand stock, reads 90-day sales
velocity, reads supplier lead times, and drafts a purchase order per supplier. The next node in the
workflow emails it.

The run in the prototype is a good one. It reads the right records, does the arithmetic correctly on
three of four line items — and on the fourth it writes a fluent, specific, entirely false sentence
about a supplier's lead time. That is the run worth designing for. A run that errors out is easy;
the interesting failure is the one that looks exactly like a success.

## Before

Reconstructions, not screenshots — see the honesty note below.

| | |
|---|---|
| [`before/before-02-executing.svg`](./before/before-02-executing.svg) | Nine seconds of spinner. |
| [`before/before-01-run-output.svg`](./before/before-01-run-output.svg) | The finished run as a JSON tree. |

The second one is the argument. **Nothing on that panel is wrong.** The false claim about the lead
time is in it, and so is the supplier record that contradicts it — one inside a prose blob, the
other inside an escaped string four levels down a collapsed tree, both rendered in the same grey
monospace at the same weight. The screen has all the information needed to catch the error and
gives the operator no reason to look for it.

## After

Full captures in [`after/`](./after/), taken from the prototype itself over the Chrome DevTools
Protocol at an emulated 375 px and at 1280 px, in both colour schemes.

| | |
|---|---|
| [`after-14-desktop-light-review-full.png`](./after/after-14-desktop-light-review-full.png) | The whole screen, annotated |
| [`after-03-375-light-review-full.png`](./after/after-03-375-light-review-full.png) | The whole screen at 375 px |
| [`after-12-375-dark-review-full.png`](./after/after-12-375-dark-review-full.png) | Dark, 375 px |
| [`after-16-desktop-light-notes-off.png`](./after/after-16-desktop-light-notes-off.png) | Design notes off — the product without the commentary |

The prototype carries numbered design notes in the UI so the reasoning is legible without this
document. They toggle off; that capture is what the screen would actually ship as.

## Process

[**`explorations.html`**](./explorations.html) shows the two directions I discarded for the
confidence layer — the message-level 87% score and the persistent "AI may make mistakes" banner —
drawn out properly, side by side with the provenance system that shipped. Each direction renders
the same run containing the same false sentence, and each carries a short note on why it died. The
discarded options are drawn as a competent team would ship them, not as straw men; the argument has
to beat the good version. Verified the same way as the prototype (captures
[`after-17`](./after/after-17-explorations-375-light.png)–[`20`](./after/after-20-explorations-desktop-dark.png)).

## The five decisions

Full reasoning, and the alternative discarded in each case, in **[`decisions.md`](./decisions.md)**.
In short:

| | Decision | Discarded |
|---|---|---|
| **Streaming** | Publish the agent's **plan** before the first token. The dead time carries a commitment the operator can check and kill. | Spinner, skeleton shimmer, fake progress bar |
| **Confidence** | Provenance per claim — **verified / derived / assumed** — never a score, and only *assumed* gets colour. | A confidence percentage; hedging language |
| **Tool calls** | One line each: verb, object, count, duration. Payload one click away, and it is the same object the model saw. | The full nested JSON tree; hiding calls entirely |
| **Graceful failure** | A deterministic check re-reads the records and shows **both values side by side**. The model gets no vote on whether it was right. | An "AI can make mistakes" banner; asking the model to self-assess; voiding the whole run |
| **Human-in-the-loop** | The pause goes **before** the irreversible step. Partial approval, first-class editing, a named owner, an expiry that defaults to *don't send*, and a five-minute recall window. | Post-hoc review; a modal confirm dialog |

The fifth is the one that matters most and gets designed least, because reviewing after the fact is
far cheaper to build. For anything irreversible, that review is a eulogy.

## Visual decisions

- **Instrument panel, not chat app.** Hairlines, 3 px corners, no shadows, no gradients. A run is a
  record of events in order, so the layout is literally that: mono timestamps on a rail, square
  ticks, everything left-aligned. The rail survives 375 px rather than collapsing, because the
  ordering of events *is* the content.
- **The type system is one rule: human words in sans, machine facts in mono.** Every value a program
  emitted — IDs, SKUs, durations, record counts, quantities, model name — is monospace. You can tell
  at a glance what was written and what was produced. It also makes numbers align, which matters on
  a screen whose whole job is comparing them.
- **System font stacks, no webfonts.** Not Inter. Nothing is fetched.
- **Cool graphite with a single teal accent**, plus three signal colours that only ever mean one
  thing: green *verified*, amber *needs a human*, clay *contradicted*. No violet, no gradient, and
  deliberately not the warm palette of the support-widget piece in this portfolio — different
  product, different world.
- **375 px is a design position, not a checkbox.** Approvals get done from a phone, at the worst
  possible moment. An approval surface that is desktop-only gets rubber-stamped from a notification
  instead — which is the exact failure the design exists to prevent. Quantity inputs are 16 px so
  iOS does not zoom the panel away mid-edit.

## Verification

The prototype was driven end to end over the Chrome DevTools Protocol: real 375 px viewport
emulation, real `prefers-color-scheme` emulation, real clicks on the real handlers. **30 assertions,
30 passed, console clean — zero errors, zero warnings.** Independently re-checked in a second
browser at 375 px dark.

Covered: layout viewport is exactly 375 px with no horizontal overflow; the speculative-work label
is the first line on the page; the plan renders before the first token; prose streams and the caret
clears; the payload expands and highlights the contradicting record; the assumed value names the gap
it filled; the wrong claim is struck through with both values shown; the approval bar offers three
verbs, names an owner and an expiry; editing preserves the original without losing the caret;
approval queues with a live countdown and a recall; the receipt lists only approved items at edited
quantities; blocking records a reason and sends nothing; dark mode works from the system preference
alone *and* the in-page toggle overrides it; zero external resource requests.

Two real defects were found and fixed this way: the edited-quantity marker only appeared on blur
rather than on keystroke, and the approval summary counted suppliers from a hardcoded literal
instead of the data.

## Honesty notes

- **This is speculative work.** Nobody commissioned it, nobody paid for it, and it is not affiliated
  with any company. It references a product pattern; it does not impersonate a product.
- **The `before/` images are reconstructions, drawn from memory and public documentation — not
  screenshots of anyone's product.** They are composites of the pattern as it appears across several
  tools, and each one says so inside the image itself. Faking a screenshot of someone's UI to make a
  redesign look better is not a thing I will do.
- **No usability testing was run, so there are no usability numbers.** No task-completion rates, no
  time-on-task, no error-rate deltas. Everything above is design reasoning and defended trade-offs.
  If a number appears in a redesign case study with no study behind it, it was invented.
- **All data is synthetic** — brand, suppliers, SKUs, quantities, order references and the approver
  are invented for the prototype. No real business data appears anywhere.
- **The verification numbers are real, with one caveat stated plainly:** the 30-assertion count
  comes from a CDP harness run during development that is not shipped in this folder, so that
  number is attested, not reproducible from here. What *is* checkable by anyone: open the file —
  console stays clean, both themes work, 375 px shows no horizontal scroll, and all five states
  can be driven by hand.

## Files

```
04-ai-ux-redesign/
├── README.md          this case study
├── decisions.md       one section per problem, each with the discarded alternative
├── prototype.html     interactive, self-contained, zero dependencies
├── explorations.html  the discarded directions for the trust layer, side by side
├── before/            two labelled reconstructions
└── after/             20 captures — 16 from the prototype, 4 from explorations —
                       at 375 px and 1280 px, light and dark
```
