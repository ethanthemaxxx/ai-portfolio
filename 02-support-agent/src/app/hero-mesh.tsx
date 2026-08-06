'use client';

/**
 * The hero backdrop: a surveyed grid that responds to the pointer, drifting on
 * two planes as the page scrolls.
 *
 * It is a grid rather than scenery on purpose. This page argues that the agent
 * shows its work — the tool call, the elapsed time, the document each claim came
 * from — and a measuring instrument is the right backdrop for that argument in a
 * way that weather is not.
 *
 * What is drawn, back to front:
 *
 *   dots      a 22px pitch, the fine graticule, drifting slowest-but-one
 *   lines     an 88px pitch, the coarse graticule, drifting slower still
 *   glow      the same coarse grid at four times the contrast, revealed only
 *             through a soft disc centred on the pointer
 *   cell      the one 88px square the pointer is inside, snapped to the pitch
 *   crosshair a full-width and full-height rule through the pointer
 *
 * How it is driven, and why this way:
 *
 *   Two inputs — scroll and pointer — share a single `requestAnimationFrame`.
 *   Neither handler touches layout: the pointer handler stores raw client
 *   coordinates and the hero's rect is cached, refreshed only on scroll and
 *   resize, so moving the mouse never forces a style recalculation.
 *
 *   Everything is expressed as custom properties on this element — never on
 *   `:root`, where a per-frame write would invalidate every rule on the page
 *   that could inherit it. CSS turns those few numbers into every offset, mask
 *   and highlight below.
 *
 *   The glow and the cell are parallaxed with the grid they belong to, so their
 *   mask has to be read in the translated coordinate space — hence the
 *   `--drift` subtraction in the CSS. Without it the highlight lags the cursor
 *   by exactly the parallax offset, which reads as broken rather than as depth.
 *
 *   The pointer half is gated on `(pointer: fine)`. On a touch screen there is
 *   no hover to respond to, and a highlight stranded wherever the last tap
 *   landed is worse than no highlight.
 *
 *   Under `prefers-reduced-motion` neither half is attached. The grid renders
 *   static, which is a composition that holds on its own — the movement is a
 *   flourish on top of it, not the thing holding it together.
 */

import { useEffect, useRef } from 'react';

/** Matches --pitch-coarse in globals.css. The cell snaps to this. */
const PITCH = 88;

/** Survey crosses, placed by eye rather than on the pitch. */
const CROSSES = [
  { x: '11%', y: '18%' },
  { x: '78%', y: '12%' },
  { x: '22%', y: '62%' },
  { x: '89%', y: '54%' },
  { x: '46%', y: '8%' },
];

export default function HeroMesh() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hero = el.parentElement;
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const fine = window.matchMedia('(pointer: fine)').matches;

    let frame = 0;
    let rect = hero.getBoundingClientRect();
    let lastScroll = -1;
    let clientX = 0;
    let clientY = 0;
    let movePending = false;

    const write = () => {
      frame = 0;

      const y = window.scrollY;
      const limit = hero.offsetHeight + 200;
      // Past the hero there is nothing on screen left to move.
      if (y !== lastScroll && !(lastScroll > limit && y > limit)) {
        lastScroll = y;
        el.style.setProperty('--sy', String(Math.min(y, limit)));
      }

      if (movePending) {
        movePending = false;
        const x = clientX - rect.left;
        const ny = clientY - rect.top;
        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${ny}px`);
        el.style.setProperty('--cx', `${Math.floor(x / PITCH) * PITCH}px`);
        el.style.setProperty('--cy', `${Math.floor(ny / PITCH) * PITCH}px`);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    // The rect only moves when the page scrolls or the layout changes, so it is
    // cached and refreshed there — never read inside the pointer handler.
    const refreshRect = () => {
      rect = hero.getBoundingClientRect();
    };

    const onScroll = () => {
      refreshRect();
      schedule();
    };
    const onResize = () => {
      refreshRect();
      schedule();
    };
    const onMove = (e: PointerEvent) => {
      clientX = e.clientX;
      clientY = e.clientY;
      movePending = true;
      el.style.setProperty('--ma', '1');
      schedule();
    };
    const onLeave = () => el.style.setProperty('--ma', '0');

    write();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    // A hidden tab pauses rAF, so a scroll made while backgrounded never lands.
    document.addEventListener('visibilitychange', write);
    if (fine) {
      hero.addEventListener('pointermove', onMove, { passive: true });
      hero.addEventListener('pointerleave', onLeave, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', write);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="mesh" ref={ref} aria-hidden="true">
      <div className="mesh__wash" />
      <div className="mesh__dots" />
      <div className="mesh__lines" />

      {CROSSES.map((c) => (
        <svg
          className="mesh__cross"
          key={`${c.x}${c.y}`}
          style={{ left: c.x, top: c.y }}
          width="11"
          height="11"
          viewBox="0 0 11 11"
        >
          <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
        </svg>
      ))}

      <div className="mesh__glow-clip">
        <div className="mesh__glow" />
      </div>
      <div className="mesh__cell" />
      <div className="mesh__rule mesh__rule--h" />
      <div className="mesh__rule mesh__rule--v" />
    </div>
  );
}
