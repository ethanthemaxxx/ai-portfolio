/**
 * D7 — the composed evaluator.
 *
 * Runs all seven triggers from plan.md §7 and returns one decision. Six of them
 * are pure functions over text, dates and an order envelope; the seventh is the
 * model's own `escalate_to_human` call. Escalation fires when **any** of them
 * hold, and the model cannot override the other six.
 *
 * There is no model call in this file, no network, and no clock.
 */

import { createEscalateToHuman, type EscalationContext, type EscalationTicket } from "../tools/escalate-to-human.ts";
import type { EscalationCategory } from "../tools/types.ts";
import {
  looksLikeInstructionOverride,
  TRIGGERS,
  type EscalationSignals,
  type EscalationTrigger,
  type TriggerId,
} from "./triggers.ts";

export type EscalationDecision = {
  escalate: boolean;
  /** Every trigger that fired, in the plan.md §7 table order. */
  triggers: EscalationTrigger[];
  /** The most specific trigger — the one whose category the ticket carries. */
  primary: EscalationTrigger | null;
  category: EscalationCategory | null;
  reason: string | null;
  /** True only when the model's judgement is the *sole* reason this escalated. */
  modelOnly: boolean;
  /**
   * The message contained an attempt to reprogram the agent. Recorded for the
   * logs and carried onto the ticket — never used to suppress a trigger. An
   * injection frame that could switch escalation off would be a bypass, not a
   * defence (spec §8).
   */
  injectionSuspected: boolean;
};

/**
 * Which trigger the ticket is filed under when several fire.
 *
 * Ranked by how precisely the trigger tells a human what to do — "this is a
 * wholesale enquiry" routes itself, "retrieval found nothing" does not. The
 * ranking only picks the label; every trigger that fired is on the decision, and
 * all of them reach the ticket.
 */
const SPECIFICITY: TriggerId[] = [
  "cannot_answer_here",
  "refund_over_approval_limit",
  "money_commitment",
  "delivery_outside_refund_window",
  "customer_requested_human",
  "retrieval_below_floor",
  "model_requested",
];

export function evaluateEscalation(signals: EscalationSignals): EscalationDecision {
  const triggers = TRIGGERS.map((rule) => rule(signals)).filter(isTrigger);

  const primary =
    [...triggers].sort((a, b) => SPECIFICITY.indexOf(a.id) - SPECIFICITY.indexOf(b.id))[0] ?? null;

  const deterministic = triggers.filter((t) => t.deterministic);

  return {
    escalate: triggers.length > 0,
    triggers,
    primary,
    category: primary?.category ?? null,
    reason: primary?.reason ?? null,
    modelOnly: triggers.length > 0 && deterministic.length === 0,
    injectionSuspected: looksLikeInstructionOverride(signals.message),
  };
}

/** The deterministic subset, for the release gate that has to hold without a model. */
export function deterministicTriggers(signals: EscalationSignals): EscalationTrigger[] {
  return evaluateEscalation(signals).triggers.filter((t) => t.deterministic);
}

export type EscalationRunOptions = {
  context?: EscalationContext | undefined;
  emit?: ((ticket: EscalationTicket) => void) | undefined;
};

export type EscalationOutcome = {
  decision: EscalationDecision;
  /** Present only when the decision was to escalate. */
  handoff: { ticket_id: string; expected_reply: string; tell_customer: string } | null;
};

/**
 * Evaluate, and file the ticket if it escalates.
 *
 * The summary on the ticket comes from the model when the model supplied one and
 * from the winning trigger otherwise — so a deterministic escalation still
 * produces a sentence a human can act on with no model in the loop.
 */
export function runEscalation(
  signals: EscalationSignals,
  options: EscalationRunOptions = {},
): EscalationOutcome {
  const decision = evaluateEscalation(signals);
  if (!decision.escalate || !decision.primary) {
    return { decision, handoff: null };
  }

  const escalate = createEscalateToHuman(options.emit ? { emit: options.emit } : {});
  const context: EscalationContext = {
    ...options.context,
    triggers: decision.triggers.map((t) => t.id),
    today: options.context?.today ?? signals.today,
    // The human picking this up should know the message tried to reprogram the
    // agent, even though it changed nothing about how it was routed.
    injectionSuspected: decision.injectionSuspected,
  };
  if (signals.order?.orderNumber && context.orderNumber === undefined) {
    context.orderNumber = signals.order.orderNumber;
  }

  const summary =
    signals.modelEscalation?.summary?.trim() ||
    decision.triggers.map((t) => t.reason).join(" ");

  const handoff = escalate({ category: decision.primary.category, summary }, context);
  return { decision, handoff };
}

function isTrigger(value: EscalationTrigger | null): value is EscalationTrigger {
  return value !== null;
}
