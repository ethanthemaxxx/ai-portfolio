/**
 * Date arithmetic for policy thresholds.
 *
 * Two rules hold everywhere in this file:
 *
 * 1. **Everything is UTC.** Dates arrive as `YYYY-MM-DD` and are compared as
 *    whole days. Parsing them in local time would make a threshold flip on a
 *    machine in a different timezone, which is exactly the class of bug you
 *    cannot reproduce.
 * 2. **"Today" is a parameter.** It defaults to the fixture anchor and is never
 *    read from the clock (plan.md §10).
 */

import { ANCHOR_TODAY } from "./policy.ts";

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` → epoch-day index. Rejects anything else rather than guessing. */
export function toEpochDay(isoDate: string): number {
  if (!ISO_DATE.test(isoDate)) {
    throw new TypeError(`Expected a YYYY-MM-DD date, received "${isoDate}"`);
  }
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  // V8 rolls impossible dates forward — `2026-02-30` parses as 2 March. The
  // round-trip is what actually rejects them, and a date that quietly shifts by
  // two days is precisely the kind of error a threshold check must not absorb.
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== isoDate) {
    throw new TypeError(`Not a real calendar date: "${isoDate}"`);
  }
  return Math.floor(ms / MS_PER_DAY);
}

export function toIsoDate(epochDay: number): string {
  return new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(isoDate: string): number {
  return new Date(toEpochDay(isoDate) * MS_PER_DAY).getUTCDay();
}

export function isWeekend(isoDate: string): boolean {
  const d = dayOfWeek(isoDate);
  return d === 0 || d === 6;
}

/**
 * Whole calendar days from `from` to `to`. Negative if `to` precedes `from`.
 *
 * This is the number the customer counts, and it is what the tool reports as
 * `days_since_last_movement` — "it's been 7 days" is the fact they recognise.
 * The 5-business-day *threshold* is measured separately, below.
 */
export function calendarDaysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

/**
 * Business days elapsed after `from`, up to and including `to`. Weekends are
 * excluded; `holidays` is accepted but empty by default.
 *
 * We do not ship a US federal holiday table. shipping.md says *"We don't ship on
 * federal holidays"* without listing them, and inventing a calendar the policy
 * doesn't state would be exactly the kind of unsupported claim spec §B1 forbids.
 * The parameter is here so a merchant's real calendar can be injected later.
 */
export function businessDaysBetween(
  from: string,
  to: string,
  holidays: ReadonlySet<string> = new Set(),
): number {
  const start = toEpochDay(from);
  const end = toEpochDay(to);
  if (end <= start) return 0;

  let count = 0;
  for (let day = start + 1; day <= end; day++) {
    const iso = toIsoDate(day);
    if (!isWeekend(iso) && !holidays.has(iso)) count++;
  }
  return count;
}

/** The default "today" for every derivation in this layer. */
export function today(override?: string | undefined): string {
  return override ?? ANCHOR_TODAY;
}
