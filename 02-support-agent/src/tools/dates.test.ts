import { test } from "node:test";
import assert from "node:assert/strict";

import {
  businessDaysBetween,
  calendarDaysBetween,
  dayOfWeek,
  isWeekend,
  toEpochDay,
  toIsoDate,
  today,
} from "./dates.ts";
import { ANCHOR_TODAY } from "./policy.ts";

test("dates: round-trips ISO days without timezone drift", () => {
  for (const iso of ["2026-01-01", "2026-06-24", "2026-08-04", "2026-12-31"]) {
    assert.equal(toIsoDate(toEpochDay(iso)), iso);
  }
});

test("dates: rejects anything that isn't a YYYY-MM-DD date", () => {
  assert.throws(() => toEpochDay("2026-8-4"), TypeError);
  assert.throws(() => toEpochDay("04/08/2026"), TypeError);
  assert.throws(() => toEpochDay("2026-02-30"), TypeError);
  assert.throws(() => toEpochDay(""), TypeError);
});

test("dates: the anchor week has the weekdays the fixtures assume", () => {
  // Every threshold in the suite is checked against these; if the calendar is
  // wrong, the business-day arithmetic is wrong everywhere and silently.
  assert.equal(dayOfWeek("2026-07-28"), 2, "2026-07-28 is a Tuesday");
  assert.equal(dayOfWeek("2026-07-31"), 5, "2026-07-31 is a Friday");
  assert.equal(dayOfWeek("2026-08-03"), 1, "2026-08-03 is a Monday");
  assert.equal(dayOfWeek(ANCHOR_TODAY), 2, "the anchor date is a Tuesday");
});

test("dates: weekends", () => {
  assert.equal(isWeekend("2026-08-01"), true, "Saturday");
  assert.equal(isWeekend("2026-08-02"), true, "Sunday");
  assert.equal(isWeekend("2026-08-03"), false, "Monday");
});

test("dates: calendar days are inclusive of neither endpoint's clock", () => {
  assert.equal(calendarDaysBetween("2026-07-28", "2026-08-04"), 7);
  assert.equal(calendarDaysBetween("2026-06-24", "2026-08-04"), 41);
  assert.equal(calendarDaysBetween("2026-08-04", "2026-08-04"), 0);
  assert.equal(calendarDaysBetween("2026-08-05", "2026-08-04"), -1);
});

test("dates: business days skip weekends", () => {
  // Tue 28 Jul → Tue 4 Aug: Wed, Thu, Fri, Mon, Tue. Seven calendar days, five
  // business days — which is exactly the CA-10244 stall case.
  assert.equal(businessDaysBetween("2026-07-28", "2026-08-04"), 5);
  // Fri 31 Jul → Tue 4 Aug: Mon and Tue only.
  assert.equal(businessDaysBetween("2026-07-31", "2026-08-04"), 2);
  // Fri → the following Monday is one business day, not three.
  assert.equal(businessDaysBetween("2026-07-31", "2026-08-03"), 1);
  assert.equal(businessDaysBetween("2026-08-04", "2026-08-04"), 0);
  assert.equal(businessDaysBetween("2026-08-04", "2026-08-01"), 0, "never negative");
});

test("dates: an injected holiday calendar removes a business day", () => {
  const holidays = new Set(["2026-07-30"]);
  assert.equal(businessDaysBetween("2026-07-28", "2026-08-04", holidays), 4);
});

test("dates: today() defaults to the fixture anchor and never reads the clock", () => {
  assert.equal(today(), ANCHOR_TODAY);
  assert.equal(today("2026-09-01"), "2026-09-01");
});
