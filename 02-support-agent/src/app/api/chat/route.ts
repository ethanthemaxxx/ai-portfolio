/**
 * SSE endpoint. Streams `AgentEvent`s straight through to the widget.
 *
 * The widget is a projection of this stream and nothing else — every state it can
 * render corresponds to an event the agent actually emitted. That constraint is
 * what keeps the "checking your order…" indicator honest: it appears because a
 * tool call started, not because a timer said it was time to look busy.
 *
 * Two modes:
 *   live     — real inference. Needs ANTHROPIC_API_KEY.
 *   fixture  — replays a scripted turn with realistic timing. No key, no spend.
 *
 * Fixture mode is not a toy. It's how you record a demo, screenshot the states,
 * and let a prospective client click through the thing before you've given them
 * anything. It also makes the UI states reachable in a browser test.
 */

import type { AgentEvent } from '../../../agent/loop.ts';
import { FIXTURE_TURNS } from './fixtures.ts';

// The live path is imported lazily, inside the branch that uses it. Fixture mode
// has no business loading the index, the Shopify adapter, or the SDK — and a
// module-level import means a failure anywhere in that graph takes down the whole
// route, including the mode that didn't need it. That is exactly how this route
// broke the first time.

export const runtime = 'nodejs';

const ANCHOR = '2026-08-04';

function sse(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'question required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const live = Boolean(process.env['ANTHROPIC_API_KEY']);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(sse(e)));

      try {
        if (!live) {
          for (const step of pickFixture(question)) {
            await sleep(step.afterMs);
            send(step.event);
          }
        } else {
          const [{ runTurn }, { wire }] = await Promise.all([
            import('../../../agent/loop.ts'),
            import('../../../../evals/wire.ts'),
          ]);
          const deps = await wire(ANCHOR);
          for await (const event of runTurn(
            {
              client: deps.client,
              tools: deps.tools,
              executeTool: deps.executeTool,
              retrieve: deps.retrieve,
              evaluateEscalation: deps.evaluateEscalation,
              todayISO: ANCHOR,
            },
            [],
            question,
          )) {
            send(event);
          }
        }
      } catch (err) {
        // The customer never sees a stack trace. They see something recoverable
        // with a path to a person — spec §8, "human handoff is always reachable".
        send({
          type: 'error',
          message: 'Something broke on our side. Nothing you did.',
          recoverable: true,
        });
        console.error('[chat] turn failed:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

/** Closest scripted turn, by keyword. Crude on purpose — it's a demo harness. */
function pickFixture(question: string) {
  const q = question.toLowerCase();
  const match = FIXTURE_TURNS.find((f) => f.match.some((m) => q.includes(m)));
  return (match ?? FIXTURE_TURNS[FIXTURE_TURNS.length - 1]!).steps;
}
