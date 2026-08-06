import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UpRank scorer — rank a job post with a rule engine, not a model',
  description:
    'Paste an Upwork job post and get a 0–100 score, five sub-scores, a reason for each, scam signals and an apply/maybe/skip verdict. Runs entirely in your browser. No sign-up, no model call.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
