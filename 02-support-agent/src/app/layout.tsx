import './globals.css';
import type { ReactNode } from 'react';

/**
 * Fonts come from the Google CSS API rather than `next/font/google`, and that is
 * deliberate: `next/font` fetches at build time, which would break this project's
 * own promise that a clean clone builds with no network. Here the build stays
 * offline-safe, the page degrades to the system stack if the request fails, and
 * `display=swap` means text is never invisible while waiting.
 */
export const metadata = {
  title: 'Cerro Alto Coffee — support agent',
  description:
    'A RAG support agent for a DTC coffee store: answers grounded in the store’s own policy documents, live order lookup, and deterministic escalation to a human.',
  openGraph: {
    title: 'Cerro Alto Coffee — support agent',
    description:
      'Grounded answers, live order lookup, deterministic escalation. Spec-first, adversarially evaluated.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#f9f9f9',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
