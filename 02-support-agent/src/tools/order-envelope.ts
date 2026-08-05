/**
 * C1–C3 — the raw order → `OrderEnvelope` mapper.
 *
 * This is the privacy boundary of the whole system. The agent never verifies
 * identity (spec §6), so a stranger who guesses an order number must learn
 * nothing useful (spec §8). That guarantee is made here, in one function, with
 * an **allowlist** — `ENVELOPE_KEYS` is the complete set of fields that can ever
 * reach the model. Adding a field to the raw order does not add it to the
 * envelope; someone has to come here and say so.
 *
 * The alternative — deleting sensitive fields on the way out — fails the moment
 * the store adds a column nobody remembered to delete. An allowlist fails closed.
 */

import { businessDaysBetween, calendarDaysBetween, today } from "./dates.ts";
import {
  APPROVAL_THRESHOLD_USD,
  LABEL_SCAN_GRACE_DAYS,
  MISSING_PACKAGE_WINDOW_DAYS,
  REFUND_WINDOW_DAYS,
  STALE_ROAST_DAYS,
  STALL_THRESHOLD_BUSINESS_DAYS,
} from "./policy.ts";
import type {
  LineItem,
  OrderEnvelope,
  OrderStatus,
  RawOrder,
  TrackingState,
} from "./types.ts";

/**
 * The allowlist, and the camelCase ↔ snake_case mapping in one place.
 *
 * `plan.md` §8 defines the internal type in camelCase; `contracts/tools.md`
 * defines the wire shape in snake_case. Deriving both from this single table
 * means the two can't drift, and there is exactly one list to review when
 * someone asks "can the agent see the shipping address?"
 */
export const ENVELOPE_KEYS = [
  ["orderNumber", "order_number"],
  ["status", "status"],
  ["placedAt", "placed_at"],
  ["shippedAt", "shipped_at"],
  ["deliveredAt", "delivered_at"],
  ["estimatedDelivery", "estimated_delivery"],
  ["trackingState", "tracking_state"],
  ["daysSinceLastMovement", "days_since_last_movement"],
  ["lineItems", "line_items"],
  ["isGift", "is_gift"],
  ["subscriptionId", "subscription_id"],
  ["refundEligible", "refund_eligible"],
  ["requiresApproval", "requires_approval"],
  ["notes", "notes"],
] as const satisfies ReadonlyArray<readonly [keyof OrderEnvelope, string]>;

/**
 * Test oracle only — the enforcement is `ENVELOPE_KEYS` above, not this list.
 * It exists so the assertion in the test reads as the requirement from spec §8
 * rather than as a diff of two key arrays.
 */
export const NEVER_DISCLOSED_FIELDS = [
  "email",
  "customer_name",
  "recipient_name",
  "shipping_address",
  "shipping_state",
  "tracking_number",
  "tracking_company",
  "payment_method",
  "financial_status",
  "total",
  "price",
  "_tests",
] as const;

export type DeriveOptions = {
  /** "Today", injected. Defaults to the fixture anchor — never the wall clock. */
  today?: string | undefined;
  /** Non-shipping days, if a merchant calendar is available. */
  holidays?: ReadonlySet<string> | undefined;
};

/** The snake_case wire shape from contracts/tools.md, plus the `found` discriminant. */
export type OrderEnvelopeWire = {
  found: true;
  order_number: string;
  status: OrderStatus;
  placed_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery: string | null;
  tracking_state: TrackingState;
  days_since_last_movement: number | null;
  line_items: LineItem[];
  is_gift: boolean;
  subscription_id: string | null;
  refund_eligible: boolean;
  requires_approval: boolean;
  notes: string[];
};

// ---------------------------------------------------------------------------
// C1 — the mapper
// ---------------------------------------------------------------------------

export function toOrderEnvelope(raw: RawOrder, options: DeriveOptions = {}): OrderEnvelope {
  const now = today(options.today);
  const status = deriveStatus(raw);
  const tracking = deriveTrackingState(raw, options);
  const refund = deriveRefundFlags(raw, options);

  // Annotated as OrderEnvelope so the compiler rejects an extra field, then
  // filtered through the allowlist so the runtime rejects one too.
  const derived: OrderEnvelope = {
    orderNumber: raw.order_number,
    status,
    placedAt: raw.created_at,
    shippedAt: raw.shipped_at ?? null,
    deliveredAt: raw.delivered_at ?? null,
    estimatedDelivery: raw.estimated_delivery ?? null,
    trackingState: tracking.trackingState,
    daysSinceLastMovement: tracking.daysSinceLastMovement,
    lineItems: raw.line_items.map(toLineItem),
    isGift: raw.is_gift ?? false,
    subscriptionId: raw.subscription_id ?? null,
    refundEligible: refund.refundEligible,
    requiresApproval: refund.requiresApproval,
    notes: buildNotes(raw, { status, tracking, refund, now }),
  };

  return pickAllowedKeys(derived);
}

