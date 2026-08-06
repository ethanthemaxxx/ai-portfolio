/**
 * The icon set.
 *
 * Drawn here rather than pulled from a library, for one reason: an icon in this
 * page is a label, not an ornament. Each one names a specific part of the agent
 * — the index it read, the tool it called, the human it handed to — and a
 * generic sparkle would say none of that.
 *
 * The grammar is fixed so a new icon can't drift: 24px box, 1.5 stroke, round
 * caps and joins, no fills, `currentColor` throughout. Anything that reads as
 * text — a tick in a status row, the plus on a disclosure — is a 16px box on the
 * same stroke, so it optically matches the 12–14px type it sits beside.
 *
 * All of them are `aria-hidden`: every icon on this page sits next to a written
 * label, so announcing it twice would only slow a screen reader down.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

function SvgSm({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ── the four capabilities ─────────────────────────────────────────────── */

/** Grounded retrieval — a document with its passage marked. */
export function IconDocument(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13h7M8.5 16.5h4" />
    </Svg>
  );
}

/** Live order lookup — a parcel, seen in three-quarter. */
export function IconParcel(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.75 3.75 7.25v9.5L12 21.25l8.25-4.5v-9.5z" />
      <path d="M3.75 7.25 12 11.75l8.25-4.5" />
      <path d="M12 11.75v9.5" />
      <path d="M7.9 5 16.1 9.5" />
    </Svg>
  );
}

/** Deterministic escalation — the path leaves the machine and reaches a person. */
export function IconHandoff(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.75 12h8" />
      <path d="M7.75 8.5 11.25 12l-3.5 3.5" />
      <circle cx="17" cy="8.25" r="2.5" />
      <path d="M13 19.25a4 4 0 0 1 8 0" />
    </Svg>
  );
}

/** Checkable answers — a claim under a seal. */
export function IconSeal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.75 18.75 5.5v6.25c0 4.1-2.75 7.7-6.75 9.5-4-1.8-6.75-5.4-6.75-9.5V5.5z" />
      <path d="M9.25 11.75 11.25 13.75l3.5-3.75" />
    </Svg>
  );
}

/* ── the three steps ───────────────────────────────────────────────────── */

/** Retrieve — search over the index. */
export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10.75" cy="10.75" r="6" />
      <path d="M15.25 15.25 20.5 20.5" />
    </Svg>
  );
}

/** Call tools — a terminal, because the call is shown, not hidden. */
export function IconTerminal(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2.75" y="4.25" width="18.5" height="15.5" rx="2.5" />
      <path d="M7 10l2.75 2.75L7 15.5" />
      <path d="M12.75 15.5h4.25" />
    </Svg>
  );
}

/** Answer or hand off — the fork where the turn splits. */
export function IconFork(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.75 3.5v3.75a4 4 0 0 0 4 4h10" />
      <path d="M4.75 20.5v-3.75a4 4 0 0 1 4-4" />
      <path d="M15.5 7.75 18.75 11.25 15.5 14.75" />
    </Svg>
  );
}

/* ── the three examples ────────────────────────────────────────────────── */

/** An order in transit. */
export function IconTruck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.75 6.25h10.5v9.5H2.75z" />
      <path d="M13.25 9.5h3.9l3.1 3.1v3.15h-7z" />
      <circle cx="7" cy="18" r="2.25" />
      <circle cx="17" cy="18" r="2.25" />
    </Svg>
  );
}

/** A refund claim — the receipt a human has to sign off. */
export function IconReceipt(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.75 2.75h12.5v18.5l-3.125-2-3.125 2-3.125-2-3.125 2z" />
      <path d="M9.25 8h5.5M9.25 12h5.5" />
    </Svg>
  );
}

/** Product advice — the cup the grind is for. */
export function IconCup(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.75 8.75h12.5v4.5a5 5 0 0 1-5 5h-2.5a5 5 0 0 1-5-5z" />
      <path d="M16.25 10.25h1.25a2.75 2.75 0 0 1 0 5.5h-1.25" />
      <path d="M7.25 3v2.25M10.75 3v2.25M14.25 3v2.25" />
    </Svg>
  );
}

/* ── text-scale marks ──────────────────────────────────────────────────── */

export function IconCheck(p: IconProps) {
  return (
    <SvgSm {...p}>
      <path d="M3.75 8.25 6.5 11l5.75-6" />
    </SvgSm>
  );
}

export function IconCross(p: IconProps) {
  return (
    <SvgSm {...p}>
      <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" />
    </SvgSm>
  );
}

/** The disclosure toggle. Rotating a real cross is crisper than rotating a glyph. */
export function IconPlus(p: IconProps) {
  return (
    <SvgSm {...p}>
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </SvgSm>
  );
}

export function IconMenu(p: IconProps) {
  return (
    <SvgSm {...p}>
      <path d="M2 4h12M2 8h12M2 12h12" />
    </SvgSm>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <SvgSm {...p}>
      <path d="M3 8h9.5" />
      <path d="M9 4.5 12.5 8 9 11.5" />
    </SvgSm>
  );
}

/** The brand mark: a bean, drawn as the split ellipse it actually is. */
export function MarkBean(p: IconProps) {
  return (
    <SvgSm {...p}>
      <ellipse cx="8" cy="8" rx="4.75" ry="6.25" transform="rotate(-38 8 8)" />
      <path d="M5.4 10.6c1.4-1.1 1.9-2.4 1.3-3.6-.6-1.2-.1-2.5 1.3-3.6" />
    </SvgSm>
  );
}

export const FEATURE_ICONS = {
  document: IconDocument,
  parcel: IconParcel,
  handoff: IconHandoff,
  seal: IconSeal,
  search: IconSearch,
  terminal: IconTerminal,
  fork: IconFork,
  truck: IconTruck,
  receipt: IconReceipt,
  cup: IconCup,
} as const;

export type IconKey = keyof typeof FEATURE_ICONS;
