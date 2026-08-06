'use client';

import { useId, useState } from 'react';
import { Plus } from './icons.tsx';

export interface QA {
  q: string;
  a: string;
}

/* grid-template-rows 0fr → 1fr animates height without measuring anything, and
 * the panel stays in the DOM so in-page search still finds the answers. */
export function Accordion({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <div className="acc">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${base}-panel-${i}`;
        const btnId = `${base}-btn-${i}`;
        return (
          <div className="acc__item" key={item.q}>
            <h3>
              <button
                id={btnId}
                className="acc__btn"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="acc__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="acc__q">{item.q}</span>
                <span className="acc__sign" aria-hidden>
                  <Plus />
                </span>
              </button>
            </h3>
            <div className="acc__panel" id={panelId} role="region" aria-labelledby={btnId} data-open={isOpen}>
              <div>
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
