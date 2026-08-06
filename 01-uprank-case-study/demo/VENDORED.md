# What was copied from the source app, and what changed

This demo does not import UpRank. It ships a **copy** of UpRank's ranking engine,
because the source app is a local single-user tool with a SQLite database and a
Spanish interface, and neither of those belongs in a public demo aimed at
English-speaking clients.

Copying an engine and then claiming it is "the same engine" is exactly the sort of
statement that should not be taken on trust, so the last section is a script that
checks it.

## Files

| Here | Copied from | What changed |
|---|---|---|
| `src/engine/types.ts` | `uprank/src/lib/types.ts` | Comments translated. No type, field or name changed. |
| `src/engine/parseJob.ts` | `uprank/src/lib/parseJob.ts` | Comments translated; the fallback title string `"Trabajo sin título"` → `"Untitled job"`. Every regex, branch and slice length is unchanged. Non-null assertions were added where `noUncheckedIndexedAccess` requires them — a type-level annotation with no runtime effect. |
| `src/engine/scoring.ts` | `uprank/src/lib/scoring.ts` | The reason strings and red-flag labels are translated. **Every number is unchanged**: the five sub-score ceilings (25/20/25/15/15), every threshold, the −20 severe and −6 minor red-flag penalties, and the ≥75 apply / ≥55 maybe cutoffs. Added `SUB_SCORE_MAX`, an exported constant the UI reads to render the bars; it is not used by `scoreJob`. |
| `src/engine/niches.ts` | `uprank/src/data/niches.ts` | Trimmed to the two fields the scorer reads — `keywords` and `highValueKeywords` — both **verbatim**, since they are the matching surface and editing them would change scores. `label` and `tagline` translated. The rest of `NicheData` (rate ladders, headline formulas, services, tools) is display content for screens this demo does not have. |

## What is deliberately absent

- **No database.** The source app persists jobs, proposals and the profile to
  SQLite. Nothing here is stored — no server, no cookies, no analytics. Reload and
  it is gone.
- **No Anthropic call.** In the full app Claude writes proposal drafts. That path
  is not in this demo, so the demo needs no API key and cannot cost anyone money.
- **No profile audit, no proposal generator, no Upwork API integration.** This
  demo is the ranking engine, which is the part the case study argues about.

## Checking the claim

`parity/parity-check.mts` runs the original and the vendored implementations over
the same job posts and compares score, recommendation, sub-score breakdown,
red-flag count and reason count. It needs the source app present; the header of
the file has the exact commands to stage it.

Last run: **72 scorings compared — 8 posts × 3 niches × 3 skill sets — zero
differences.**

That is the whole claim, and it is falsifiable in about a minute.
