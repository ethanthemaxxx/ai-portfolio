import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Catalog copy gate — try to sneak a fabrication past it',
  description:
    'A public demo of a catalogue enrichment pipeline whose product is the gate: every factual claim must trace to the source data, or the product is quarantined. No sign-up, no API key.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
