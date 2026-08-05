import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createEscalateToHuman,
  createSequentialTicketIds,
  createTicketQueue,
  TICKET_ID_PREFIX,
  type EscalationContext,
} from "./escalate-to-human.ts";
import { ANCHOR_TODAY, HANDOFF_EXPECTED_REPLY, HANDOFF_TELL_CUSTOMER } from "./policy.ts";

const CONTEXT: EscalationContext = {
  transcript: [
    { role: "customer", text: "My kettle arrived dented and I want my money back." },
    { role: "agent", text: "Let me check that order." },
  ],
  retrievedDocIds: ["returns-refunds", "faq"],
  orderNumber: "CA-10250",
  triggers: ["refund_over_approval_limit"],
  today: ANCHOR_TODAY,
};

test("C7: the ticket carries category, transcript, retrieved doc ids and the order number", () => {
  const queue = createTicketQueue();
  const escalate = createEscalateToHuman({ emit: queue.emit });

  escalate(
    {
      category: "money_commitment",
      summary: "Dented kettle on a $170 order; refund needs supervisor approval.",
    },
    CONTEXT,
  );

  assert.equal(queue.tickets.length, 1);
  const ticket = queue.tickets[0]!;
  assert.equal(ticket.category, "money_commitment");
  assert.equal(ticket.summary, "Dented kettle on a $170 order; refund needs supervisor approval.");
  assert.equal(ticket.order_number, "CA-10250");
  assert.deepEqual(ticket.retrieved_doc_ids, ["returns-refunds", "faq"]);
  assert.equal(ticket.transcript.length, 2);
  assert.deepEqual(ticket.triggers, ["refund_over_approval_limit"]);
  assert.equal(ticket.opened_on, ANCHOR_TODAY);
});

test("C7: the customer-facing sentence comes from the system, not the model", () => {
  // contracts/tools.md §3 — the reply-time promise is a constant so the model
  // can't improvise a number the team then has to honour.
  const escalate = createEscalateToHuman();
  const result = escalate({ category: "wholesale", summary: "Café asking about bulk pricing." });

  assert.deepEqual(Object.keys(result).sort(), [
    "expected_reply",
    "tell_customer",
    "ticket_id",
  ]);
  assert.equal(result.expected_reply, HANDOFF_EXPECTED_REPLY);
  assert.equal(result.tell_customer, HANDOFF_TELL_CUSTOMER);
  assert.match(result.ticket_id, /^ESC-\d{4}$/);
});

test("C7: the ticket id is deterministic — same content, same id, every run", () => {
  const escalate = createEscalateToHuman();
  const input = { category: "medical", summary: "Asked about caffeine while pregnant." } as const;

  const first = escalate(input, CONTEXT);
  const second = escalate(input, CONTEXT);
  assert.equal(first.ticket_id, second.ticket_id);

  // And across a fresh factory: no hidden counter, no clock, no randomness.
  assert.equal(createEscalateToHuman()(input, CONTEXT).ticket_id, first.ticket_id);
});

test("C7: different content produces a different id", () => {
  const escalate = createEscalateToHuman();
  const a = escalate({ category: "medical", summary: "Caffeine and pregnancy." }, CONTEXT);
  const b = escalate({ category: "medical", summary: "Caffeine and blood pressure." }, CONTEXT);
  const c = escalate({ category: "wholesale", summary: "Caffeine and pregnancy." }, CONTEXT);

  assert.notEqual(a.ticket_id, b.ticket_id);
  assert.notEqual(a.ticket_id, c.ticket_id);
});

test("C7: the id does not move when the wall clock does", () => {
  // The only date input is the injected one. If `Date.now()` were reachable from
  // here, these two would differ on a run that straddles midnight.
  const escalate = createEscalateToHuman();
  const input = { category: "other", summary: "Something odd." } as const;

  const withAnchor = escalate(input, { ...CONTEXT, today: ANCHOR_TODAY });
  const withDefault = escalate(input, { ...CONTEXT, today: undefined });
  assert.equal(withAnchor.ticket_id, withDefault.ticket_id);
});

test("C7: the order number falls back to the model's argument when the runtime has none", () => {
  const queue = createTicketQueue();
  const escalate = createEscalateToHuman({ emit: queue.emit });

  escalate(
    { category: "other", summary: "Asked about a promo code.", order_number: "CA-10241" },
    { retrievedDocIds: [] },
  );

  assert.equal(queue.tickets[0]?.order_number, "CA-10241");
});

test("C7: a ticket with no order at all records null rather than an empty string", () => {
  const queue = createTicketQueue();
  createEscalateToHuman({ emit: queue.emit })({
    category: "press_or_partnership",
    summary: "Journalist asking about sourcing.",
  });

  const ticket = queue.tickets[0]!;
  assert.equal(ticket.order_number, null);
  assert.deepEqual(ticket.retrieved_doc_ids, []);
  assert.deepEqual(ticket.transcript, []);
  assert.equal(ticket.injection_suspected, false, "absent means false, not undefined");
});

test("C7: an injection flag is recorded on the ticket and changes its id", () => {
  const queue = createTicketQueue();
  const escalate = createEscalateToHuman({ emit: queue.emit });
  const input = { category: "money_commitment", summary: "Refund demanded." } as const;

  const clean = escalate(input, { ...CONTEXT, injectionSuspected: false });
  const flagged = escalate(input, { ...CONTEXT, injectionSuspected: true });

  assert.equal(queue.tickets[0]?.injection_suspected, false);
  assert.equal(queue.tickets[1]?.injection_suspected, true);
  // Two materially different tickets must not collapse onto one id.
  assert.notEqual(clean.ticket_id, flagged.ticket_id);
});

test("C7: a sequential id strategy is available for a queue that wants ordered ids", () => {
  const nextId = createSequentialTicketIds(4417);
  const escalate = createEscalateToHuman({ ticketId: nextId });

  assert.equal(escalate({ category: "other", summary: "one" }).ticket_id, "ESC-4417");
  assert.equal(escalate({ category: "other", summary: "two" }).ticket_id, "ESC-4418");
  assert.ok(TICKET_ID_PREFIX === "ESC-");
});

test("C7: the ticket is a snapshot — mutating the context afterwards doesn't rewrite it", () => {
  const queue = createTicketQueue();
  const docIds = ["shipping"];
  createEscalateToHuman({ emit: queue.emit })(
    { category: "other", summary: "s" },
    { retrievedDocIds: docIds },
  );

  docIds.push("faq");
  assert.deepEqual(queue.tickets[0]?.retrieved_doc_ids, ["shipping"]);
});
