/**
 * The agent turn: stream → tool loop → deterministic escalation gate.
 *
 * Why a manual loop rather than the SDK's tool runner. The runner is the right
 * default and covers most "I need control" cases through its per-turn hooks. Two
 * things here fall outside it:
 *
 *   1. Every tool call has to surface as an SSE event the widget renders live
 *      ("checking your order…"). That's a per-call emission, not a per-turn hook.
 *   2. The escalation evaluator (plan.md §7) runs after the model's turn and can
 *      override it. Escalation is a release gate, and gating on a probabilistic
 *      decision is not gating.
 *
 * Both are legitimate; neither is "the runner felt like a black box."
 *
 * Model settings, and the reasoning behind each:
 *
 *   model    claude-opus-5   Answer quality on policy edges is the product.
 *   effort   low             Opus 5 is unusually strong at low effort. This is the
 *                            primary latency lever and costs little here.
 *   thinking omitted         Thinking is ON by default on Opus 5, and that is what
 *                            we want. Disabling it has two documented failure
 *                            modes: tool calls occasionally emitted as plain text
 *                            (the call silently never runs — in a support agent
 *                            that means telling a customer their order was checked
 *                            when it wasn't), and <thinking> tags leaking into the
 *                            visible reply. Neither is survivable customer-facing.
 *   max_tokens 8192          Thinking and response share this budget. A 120-word
 *                            answer needs ~200 tokens; the rest is headroom so a
 *                            thinking-heavy turn can't truncate mid-sentence.
 *
 * No temperature / top_p / top_k — removed on Opus 5, and sending them is a 400.
 * Style is steered by the prompt instead.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemBlocks, buildVolatileContext } from './prompt.ts';
import type { RetrievedChunk } from '../types.ts';

export const MODEL = 'claude-opus-5';
export const MAX_TOKENS = 8192;
export const EFFORT = 'low' as const;

/** Emitted to the widget over SSE. The UI is a projection of this stream. */
export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'tool_end'; name: string; ms: number; ok: boolean }
  | { type: 'escalated'; reason: string; ticketId: string; tellCustomer: string }
  | { type: 'done'; turn: AgentTurn }
  | { type: 'error'; message: string; recoverable: boolean };

