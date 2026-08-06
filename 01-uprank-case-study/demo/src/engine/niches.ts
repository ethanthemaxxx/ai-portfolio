/**
 * Vendored from `uprank/src/data/niches.ts`, trimmed to the fields the scoring
 * engine actually reads: `keywords` and `highValueKeywords`. Both lists are
 * copied verbatim — they are the matching surface, so changing them would change
 * the scores and make this demo a different engine.
 *
 * The labels and taglines are translated, because they are display text.
 */

import type { NicheKey } from './types.ts';

export interface NicheData {
  key: NicheKey;
  label: string;
  tagline: string;
  keywords: string[];
  highValueKeywords: string[];
}

export const NICHES: Record<NicheKey, NicheData> = {
  ai_automation: {
    key: 'ai_automation',
    label: 'AI automation',
    tagline: 'Agents, workflows and systems that save the client hours and money.',
    keywords: [
      'automation', 'automate', 'workflow', 'n8n', 'make.com', 'make ', 'integromat',
      'zapier', 'ai agent', 'agents', 'gpt', 'openai', 'api integration', 'webhook',
      'chatbot', 'rag', 'retrieval', 'langchain', 'no-code', 'low-code', 'pipeline',
      'crm integration', 'airtable', 'google sheets automation', 'scraping', 'data pipeline',
      'voice agent', 'vapi', 'twilio', 'email automation', 'lead generation system',
    ],
    highValueKeywords: [
      'end-to-end', 'ongoing', 'long-term', 'retainer', 'monthly', 'system', 'architecture',
      'production', 'scalable', 'enterprise', 'consultant', 'audit', 'custom gpt', 'internal tool',
    ],
  },
  ai_marketing: {
    key: 'ai_marketing',
    label: 'AI marketing',
    tagline: 'Funnels, content and campaigns powered by AI that actually sell.',
    keywords: [
      'marketing automation', 'email marketing', 'klaviyo', 'hubspot', 'gohighlevel', 'ghl',
      'crm', 'funnel', 'sales funnel', 'lead nurture', 'drip campaign', 'ai content',
      'content pipeline', 'seo', 'copywriting', 'ad copy', 'meta ads', 'google ads',
      'cold email', 'outreach', 'personalization', 'newsletter', 'landing page', 'conversion',
      'growth', 'ai copywriting', 'chatgpt content', 'social media automation',
    ],
    highValueKeywords: [
      'roi', 'revenue', 'scale', 'retainer', 'ongoing', 'strategy', 'full-funnel',
      'performance', 'conversion rate', 'ltv', 'cac', 'attribution', 'b2b', 'saas', 'dtc',
    ],
  },
  ai_ugc: {
    key: 'ai_ugc',
    label: 'AI UGC',
    tagline: 'Ads and UGC with AI avatars that convert for DTC brands.',
    keywords: [
      'ugc', 'user generated content', 'ai avatar', 'heygen', 'arcads', 'synthesia',
      'ai actor', 'ai spokesperson', 'talking head', 'product video', 'ad creative',
      'tiktok ad', 'reels', 'shorts', 'video ad', 'faceless', 'ai video', 'captions',
      'dtc', 'ecommerce video', 'explainer', 'voiceover', 'elevenlabs', 'runway',
      'creative testing', 'hook', 'ad variations', 'meta ads creative',
    ],
    highValueKeywords: [
      'batch', 'volume', 'monthly', 'retainer', 'scale', 'creative testing', 'winning ad',
      'roas', 'performance creative', 'brand', 'campaign', '10 variations', 'ongoing',
    ],
  },
};

export function getNiche(key: NicheKey): NicheData {
  return NICHES[key];
}
