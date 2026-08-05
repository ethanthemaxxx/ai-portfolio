/**
 * A3 — token counts per chunk.
 *
 * Real counts come from `messages.countTokens`. Without a key we fall back to
 * chars/4, which is close enough for a budget number and — more importantly — keeps
 * `npm run ingest` working offline (plan.md §10).
 */

import type { TokenCounter } from '../types.ts';

const MODEL = 'claude-opus-5';
const CONCURRENCY = 6;

/** The chars-per-token ratio for English prose. Rough by design. */
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function createTokenCounter(env: NodeJS.ProcessEnv = process.env): TokenCounter {
  const apiKey = env['ANTHROPIC_API_KEY'];
  return apiKey ? apiCounter(apiKey) : estimateCounter();
}

function estimateCounter(): TokenCounter {
  return {
    mode: 'estimate',
    count: async (texts) => texts.map(estimateTokens),
  };
}

function apiCounter(apiKey: string): TokenCounter {
  let overhead: Promise<number> | null = null;

  return {
    mode: 'api',
    async count(texts) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const countOne = async (text: string): Promise<number> => {
        const result = await client.messages.countTokens({
          model: MODEL,
          messages: [{ role: 'user', content: text }],
        });
        return result.input_tokens;
      };

      // countTokens bills a per-request envelope (role framing, BOS) on top of the
      // text. Across ~90 chunks that envelope is a double-digit percentage of the
      // corpus total, so measure it once and subtract it — otherwise per-chunk
      // counts don't sum to a whole-corpus count.
      overhead ??= countOne('a').then((n) => Math.max(0, n - 1));
      const envelope = await overhead;

      return mapWithConcurrency(texts, CONCURRENCY, async (text) =>
        text.trim() === '' ? 0 : Math.max(1, (await countOne(text)) - envelope),
      );
    },
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const i = cursor++;
      const item = items[i];
      if (item === undefined) continue;
      results[i] = await fn(item);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