export interface AgentTurn {
  answer: string;
  citations: { docId: string }[];
  escalated: boolean;
  escalationReason: string | null;
  toolCalls: { name: string; ms: number; ok: boolean }[];
  latency: { firstTokenMs: number; totalMs: number };
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

/** What the widget shows while a tool runs. Copy lives here, not in the model. */
const TOOL_LABELS: Record<string, string> = {
  lookup_order: 'Checking your order',
  search_help_center: 'Looking through the help centre',
  escalate_to_human: 'Handing this to the team',
};

export interface RunTurnDeps {
  client: Anthropic;
  /** Tool schemas, in a stable order — reordering invalidates the prompt cache. */
  tools: Anthropic.Tool[];
  /** Executes one tool call. Owned by src/tools; injected so the loop stays testable. */
  executeTool: (name: string, input: unknown) => Promise<unknown>;
  /** Pre-retrieved policy chunks for the opening question. */
  retrieve: (query: string) => Promise<{ chunks: RetrievedChunk[]; belowFloor: boolean }>;
  /**
   * Deterministic escalation evaluator (plan.md §7). Runs after the model's turn.
   * Six of its seven triggers need no model call; the model's own
   * escalate_to_human is the seventh input, never the gate.
   */
  evaluateEscalation: (ctx: {
    question: string;
    answer: string;
    toolResults: { name: string; result: unknown }[];
    belowFloor: boolean;
  }) => { escalate: boolean; reason: string | null; ticketId: string; tellCustomer: string } | null;
  /** Injected clock. Never Date.now() in logic — the eval suite must be reproducible. */
  todayISO: string;
  /** Injected only so latency can be measured; not used for any decision. */
  now?: () => number;
}

export async function* runTurn(
  deps: RunTurnDeps,
  history: Anthropic.MessageParam[],
  question: string,
): AsyncGenerator<AgentEvent> {
  const now = deps.now ?? (() => performance.now());
  const startedAt = now();
  let firstTokenAt: number | null = null;

  const toolCalls: AgentTurn['toolCalls'] = [];
  const toolResults: { name: string; result: unknown }[] = [];
  // Per-turn, deliberately. Tool events are produced inside Promise.all, which
  // can't yield, so they queue here and are drained after. Module-level state
  // here would cross-contaminate concurrent conversations — two customers, one
  // queue, and each sees the other's "checking your order…".
  const pendingEvents: AgentEvent[] = [];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let answer = '';

  // --- Pre-retrieval. One search, up front, because the question is known and the
  //     customer is waiting. Order data is fetched just-in-time via tools instead.
  const { chunks, belowFloor } = await deps.retrieve(question);

  const system = buildSystemBlocks(
    buildVolatileContext({ todayISO: deps.todayISO, retrieved: chunks, belowFloor }),
  );

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: question },
  ];

  // --- Tool loop. Bounded: a support turn that needs more than four rounds of
  //     tools has gone wrong, and looping forever in front of a customer is worse
  //     than handing off.
  const MAX_ROUNDS = 4;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = deps.client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: EFFORT },
      system,
      tools: deps.tools,
      messages,
    });

    stream.on('text', (delta) => {
      if (firstTokenAt === null) firstTokenAt = now();
      answer += delta;
    });

    let message: Anthropic.Message;
    try {
      // finalMessage() resolves the accumulated message and surfaces stream errors.
      // Deltas were already forwarded above; this is the authoritative record.
      message = await stream.finalMessage();
    } catch (err) {
      yield {
        type: 'error',
        message: err instanceof Error ? err.message : 'stream failed',
        recoverable: true,
      };
      return;
    }

    usage.input += message.usage.input_tokens;
    usage.output += message.usage.output_tokens;
    usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

    // A server-side tool hit its iteration limit. Append and re-send; do NOT add a
    // "continue" message — the API resumes on its own from the trailing block.
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }

    if (message.stop_reason !== 'tool_use') {
      messages.push({ role: 'assistant', content: message.content });
      break;
    }

    const uses = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    messages.push({ role: 'assistant', content: message.content });

    // Execute in parallel, then return ALL results in ONE user message. Splitting
    // them across messages silently trains the model to stop calling tools in
    // parallel — a slow degradation with no error to notice.
    const results: Anthropic.ToolResultBlockParam[] = [];

    await Promise.all(
      uses.map(async (use) => {
        const label = TOOL_LABELS[use.name] ?? use.name;
        const t0 = now();
        // Emitted through the generator by the caller draining `pending`; see note.
        pendingEvents.push({ type: 'tool_start', name: use.name, label });
        try {
          const result = await deps.executeTool(use.name, use.input);
          const ms = now() - t0;
          toolCalls.push({ name: use.name, ms, ok: true });
          toolResults.push({ name: use.name, result });
          pendingEvents.push({ type: 'tool_end', name: use.name, ms, ok: true });
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          const ms = now() - t0;
          toolCalls.push({ name: use.name, ms, ok: false });
          pendingEvents.push({ type: 'tool_end', name: use.name, ms, ok: false });
          // Return the failure as a result rather than dropping it. A dropped
          // tool_use_id is a 400; worse, a silent drop invites the model to invent
          // the answer it didn't get.
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: `Tool failed: ${err instanceof Error ? err.message : 'unknown error'}. Do not guess at the answer — hand off to a human.`,
            is_error: true,
          });
        }
      }),
    );

    while (pendingEvents.length) yield pendingEvents.shift()!;
    messages.push({ role: 'user', content: results });
  }

  // --- Deterministic gate. Runs regardless of what the model decided.
  const escalation = deps.evaluateEscalation({
    question,
    answer,
    toolResults,
    belowFloor,
  });

  if (escalation?.escalate) {
    yield {
      type: 'escalated',
      reason: escalation.reason ?? 'unspecified',
      ticketId: escalation.ticketId,
      tellCustomer: escalation.tellCustomer,
    };
  }

  const totalMs = now() - startedAt;

  yield {
    type: 'done',
    turn: {
      answer,
      citations: extractCitations(answer),
      escalated: Boolean(escalation?.escalate),
      escalationReason: escalation?.reason ?? null,
      toolCalls,
      latency: {
        firstTokenMs: firstTokenAt === null ? totalMs : firstTokenAt - startedAt,
        totalMs,
      },
      usage,
    },
  };
}

const KNOWN_DOCS = new Set([
  'shipping',
  'returns-refunds',
  'subscriptions',
  'freshness-storage',
  'brewing-grind-guide',
  'faq',
]);

/**
 * Pull `[doc-id]` citations out of the answer and drop any that don't name a real
 * document. A model can invent a citation as easily as a fact — validating against
 * the index is what makes eval gate A5 meaningful rather than decorative.
 */
export function extractCitations(answer: string): { docId: string }[] {
  const found = new Set<string>();
  for (const m of answer.matchAll(/\[([a-z-]+)\]/g)) {
    const id = m[1];
    if (id && KNOWN_DOCS.has(id)) found.add(id);
  }
  return [...found].sort().map((docId) => ({ docId }));
}
