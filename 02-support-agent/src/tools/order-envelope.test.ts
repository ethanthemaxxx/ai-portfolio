import { test } from "node:test";
import assert from "node:assert/strict";

import { loadFixtureOrders } from "./fixture-order-source.ts";
import {
  deriveRefundFlags,
  deriveTrackingState,
  ENVELOPE_KEYS,
  NEVER_DISCLOSED_FIELDS,
  toOrderEnvelope,
  toWire,
} from "./order-envelope.ts";
import { ANCHOR_TODAY } from "./policy.ts";
import type { RawOrder } from "./types.ts";

const ORDERS = loadFixtureOrders();

function fixture(orderNumber: string): RawOrder {
  const found = ORDERS.find((o) => o.order_number === orderNumber);
  if (!found) throw new Error(`fixture ${orderNumber} is missing from orders.json`);
  return found;
}

function envelope(orderNumber: string) {
  return toOrderEnvelope(fixture(orderNumber), { today: ANCHOR_TODAY });
}

// ===========================================================================
// C1 — the privacy allowlist
// ===========================================================================

test("C1: the envelope's key set is exactly the allowlist, for every fixture order", () => {
  const allowed = ENVELOPE_KEYS.map(([camel]) => camel).sort();

  for (const raw of ORDERS) {
    const keys = Object.keys(toOrderEnvelope(raw, { today: ANCHOR_TODAY })).sort();
    assert.deepEqual(keys, allowed, `${raw.order_number} exposed an unexpected key set`);
  }
});

test("C1: the wire shape's key set is exactly the allowlist plus `found`", () => {
  const allowed = ["found", ...ENVELOPE_KEYS.map(([, snake]) => snake)].sort();

  for (const raw of ORDERS) {
    const keys = Object.keys(toWire(toOrderEnvelope(raw, { today: ANCHOR_TODAY }))).sort();
    assert.deepEqual(keys, allowed, `${raw.order_number} exposed an unexpected wire key set`);
  }
});

test("C1: none of the fields spec §8 forbids appears anywhere in the envelope", () => {
  for (const raw of ORDERS) {
    const wire = toWire(toOrderEnvelope(raw, { today: ANCHOR_TODAY })) as Record<string, unknown>;
    for (const forbidden of NEVER_DISCLOSED_FIELDS) {
      assert.equal(
        Object.hasOwn(wire, forbidden),
        false,
        `${raw.order_number} exposed "${forbidden}"`,
      );
    }
  }
});

test("C1: no high-entropy customer value survives into the serialised envelope", () => {
  // The key-set assertion above is the real guarantee. This one catches a value
  // that got smuggled into a note or a line-item title.
  for (const raw of ORDERS) {
    const serialised = JSON.stringify(toWire(toOrderEnvelope(raw, { today: ANCHOR_TODAY })));
    const secrets = [
      raw.email,
      raw.customer_name,
      raw.recipient_name,
      raw.tracking_number,
      raw.tracking_company,
      raw.shipping_address,
    ].filter((v): v is string => typeof v === "string" && v.length > 0);

    for (const secret of secrets) {
      assert.equal(
        serialised.includes(secret),
        false,
        `${raw.order_number} leaked "${secret}"`,
      );
    }
  }
});

test("C1: a new field on the raw order does not appear in the envelope", () => {
  // The allowlist has to fail closed. Omission-based redaction would pass this
  // test today and fail it the day the store adds a column.
  const raw = {
    ...fixture("CA-10241"),
    payment_method: "visa ending 4242",
    shipping_address: "12 Peachtree St, Atlanta GA 30303",
    internal_risk_score: 0.91,
  } as unknown as RawOrder;

  const wire = toWire(toOrderEnvelope(raw, { today: ANCHOR_TODAY })) as Record<string, unknown>;
  assert.equal(Object.hasOwn(wire, "payment_method"), false);
  assert.equal(Object.hasOwn(wire, "shipping_address"), false);
  assert.equal(Object.hasOwn(wire, "internal_risk_score"), false);
  assert.equal(JSON.stringify(wire).includes("4242"), false);
});

test("C1: line items keep the title and the quantity, and drop the price", () => {
  const wire = toWire(envelope("CA-10250"));
  assert.equal(wire.line_items.length, 3);
  for (const item of wire.line_items) {
    assert.deepEqual(Object.keys(item).sort(), ["qty", "title"]);
  }
  assert.equal(JSON.stringify(wire.line_items).includes("69"), false, "unit price leaked");
});

