import { ArrowRight, Mark } from './icons.tsx';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#demo', label: 'Live demo' },
  { href: '#rules', label: 'The rules' },
  { href: '#faq', label: 'FAQs' },
];

export function SiteNav() {
  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav__inner">
        <a className="nav__mark" href="#main" aria-label="Catalog copy gate — home">
          <Mark />
        </a>
        <div className="nav__links">
          {LINKS.map((l) => (
            <a key={l.href} className="nav__link" href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <a className="btn btn--light btn--sm" href="#demo" style={{ marginLeft: 'auto' }}>
          Try the gate
          <ArrowRight size={12} />
        </a>
      </div>
    </nav>
  );
}
