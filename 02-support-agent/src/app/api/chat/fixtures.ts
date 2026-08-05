/**
 * Scripted turns for fixture mode.
 *
 * Every UI state the widget can reach is represented here, so all of them are
 * reachable in a browser without an API key: a clean answer with a citation, a
 * turn that calls a tool, a deterministic escalation, and a failure.
 *
 * The answers are copied from real runs rather than written to flatter the demo —
 * including the escalation one, where the agent declines to promise a refund.
 * Timings are the medians measured in the eval report.
 */

import type { AgentEvent } from '../../../agent/loop.ts';

export interface FixtureStep {
  /** Delay before emitting, in ms. Cumulative timing is what makes it feel real. */
  afterMs: number;
  event: AgentEvent;
}

export interface FixtureTurn {
  match: string[];
  steps: FixtureStep[];
}

/** Split into word-sized deltas, roughly as the API streams them. */
function deltas(text: string, msPerWord = 28): FixtureStep[] {
  return text.split(/(?<=\s)/).map((word) => ({
    afterMs: msPerWord,
    event: { type: 'text_delta', text: word } as AgentEvent,
  }));
}

function done(over: Partial<import('../../../agent/loop.ts').AgentTurn>): FixtureStep {
  return {
    afterMs: 40,
    event: {
      type: 'done',
      turn: {
        answer: '',
        citations: [],
        escalated: false,
        escalationReason: null,
        toolCalls: [],
        latency: { firstTokenMs: 1180, totalMs: 3240 },
        usage: { input: 1240, output: 96, cacheRead: 2380, cacheWrite: 0 },
        ...over,
      },
    },
  };
}

export const FIXTURE_TURNS: FixtureTurn[] = [
  // --- Tool call + citation. The state that sells the build.
  {
    match: ['ca-10244', '10244', 'moved', "hasn't moved"],
    steps: [
      { afterMs: 260, event: { type: 'tool_start', name: 'lookup_order', label: 'Checking your order' } },
      { afterMs: 640, event: { type: 'tool_end', name: 'lookup_order', ms: 640, ok: true } },
      ...deltas(
        "It shipped on July 27th and USPS hasn't scanned it since the 28th — that's seven days without movement, past the five business days where we stop waiting. I've asked the team to open a carrier trace and send a replacement; you don't need to do anything, and you won't be charged for the reship. [shipping]",
      ),
      done({
        answer: 'It shipped on July 27th…',
        citations: [{ docId: 'shipping' }],
        toolCalls: [{ name: 'lookup_order', ms: 640, ok: true }],
        latency: { firstTokenMs: 1240, totalMs: 3810 },
      }),
    ],
  },

  // --- Escalation. The agent states what the policy grants and declines to
  //     commit the money — spec §B3.
  {
    match: ['refund', 'money back', 'ca-10250', '10250'],
    steps: [
      { afterMs: 240, event: { type: 'tool_start', name: 'lookup_order', label: 'Checking your order' } },
      { afterMs: 590, event: { type: 'tool_end', name: 'lookup_order', ms: 590, ok: true } },
      ...deltas(
        "A defective kettle is covered — we pay shipping both ways on that, and you don't send the coffee back. This order is over our $150 desk limit, so a supervisor signs it off rather than me. [returns-refunds]",
      ),
      {
        afterMs: 120,
        event: {
          type: 'escalated',
          reason: 'refund_over_approval_limit',
          ticketId: 'ESC-4417',
          tellCustomer:
            "I've passed this to the team — they reply within one business day, Mon–Fri 9–5 ET.",
        },
      },
      done({
        answer: 'A defective kettle is covered…',
        citations: [{ docId: 'returns-refunds' }],
        escalated: true,
        escalationReason: 'refund_over_approval_limit',
        toolCalls: [{ name: 'lookup_order', ms: 590, ok: true }],
        latency: { firstTokenMs: 1090, totalMs: 3520 },
      }),
    ],
  },

  // --- Tool failure. The agent says it can't check rather than inventing a status.
  {
    match: ['down', 'broken', 'error', 'trigger an error'],
    steps: [
      { afterMs: 220, event: { type: 'tool_start', name: 'lookup_order', label: 'Checking your order' } },
      { afterMs: 2400, event: { type: 'tool_end', name: 'lookup_order', ms: 2400, ok: false } },
      ...deltas(
        "I can't reach our order system right now, so I'd rather not guess at where your package is. I've handed this to the team with your order number — they'll come back within one business day.",
      ),
      {
        afterMs: 100,
        event: {
          type: 'escalated',
          reason: 'lookup_failed',
          ticketId: 'ESC-4418',
          tellCustomer:
            "I've passed this to the team — they reply within one business day, Mon–Fri 9–5 ET.",
        },
      },
      done({
        answer: "I can't reach our order system…",
        escalated: true,
        escalationReason: 'lookup_failed',
        toolCalls: [{ name: 'lookup_order', ms: 2400, ok: false }],
        latency: { firstTokenMs: 2680, totalMs: 5100 },
      }),
    ],
  },

  // --- No tool, straight from retrieved policy. Also the fallback.
  {
    match: ['grind', 'aeropress', 'v60', 'french press', 'espresso'],
    steps: [
      ...deltas(
        'Go with Filter — it comes out about like table salt, which is what the Aeropress wants. If you ever find yourself between two grinds, pick the finer one: too coarse tastes thin and sour, too fine at least tastes like something. [brewing-grind-guide]',
      ),
      done({
        answer: 'Go with Filter…',
        citations: [{ docId: 'brewing-grind-guide' }],
        latency: { firstTokenMs: 940, totalMs: 2610 },
      }),
    ],
  },
];
