import type { ReactNode } from 'react';
import { Reveal } from './reveal.tsx';

/* The reference numbers every section 001…010 and pairs the number with a
 * one-word category. It is the spine that holds a long page together. */
export function SectionHead({
  num,
  label,
  title,
  lede,
}: {
  num: string;
  label: string;
  title: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <div className="section__head">
      <Reveal className="section__eyebrow">
        <span className="label mono">{num}</span>
        <span className="label">{label}</span>
      </Reveal>
      <Reveal className="section__intro" delay={60}>
        <h2 className="h2">{title}</h2>
        {lede ? <p className="lede">{lede}</p> : null}
      </Reveal>
    </div>
  );
}
