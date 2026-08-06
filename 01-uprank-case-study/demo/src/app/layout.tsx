import type { Metadata } from 'next';
import { Schibsted_Grotesk, Cabin, Geist_Mono } from 'next/font/google';
import './globals.css';

/* The three faces the reference design uses, self-hosted by next/font so the
 * page makes no request to a font CDN at runtime and nothing shifts on load.
 * Display is Schibsted Grotesk at 400 — the light weight at a large size is
 * the thing that keeps a pure-black page from reading heavy. */

const display = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
});

const ui = Cabin({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ui',
  display: 'swap',
});

const mono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'UpRank scorer — rank a job post with a rule engine, not a model',
  description:
    'Paste an Upwork job post and get a 0–100 score, five sub-scores, a reason for each, scam signals and an apply/maybe/skip verdict. Runs entirely in your browser. No sign-up, no model call.',
};

export const viewport = { themeColor: '#000000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
