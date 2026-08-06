'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/* One observer per element, disconnected on first intersection. Cheaper than a
 * scroll listener, and it means the animation cannot re-trigger and flicker on
 * the way back up.
 *
 * The entrance animation starts from opacity 0, so anything that stops the
 * observer from firing leaves the page blank. Two backstops: a rect check at
 * mount for anything already on screen, and one shared rAF-throttled scroll
 * listener that re-checks. Motion is the enhancement; the words are the
 * product, and they must survive the enhancement failing. */

const watchers = new Set<() => void>();
let ticking = false;

function pump() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    for (const fn of watchers) fn();
  });
}

function watch(fn: () => void) {
  if (watchers.size === 0) {
    window.addEventListener('scroll', pump, { passive: true });
    window.addEventListener('resize', pump, { passive: true });
  }
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
    if (watchers.size === 0) {
      window.removeEventListener('scroll', pump);
      window.removeEventListener('resize', pump);
    }
  };
}

function useShown<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setShown(true);
    };

    const inView = () => {
      const box = el.getBoundingClientRect();
      return box.top < window.innerHeight * 0.94 && box.bottom > 0;
    };

    if (inView()) {
      reveal();
      return;
    }

    const unwatch = watch(() => {
      if (inView()) {
        reveal();
        unwatch();
      }
    });

    if (typeof IntersectionObserver === 'undefined') return unwatch;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);

    return () => {
      unwatch();
      io.disconnect();
    };
  }, [threshold]);

  return { ref, shown };
}

export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
}) {
  const { ref, shown } = useShown<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`.trim()}
      data-shown={shown}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/* The reference's opening statement fades in word by word as it scrolls into
 * view. Splitting on whitespace keeps the words selectable and screen-reader
 * friendly — the whole sentence still reads as one string. */
export function WordReveal({ text, className = '' }: { text: string; className?: string }) {
  const { ref, shown } = useShown<HTMLParagraphElement>(0.35);
  const words = text.split(' ');
  return (
    <p ref={ref} className={`words ${className}`.trim()} data-shown={shown}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} style={{ '--i': i } as React.CSSProperties}>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
