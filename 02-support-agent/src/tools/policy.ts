/**
 * Every number in this file is a quotation, not a decision.
 *
 * The policy documents are the only authority (spec §8). When a threshold moves,
 * it moves in `00-brand-demo/policies/` first and here second — and the citation
 * on each constant is what makes that check a five-second job instead of a grep.
 */

/**
 * The fixture anchor date. Nothing in this codebase calls `Date.now()`: an eval
 * suite whose expectations drift with the wall clock stops being a test
 * (plan.md §10).
 */
export const ANCHOR_TODAY = "2026-08-04";

/**
 * shipping.md → "Late, lost and stolen packages": *"if tracking hasn't moved in
 * 5 business days, contact us and we'll open a carrier trace and reship at no
 * cost."* Business days, not calendar days — a package that last moved on a
 * Friday is not stalled on the following Wednesday.
 */
export const STALL_THRESHOLD_BUSINESS_DAYS = 5;

/**
 * returns-refunds.md → "If something is wrong with the coffee": *"Contact us
 * within 30 days of delivery"*, restated under "What we don't refund" as
 * *"Orders reported more than 30 days after delivery"*. Calendar days.
 */
export const REFUND_WINDOW_DAYS = 30;

/**
 * shipping.md → "Marked delivered but missing": *"contact us within 7 days of
 * the delivery scan. We reship once per address at no charge."*
 */
export const MISSING_PACKAGE_WINDOW_DAYS = 7;

/**
 * returns-refunds.md → *"Roast date on the bag is more than 14 days before
 * delivery"* is a defect, refund or replace with no return.
 */
export const STALE_ROAST_DAYS = 14;

/**
 * faq.md → "Things we can't answer here": *"Refunds above $150, which need a
 * supervisor's approval."* Strictly above — $150.00 exactly does not need one.
 */
export const APPROVAL_THRESHOLD_USD = 150;

/**
 * shipping.md → "Tracking": *"It can take USPS up to 24 hours to show the first
 * movement scan — a tracking number that says 'label created' the next morning
 * is normal and not a sign of a problem."*
 */
export const LABEL_SCAN_GRACE_DAYS = 1;

/**
 * The wording customers hear when a ticket is handed over. It lives in code, not
 * in the prompt, so the response-time promise is the system's and not something
 * the model improvised (contracts/tools.md §3).
 */
export const HANDOFF_EXPECTED_REPLY = "within one business day";
export const HANDOFF_TELL_CUSTOMER =
  "I've passed this to the team — they reply within one business day, Mon–Fri 9–5 ET.";
