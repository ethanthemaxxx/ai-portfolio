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

/* ── what the agent is wired to ────────────────────────────────────────── */

/*
 * These name a capability, never a vendor. Redrawing a third party's logo puts
 * their trade mark in this repository under my hand, which is a different
 * problem from naming them in text — so the mark says what the thing does and
 * the label beside it says whose it is.
 */

/** The model. */
export function IconSpark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.25 13.9 9 19.75 10.9 13.9 12.8 12 18.55 10.1 12.8 4.25 10.9 10.1 9z" />
      <path d="M18 16.5 18.8 18.7 21 19.5 18.8 20.3 18 22.5 17.2 20.3 15 19.5 17.2 18.7z" />
    </Svg>
  );
}

/** The store the orders live in. */
export function IconStore(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 9.75h16v9.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.25z" />
      <path d="M3.25 9.75 5 3.75h14l1.75 6" />
      <path d="M9.5 20.75v-6h5v6" />
    </Svg>
  );
}

/** The embedding space retrieval searches. */
export function IconVector(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.75 20.25V4M3.75 20.25H20" />
      <circle cx="9" cy="15" r="1.5" />
      <circle cx="13.5" cy="9.5" r="1.5" />
      <circle cx="17.5" cy="14" r="1.5" />
      <path d="M10.1 13.8 12.4 10.7M14.6 10.6 16.4 12.9" />
    </Svg>
  );
}

/** The help centre. */
export function IconBook(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4.75A1.5 1.5 0 0 1 5.5 3.25H19v17.5H5.5A1.5 1.5 0 0 1 4 19.25z" />
      <path d="M4 17.25h15" />
      <path d="M8 7.25h7" />
    </Svg>
  );
}

/** The queue a handoff lands in. */
export function IconInbox(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.25 13.5 6 4.75h12l2.75 8.75v5.25a1.5 1.5 0 0 1-1.5 1.5H4.75a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.25 13.5h4.5l1.25 2.5h6l1.25-2.5h4.5" />
    </Svg>
  );
}

/** The typed contracts. */
export function IconBraces(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 3.75H8A2.25 2.25 0 0 0 5.75 6v3.25L3.75 12l2 2.75V18A2.25 2.25 0 0 0 8 20.25h1.5" />
      <path d="M14.5 3.75H16A2.25 2.25 0 0 1 18.25 6v3.25L20.25 12l-2 2.75V18A2.25 2.25 0 0 1 16 20.25h-1.5" />
    </Svg>
  );
}

/** The suite. */
export function IconFlask(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 3.25v6.1L4.6 17.6a1.6 1.6 0 0 0 1.4 2.4h12a1.6 1.6 0 0 0 1.4-2.4l-4.9-8.25V3.25" />
      <path d="M8.25 3.25h7.5" />
      <path d="M6.9 14.5h10.2" />
    </Svg>
  );
}

/** Where it is served from. */
export function IconGlobe(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M3.4 12h17.2" />
      <path d="M12 3.25c2.2 2.4 3.4 5.5 3.4 8.75S14.2 18.35 12 20.75c-2.2-2.4-3.4-5.5-3.4-8.75S9.8 5.65 12 3.25z" />
    </Svg>
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
  spark: IconSpark,
  store: IconStore,
  vector: IconVector,
  book: IconBook,
  inbox: IconInbox,
  braces: IconBraces,
  flask: IconFlask,
  globe: IconGlobe,
} as const;

export type IconKey = keyof typeof FEATURE_ICONS;
