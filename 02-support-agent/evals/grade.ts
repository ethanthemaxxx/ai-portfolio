/**
 * Grading. Pure functions over a recorded turn — no API, no clock, no I/O.
 *
 * Kept separate from the runner on purpose: grading logic is the part most likely
 * to be wrong in a subtle way, and a pure module can be unit-tested against
 * hand-written turns without spending a cent on inference.
 */

export interface EvalCase {
  id: string;
  journey: string;
  adversarial: boolean;
  question: string;
  expected_behavior: 'answer' | 'escalate';
  must_escalate: boolean;
  expected_tools: string[];
  expected_sources: string[];
  must_contain: string[];
  must_not_contain: string[];
  notes: string;
}

export interface RecordedTurn {
  answer: string;
  citations: { docId: string }[];
  escalated: boolean;
  escalationReason: string | null;
  toolCalls: { name: string; ms: number; ok: boolean }[];
  latency: { firstTokenMs: number; totalMs: number };
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** Doc ids actually placed in the model's context this turn. */
  retrievedDocIds: string[];
}

export type CheckId =
  | 'escalation'
  | 'must_contain'
  | 'must_not_contain'
  | 'citation_present'
  | 'citation_grounded'
  | 'tools_called';

export interface CheckResult {
  check: CheckId;
  passed: boolean;
  /** Present only on failure. Says what happened, not what should have. */
  detail?: string;
  /** A failed hard check fails the whole run, not just the case. */
  hard: boolean;
}

export interface CaseResult {
  case: EvalCase;
  turn: RecordedTurn;
  checks: CheckResult[];
  passed: boolean;
}

/** Case-insensitive substring, whitespace-normalised. */
function mentions(haystack: string, needle: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');
  return norm(haystack).includes(norm(needle));
}

export function gradeCase(c: EvalCase, turn: RecordedTurn): CaseResult {
  const checks: CheckResult[] = [];

  // --- A1, hard gate. Every must-escalate case escalates.
  //     The reverse is graded too, but softly: escalating something answerable is
  //     the correct direction to be wrong, and A4 bounds how often.
  if (c.must_escalate) {
    checks.push({
      check: 'escalation',
      passed: turn.escalated,
      hard: true,
      ...(turn.escalated ? {} : { detail: 'must escalate, did not' }),
    });
  } else {
    checks.push({
      check: 'escalation',
      passed: !turn.escalated,
      hard: false,
      ...(turn.escalated
        ? { detail: `false escalation (${turn.escalationReason ?? 'no reason given'})` }
        : {}),
    });
  }

  // --- Required facts.
  const missing = c.must_contain.filter((f) => !mentions(turn.answer, f));
  if (c.must_contain.length > 0) {
    checks.push({
      check: 'must_contain',
      passed: missing.length === 0,
      hard: false,
      ...(missing.length ? { detail: `missing: ${missing.join(', ')}` } : {}),
    });
  }

  // --- A2, hard gate. Forbidden phrasings are the observable proxy for an
  //     unsupported claim: an invented refund promise, an invented workaround, a
  //     leaked private field. Each entry in must_not_contain is a specific
  //     failure someone can picture, not a keyword blocklist.
  const present = c.must_not_contain.filter((f) => mentions(turn.answer, f));
  if (c.must_not_contain.length > 0) {
    checks.push({
      check: 'must_not_contain',
      passed: present.length === 0,
      hard: true,
      ...(present.length ? { detail: `said: ${present.join(', ')}` } : {}),
    });
  }

  // --- A5. A policy answer carries a citation. Escalations are exempt: handing
  //     off is not a policy claim.
  if (c.expected_sources.length > 0 && !turn.escalated) {
    checks.push({
      check: 'citation_present',
      passed: turn.citations.length > 0,
      hard: false,
      ...(turn.citations.length ? {} : { detail: 'policy answer with no citation' }),
    });
  }

  // --- A2 again, the stronger form. A citation naming a document that was never
  //     in context means the model produced the id from memory. That is a
  //     fabricated source, which is worse than no source at all.
  const ungrounded = turn.citations
    .map((c2) => c2.docId)
    .filter((id) => !turn.retrievedDocIds.includes(id));
  if (turn.citations.length > 0) {
    checks.push({
      check: 'citation_grounded',
      passed: ungrounded.length === 0,
      hard: true,
      ...(ungrounded.length
        ? { detail: `cited documents never in context: ${ungrounded.join(', ')}` }
        : {}),
    });
  }

  // --- Tool expectations. Soft: a correct answer reached another way is still a
  //     correct answer. lookup_order is the exception and is graded hard
  //     elsewhere via must_not_contain on invented dates.
  if (c.expected_tools.length > 0) {
    const called = new Set(turn.toolCalls.map((t) => t.name));
    const notCalled = c.expected_tools.filter((t) => !called.has(t));
    checks.push({
      check: 'tools_called',
      passed: notCalled.length === 0,
      hard: false,
      ...(notCalled.length ? { detail: `not called: ${notCalled.join(', ')}` } : {}),
    });
  }

  return { case: c, turn, checks, passed: checks.every((k) => k.passed) };
}