/** Serialise to the wire shape in contracts/tools.md. Same allowlist, one hop later. */
export function toWire(envelope: OrderEnvelope): OrderEnvelopeWire {
  const wire: Record<string, unknown> = { found: true };
  for (const [camel, snake] of ENVELOPE_KEYS) {
    wire[snake] = envelope[camel];
  }
  return wire as OrderEnvelopeWire;
}

function pickAllowedKeys(derived: OrderEnvelope): OrderEnvelope {
  const out: Record<string, unknown> = {};
  for (const [key] of ENVELOPE_KEYS) {
    out[key] = derived[key];
  }
  return out as OrderEnvelope;
}

/** Line items lose their SKU and their price. The price is the order total in pieces. */
function toLineItem(item: { title: string; qty: number }): LineItem {
  return { title: item.title, qty: item.qty };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const KNOWN_STATUSES = new Set<OrderStatus>([
  "unfulfilled",
  "in_transit",
  "fulfilled",
  "cancelled",
]);

export function deriveStatus(raw: RawOrder): OrderStatus {
  if (raw.cancelled_at) return "cancelled";
  const value = raw.fulfillment_status?.toLowerCase() as OrderStatus | undefined;
  // An unrecognised status resolves to the least-committal value rather than
  // being forwarded verbatim: the model must never see a state it can't reason
  // about, and "unfulfilled" is the answer that provokes a lookup, not a promise.
  return value && KNOWN_STATUSES.has(value) ? value : "unfulfilled";
}

// ---------------------------------------------------------------------------
// C2 — tracking state and days since last movement
// ---------------------------------------------------------------------------

export type TrackingDerivation = {
  trackingState: TrackingState;
  daysSinceLastMovement: number | null;
  /** The date the calculation ran from, kept for the note text. */
  lastMovementAt: string | null;
  businessDaysSinceLastMovement: number | null;
};

/**
 * The five states, in the order they're decided:
 *
 * - `delivered`  — there is a delivery scan. Nothing else matters.
 * - `none`       — cancelled, or nothing has been handed to a carrier and no
 *                  label exists.
 * - `label_created` — a label exists but the carrier hasn't scanned movement.
 *                  shipping.md allows 24 hours for the first scan, so a shipment
 *                  that left today is "label created", not "stalled".
 * - `stalled`    — ≥ 5 **business** days since the last movement (shipping.md).
 * - `moving`     — everything else.
 *
 * `daysSinceLastMovement` is reported in **calendar** days even though the
 * threshold is measured in business days. That split is deliberate and it is
 * what the contract example shows: the customer counts "7 days", the policy
 * counts "5 business days", and both statements are true of CA-10244.
 */
export function deriveTrackingState(
  raw: RawOrder,
  options: DeriveOptions = {},
): TrackingDerivation {
  const now = today(options.today);
  const holidays = options.holidays ?? new Set<string>();
  const none: TrackingDerivation = {
    trackingState: "none",
    daysSinceLastMovement: null,
    lastMovementAt: null,
    businessDaysSinceLastMovement: null,
  };

  if (deriveStatus(raw) === "cancelled") return none;

  if (raw.delivered_at) {
    return {
      trackingState: "delivered",
      daysSinceLastMovement: calendarDaysBetween(raw.delivered_at, now),
      lastMovementAt: raw.delivered_at,
      businessDaysSinceLastMovement: businessDaysBetween(raw.delivered_at, now, holidays),
    };
  }

  if (!raw.shipped_at) {
    // A tracking number with no ship scan is a printed label and nothing more.
    return raw.tracking_number
      ? { ...none, trackingState: "label_created" }
      : none;
  }

  const lastMovementAt = raw.last_tracking_movement ?? raw.shipped_at;
  const calendarDays = calendarDaysBetween(lastMovementAt, now);
  const businessDays = businessDaysBetween(lastMovementAt, now, holidays);
  const base = {
    daysSinceLastMovement: calendarDays,
    lastMovementAt,
    businessDaysSinceLastMovement: businessDays,
  };

  if (businessDays >= STALL_THRESHOLD_BUSINESS_DAYS) {
    return { ...base, trackingState: "stalled" };
  }

  // No movement scan of its own, and inside the grace period the carrier is
  // allowed: this is the "label created the next morning is normal" case.
  const hasMovementScan = Boolean(raw.last_tracking_movement);
  if (!hasMovementScan && calendarDays < LABEL_SCAN_GRACE_DAYS) {
    return { ...base, trackingState: "label_created" };
  }

  return { ...base, trackingState: "moving" };
}

// ---------------------------------------------------------------------------
// C3 — refund eligibility and approval
// ---------------------------------------------------------------------------

export type RefundDerivation = {
  refundEligible: boolean;
  requiresApproval: boolean;
  alreadyRefunded: boolean;
  daysSinceDelivery: number | null;
};

/**
 * `refundEligible` is the 30-day window in returns-refunds.md, and nothing more.
 * It answers "is the door still open", not "will we say yes" — the reason for a
 * refund (defect, preference, unopened) is a judgement the documents make and a
 * human executes (spec §B3).
 *
 * Three cases:
 * - **Already refunded or cancelled** → false. There is nothing left to refund,
 *   and CA-10251 exists to stop the agent promising a second one.
 * - **Delivered** → the window is `delivered_at + 30 calendar days`.
 * - **Not yet delivered** → true. The window is measured *from delivery*, so it
 *   has not started, let alone expired.
 *
 * `requiresApproval` is faq.md's *"Refunds above $150, which need a supervisor's
 * approval"*, evaluated against the order total. The total itself never leaves
 * this function — the boolean is the only thing that crosses into the envelope,
 * which is how the escalation machine can gate on value without the value ever
 * entering the model's context.
 */
export function deriveRefundFlags(
  raw: RawOrder,
  options: DeriveOptions = {},
): RefundDerivation {
  const now = today(options.today);
  const requiresApproval = raw.total > APPROVAL_THRESHOLD_USD;
  const alreadyRefunded =
    raw.financial_status?.toLowerCase() === "refunded" || deriveStatus(raw) === "cancelled";
  const daysSinceDelivery = raw.delivered_at ? calendarDaysBetween(raw.delivered_at, now) : null;

  if (alreadyRefunded) {
    return { refundEligible: false, requiresApproval, alreadyRefunded, daysSinceDelivery };
  }

  const refundEligible =
    daysSinceDelivery === null ? true : daysSinceDelivery <= REFUND_WINDOW_DAYS;

  return { refundEligible, requiresApproval, alreadyRefunded, daysSinceDelivery };
}

// ---------------------------------------------------------------------------
// notes — the one place the tool interprets
// ---------------------------------------------------------------------------

type NoteContext = {
  status: OrderStatus;
  tracking: TrackingDerivation;
  refund: RefundDerivation;
  now: string;
};

/**
 * Arithmetic against a written policy, done in code because code doesn't get it
 * wrong (contracts/tools.md). Each note states a fact and names the rule it
 * comes from, so the model can cite rather than reason.
 *
 * Order is fixed, so two runs over the same fixture produce identical output.
 */
export function buildNotes(raw: RawOrder, ctx: NoteContext): string[] {
  const notes: string[] = [];
  const { tracking, refund } = ctx;

  if (tracking.trackingState === "stalled" && tracking.daysSinceLastMovement !== null) {
    notes.push(
      `Tracking has not moved in ${tracking.daysSinceLastMovement} days, past the ` +
        `${STALL_THRESHOLD_BUSINESS_DAYS}-business-day threshold.`,
    );
  }

  if (tracking.trackingState === "label_created") {
    notes.push(
      "Label created but no movement scan yet; the carrier can take up to 24 hours " +
        "to show the first scan.",
    );
  }

  if (
    tracking.trackingState === "delivered" &&
    tracking.daysSinceLastMovement !== null &&
    tracking.daysSinceLastMovement <= MISSING_PACKAGE_WINDOW_DAYS
  ) {
    notes.push(
      `Delivered ${daysAgo(tracking.daysSinceLastMovement)}, inside the ` +
        `${MISSING_PACKAGE_WINDOW_DAYS}-day window for a package marked delivered but missing.`,
    );
  }

  if (raw.roast_date_on_bag && raw.delivered_at) {
    const age = calendarDaysBetween(raw.roast_date_on_bag, raw.delivered_at);
    if (age > STALE_ROAST_DAYS) {
      notes.push(
        `Roast date on the bag is ${age} days before delivery, past the ` +
          `${STALE_ROAST_DAYS}-day limit in the returns policy.`,
      );
    }
  }

  if (refund.alreadyRefunded) {
    notes.push("This order was already refunded or cancelled; there is nothing left to refund.");
  } else if (!refund.refundEligible && refund.daysSinceDelivery !== null) {
    notes.push(
      `Delivered ${daysAgo(refund.daysSinceDelivery)}, past the ${REFUND_WINDOW_DAYS}-day ` +
        `window in the returns policy.`,
    );
  }

  if (refund.requiresApproval) {
    notes.push(
      `Order total is above the $${APPROVAL_THRESHOLD_USD} threshold, so any refund needs ` +
        "supervisor approval.",
    );
  }

  if (ctx.status === "unfulfilled" && raw.next_roast_date) {
    notes.push(
      `Not roasted yet — next roast is ${raw.next_roast_date}, so the order can still be changed.`,
    );
  }

  if (raw.subscription_id && raw.next_charge_at) {
    notes.push(
      `Next subscription charge is ${raw.next_charge_at}; skip, pause and swap are all ` +
        "possible until then.",
    );
  }

  if (raw.is_gift) {
    notes.push(
      "Gift order: the recipient can request a replacement, but a refund can only go to " +
        "the purchaser's original payment method.",
    );
  }

  return notes;
}

/** Notes are read out loud to a customer, so "1 days ago" is not acceptable output. */
function daysAgo(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
