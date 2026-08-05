/**
 * Every threshold in `policy.ts` is supposed to be a quotation from the corpus,
 * not a number somebody picked. This test reads the policy documents and proves
 * it — so "we encoded the written rules" is a claim with a red test behind it
 * rather than a line in a README.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ANCHOR_TODAY,
  APPROVAL_THRESHOLD_USD,
  HANDOFF_EXPECTED_REPLY,
  HANDOFF_TELL_CUSTOMER,
  LABEL_SCAN_GRACE_DAYS,
  MISSING_PACKAGE_WINDOW_DAYS,
  REFUND_WINDOW_DAYS,
  STALE_ROAST_DAYS,
  STALL_THRESHOLD_BUSINESS_DAYS,
} from "./policy.ts";

function policy(docId: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../00-brand-demo/policies/${docId}.md`, import.meta.url)),
    "utf8",
  );
}

function contract(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../specs/${name}`, import.meta.url)), "utf8");
}

test("the stall threshold is the one shipping.md states", () => {
  const shipping = policy("shipping");
  assert.ok(shipping.includes(`${STALL_THRESHOLD_BUSINESS_DAYS} business days`));
  assert.ok(shipping.includes("tracking hasn't moved"));
  assert.equal(STALL_THRESHOLD_BUSINESS_DAYS, 5);
});

test("the missing-package window is the one shipping.md states", () => {
  const shipping = policy("shipping");
  assert.ok(shipping.includes(`${MISSING_PACKAGE_WINDOW_DAYS} days** of the delivery scan`));
  assert.equal(MISSING_PACKAGE_WINDOW_DAYS, 7);
});

test("the first-scan grace period is the 24 hours shipping.md allows", () => {
  assert.ok(policy("shipping").includes("up to 24 hours to show the first movement scan"));
  assert.equal(LABEL_SCAN_GRACE_DAYS, 1);
});

test("the refund window is the one returns-refunds.md states, in both places it states it", () => {
  const returns = policy("returns-refunds");
  assert.ok(returns.includes(`${REFUND_WINDOW_DAYS} days of delivery`));
  assert.ok(returns.includes(`more than **${REFUND_WINDOW_DAYS} days** after delivery`));
  assert.equal(REFUND_WINDOW_DAYS, 30);
});

test("the stale-roast limit is the one returns-refunds.md states", () => {
  assert.ok(policy("returns-refunds").includes(`more than **${STALE_ROAST_DAYS} days** before delivery`));
  assert.equal(STALE_ROAST_DAYS, 14);
});

test("the approval threshold is the one faq.md states, and it is a refund rule", () => {
  const faq = policy("faq");
  assert.ok(faq.includes(`Refunds above $${APPROVAL_THRESHOLD_USD}`));
  assert.ok(faq.includes("supervisor's approval"));
  assert.equal(APPROVAL_THRESHOLD_USD, 150);
});

test("faq.md's can't-answer list still contains the seven entries the machine encodes", () => {
  const list = policy("faq").split("## Things we can't answer here")[1] ?? "";
  assert.ok(list.length > 0, "the can't-answer section is missing from faq.md");

  for (const topic of [
    "Wholesale",
    "Corporate gifting",
    "Press, partnerships",
    "Anything medical",
    "Legal requests",
    "Refunds above $150",
    "already shipped",
  ]) {
    assert.ok(list.includes(topic), `faq.md no longer lists "${topic}"`);
  }
});

test("the anchor date is the one the plan fixes, and no clock is consulted", () => {
  assert.equal(ANCHOR_TODAY, "2026-08-04");
  assert.ok(contract("plan.md").includes("The eval anchor date is fixed (`2026-08-04`)"));
});

test("the handoff wording matches contracts/tools.md verbatim", () => {
  // The customer hears this sentence, so it is a constant rather than something
  // the model composes on the day.
  const tools = contract("contracts/tools.md");
  assert.ok(tools.includes(`"expected_reply": "${HANDOFF_EXPECTED_REPLY}"`));
  assert.ok(tools.includes(HANDOFF_TELL_CUSTOMER));
});