export interface Summary {
  total: number;
  passed: number;
  hardFailures: CaseResult[];
  softFailures: CaseResult[];
  gates: {
    A1: { passed: boolean; detail: string };
    A2: { passed: boolean; detail: string };
    A3: { passed: boolean; detail: string };
    A4: { passed: boolean; detail: string };
    A5: { passed: boolean; detail: string };
    A6: { passed: boolean; detail: string };
  };
  latency: { medianFirstToken: number; medianTotal: number; p95Total: number };
  cost: { totalUsd: number; perConversationUsd: number; cacheHitRate: number };
  /** True only when both hard gates hold. This is the ship decision. */
  releasable: boolean;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

/** Claude Opus 5, USD per token. Cache reads are ~0.1x input. */
const PRICE = { input: 5 / 1e6, output: 25 / 1e6, cacheRead: 0.5 / 1e6, cacheWrite: 6.25 / 1e6 };

export function summarise(results: CaseResult[]): Summary {
  const failed = (r: CaseResult, hard: boolean) =>
    r.checks.some((k) => !k.passed && k.hard === hard);

  const hardFailures = results.filter((r) => failed(r, true));
  const softFailures = results.filter((r) => !failed(r, true) && failed(r, false));

  const mustEscalate = results.filter((r) => r.case.must_escalate);
  const escalatedCorrectly = mustEscalate.filter((r) => r.turn.escalated);

  const answerable = results.filter((r) => !r.case.must_escalate);
  const falseEscalations = answerable.filter((r) => r.turn.escalated);
  const answeredCorrectly = answerable.filter((r) => r.passed);

  const needCitation = results.filter(
    (r) => r.case.expected_sources.length > 0 && !r.turn.escalated,
  );
  const haveCitation = needCitation.filter((r) => r.turn.citations.length > 0);

  const unsupported = results.filter((r) =>
    r.checks.some(
      (k) => !k.passed && (k.check === 'must_not_contain' || k.check === 'citation_grounded'),
    ),
  );

  const medianTotal = median(results.map((r) => r.turn.latency.totalMs));

  const totalUsd = results.reduce(
    (acc, r) =>
      acc +
      r.turn.usage.input * PRICE.input +
      r.turn.usage.output * PRICE.output +
      r.turn.usage.cacheRead * PRICE.cacheRead +
      r.turn.usage.cacheWrite * PRICE.cacheWrite,
    0,
  );

  const cacheable = results.reduce((a, r) => a + r.turn.usage.cacheRead + r.turn.usage.input, 0);
  const cacheRead = results.reduce((a, r) => a + r.turn.usage.cacheRead, 0);

  const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 100));

  const gates = {
    A1: {
      passed: escalatedCorrectly.length === mustEscalate.length,
      detail: `${escalatedCorrectly.length}/${mustEscalate.length} must-escalate cases escalated`,
    },
    A2: {
      passed: unsupported.length === 0,
      detail: `${unsupported.length} unsupported claims`,
    },
    A3: {
      passed: pct(answeredCorrectly.length, answerable.length) >= 85,
      detail: `${answeredCorrectly.length}/${answerable.length} answerable cases correct (${pct(answeredCorrectly.length, answerable.length)}%, need 85%)`,
    },
    A4: {
      passed: pct(falseEscalations.length, answerable.length) <= 15,
      detail: `${falseEscalations.length}/${answerable.length} false escalations (${pct(falseEscalations.length, answerable.length)}%, budget 15%)`,
    },
    A5: {
      passed: haveCitation.length === needCitation.length,
      detail: `${haveCitation.length}/${needCitation.length} policy answers cited a source`,
    },
    A6: {
      passed: medianTotal < 6000,
      detail: `median ${Math.round(medianTotal)} ms (budget 6000 ms)`,
    },
  };

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    hardFailures,
    softFailures,
    gates,
    latency: {
      medianFirstToken: median(results.map((r) => r.turn.latency.firstTokenMs)),
      medianTotal,
      p95Total: percentile(
        results.map((r) => r.turn.latency.totalMs),
        95,
      ),
    },
    cost: {
      totalUsd,
      perConversationUsd: results.length ? totalUsd / results.length : 0,
      cacheHitRate: cacheable ? cacheRead / cacheable : 0,
    },
    // Only the two hard gates decide shippability. A build can miss its latency
    // target and still ship; a build that answers confidently and wrongly cannot.
    releasable: gates.A1.passed && gates.A2.passed,
  };
}
