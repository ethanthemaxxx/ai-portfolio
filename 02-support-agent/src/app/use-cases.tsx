'use client';

/**
 * Who the agent is actually for, as a numbered accordion.
 *
 * One panel is open at a time and one is always open, so the section never
 * collapses to a stack of labels with a hole underneath it. The first is open
 * on the server render too, which means the content is in the HTML for a reader
 * who never runs the script and for anything crawling the page.
 *
 * Built on real buttons rather than divs with click handlers: `aria-expanded`
 * announces the state, `aria-controls` ties the header to its panel, and arrow
 * keys move between headers the way a tablist is expected to. The panel keeps
 * its own tab order, so a keyboard user lands on the links inside it next.
 */

import { useRef, useState } from 'react';
import { FEATURE_ICONS, type IconKey } from './icons.tsx';

interface UseCase {
  n: string;
  icon: IconKey;
  tone: string;
  title: string;
  lede: string;
  points: string[];
}

const CASES: UseCase[] = [
  {
    n: '001',
    icon: 'cup',
    tone: 'tile--mint',
    title: 'The customer',
    lede: 'Someone who wants an answer at 11pm and has no interest in whether it came from a model or a person.',
    points: [
      'Gets the shipping rule as it is written, not an approximation of it.',
      'Can click through to the document the answer was built from.',
      'Is handed to a human the moment the documents stop covering the question — with the ticket already written.',
    ],
  },
  {
    n: '002',
    icon: 'inbox',
    tone: 'tile--amber',
    title: 'The support lead',
    lede: 'The person who has to answer for what the agent said to a customer last Tuesday.',
    points: [
      'Escalation is a rule in code, not a line in a prompt — refunds over the approval limit cannot be talked past.',
      'Every turn carries the documents it cited, so a bad answer is traceable to a bad document.',
      'Changing a policy means editing a markdown file and rebuilding the index, not retraining anything.',
    ],
  },
  {
    n: '003',
    icon: 'braces',
    tone: 'tile--lav',
    title: 'The engineer',
    lede: 'Whoever inherits this and has to change it without breaking the part that touches money.',
    points: [
      'Retrieval, tools, escalation and citation are separate contracts with separate tests.',
      'The index is committed, so a clean clone runs the offline half with no keys and no network.',
      'The spec, plan and task list that produced the code are in the repository next to it.',
    ],
  },
];

export default function UseCases() {
  const [open, setOpen] = useState(0);
  const headers = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const delta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + CASES.length) % CASES.length;
    setOpen(next);
    headers.current[next]?.focus();
  }

  return (
    <div className="cases">
      {CASES.map((c, i) => {
        const Icon = FEATURE_ICONS[c.icon];
        const isOpen = i === open;
        return (
          <div className={`cases__item ${isOpen ? 'is-open' : ''}`} key={c.n}>
            <h3 className="cases__h">
              <button
                className="cases__header"
                ref={(el) => {
                  headers.current[i] = el;
                }}
                aria-expanded={isOpen}
                aria-controls={`case-panel-${c.n}`}
                id={`case-header-${c.n}`}
                onClick={() => setOpen(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <span className="cases__n">{c.n}</span>
                <span className={`tile ${c.tone}`}>
                  <Icon size={20} />
                </span>
                <span className="cases__title">{c.title}</span>
                <span className="cases__chevron" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 6.25 8 10.25l4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            </h3>

            <div
              className="cases__panel"
              id={`case-panel-${c.n}`}
              role="region"
              aria-labelledby={`case-header-${c.n}`}
              hidden={!isOpen}
            >
              <div className="cases__panel-inner">
                <p className="cases__lede">{c.lede}</p>
                <ul className="cases__points">
                  {c.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
