import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteNav } from './components/site-nav.tsx';
import { SiteFooter } from './components/site-footer.tsx';

/* Geist is self-hosted from /public/fonts and declared with plain @font-face in
 * globals.css, rather than through next/font. The pipeline sources set
 * moduleResolution to NodeNext so they can run unbundled under
 * `node --experimental-strip-types`, and `next/font/local` does not resolve
 * under that setting. Two <link rel="preload"> tags below buy back what
 * next/font would have given us: the files start downloading with the HTML
 * instead of after the stylesheet parses. */

export const metadata: Metadata = {
  title: 'Catalog copy gate — try to sneak a fabrication past it',
  description:
    'A public demo of a catalogue enrichment pipeline whose product is the gate: every factual claim must trace to the source data, or the product is quarantined. No sign-up, no API key.',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/Geist-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/GeistMono-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Without JS the reveal animation never runs, and its from-state is
            opacity 0. Ship the page readable in that case. */}
        <noscript>
          <style>{'.reveal{opacity:1!important;transform:none!important}.words span{color:var(--ink)!important}'}</style>
        </noscript>
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <SiteNav />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
