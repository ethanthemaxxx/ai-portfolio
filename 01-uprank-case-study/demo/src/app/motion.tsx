'use client';

/* ===========================================================================
   Motion system — reproduced from agentflow.framer.ai.

   The reference drives everything through Framer Motion and Lenis. The values
   here are not invented: they were read off the live site's DOM while it was
   mid-animation. Elements awaiting reveal sit at `opacity: 0.001` with
   `translateY(60px)`, `translateY(30px)` or `scale(0.8)` and `will-change:
   transform`; its caret blinks at 800ms; its shimmer sweeps background-position
   from 200% to -100% over 3–4s linear; its easing is cubic-bezier(.44,0,.56,1),
   which appears in the site's own stylesheet.

   Everything below degrades to "already in its final state" under
   prefers-reduced-motion. That is not a nicety: a page that hijacks the scroll
   wheel and animates on every section is exactly the page that has to stop
   when a visitor has told the OS that motion makes them ill.
   =========================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* The `motion` class is put on <html> by a blocking script in the layout, so
 * it is present before first paint. Every rule that hides something for a
 * reveal is scoped to it — which means a visitor with JavaScript off, or a
 * visitor whose JS threw before hydration, gets the whole page visible rather
 * than a black rectangle. Hiding content is only safe if something is
 * guaranteed to unhide it. */

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------ smooth scroll
   Lenis is the library the reference actually uses (its <html> carries the
   `lenis lenis-autoToggle` classes). Same library, same feel — and switched
   off entirely when the visitor has asked for less motion, because inertial
   scrolling is the single most nauseating thing on a page like this. */

export function SmoothScroll() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let frame = 0;
    let cancelled = false;

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      // `anchors` is what keeps every #href on the page scrolling with the
      // same inertia as the wheel. Without it Lenis disables native smooth
      // scrolling and the nav links snap.
      lenis = new Lenis({ duration: 1.05, smoothWheel: true, anchors: true });
      const raf = (time: number) => {
        lenis?.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, [reduced]);

  return null;
}

/* ---------------------------------------------------------------- reveal
   One IntersectionObserver for the whole page rather than one per element.
   `once: true` — the reference never re-hides something you have already
   scrolled past, and neither does this. */

/* One observer for the page, created lazily at module scope rather than inside
 * an effect. That is deliberate: an observer owned by an effect gets torn down
 * and rebuilt by Strict Mode's double mount, and any element registered before
 * the teardown is silently dropped — which leaves the whole page sitting at
 * opacity .001 forever. Module scope has no such lifecycle. */

let sharedIO: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined') return null;
  if (!sharedIO) {
    sharedIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          sharedIO?.unobserve(e.target);
        }
      },
      // Fire a little before the element's top edge arrives, so the motion
      // reads as "already underway" rather than as a jolt at the fold.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    );
  }
  return sharedIO;
}

const RevealCtx = createContext<((el: Element | null) => (() => void) | void) | null>(null);

export function RevealProvider({ children }: { children: ReactNode }) {
  const register = useCallback((el: Element | null) => {
    if (!el) return;
    if (REDUCED) {
      el.classList.add('is-in');
      return;
    }
    const io = getObserver();
    io?.observe(el);
    return () => io?.unobserve(el);
  }, []);

  return <RevealCtx.Provider value={register}>{children}</RevealCtx.Provider>;
}

type RevealVariant = 'up' | 'up-sm' | 'scale';