test("C1: every fixture order maps without throwing", () => {
  for (const raw of ORDERS) {
    assert.doesNotThrow(() => toOrderEnvelope(raw, { today: ANCHOR_TODAY }), raw.order_number);
  }
});

// ===========================================================================
// C2 — trackingState and daysSinceLastMovement
// ===========================================================================

test("C2: CA-10244 is stalled — 7 calendar days, which is 5 business days", () => {
  // "stalled 7 days: crosses the 5-business-day threshold" (fixture `_tests`)
  const e = envelope("CA-10244");
  assert.equal(e.trackingState, "stalled");
  assert.equal(e.daysSinceLastMovement, 7);
  assert.equal(
    e.notes[0],
    "Tracking has not moved in 7 days, past the 5-business-day threshold.",
  );
});

test("C2: CA-10242 is moving — shipped yesterday, nowhere near the threshold", () => {
  const e = envelope("CA-10242");
  assert.equal(e.trackingState, "moving");
  assert.equal(e.daysSinceLastMovement, 1);
  assert.equal(e.estimatedDelivery, "2026-08-06");
  assert.deepEqual(e.notes, []);
});

test("C2: CA-10252 (Hawaii) is moving, not stalled — 4 calendar days is 2 business days", () => {
  // The stall threshold is business days on purpose. A Friday ship date and a
  // Tuesday question is a weekend, not a problem.
  const e = envelope("CA-10252");
  assert.equal(e.trackingState, "moving");
  assert.equal(e.daysSinceLastMovement, 4);
});

test("C2: a delivered order is `delivered` regardless of anything else", () => {
  const e = envelope("CA-10241");
  assert.equal(e.trackingState, "delivered");
  assert.equal(e.deliveredAt, "2026-08-03");
  assert.equal(e.daysSinceLastMovement, 1);
});

test("C2: an unfulfilled order with no label is `none`", () => {
  const e = envelope("CA-10243");
  assert.equal(e.trackingState, "none");
  assert.equal(e.daysSinceLastMovement, null);
  assert.equal(e.status, "unfulfilled");
});

test("C2: a cancelled order is `none`, not whatever the carrier last said", () => {
  const e = envelope("CA-10251");
  assert.equal(e.status, "cancelled");
  assert.equal(e.trackingState, "none");
  assert.equal(e.daysSinceLastMovement, null);
});

test("C2: a label with no ship scan is `label_created`", () => {
  const raw: RawOrder = {
    ...fixture("CA-10243"),
    tracking_number: "9400100000000000000099",
  };
  delete raw.shipped_at;
  const derived = deriveTrackingState(raw, { today: ANCHOR_TODAY });
  assert.equal(derived.trackingState, "label_created");
  assert.equal(derived.daysSinceLastMovement, null);
});

test("C2: shipped today with no movement scan is `label_created`, not `stalled`", () => {
  // shipping.md: the carrier can take 24 hours to show the first scan, and that
  // "is normal and not a sign of a problem".
  const raw: RawOrder = {
    ...fixture("CA-10242"),
    shipped_at: ANCHOR_TODAY,
    last_tracking_movement: null,
  };
  const e = toOrderEnvelope(raw, { today: ANCHOR_TODAY });
  assert.equal(e.trackingState, "label_created");
  assert.equal(e.daysSinceLastMovement, 0);
  assert.match(e.notes[0] ?? "", /up to 24 hours/);
});

test("C2: the stall threshold is exactly 5 business days, not 4", () => {
  const base = fixture("CA-10244");

  // Wed 29 Jul → Tue 4 Aug: Thu, Fri, Mon, Tue = 4 business days.
  const four = deriveTrackingState(
    { ...base, last_tracking_movement: "2026-07-29" },
    { today: ANCHOR_TODAY },
  );
  assert.equal(four.businessDaysSinceLastMovement, 4);
  assert.equal(four.trackingState, "moving");

  // Tue 28 Jul → Tue 4 Aug: 5 business days.
  const five = deriveTrackingState(
    { ...base, last_tracking_movement: "2026-07-28" },
    { today: ANCHOR_TODAY },
  );
  assert.equal(five.businessDaysSinceLastMovement, 5);
  assert.equal(five.trackingState, "stalled");
});

// ===========================================================================
// C3 — refundEligible and requiresApproval
// ===========================================================================

test("C3: CA-10246 was delivered 41 days ago and is outside the 30-day window", () => {
  const e = envelope("CA-10246");
  assert.equal(e.refundEligible, false);
  assert.equal(e.requiresApproval, false);
  assert.ok(
    e.notes.some((n) => n === "Delivered 41 days ago, past the 30-day window in the returns policy."),
    `expected a 41-day note, got ${JSON.stringify(e.notes)}`,
  );
});

