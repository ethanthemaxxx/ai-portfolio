/**
 * Vendored from `uprank/src/lib/scoring.ts`.
 *
 * Every number in here — the five sub-score ceilings, every threshold, the
 * severe/minor red-flag penalties, the apply/maybe/skip cutoffs — is identical
 * to the source app. The only edits are translation: the reason strings and the
 * red-flag labels are the app's Spanish text rendered in English, because this
 * demo is for an English-speaking audience. See VENDORED.md.
 *
 * There is no language model anywhere in this file, and that is the point the
 * case study argues. A score you cannot audit is a score you will not trust, and
 * the same post must always produce the same score or the sorted list stops
 * being stable.
 */

import type { ParsedJob, ScoredJob, ScoreBreakdown, NicheKey, Recommendation } from './types.ts';
import { getNiche } from './niches.ts';

/** Phrases that indicate a scam, a difficult client, or work to avoid. */
const RED_FLAG_RULES: { test: RegExp; label: string; severe?: boolean }[] = [
  { test: /\b(free|unpaid)\s+(test|trial|sample|task)\b/i, label: 'Asks for a free test / unpaid work', severe: true },
  { test: /\b(whatsapp|telegram|skype|signal)\b/i, label: 'Pushes the chat off Upwork (WhatsApp/Telegram)', severe: true },
  { test: /\bcontact me (at|on)\b|\bemail me (at|on)\b|@gmail\.com|@outlook\.com/i, label: 'Tries to move contact off the platform', severe: true },
  { test: /\b(crypto|bitcoin|usdt|gift ?card)\b.*\b(pay|payment)\b|\bpay(ment)?\b.*\b(crypto|bitcoin|gift ?card)\b/i, label: 'Mentions payment in crypto / gift cards', severe: true },
  { test: /\bearn \$?\d{3,}\s*(\/|per )?(day|hour)\b|\$\d{3,}\s*\/?\s*day/i, label: 'Unrealistic earnings promise ($X/day)', severe: true },
  { test: /\b(data entry|copy paste|copy-paste)\b.*\b(easy|simple|quick)\b/i, label: "Generic 'easy and quick' work (low value / possible bait)" },
  { test: /\burgent\b/i, label: "Marked 'urgent' (can pressure price and timeline)" },
  { test: /\b(revenue share|equity|commission only|profit share)\b/i, label: "Offers 'revenue share' / commission instead of pay" },
  { test: /\blong term\b.*\bstart\b.*\blow\b|\bstart low\b/i, label: "Asks you to start cheap on a 'long term' promise" },
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/* ── Sub-score: PAY (0-25) ──────────────────────────────── */
function scorePay(job: ParsedJob): { pts: number; reason: string } {
  if (job.budgetType === 'hourly') {
    const rate = job.budgetMax ?? job.budgetMin ?? 0;
    if (!rate) return { pts: 12, reason: 'Hourly with no clear range (neutral).' };
    if (rate >= 60) return { pts: 25, reason: `High hourly rate (~$${rate}/h).` };
    if (rate >= 40) return { pts: 21, reason: `Good hourly rate (~$${rate}/h).` };
    if (rate >= 25) return { pts: 15, reason: `Mid hourly rate (~$${rate}/h).` };
    return { pts: 7, reason: `Low hourly rate (~$${rate}/h).` };
  }
  if (job.budgetType === 'fixed') {
    const b = job.budgetMax ?? job.budgetMin ?? 0;
    if (!b) return { pts: 12, reason: 'Fixed price with no clear amount (neutral).' };
    if (b >= 3000) return { pts: 25, reason: `High fixed budget ($${b.toLocaleString('en-US')}).` };
    if (b >= 1000) return { pts: 21, reason: `Good fixed budget ($${b.toLocaleString('en-US')}).` };
    if (b >= 400) return { pts: 15, reason: `Mid fixed budget ($${b.toLocaleString('en-US')}).` };
    if (b >= 150) return { pts: 9, reason: `Low fixed budget ($${b.toLocaleString('en-US')}).` };
    return { pts: 4, reason: `Very low budget ($${b.toLocaleString('en-US')}).` };
  }
  return { pts: 10, reason: 'No budget detected (neutral).' };
}

/* ── Sub-score: CLIENT (0-20) ───────────────────────────── */
function scoreClient(job: ParsedJob): { pts: number; reasons: string[] } {
  let pts = 6; // neutral base
  const reasons: string[] = [];

  if (job.paymentVerified) { pts += 6; reasons.push('Payment verified ✔'); }
  else { pts -= 2; reasons.push('Payment NOT verified'); }

  if (job.clientSpent != null) {
    if (job.clientSpent >= 10000) { pts += 6; reasons.push(`Client has spent $${job.clientSpent.toLocaleString('en-US')}+ (serious)`); }
    else if (job.clientSpent >= 1000) { pts += 4; reasons.push(`Client has a history ($${job.clientSpent.toLocaleString('en-US')} spent)`); }
    else if (job.clientSpent > 0) { pts += 1; reasons.push(`Client with little history ($${job.clientSpent})`); }
    else { reasons.push('New client (no spend yet)'); }
  }

  if (job.clientHireRate != null) {
    if (job.clientHireRate >= 70) { pts += 2; reasons.push(`High hire rate (${job.clientHireRate}%)`); }
    else if (job.clientHireRate < 30) { pts -= 2; reasons.push(`Low hire rate (${job.clientHireRate}%) — posts a lot, hires little`); }
  }

  return { pts: clamp(pts, 0, 20), reasons };
}

/* ── Sub-score: FIT with your niche/profile (0-25) ───────── */
function scoreFit(job: ParsedJob, niche: NicheKey, profileSkills: string[]): { pts: number; reason: string } {
  const n = getNiche(niche);
  const hay = (job.rawText + ' ' + job.skills.join(' ')).toLowerCase();

  const matched = n.keywords.filter((k) => hay.includes(k.toLowerCase()));
  const premium = n.highValueKeywords.filter((k) => hay.includes(k.toLowerCase()));
  const skillOverlap = profileSkills.filter((s) => s && hay.includes(s.toLowerCase()));

  let pts = 0;
  pts += clamp(matched.length * 3.5, 0, 16);
  pts += clamp(premium.length * 2, 0, 5);
  pts += clamp(skillOverlap.length * 2, 0, 4);

  const reason =
    matched.length === 0
      ? 'No clear signals from your niche (is this really for you?).'
      : `Fits your niche: ${matched.slice(0, 5).join(', ')}${premium.length ? ` · premium: ${premium.slice(0, 3).join(', ')}` : ''}.`;

  return { pts: clamp(Math.round(pts), 0, 25), reason };
}

/* ── Sub-score: BUYING INTENT (0-15) ────────────────────── */
function scoreIntent(job: ParsedJob): { pts: number; reason: string } {
  let pts = 4;
  const t = job.rawText.toLowerCase();
  const len = job.description.length;

  if (len > 600) pts += 4;
  else if (len > 250) pts += 2;
  else pts -= 2; // a very short description means a not-very-serious post

  if (/\b(deliverable|scope|milestone|requirements|responsibilities)\b/i.test(t)) pts += 3;
  if (/\b(long[- ]term|ongoing|monthly|retainer|full[- ]time)\b/i.test(t)) pts += 3;
  if (/\b(budget|timeline|deadline|start (date|immediately|asap))\b/i.test(t)) pts += 1;

  const reason =
    pts >= 10 ? 'Detailed post with real intent to hire.'
    : pts >= 6 ? 'Medium intent; the scope is a bit vague.'
    : 'Vague or short post; weak buying signal.';
  return { pts: clamp(pts, 0, 15), reason };
}

/* ── Sub-score: COMPETITION (0-15) ──────────────────────── */
function scoreCompetition(job: ParsedJob): { pts: number; reason: string } {
  if (job.proposalsCount == null) return { pts: 8, reason: 'Proposal count unknown (neutral).' };
  const p = job.proposalsCount;
  if (p <= 5) return { pts: 15, reason: `Very few proposals (${p}) — apply now.` };
  if (p <= 10) return { pts: 12, reason: `Little competition (~${p} proposals).` };
  if (p <= 20) return { pts: 8, reason: `Medium competition (~${p} proposals).` };
  if (p <= 40) return { pts: 4, reason: `Heavy competition (~${p} proposals).` };
  return { pts: 2, reason: `Saturated (~${p} proposals) — hard to stand out.` };
}

/** Ranking engine: scores a job 0-100 and recommends apply / maybe / skip. */
export function scoreJob(job: ParsedJob, niche: NicheKey, profileSkills: string[] = []): ScoredJob {
  const pay = scorePay(job);
  const client = scoreClient(job);
  const fit = scoreFit(job, niche, profileSkills);
  const intent = scoreIntent(job);
  const competition = scoreCompetition(job);

  const breakdown: ScoreBreakdown = {
    pay: pay.pts,
    client: client.pts,
    fit: fit.pts,
    intent: intent.pts,
    competition: competition.pts,
  };

  const redFlags: string[] = [];
  let severePenalty = 0;
  for (const rule of RED_FLAG_RULES) {
    if (rule.test.test(job.rawText)) {
      redFlags.push(rule.label);
      severePenalty += rule.severe ? 20 : 6;
    }
  }

  let score = pay.pts + client.pts + fit.pts + intent.pts + competition.pts;
  score = clamp(score - severePenalty, 0, 100);

  let recommendation: Recommendation;
  const hasSevere = RED_FLAG_RULES.some((r) => r.severe && r.test.test(job.rawText));
  if (hasSevere && score < 70) recommendation = 'skip';
  else if (score >= 75) recommendation = 'apply';
  else if (score >= 55) recommendation = 'maybe';
  else recommendation = 'skip';

  const reasons = [pay.reason, ...client.reasons, fit.reason, intent.reason, competition.reason];

  return { score, recommendation, breakdown, redFlags, reasons };
}

/** The weights, exposed so the UI can show what each sub-score is out of. */
export const SUB_SCORE_MAX: Record<keyof ScoreBreakdown, number> = {
  pay: 25,
  client: 20,
  fit: 25,
  intent: 15,
  competition: 15,
};
