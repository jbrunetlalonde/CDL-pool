import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Canadian Income Tax Calculator 2026',
  description: 'Free, anonymous Canada-first income tax calculator with take-home pay by province.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
        <footer
          style={{
            borderTop: '1px solid var(--hairline)',
            marginTop: 64,
            padding: '24px 16px 48px',
            fontSize: 12,
            color: 'var(--muted)',
            textAlign: 'center',
          }}
        >
          <p>For informational purposes only.</p>
          <p>Numbers are estimates and may not reflect actual tax liabilities.</p>
          <p>Data last verified 2026-09-03, for the 2026 tax year (snapshot + BC/PE/NL overrides vs CRA/KPMG).</p>
        </footer>
      </body>
    </html>
  );
}
