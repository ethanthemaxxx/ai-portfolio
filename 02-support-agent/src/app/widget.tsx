'use client';

/**
 * The chat widget.
 *
 * Every state here is a projection of an `AgentEvent`. Nothing is simulated: the
 * "Checking your order" row appears because a tool call started and clears because
 * it returned, and the elapsed time shown is the real one. A fake spinner is worse
 * than no spinner — it teaches the customer that the indicator means nothing.
 *
 * The four states that separate this from a chat box, and why each exists:
 *
 *   Thinking     Opus 5 reasons before the first token. Unexplained, that gap
 *                reads as broken. Named, it reads as working. This is the whole
 *                latency argument from plan.md §5: a visible "checking your
 *                order…" makes 3s feel responsive, a blank box makes 1.5s feel
 *                dead.
 *   Tool call    Shows what the agent is doing on the customer's behalf, and
 *                proves the order status was actually looked up.
 *   Citation     Makes the answer checkable. The customer can click and read the
 *                policy the answer came from.
 *   Handoff      A deliberate state, not an error. Escalation is the system
 *                working correctly, and it should not look like a failure.
 */

import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconCross, IconHandoff } from './icons.tsx';

type Phase = 'idle' | 'thinking' | 'tool' | 'streaming' | 'done' | 'error';

interface ToolRow {
  name: string;
  label: string;
  ms: number | null;
  ok: boolean | null;
}

interface Handoff {
  ticketId: string;
  tellCustomer: string;
}

interface Turn {
  question: string;
  answer: string;
  tools: ToolRow[];
  citations: string[];
  handoff: Handoff | null;
  error: string | null;
  phase: Phase;
}

const DOC_TITLES: Record<string, string> = {
  shipping: 'Shipping & Delivery',
  'returns-refunds': 'Returns & Refunds',
  subscriptions: 'Subscriptions',
  'freshness-storage': 'Freshness & Storage',
  'brewing-grind-guide': 'Choosing a Grind',
  faq: 'FAQ',
};

const SUGGESTIONS = [
  "Where's my order CA-10244?",
  'I just got an Aeropress — which grind?',
  'The kettle in CA-10250 is dead, I want a refund',
];

/** Strip the [doc-id] markers; they render as chips instead of inline noise. */
function stripCitations(text: string): string {
  return text.replace(/\s*\[[a-z-]+\]/g, '').replace(/[ \t]+\n/g, '\n');
}

export default function Widget({ live = false }: { live?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setInput('');

    const index = turns.length;
    setTurns((t) => [
      ...t,
      {
        question,
        answer: '',
        tools: [],
        citations: [],
        handoff: null,
        error: null,
        phase: 'thinking',
      },
    ]);

    const patch = (fn: (t: Turn) => Turn) =>
      setTurns((all) => all.map((t, i) => (i === index ? fn(t) : t)));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line. Keep the trailing partial.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const ev = JSON.parse(line.slice(6));

          switch (ev.type) {
            case 'text_delta':
              patch((t) => ({ ...t, phase: 'streaming', answer: t.answer + ev.text }));
              break;
            case 'tool_start':
              patch((t) => ({
                ...t,
                phase: 'tool',
                tools: [...t.tools, { name: ev.name, label: ev.label, ms: null, ok: null }],
              }));
              break;
            case 'tool_end':
              patch((t) => ({
                ...t,
                tools: t.tools.map((x) =>
                  x.name === ev.name && x.ms === null ? { ...x, ms: ev.ms, ok: ev.ok } : x,
                ),
              }));
              break;
            case 'escalated':
              patch((t) => ({
                ...t,
                handoff: { ticketId: ev.ticketId, tellCustomer: ev.tellCustomer },
              }));
              break;
            case 'done':
              patch((t) => ({
                ...t,
                phase: 'done',
                citations: ev.turn.citations.map((c: { docId: string }) => c.docId),
              }));
              break;
            case 'error':
              patch((t) => ({ ...t, phase: 'error', error: ev.message }));
              break;
          }
        }
      }
    } catch {
      patch((t) => ({
        ...t,
        phase: 'error',
        error: 'We lost the connection. Your message is still here — try again.',
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="widget">
      <header className="widget__header">
        <span className="widget__avatar" aria-hidden="true">
          CA
        </span>
        <div className="widget__id">
          <strong>Cerro Alto Coffee</strong>
          <span className="widget__hours">Support · Mon–Fri 9–5 ET</span>
        </div>
        {/* The mode is stated in the surface itself, not in a footnote below it. */}
        <span className={`widget__mode ${live ? 'widget__mode--live' : ''}`}>
          <i aria-hidden="true" />
          {live ? 'Live' : 'Fixture mode'}
        </span>
      </header>

      <div className="widget__scroll" ref={scrollRef}>
        {turns.length === 0 && (
          <div className="empty">
            <p className="empty__lead">
              Ask about an order, a grind, or a subscription. If I can&apos;t answer it from our
              help centre, I&apos;ll hand you to a person rather than guess.
            </p>
            <div className="empty__suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip chip--action" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div className="turn" key={i}>
            <div className="bubble bubble--customer">{turn.question}</div>

            {/* Named, because an unexplained pause reads as broken. */}
            {turn.phase === 'thinking' && (
              <div className="status">
                <span className="status__dot" /> Thinking
              </div>
            )}

            {turn.tools.map((tool, j) => (
              <div className={`status ${tool.ms !== null ? 'status--done' : ''}`} key={j}>
                {tool.ms === null ? (
                  <>
                    <span className="status__dot" /> {tool.label}…
                  </>
                ) : tool.ok ? (
                  <>
                    <span className="status__tick">
                      <IconCheck />
                    </span>{' '}
                    {tool.label}
                    <span className="status__ms">{tool.ms} ms</span>
                  </>
                ) : (
                  <>
                    <span className="status__cross">
                      <IconCross />
                    </span>{' '}
                    Couldn&apos;t reach the order system
                  </>
                )}
              </div>
            ))}

            {turn.answer && (
              <div className="bubble bubble--agent">
                {stripCitations(turn.answer)}
                {turn.phase === 'streaming' && <span className="caret" />}
              </div>
            )}

            {turn.citations.length > 0 && (
              <div className="citations">
                <span className="citations__label">From</span>
                {turn.citations.map((doc) => (
                  <a
                    key={doc}
                    className="chip chip--cite"
                    href={`/policies/${doc}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {DOC_TITLES[doc] ?? doc}
                  </a>
                ))}
              </div>
            )}

            {/* A deliberate state. Escalation is the system working, not failing. */}
            {turn.handoff && (
              <div className="handoff">
                <div className="handoff__title">
                  <IconHandoff /> Passed to a person
                </div>
                <p>{turn.handoff.tellCustomer}</p>
                <span className="handoff__ref">Ref {turn.handoff.ticketId}</span>
              </div>
            )}

            {turn.error && (
              <div className="failure">
                <p>{turn.error}</p>
                <a href="mailto:support@cerroaltocoffee.example">Email the team instead</a>
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          className="composer__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about an order, a grind, a subscription…"
          aria-label="Your message"
          disabled={busy}
        />
        <button className="composer__send" disabled={busy || !input.trim()} aria-label="Send">
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
