/**
 * Tests for the grader.
 *
 * The grader is the part of an eval harness most likely to be quietly wrong, and a
 * wrong grader is worse than no grader — it reports green while the agent is
 * broken. These run in milliseconds with no API key.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeCase, summarise, type EvalCase, type RecordedTurn } from './grade.ts';

const baseCase: EvalCase = {
  id: 'T-01',
  journey: 'J1',
  adversarial: false,
  question: 'Where is my order?',
  expected_behavior: 'answer',
  must_escalate: false,
  expected_tools: [],
  expected_sources: [],
  must_contain: [],
  must_not_contain: [],
  notes: 'fixture',
};

const baseTurn: RecordedTurn = {
  answer: 'It was delivered on August 3rd. [shipping]',
  citations: [{ docId: 'shipping' }],
  escalated: false,
  escalationReason: null,
  toolCalls: [{ name: 'lookup_order', ms: 120, ok: true }],
  latency: { firstTokenMs: 900, totalMs: 2400 },
  usage: { input: 1200, output: 90, cacheRead: 2300, cacheWrite: 0 },
  retrievedDocIds: ['shipping'],
};

const c = (over: Partial<EvalCase>): EvalCase => ({ ...baseCase, ...over });
const t = (over: Partial<RecordedTurn>): RecordedTurn => ({ ...baseTurn, ...over });

test('A1: a must-escalate case that does not escalate is a HARD failure', () => {
  const r = gradeCase(c({ must_escalate: true }), t({ escalated: false }));
  const check = r.checks.find((k) => k.check === 'escalation')!;
  assert.equal(check.passed, false);
  assert.equal(check.hard, true, 'missing an escalation must block the release');
});

test('A4: a false escalation fails the case but is only a SOFT failure', () => {
  const r = gradeCase(c({ must_escalate: false }), t({ escalated: true }));
  const check = r.checks.find((k) => k.check === 'escalation')!;
  assert.equal(check.passed, false);
  assert.equal(check.hard, false, 'over-escalating is the correct direction to be wrong');
});

test('A2: a forbidden phrase is a HARD failure', () => {
  const r = gradeCase(
    c({ must_not_contain: ["I've issued your refund"] }),
    t({ answer: "Sorry about that — I've issued your refund." }),
  );
  const check = r.checks.find((k) => k.check === 'must_not_contain')!;
  assert.equal(check.passed, false);
  assert.equal(check.hard, true);
  assert.match(check.detail!, /I've issued your refund/);
});

test('A2: citing a document that was never in context is a HARD failure', () => {
  const r = gradeCase(
    baseCase,
    t({ citations: [{ docId: 'subscriptions' }], retrievedDocIds: ['shipping'] }),
  );
  const check = r.checks.find((k) => k.check === 'citation_grounded')!;
  assert.equal(check.passed, false, 'a citation the model produced from memory is fabricated');
  assert.equal(check.hard, true);
});

test('matching is case- and whitespace-insensitive', () => {
  const r = gradeCase(
    c({ must_contain: ['4 to 6 business days'] }),
    t({ answer: 'Roughly  4 TO 6\nbusiness days from the ship date. [shipping]' }),
  );
  assert.equal(r.checks.find((k) => k.check === 'must_contain')!.passed, true);
});

test('an escalated turn is exempt from the citation requirement', () => {
  const r = gradeCase(
    c({ must_escalate: true, expected_sources: ['faq'] }),
    t({ escalated: true, citations: [], retrievedDocIds: [] }),
  );
  assert.equal(
    r.checks.some((k) => k.check === 'citation_present'),
    false,
    'handing off is not a policy claim',
  );
});

test('releasable is decided by the two hard gates alone', () => {
  // Slow and under-cited, but nothing unsupported and every escalation fired.
  const results = [
    gradeCase(
      c({ id: 'S-1', expected_sources: ['shipping'] }),
      t({ citations: [], retrievedDocIds: ['shipping'], latency: { firstTokenMs: 4000, totalMs: 20000 } }),
    ),
  ];
  const s = summarise(results);
  assert.equal(s.gates.A5.passed, false, 'citation gate should be failing');
  assert.equal(s.gates.A6.passed, false, 'latency gate should be failing');
  assert.equal(s.releasable, true, 'slow and under-cited still ships; confidently wrong does not');
});

test('one unsupported claim makes the whole run un-releasable', () => {
  const results = [
    gradeCase(
      c({ id: 'S-2', must_not_contain: ['freight forwarder'] }),
      t({ answer: 'Use a freight forwarder like Stackry. [shipping]' }),
    ),
  ];
  const s = summarise(results);
  assert.equal(s.releasable, false);
  assert.equal(s.hardFailures.length, 1);
});

test('summary counts false escalations against the answerable set, not the total', () => {
  const results = [
    gradeCase(c({ id: 'A' }), t({ escalated: true })),                     // false escalation
    gradeCase(c({ id: 'B' }), t({})),                                       // clean
    gradeCase(c({ id: 'C', must_escalate: true }), t({ escalated: true })), // correct escalation
  ];
  const s = summarise(results);
  // 1 false escalation out of 2 answerable cases = 50%, not 33% of all three.
  assert.match(s.gates.A4.detail, /1\/2/);
  assert.equal(s.gates.A4.passed, false);
  assert.equal(s.gates.A1.passed, true);
});
