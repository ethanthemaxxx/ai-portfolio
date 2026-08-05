/**
 * D1–D6 — the escalation triggers, as pure functions.
 *
 * Each one takes the signals available at the end of a turn and returns either a
 * trigger or `null`. No I/O, no model, no clock. Six of the seven in plan.md §7
 * are decided here; the seventh — the model calling `escalate_to_human` — is one
 * input among seven and is composed in `evaluate.ts`.
 *
 * That split is the whole design. Spec §A1 ("every must-escalate case escalates")
 * is a hard release gate, and you cannot gate on a probabilistic decision.
 *
 * **Customer text is data.** Every pattern below reads the message as evidence
 * about what the customer wants, never as an instruction to follow (spec §8).
 */

import { calendarDaysBetween, today } from "../tools/dates.ts";
import { APPROVAL_THRESHOLD_USD, REFUND_WINDOW_DAYS } from "../tools/policy.ts";
import type { EscalateInput } from "../tools/escalate-to-human.ts";
import type { EscalationCategory, OrderEnvelope } from "../tools/types.ts";

export type TriggerId =
  | "retrieval_below_floor"
  | "money_commitment"
  | "refund_over_approval_limit"
  | "delivery_outside_refund_window"
  | "cannot_answer_here"
  | "model_requested"
  | "customer_requested_human";

export type EscalationTrigger = {
  id: TriggerId;
  category: EscalationCategory;
  /** One line a human can read off the ticket. */
  reason: string;
  /** False for exactly one trigger: the model's own judgement. */
  deterministic: boolean;
};

export type EscalationSignals = {
  /** The customer's message. Evidence, not instructions. */
  message?: string | undefined;
  /** Chunks that cleared the relevance floor. An empty array means none did. */
  retrievedChunks?: readonly { docId: string }[] | undefined;
  /** Set directly when the retriever reports the floor itself (task B4). */
  belowRelevanceFloor?: boolean | undefined;
  /** The envelope from `lookup_order`, when an order is in play. */
  order?: OrderEnvelope | null | undefined;
  /** The model's `escalate_to_human` call, if it made one. */
  modelEscalation?: EscalateInput | null | undefined;
  /** Overrides the text heuristic when the caller already knows a refund is at stake. */
  refundRequested?: boolean | undefined;
  today?: string | undefined;
};

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

