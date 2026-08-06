/**
 * Proves the vendored engine scores identically to the source app.
 *
 * The demo ships a *copy* of UpRank's scoring engine with its user-facing strings
 * translated to English. The claim that only the strings changed is worth
 * nothing unless it is checkable, so this script runs both implementations over
 * the same posts and compares score, recommendation, sub-score breakdown,
 * red-flag count and reason count.
 *
 * It needs the source app present at ../../../../uprank. Prepare it with:
 *
 *   mkdir -p orig && U=../../../../uprank/src
 *   sed 's|from "@/data/niches"|from "./niches.ts"|; s|from "./types"|from "./types.ts"|' $U/lib/scoring.ts > orig/scoring.ts
 *   sed 's|from "./types"|from "./types.ts"|' $U/lib/parseJob.ts > orig/parseJob.ts
 *   cp $U/lib/types.ts orig/types.ts
 *   sed 's|from "@/lib/types"|from "./types.ts"|' $U/data/niches.ts > orig/niches.ts
 *   ln -s ../src/engine vend
 *   npx tsx parity-check.mts
 *
 * Last run: 72 scorings compared, zero differences.
 */

import { parseJob as parseO } from './orig/parseJob.ts';
import { scoreJob as scoreO } from './orig/scoring.ts';
import { parseJob as parseV } from './vend/parseJob.ts';
import { scoreJob as scoreV } from './vend/scoring.ts';

const NICHES = ['ai_automation', 'ai_marketing', 'ai_ugc'] as const;

const POSTS: string[] = [
  `Build a RAG customer support agent over our help center (Python + vector DB)
Hourly: $55.00-$80.00
Payment verified · $150,000+ spent · United Kingdom · Hire rate, 92%
Proposals: 10 to 15
We need an ongoing, long-term partner to build a production RAG system over our help center.
Deliverables: ingestion pipeline, retrieval API, evaluation harness. Milestones defined.
Skills: Python, RAG, OpenAI API, vector database, API integration, LangChain`,

  `AI Automation Expert Needed — n8n workflow to sync Shopify orders to HubSpot CRM
Fixed-price - $2,500.00
Payment verified · $40,000 spent · United States
Proposals: 5 to 10
We want to automate our order flow into HubSpot. Scope and requirements attached. Monthly retainer possible.
Skills: n8n, automation, webhook, crm integration, Shopify`,

  `URGENT!! AI Automation Specialist — start today, big long term project
Fixed-price - $120.00
United States · $0 spent · Proposals: less than 5
Send me a free test task first. Contact me at hiring@gmail.com or on WhatsApp.
We pay in crypto. You can earn $500/day. Start low, long term guaranteed.`,

  `Need someone to help with AI stuff for our marketing
Hourly: $18.00-$25.00
Payment verified · $900 spent · United States · Hire rate, 12%
Proposals: 30 to 40
help with ai marketing stuff`,

  `Make 10 UGC ad variations with AI avatars for our DTC skincare brand
Fixed-price - $1,800.00
Payment verified · $22,000 spent · Australia · Hire rate, 78%
Proposals: 5 to 10
Ongoing monthly batch of creative testing. We need hooks and ad variations for Meta ads.
Skills: ugc, ai avatar, heygen, tiktok ad, video ad, creative testing`,

  ``,
  `x`,
  `Fixed-price - $3,000.00\nProposals: 1`,
];

const SKILLSETS = [[], ['n8n', 'RAG'], ['heygen', 'shopify']];

let checked = 0;
const diffs: string[] = [];

for (const post of POSTS) {
  const o = parseO(post);
  const v = parseV(post);
  // parse parity: every field except the translated fallback title
  for (const k of Object.keys(o) as (keyof typeof o)[]) {
    if (k === 'title') continue;
    const a = JSON.stringify(o[k]); const b = JSON.stringify(v[k]);
    if (a !== b) diffs.push(`parse.${k}: ${a} !== ${b}`);
  }
  for (const niche of NICHES) {
    for (const skills of SKILLSETS) {
      const so = scoreO(o, niche, skills);
      const sv = scoreV(v, niche, skills);
      checked++;
      if (so.score !== sv.score) diffs.push(`score ${niche}: ${so.score} !== ${sv.score}`);
      if (so.recommendation !== sv.recommendation) diffs.push(`rec ${niche}: ${so.recommendation} !== ${sv.recommendation}`);
      if (JSON.stringify(so.breakdown) !== JSON.stringify(sv.breakdown)) {
        diffs.push(`breakdown ${niche}: ${JSON.stringify(so.breakdown)} !== ${JSON.stringify(sv.breakdown)}`);
      }
      if (so.redFlags.length !== sv.redFlags.length) {
        diffs.push(`redFlags count ${niche}: ${so.redFlags.length} !== ${sv.redFlags.length}`);
      }
      if (so.reasons.length !== sv.reasons.length) {
        diffs.push(`reasons count ${niche}: ${so.reasons.length} !== ${sv.reasons.length}`);
      }
    }
  }
}

console.log(`compared ${checked} scorings across ${POSTS.length} posts × ${NICHES.length} niches × ${SKILLSETS.length} skill sets`);
console.log(diffs.length ? 'DIFFERENCES:\n' + [...new Set(diffs)].join('\n') : 'PARITY OK — identical score, recommendation, breakdown, red-flag count and reason count');
