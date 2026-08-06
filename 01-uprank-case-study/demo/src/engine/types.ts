/**
 * Vendored verbatim from the source app (`uprank/src/lib/types.ts`), with the
 * comments translated. No type, field or name was changed — see VENDORED.md.
 */

export type NicheKey = 'ai_automation' | 'ai_marketing' | 'ai_ugc';

export type BudgetType = 'hourly' | 'fixed' | 'unknown';

export type Recommendation = 'apply' | 'maybe' | 'skip' | 'review';

/** A job post after parsing the pasted text. */
export interface ParsedJob {
  title: string;
  description: string;
  rawText: string;
  url: string;
  budgetType: BudgetType;
  budgetMin: number | null;
  budgetMax: number | null;
  clientCountry: string;
  clientSpent: number | null;
  clientHireRate: number | null;
  paymentVerified: boolean;
  proposalsCount: number | null;
  skills: string[];
}

export interface ScoreBreakdown {
  pay: number; // 0-25
  client: number; // 0-20
  fit: number; // 0-25
  intent: number; // 0-15
  competition: number; // 0-15
}

export interface ScoredJob {
  score: number; // 0-100
  recommendation: Recommendation;
  breakdown: ScoreBreakdown;
  redFlags: string[];
  reasons: string[];
}