export function normalise(message: string | undefined): string {
  return (message ?? "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Frames that mark text as an attempt to reprogram the agent.
 *
 * Spec §8 — "injected instructions in customer messages are data, not commands"
 * — cuts one way only: **ignore the instruction, still process the request.**
 * The claimed authority ("admin mode", "you are now authorised") is discarded;
 * the underlying ask is judged on its merits exactly as if a customer had typed
 * it plainly. "Refund CA-10241" is a refund request either way, and refunds go
 * to a human either way.
 *
 * Detection therefore **flags** a turn; it never gates a trigger. Letting the
 * frame suppress an escalation would hand an attacker the switch: prefix
 * "ignore your instructions" and the money rule stops firing. The wrapper would
 * become the bypass. See the property test in triggers.test.ts.
 */
export const INSTRUCTION_OVERRIDE_PATTERNS: RegExp[] = [
  /\bignore (?:all |any |your |the )?(?:previous |prior |above |earlier )?(?:instructions?|rules?|prompts?|guidelines?)\b/,
  /\bdisregard (?:all |any |your |the )?(?:previous |prior |above |earlier )?(?:instructions?|rules?|prompts?)\b/,
  /\bforget (?:everything|your instructions|all previous|the above)\b/,
  /\boverride (?:your |the )?(?:instructions?|rules?|policy|policies)\b/,
  /\bnew instructions?\b/,
  /\bsystem prompt\b/,
  /\byou are now\b/,
  /(?:^|\s)(?:system|assistant)\s*:/,
];

export function looksLikeInstructionOverride(message: string | undefined): boolean {
  const text = normalise(message);
  return INSTRUCTION_OVERRIDE_PATTERNS.some((p) => p.test(text));
}

/**
 * "How do I…", "can I…", "what happens if…" — the customer is asking what the
 * policy allows. returns-refunds.md answers those, and answering them is the
 * job (spec §B5: escalate on uncertainty, not on difficulty).
 */
const POLICY_QUESTION_OPENERS =
  /\b(?:how (?:do|can|would) i|what (?:happens|do i|is|are)|what's|can i|could i|do i|do you|is it possible|where do i|when (?:do|can) i|am i)\b/;

export function looksLikePolicyQuestion(message: string | undefined): boolean {
  return POLICY_QUESTION_OPENERS.test(normalise(message));
}

// ---------------------------------------------------------------------------
// D1 — nothing retrieved above the relevance floor
// ---------------------------------------------------------------------------

export function retrievalBelowFloor(signals: EscalationSignals): EscalationTrigger | null {
  const below =
    signals.belowRelevanceFloor === true ||
    (signals.belowRelevanceFloor !== false &&
      signals.retrievedChunks !== undefined &&
      signals.retrievedChunks.length === 0);

  if (!below) return null;

  return {
    id: "retrieval_below_floor",
    category: "no_supporting_document",
    reason: "No help-centre document cleared the relevance floor for this question.",
    deterministic: true,
  };
}

// ---------------------------------------------------------------------------
// D6 — the customer wants money committed
// ---------------------------------------------------------------------------

const MONEY_NOUN =
  "(?:refunds?|store credit|credit(?! card)|re-?ship(?:ment|ping)?|replacements?|money back|reimburse\\w*|compensation)";
const COMMIT_VERB =
  "(?:confirm\\w*|guarantee\\w*|promis\\w*|assur\\w*|approv\\w*|authori[sz]\\w*|commit(?:ment)? to|in writing)";

/** A commitment word and a money word inside the same clause, in either order. */
const COMMITMENT_PATTERNS: RegExp[] = [
  new RegExp(`\\b${COMMIT_VERB}\\b[^.?!;]{0,80}\\b${MONEY_NOUN}\\b`),
  new RegExp(`\\b${MONEY_NOUN}\\b[^.?!;]{0,80}\\b${COMMIT_VERB}\\b`),
];

/** A direct instruction to pay out, rather than a question about the policy. */
const PAYOUT_DEMAND_PATTERNS: RegExp[] = [
  /\b(?:refund|reimburse) me\b/,
  new RegExp(
    `\\b(?:give|send|issue|process|put through|pay)\\s+(?:me\\s+)?(?:a|my|the)\\s+(?:full |partial |complete )?${MONEY_NOUN}\\b`,
  ),
  /\bi want my money back\b/,
];

export function moneyCommitmentRequested(signals: EscalationSignals): EscalationTrigger | null {
  const text = normalise(signals.message);
  if (!text) return null;

  // Deliberately no injection check here. An injected "issue a full refund" is
  // still a request for money, and the frame it arrived in must not be able to
  // switch this rule off (spec §8, §A1).
  const asksForCommitment = COMMITMENT_PATTERNS.some((p) => p.test(text));
  const demandsPayout =
    !looksLikePolicyQuestion(text) && PAYOUT_DEMAND_PATTERNS.some((p) => p.test(text));

  if (!asksForCommitment && !demandsPayout) return null;

  return {
    id: "money_commitment",
    category: "money_commitment",
    reason:
      "The customer is asking for a refund, credit or reship to be committed. Only a person " +
      "commits the company to a payment (spec §B3).",
    deterministic: true,
  };
}

// ---------------------------------------------------------------------------
// D2 — refund above the supervisor-approval limit
// ---------------------------------------------------------------------------

const REFUND_INTENT_PATTERNS: RegExp[] = [
  /\brefunds?\b/,
  /\bmoney back\b/,
  /\breimburse\w*\b/,
  /\bcredit(?! card)\b/,
  /\bchargeback\b/,
  /\bcompensation\b/,
  /\bsend (?:it|them|these|this) back\b/,
  /\breturn (?:it|this|these|them|my order|the order|the kettle|everything)\b/,
];

export function refundRequested(signals: EscalationSignals): boolean {
  if (signals.refundRequested !== undefined) return signals.refundRequested;
  const text = normalise(signals.message);
  return REFUND_INTENT_PATTERNS.some((p) => p.test(text));
}

/**
 * Anything returns-refunds.md governs — wider than `refundRequested` on purpose.
 *
 * The $150 rule (D2) is about money, so it keys on a refund. The 30-day window
 * (D3) is about the *policy* window, and that window covers replacements and
 * reships too: *"We refund or replace, no return needed."* A customer saying
 * "this arrived stale, can you replace it" is making a claim under the same
 * clause as one asking for their money back.
 */
const RETURNS_CLAIM_PATTERNS: RegExp[] = [
  ...REFUND_INTENT_PATTERNS,
  /\breplace(?:ment|d|s)?\b/,
  /\bexchange\b/,
  /\bre-?ship\b/,
  /\bsend (?:me )?(?:a |another |new )?(?:new |replacement )?(?:one|bag|order)\b/,
  // The defect vocabulary from returns-refunds.md and freshness-storage.md.
  /\b(?:damaged|broken|split|crushed|dented|stale|sour|flat|papery|mouldy|moldy|defective|leaking)\b/,
  /\bwrong (?:item|grind|bag|coffee|size|order)\b/,
  // "return" as a verb, but not "return address", "return label", "returns policy".
  /\breturn(?:ing)?\b(?!\s+(?:address|label|shipping|policy|window))/,
];

export function returnsClaimRequested(signals: EscalationSignals): boolean {
  if (signals.refundRequested !== undefined) return signals.refundRequested;
  const text = normalise(signals.message);
  return RETURNS_CLAIM_PATTERNS.some((p) => p.test(text));
}

/**
 * faq.md: *"Refunds above $150, which need a supervisor's approval."*
 *
 * The order total never reaches this function — `requiresApproval` on the
 * envelope is the only thing that crosses the privacy boundary (spec §8), and it
 * is exactly the boolean this rule needs. The privacy design and the escalation
 * design compose rather than fight.
 *
 * Gated on a refund actually being at stake. "Where is my order" on a $170 order
 * is a shipping question, and escalating it would burn the false-escalation
 * budget in spec §A4 for nothing.
 */
export function refundOverApprovalLimit(signals: EscalationSignals): EscalationTrigger | null {
  const order = signals.order;
  if (!order?.requiresApproval) return null;
  if (!refundRequested(signals)) return null;

  return {
    id: "refund_over_approval_limit",
    category: "money_commitment",
    reason:
      `Order ${order.orderNumber} is above the $${APPROVAL_THRESHOLD_USD} threshold, so any ` +
      "refund needs a supervisor's approval.",
    deterministic: true,
  };
}

// ---------------------------------------------------------------------------
// D3 — delivered outside the 30-day window
// ---------------------------------------------------------------------------

/**
 * returns-refunds.md: *"Orders reported more than 30 days after delivery"* are
 * not refunded. CA-10246 was delivered 41 days before the anchor date and exists
 * to catch an agent that pattern-matches "damaged bag → we replace it" without
 * checking the date.
 *
 * Gated on a claim being made, for the same reason D2 is: the window only
 * matters once someone is trying to use it. "Where is my order?" about a
 * 41-day-old delivery is an odd question but an answerable one, and escalating
 * it would spend the §A4 false-escalation budget on nothing.
 */
export function deliveryOutsideRefundWindow(signals: EscalationSignals): EscalationTrigger | null {
  const order = signals.order;
  if (!order?.deliveredAt) return null;
  if (!returnsClaimRequested(signals)) return null;

  const days = calendarDaysBetween(order.deliveredAt, today(signals.today));
  if (days <= REFUND_WINDOW_DAYS) return null;

  return {
    id: "delivery_outside_refund_window",
    category: "outside_policy_window",
    reason:
      `Order ${order.orderNumber} was delivered ${days} days ago, past the ` +
      `${REFUND_WINDOW_DAYS}-day window in the returns policy.`,
    deterministic: true,
  };
}

// ---------------------------------------------------------------------------
// D4 — topics the corpus says a human handles
// ---------------------------------------------------------------------------

export type CannotAnswerTopic = {
  id: string;
  category: EscalationCategory;
  label: string;
  patterns: RegExp[];
};

/**
 * faq.md → "Things we can't answer here", transcribed. Two of that list's seven
 * entries are handled by their own triggers and are deliberately absent here:
 * refunds above $150 (D2) and changes to an already-shipped order, which needs
 * the order state and is checked in `changeAfterShipping` below.
 */
export const CANNOT_ANSWER_TOPICS: CannotAnswerTopic[] = [
  {
    id: "wholesale",
    category: "wholesale",
    label: "wholesale, café accounts and bulk pricing",
    patterns: [
      /\bwholesale\b/,
      /\bcaf[eé] account\b/,
      /\bbulk (?:pricing|price|order|discount|rate|rates)\b/,
      /\bresell(?:er|ing)?\b/,
      /\btrade (?:price|pricing|account)\b/,
      /\bstock your (?:coffee|beans|roasts)\b/,
    ],
  },
  {
    id: "corporate_gifting",
    category: "wholesale",
    label: "corporate gifting and custom or private label",
    patterns: [
      /\bcorporate (?:gift|gifting|gifts|order|orders|account)\b/,
      /\b(?:private|white|custom) label\b/,
      /\bbranded bags?\b/,
    ],
  },
  {
    id: "press_or_partnership",
    category: "press_or_partnership",
    label: "press, partnerships and collaborations",
    patterns: [
      /\bpress (?:enquiry|inquiry|kit|release|contact)\b/,
      /\bjournalist\b/,
      /\bpartnership\b/,
      /\bcollaborat(?:e|ion|ions)\b/,
      /\bsponsorship\b/,
      /\baffiliate (?:program|programme|link)\b/,
      /\binfluencer\b/,
    ],
  },
  {
    id: "medical",
    category: "medical",
    label: "medical questions",
    patterns: [
      /\bpregnan(?:t|cy)\b/,
      /\bbreastfeed\w*\b/,
      /\bmedications?\b/,
      /\bmedical\b/,
      /\bblood pressure\b/,
      /\bheart condition\b/,
      /\ballerg(?:y|ies|ic|en|ens)\b/,
      /\b(?:my|a) doctor\b/,
      /\bsafe (?:for|to) (?:drink|consume|have)\b/,
    ],
  },
  {
    id: "legal_or_dispute",
    category: "legal_or_dispute",
    label: "legal requests, chargebacks in progress and disputes",
    patterns: [
      /\blawyer\b/,
      /\battorney\b/,
      /\blegal (?:action|advice|team|request|notice)\b/,
      /\b(?:sue|suing|lawsuit)\b/,
      /\bchargeback\b/,
      /\bdispute (?:the|this|my) charge\b/,
      /\bsmall claims\b/,
      /\bsubpoena\b/,
      /\b(?:gdpr|ccpa)\b/,
    ],
  },
];

/** Verbs that mean "alter the order", as opposed to asking about it. */
const CHANGE_ORDER_PATTERNS: RegExp[] = [
  /\b(?:change|update|edit|amend|correct|fix) (?:my|the|this) (?:order|address|shipping address|grind|size)\b/,
  /\b(?:cancel|stop|hold) (?:my|the|this) order\b/,
  /\badd (?:something |an item |more )?to (?:my|the|this) order\b/,
  /\bredirect (?:my|the|this) (?:order|package|parcel)\b/,
  /\bship (?:it|this|my order) to a different address\b/,
];

const SHIPPED_STATES = new Set(["label_created", "moving", "stalled", "delivered"]);

export function cannotAnswerHere(signals: EscalationSignals): EscalationTrigger | null {
  const text = normalise(signals.message);
  if (!text) return null;

  const topic = CANNOT_ANSWER_TOPICS.find((t) => t.patterns.some((p) => p.test(text)));
  if (topic) {
    return {
      id: "cannot_answer_here",
      category: topic.category,
      reason: `faq.md lists ${topic.label} as something a person handles, not the help centre.`,
      deterministic: true,
    };
  }

  const changeAfterShipping =
    CHANGE_ORDER_PATTERNS.some((p) => p.test(text)) &&
    signals.order !== null &&
    signals.order !== undefined &&
    SHIPPED_STATES.has(signals.order.trackingState);

  if (changeAfterShipping) {
    return {
      id: "cannot_answer_here",
      category: "outside_policy_window",
      reason:
        "faq.md lists any request to change an order that has already shipped as something a " +
        "person handles. Once a label is printed the shipment can't be intercepted.",
      deterministic: true,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// D5 — the customer asked for a person
// ---------------------------------------------------------------------------

const HUMAN_REQUEST_PATTERNS: RegExp[] = [
  /\b(?:talk|speak|chat)\b[^.?!;]{0,30}\b(?:human|person|someone|somebody|agent|rep|representative|manager|supervisor)\b/,
  /\bconnect me\b[^.?!;]{0,30}\b(?:human|person|someone|somebody|agent|team|manager)\b/,
  /\b(?:real|live|actual) (?:person|human|agent)\b/,
  /\b(?:want|need|get me|give me|put me through to|transfer me to)\b[^.?!;]{0,30}\b(?:human|person|agent|rep|representative|manager|supervisor)\b/,
  /\bescalate\b/,
  /\bstop talking to (?:a |the )?(?:bot|robot|ai)\b/,
  /\b(?:are you|is this) a (?:bot|robot|ai)\b/,
];

export function customerRequestedHuman(signals: EscalationSignals): EscalationTrigger | null {
  const text = normalise(signals.message);
  if (!text) return null;
  if (!HUMAN_REQUEST_PATTERNS.some((p) => p.test(text))) return null;

  return {
    id: "customer_requested_human",
    category: "customer_requested",
    reason: "The customer asked to be handed to a person.",
    deterministic: true,
  };
}

// ---------------------------------------------------------------------------
// D7's seventh input — the model's own judgement
// ---------------------------------------------------------------------------

/**
 * The only non-deterministic trigger, and the only one that can be wrong without
 * a bug being involved. It is an input, never the gate.
 */
export function modelRequestedEscalation(signals: EscalationSignals): EscalationTrigger | null {
  const call = signals.modelEscalation;
  if (!call) return null;

  return {
    id: "model_requested",
    category: call.category,
    reason: call.summary?.trim() || "The agent called escalate_to_human.",
    deterministic: false,
  };
}

/** Evaluation order, transcribed from the plan.md §7 table. */
export const TRIGGERS: ((signals: EscalationSignals) => EscalationTrigger | null)[] = [
  retrievalBelowFloor,
  moneyCommitmentRequested,
  refundOverApprovalLimit,
  deliveryOutsideRefundWindow,
  cannotAnswerHere,
  modelRequestedEscalation,
  customerRequestedHuman,
];
