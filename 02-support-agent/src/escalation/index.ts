/** Group D — the escalation state machine. Deterministic; no model in the loop. */

export { deterministicTriggers, evaluateEscalation, runEscalation } from "./evaluate.ts";
export type {
  EscalationDecision,
  EscalationOutcome,
  EscalationRunOptions,
} from "./evaluate.ts";

export {
  CANNOT_ANSWER_TOPICS,
  cannotAnswerHere,
  customerRequestedHuman,
  deliveryOutsideRefundWindow,
  INSTRUCTION_OVERRIDE_PATTERNS,
  looksLikeInstructionOverride,
  looksLikePolicyQuestion,
  modelRequestedEscalation,
  moneyCommitmentRequested,
  normalise,
  refundOverApprovalLimit,
  refundRequested,
  retrievalBelowFloor,
  returnsClaimRequested,
  TRIGGERS,
} from "./triggers.ts";
export type {
  CannotAnswerTopic,
  EscalationSignals,
  EscalationTrigger,
  TriggerId,
} from "./triggers.ts";
