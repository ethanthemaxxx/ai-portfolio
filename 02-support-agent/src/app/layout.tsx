import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Cerro Alto Coffee — Support',
  description: 'RAG support agent demo: grounded answers, live order lookup, deterministic escalation.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