test("C3: CA-10250 totals $170 and needs supervisor approval", () => {
  const e = envelope("CA-10250");
  assert.equal(e.requiresApproval, true);
  assert.equal(e.refundEligible, true, "delivered yesterday — the window is open");
  assert.ok(e.notes.some((n) => n.includes("$150")));
});

test("C3: the approval threshold is strictly above $150", () => {
  const base = fixture("CA-10250");
  assert.equal(deriveRefundFlags({ ...base, total: 150 }).requiresApproval, false);
  assert.equal(deriveRefundFlags({ ...base, total: 150.01 }).requiresApproval, true);
});

test("C3: the refund window is 30 days from delivery, inclusive of day 30", () => {
  const base = fixture("CA-10241");
  const at = (delivered: string) =>
    deriveRefundFlags({ ...base, delivered_at: delivered }, { today: ANCHOR_TODAY });

  assert.equal(at("2026-07-05").daysSinceDelivery, 30);
  assert.equal(at("2026-07-05").refundEligible, true, "day 30 is still inside");
  assert.equal(at("2026-07-04").daysSinceDelivery, 31);
  assert.equal(at("2026-07-04").refundEligible, false, "day 31 is outside");
});

test("C3: an order that hasn't been delivered is still eligible — the window starts at delivery", () => {
  const e = envelope("CA-10244");
  assert.equal(e.deliveredAt, null);
  assert.equal(e.refundEligible, true);
});

test("C3: an already-refunded order is not eligible for a second refund", () => {
  // CA-10251 exists so the agent never promises a refund that already happened.
  const e = envelope("CA-10251");
  assert.equal(e.refundEligible, false);
  assert.ok(e.notes.some((n) => n.includes("already refunded")));
});

// ===========================================================================
// notes — the interpretation the tool does so the model doesn't have to
// ===========================================================================

test("notes: CA-10247 flags a bag roasted 20 days before it was delivered", () => {
  const e = envelope("CA-10247");
  assert.ok(
    e.notes.some((n) => n === "Roast date on the bag is 20 days before delivery, past the 14-day limit in the returns policy."),
    JSON.stringify(e.notes),
  );
});

test("notes: CA-10245 is inside the 7-day window for a package marked delivered but missing", () => {
  const e = envelope("CA-10245");
  assert.ok(
    e.notes.some((n) => n.includes("7-day window") && n.includes("2 days ago")),
    JSON.stringify(e.notes),
  );
});

test("notes: CA-10243 says the order can still be changed", () => {
  const e = envelope("CA-10243");
  assert.ok(e.notes.some((n) => n.includes("Not roasted yet") && n.includes("2026-08-05")));
});

test("notes: CA-10248 says the subscription is still editable before the charge", () => {
  const e = envelope("CA-10248");
  assert.equal(e.subscriptionId, "SUB-3391");
  assert.ok(e.notes.some((n) => n.includes("2026-08-06") && n.includes("skip, pause and swap")));
});

test("notes: CA-10249 says a gift refund can only go to the purchaser", () => {
  const e = envelope("CA-10249");
  assert.equal(e.isGift, true);
  assert.ok(e.notes.some((n) => n.includes("recipient") && n.includes("purchaser")));
});

test("notes: are deterministic across runs", () => {
  for (const raw of ORDERS) {
    const a = toOrderEnvelope(raw, { today: ANCHOR_TODAY });
    const b = toOrderEnvelope(raw, { today: ANCHOR_TODAY });
    assert.deepEqual(a, b, raw.order_number);
  }
});

// ===========================================================================
// The worked example in contracts/tools.md
// ===========================================================================

test("the CA-10244 envelope matches the example in contracts/tools.md", () => {
  const wire = toWire(envelope("CA-10244"));
  assert.deepEqual(wire, {
    found: true,
    order_number: "CA-10244",
    status: "in_transit",
    placed_at: "2026-07-26",
    shipped_at: "2026-07-27",
    delivered_at: null,
    estimated_delivery: null,
    tracking_state: "stalled",
    days_since_last_movement: 7,
    // The contract prints this title with an accent ("Volcán"); orders.json
    // spells it without one. The fixture is the source of truth for data.
    line_items: [{ title: "Volcan Dark / French Press / 1kg", qty: 1 }],
    is_gift: false,
    subscription_id: null,
    refund_eligible: true,
    requires_approval: false,
    notes: ["Tracking has not moved in 7 days, past the 5-business-day threshold."],
  });
});
