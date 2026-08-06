'use client';

/**
 * The hero backdrop: a dot grid with survey crosses, a graded sky, and three
 * cloud layers that drift at different rates as the page scrolls.
 *
 * How the parallax is driven, and why this way:
 *
 *   One scroll listener, marked passive so it can never block the gesture. It
 *   does no layout work — it coalesces into a single `requestAnimationFrame`
 *   and writes one custom property, `--sy`, onto this element. Every layer
 *   derives its own offset from that one number via `--depth`, so the whole
 *   effect costs a single style write per frame and the transforms themselves
 *   stay on the compositor.
 *
 *   The property is written to the hero, never to `:root`. A custom property on
 *   the document element invalidates every rule that could inherit it, on every
 *   frame, for the whole page.
 *
 *   It stops writing once the hero has scrolled past. Below the fold there is
 *   nothing on screen to move, and a scroll handler that keeps working for the
 *   rest of a 8,000px page is a tax with no picture to show for it.
 *
 *   Under `prefers-reduced-motion` the listener is never attached. The clouds
 *   render exactly where they start, which is a composition that has to hold on
 *   its own anyway — the parallax is a flourish on top of it, not the thing
 *   holding it together.
 *
 * The clouds are drawn, not photographed: three overlapping ellipses per cloud,
 * softened by a CSS blur on the layer rather than an SVG filter, because a blur
 * on the layer is one compositor operation instead of a filter region the
 * browser has to re-rasterise while it moves.
 */

import { useEffect, useRef } from 'react';

/** One cumulus: three ellipses that read as a single soft mass once blurred. */
function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="14" rx="52" ry="17" />
      <ellipse cx="34" cy="4" rx="38" ry="24" />
      <ellipse cx="78" cy="13" rx="44" ry="18" />
      <ellipse cx="112" cy="18" rx="30" ry="13" />
    </g>
  );
}

/*
 * Placement is deliberate, not scattered. The widget covers the middle of this
 * box — roughly x 560–1040 in these units — so a cloud dropped there is a cloud
 * nobody sees. The mass sits in the two gutters beside the card, with a couple
 * left behind it so something is still passing when the card is scrolled over.
 *
 * Clouds cluster around y 200 in every layer; which band a layer occupies is
 * set once in CSS with `bottom`, so tuning the composition means moving one
 * number rather than re-typing every coordinate here.
 */
const LAYERS = [
  {
    key: 'far',
    depth: -0.18,
    clouds: [
      { x: 30, y: 205, s: 0.5 },
      { x: 330, y: 168, s: 0.4 },
      { x: 760, y: 226, s: 0.46 },
      { x: 1120, y: 180, s: 0.55 },
      { x: 1430, y: 214, s: 0.42 },
    ],
  },
  {
    key: 'mid',
    depth: -0.1,
    clouds: [
      { x: -70, y: 210, s: 0.85 },
      { x: 300, y: 178, s: 0.7 },
      { x: 1090, y: 220, s: 0.95 },
      { x: 1460, y: 186, s: 0.78 },
    ],
  },
  {
    key: 'near',
    depth: -0.04,
    clouds: [
      { x: -20, y: 196, s: 1.3 },
      { x: 620, y: 232, s: 1.15 },
      { x: 1280, y: 190, s: 1.45 },
    ],
  },
] as const;

/** Survey crosses in the dot grid, placed by eye rather than on the grid pitch. */
const CROSSES = [
  { x: '11%', y: '18%' },
  { x: '78%', y: '12%' },
  { x: '22%', y: '62%' },
  { x: '89%', y: '54%' },
  { x: '46%', y: '8%' },
];

export default function HeroSky() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const hero = el.parentElement;
    let frame = 0;
    let last = -1;

    const write = () => {
      frame = 0;
      const y = window.scrollY;
      if (y === last) return;
      // Past the hero there is nothing on screen left to move.
      const limit = (hero?.offsetHeight ?? 0) + 200;
      if (last > limit && y > limit) return;
      last = y;
      el.style.setProperty('--sy', String(Math.min(y, limit)));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    write();
    window.addEventListener('scroll', onScroll, { passive: true });
    // A hidden tab pauses rAF, so a scroll that happens while backgrounded
    // never lands. Catch up once on the way back rather than showing a stale
    // frame until the next scroll.
    document.addEventListener('visibilitychange', write);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', write);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="sky" ref={ref} aria-hidden="true">
      <div className="sky__grid" />

      {CROSSES.map((c) => (
        <svg
          className="sky__cross"
          key={`${c.x}${c.y}`}
          style={{ left: c.x, top: c.y }}
          width="11"
          height="11"
          viewBox="0 0 11 11"
        >
          <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
        </svg>
      ))}

      <div className="sky__grad" />

      {LAYERS.map((layer) => (
        <div
          className={`sky__layer sky__layer--${layer.key}`}
          key={layer.key}
          style={{ ['--depth' as string]: layer.depth }}
        >
          <svg viewBox="0 0 1600 440" preserveAspectRatio="xMidYMax meet">
            <g fill="currentColor">
              {layer.clouds.map((c) => (
                <Cloud key={`${c.x}-${c.y}`} x={c.x} y={c.y} s={c.s} />
              ))}
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}
