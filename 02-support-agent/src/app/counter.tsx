'use client';

/**
 * A figure that counts up the first time it is scrolled into view.
 *
 * Three constraints shaped it:
 *
 *   The server renders the final value, not a zero. A number that arrives as 0
 *   and climbs is fine as an animation and terrible as markup — anything that
 *   reads the page without running the script would quote "0" as the test
 *   count. So the real value is in the HTML, and the effect only borrows it.
 *
 *   No layout shift. `251/252` is narrower at `9/252` and the tile would twitch
 *   on every frame, so the value is set in tabular figures and the element
 *   reserves the width of the final string with an invisible copy of it.
 *
 *   It runs once, on entry, and disconnects. A counter that replays every time
 *   it scrolls past stops reading as a measurement and starts reading as decor.
 *
 * Under `prefers-reduced-motion` the observer is never attached: the number is
 * already correct in the DOM, so doing nothing is the whole implementation.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** The measured figure. Rendered as-is before and after the animation. */
  value: number;
  /** Anything that follows it — "%", "/252". Never animated. */
  suffix?: string;
  decimals?: number;
}

const DURATION = 900;

/** Fast out, slow in. A linear count-up looks mechanical at the top end. */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function Counter({ value, suffix = '', decimals = 0 }: Props) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let frame = 0;
    let start = 0;

    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      setShown(value * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        // Once. Disconnect before animating so a re-entry can't restart it.
        io.disconnect();
        setShown(0);
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value]);

  const text = shown.toFixed(decimals) + suffix;
  const final = value.toFixed(decimals) + suffix;

  return (
    <span className="counter" ref={ref}>
      {/* Reserves the final width so the tile never reflows mid-count. */}
      <span className="counter__ghost" aria-hidden="true">
        {final}
      </span>
      <span className="counter__live" aria-label={final}>
        {text}
      </span>
    </span>
  );
}
