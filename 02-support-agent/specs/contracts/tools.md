# Tool contracts

Three tools, no functional overlap. If a human engineer can't say with certainty
which tool applies in a given situation, neither can the model — so the boundaries
below are drawn to make that decision trivial.

Each tool is **self-contained, robust to error, and unambiguous about its intended
use**. Descriptions are prescriptive about *when* to call, not just what the tool
does — trigger conditions in the description measurably raise should-call rate.

---

## 1. `lookup_order`

```json
{
  "name": "lookup_order",
  "description": "Look up the current state of a single order. Call this whenever the customer asks where their order is, when it will arrive, whether it shipped, what was in it, or whether it can still be changed or returned — and any time you would otherwise have to guess at a date or a status. Never state an order's status without calling this first. Requires an order number (format CA-XXXXX) or the email the order was placed with; if you have neither, ask for one rather than calling with a guess.",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_number": {
        "type": "string",
        "description": "Order number as printed in the confirmation email, e.g. CA-10241."
      },
      "email": {
        "type": "string",
        "description": "Email the order was placed with. Use only when no order number is available."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns** an `OrderEnvelope` — a shaped subset, never the raw order:

```json
{
  "found": true,
  "order_number": "CA-10244",
  "status": "in_transit",
  "placed_at": "2026-07-26",
  "shipped_at": "2026-07-27",
  "delivered_at": null,
  "estimated_delivery": null,
  "tracking_state": "stalled",
  "days_since_last_movement": 7,
  "line_items": [{ "title": "Volcán Dark / French Press / 1kg", "qty": 1 }],
  "is_gift": false,
  "subscription_id": null,
  "refund_eligible": true,
  "requires_approval": false,
  "notes": ["Tracking has not moved in 7 days, past the 5-business-day threshold."]
}
```

**Never returned:** shipping address, customer email, full tracking number, payment
method, order total. A stranger with a guessed order number learns nothing useful
(spec §8). This is enforced by an allowlist in the mapper, not by prompt.

**Not found** — three distinct reasons, never a thrown error, so the model can
recover and ask for a correction:

```json
{ "found": false, "reason": "no_match" }
```

| `reason` | Meaning | What the agent should do |
|---|---|---|
| `no_match` | Identifier looks valid, no such order | Ask them to re-check the number |
| `missing_identifier` | No order number and no email supplied | Ask for one |
| `lookup_failed` | The store API failed | Say it can't be checked right now, escalate |

The first draft of this contract had only `no_match`. Collapsing the three means
reporting a Shopify outage to a customer as "that order doesn't exist" — a false
statement about their money, and exactly the kind of confident wrongness spec §B1
exists to prevent.

**`notes`** is the one place the tool does interpretation: it surfaces
policy-relevant facts the model would otherwise have to derive from raw dates.
Deriving "7 days is past the threshold" in code rather than in the model is
deliberate — it's arithmetic against a written policy, and code doesn't get it
wrong.

---

## 2. `search_help_center`

```json
{
  "name": "search_help_center",
  "description": "Search the store's help documents for a policy, product detail, or brewing instruction. Relevant documents are already provided to you for the customer's opening question — call this only when their follow-up moves to a different topic, or when the provided context does not contain the specific rule you need. Do not call it to re-read something you were already given.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "What you need to find, phrased as the customer would phrase it."
      }
    },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

**Returns** at most 4 chunks:

```json
{
  "results": [
    {
      "doc_id": "returns-refunds",
      "heading": "If something is wrong with the coffee",
      "text": "We refund or replace, no return needed…",
      "authority": "canonical"
    }
  ],
  "below_relevance_floor": false
}
```

`below_relevance_floor: true` means nothing matched well enough. That is a signal
to escalate, **not** to answer from pretrained knowledge about coffee or consumer
law.

---

## 3. `escalate_to_human`

```json
{
  "name": "escalate_to_human",
  "description": "Hand this conversation to a person. Call this when the documents don't support an answer, when the customer asks for a human, when money must be committed (a refund, credit, or reship you would otherwise be promising), or when the topic is wholesale, press, legal, or medical. Escalating is always safe; guessing is not. Do not apologise for escalating or ask the customer's permission first — call the tool and tell them it's been handed over.",
  "input_schema": {
    "type": "object",
    "properties": {
      "category": {
        "type": "string",
        "enum": [
          "no_supporting_document", "money_commitment", "wholesale",
          "press_or_partnership", "legal_or_dispute", "medical",
          "customer_requested", "outside_policy_window", "other"
        ]
      },
      "summary": {
        "type": "string",
        "description": "One or two sentences a human can act on without reading the transcript."
      },
      "order_number": {
        "type": "string",
        "description": "Include when known — it saves the human a lookup."
      }
    },
    "required": ["category", "summary"],
    "additionalProperties": false
  }
}
```

**Returns:**

```json
{
  "ticket_id": "ESC-4417",
  "expected_reply": "within one business day",
  "tell_customer": "I've passed this to the team — they reply within one business day, Mon–Fri 9–5 ET."
}
```

`tell_customer` exists so the promise the customer hears comes from **the system**,
not from the model improvising a response time.

---

## Deliberately absent

| Not a tool | Why |
|---|---|
| `issue_refund` / `cancel_order` / `update_subscription` | v1 is read-only (spec §6). No write actions, so no write tools. |
| `get_product` | The catalog is in the retrieval corpus. A separate tool would create an ambiguous boundary with `search_help_center` — exactly the failure mode a minimal tool set exists to prevent. |
| `send_email` | The helpdesk owns outbound. |
| `calculate_shipping` | Shipping rules are a document, not a computation. |
