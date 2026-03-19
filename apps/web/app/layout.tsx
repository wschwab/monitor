/**
 * Root Layout
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monitor',
  description: 'Monitor your agent monitoring the situation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #080808; color: #e2e8f0; -webkit-font-smoothing: antialiased; }
          a { color: inherit; }
          input, textarea, button, select { font-family: inherit; }
          input[type="number"]::-webkit-inner-spin-button { opacity: 1; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