export function Reveal({
  children,
  variant = 'up',
  delay = 0,
  as: Tag = 'div',
  className = '',
  ...rest
}: {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  as?: 'div' | 'section' | 'header' | 'article' | 'p' | 'h1' | 'h2' | 'h3' | 'span' | 'li';
  className?: string;
} & Record<string, unknown>) {
  const register = useContext(RevealCtx);
  return (
    <Tag
      ref={register as never}
      data-reveal={variant}
      className={className}
      style={delay ? ({ transitionDelay: `${delay}ms` } as React.CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------- split text
   The reference splits its hero line into individual characters, each with its
   own opacity and a 1px lift, and staggers them. Words are kept as unbreakable
   groups so the line still wraps like text; the characters inside them animate
   independently. `aria-label` carries the whole string, and the spans are
   hidden from the accessibility tree — a screen reader gets one sentence, not
   sixty letters. */

export function SplitText({
  text,
  className = '',
  stagger = 18,
  as: Tag = 'h1',
}: {
  text: string;
  className?: string;
  stagger?: number;
  as?: 'h1' | 'h2' | 'p';
}) {
  const register = useContext(RevealCtx);
  const words = useMemo(() => text.split(' '), [text]);
  let i = -1;

  return (
    <Tag ref={register as never} className={`split ${className}`} data-reveal="none" aria-label={text}>
      {words.map((word, w) => (
        <span className="split__word" key={`${w}-${word}`} aria-hidden="true">
          {[...word].map((ch, c) => {
            i += 1;
            return (
              <span
                className="split__ch"
                key={`${c}-${ch}`}
                style={{ transitionDelay: `${i * stagger}ms` }}
              >
                {ch}
              </span>
            );
          })}
          {w < words.length - 1 ? <span className="split__sp"> </span> : null}
        </span>
      ))}
    </Tag>
  );
}

/* ----------------------------------------------------------------- count up
   Counts only once, when the number scrolls into view. Tabular figures and a
   fixed width in the CSS stop the row from reflowing while it ticks. */

export function CountUp({ to, duration = 1100 }: { to: number; duration?: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (REDUCED) {
      setN(to);
      return;
    }
    let frame = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutExpo — fast out of the gate, settles on the number
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setN(Math.round(to * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, duration]);

  return <span ref={ref}>{n}</span>;
}

/* ------------------------------------------------------------------ ticker
   The reference's `<li class="ticker-item">` row: a track duplicated once and
   translated by exactly -50%, so the seam lands where the copy begins and the
   loop is invisible. Pauses on hover, and on focus-within so a keyboard user
   can actually reach what is inside it. */

export function Ticker({ items, duration = 44 }: { items: string[]; duration?: number }) {
  const run = [...items, ...items];
  return (
    <div className="ticker" aria-label="What the engine looks for">
      <ul className="ticker__track" style={{ animationDuration: `${duration}s` }}>
        {run.map((item, i) => (
          <li className="ticker__item" key={`${i}-${item}`} aria-hidden={i >= items.length}>
            <span className="ticker__dot" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- accordion
   Height is animated with grid-template-rows 0fr→1fr, which transitions
   cleanly without measuring anything in JS. The row is a real <button> with
   aria-expanded and aria-controls, so it works from the keyboard and announces
   its state — the reference's does neither. */

export function Accordion({
  items,
}: {
  items: Array<{ q: string; a: ReactNode }>;
}) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="acc">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className={`acc__row${isOpen ? ' is-open' : ''}`} key={item.q}>
            <h3 className="acc__h">
              <button
                type="button"
                className="acc__btn"
                aria-expanded={isOpen}
                aria-controls={`acc-panel-${i}`}
                id={`acc-btn-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.q}</span>
                <span className="acc__sign" aria-hidden="true" />
              </button>
            </h3>
            <div
              className="acc__panel"
              id={`acc-panel-${i}`}
              role="region"
              aria-labelledby={`acc-btn-${i}`}
              hidden={!isOpen}
            >
              <div className="acc__inner">
                <p className="note">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- roll label
   The reference's buttons are a 23px overflow-hidden mask holding two stacked
   15px copies of the label; hovering slides the pair up so the second copy
   takes the first's place. Both copies carry the same text, so the second is
   hidden from assistive tech to stop it being read twice. */

export function Roll({ children }: { children: string }) {
  return (
    <span className="roll">
      <span className="roll__a">{children}</span>
      <span className="roll__b" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

/* The reference pairs the label roll with an icon that rolls in its own little
 * square on the lit side of the button. Two copies again, and the whole thing
 * is decoration — the button's accessible name comes from the label. */

const Arrow = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path
      d="M3 10L10 3M10 3H4.2M10 3v5.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
    />
  </svg>
);

export function RollIcon() {
  return (
    <span className="btn__icon" aria-hidden="true">
      <span className="roll">
        <span className="roll__a">
          <Arrow />
        </span>
        <span className="roll__b">
          <Arrow />
        </span>
      </span>
    </span>
  );
}

/* --------------------------------------------------------- nav spy + shadow
   Highlights the section you are actually in, and lets the nav know when the
   page has left the top so its border can appear. */

export function useNavSpy(ids: string[]) {
  const [active, setActive] = useState<string>('');
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      io.disconnect();
    };
  }, [ids]);

  return { active, stuck };
}
