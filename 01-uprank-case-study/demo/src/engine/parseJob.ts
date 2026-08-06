/**
 * Vendored from `uprank/src/lib/parseJob.ts`. Every regex, threshold and branch
 * is byte-identical to the source app; only comments and the fallback title
 * string were translated. See VENDORED.md.
 *
 * This is the weak point of the design and the case study says so: it is regex
 * over an English-language post format. Give it an unusual layout and it returns
 * nulls, which the engine scores as "unknown" rather than guessing.
 */

import type { ParsedJob, BudgetType } from './types.ts';

/** Turns "$10K+", "$1,200.00", "1.2k" into a number. */
function money(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, '').toLowerCase();
  const m = cleaned.match(/([\d.]+)(k|m)?/);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  if (isNaN(n)) return null;
  let out = n;
  if (m[2] === 'k') out *= 1000;
  if (m[2] === 'm') out *= 1000000;
  return Math.round(out);
}

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Netherlands',
  'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Ireland', 'Singapore', 'New Zealand',
  'France', 'Spain', 'Italy', 'Belgium', 'Austria', 'Finland', 'United Arab Emirates',
  'Israel', 'Japan', 'India', 'Pakistan', 'Philippines', 'Bangladesh', 'Nigeria', 'Brazil',
];

/**
 * Pulls structured fields out of pasted Upwork job text. Tolerant on purpose: a
 * field it cannot find stays null, and the ranking engine treats null as
 * "unknown" and scores it neutrally rather than penalising a parse failure.
 */
export function parseJob(rawText: string, url = ''): ParsedJob {
  const text = rawText.replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Title = the first line with plausible content.
  const title =
    lines.find((l) => l.length > 8 && !/^\$|^posted|^hourly|^fixed/i.test(l)) ||
    lines[0] ||
    'Untitled job';

  let budgetType: BudgetType = 'unknown';
  let budgetMin: number | null = null;
  let budgetMax: number | null = null;

  const hourly = text.match(/hourly[:\s]*\$?([\d.,]+k?)\s*(?:-|–|to)\s*\$?([\d.,]+k?)/i);
  const hourlySingle = text.match(/\$?([\d.,]+)\s*\/\s*hr|hourly[:\s]*\$?([\d.,]+k?)\b/i);
  const fixed = text.match(/fixed[- ]?price[:\s]*\$?([\d.,]+k?)/i);
  const fixedAlt = text.match(/budget[:\s]*\$?([\d.,]+k?)/i);
  const anyDollar = text.match(/\$([\d.,]+k?)/i);

  if (/hourly/i.test(text) && hourly) {
    budgetType = 'hourly';
    budgetMin = money(hourly[1]!);
    budgetMax = money(hourly[2]!);
  } else if (/hourly/i.test(text) && hourlySingle) {
    budgetType = 'hourly';
    budgetMin = money(hourlySingle[1] || hourlySingle[2] || '');
    budgetMax = budgetMin;
  } else if (fixed) {
    budgetType = 'fixed';
    budgetMin = money(fixed[1]!);
    budgetMax = budgetMin;
  } else if (fixedAlt) {
    budgetType = 'fixed';
    budgetMin = money(fixedAlt[1]!);
    budgetMax = budgetMin;
  } else if (anyDollar) {
    budgetType = /hour|\/hr/i.test(text) ? 'hourly' : 'fixed';
    budgetMin = money(anyDollar[1]!);
    budgetMax = budgetMin;
  }

  const spentMatch = text.match(/\$([\d.,]+k?\+?)\s*(?:total\s*)?spent/i);
  const clientSpent = spentMatch ? money(spentMatch[1]!) : null;

  const paymentVerified = /payment\s*verified/i.test(text) && !/unverified/i.test(text);

  const hireMatch = text.match(/hire\s*rate[,:\s]*([\d]+)\s*%/i);
  const clientHireRate = hireMatch ? parseInt(hireMatch[1]!, 10) : null;

  const propRange = text.match(/proposals?[:\s]*([\d]+)\s*(?:to|-|–)\s*([\d]+)/i);
  const propLess = text.match(/proposals?[:\s]*less\s*than\s*([\d]+)/i);
  const propSingle = text.match(/proposals?[:\s]*([\d]+)\b/i);
  let proposalsCount: number | null = null;
  if (propRange) proposalsCount = Math.round((parseInt(propRange[1]!) + parseInt(propRange[2]!)) / 2);
  else if (propLess) proposalsCount = Math.max(1, parseInt(propLess[1]!) - 2);
  else if (propSingle) proposalsCount = parseInt(propSingle[1]!);

  const clientCountry = COUNTRIES.find((c) => new RegExp(c, 'i').test(text)) || '';

  const skills: string[] = [];
  const skillsBlock = text.match(/skills?(?:\s*and\s*expertise)?[:\s]*\n?([\s\S]{0,400})/i);
  if (skillsBlock) {
    skillsBlock[1]!
      .split(/[\n,•|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40 && !/^\$/.test(s))
      .slice(0, 15)
      .forEach((s) => skills.push(s));
  }

  return {
    title: title.slice(0, 180),
    description: text.slice(0, 6000),
    rawText: text,
    url,
    budgetType,
    budgetMin,
    budgetMax,
    clientCountry,
    clientSpent,
    clientHireRate,
    paymentVerified,
    proposalsCount,
    skills,
  };
}
