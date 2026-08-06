import type { ReactNode } from 'react';

/* Two identical tracks, the second aria-hidden. The animation runs one full
 * track width and repeats, so the seam never shows and the duplicate never
 * reaches the accessibility tree twice. */
export function Marquee({
  children,
  duration = 40,
  gap = 48,
}: {
  children: ReactNode;
  duration?: number;
  gap?: number;
}) {
  const style = { '--marquee-dur': `${duration}s`, '--marquee-gap': `${gap}px` } as React.CSSProperties;
  return (
    <div className="marquee" style={style}>
      <div className="marquee__track">{children}</div>
      <div className="marquee__track" aria-hidden>
        {children}
      </div>
    </div>
  );
}
