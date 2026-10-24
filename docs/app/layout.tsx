import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Geist, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Body } from '@/app/layout.client';

if (process.env.NODE_ENV === 'development') {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : '')).join(' ');
    if (
      msg.includes('Encountered a script tag') ||
      msg.includes('Scripts inside React components are never executed')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

const geist = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata = {
  metadataBase: new URL('https://marrow.run'),
  title: {
    template: '%s | Marrow',
    default: 'Marrow — Declarative Network Topology Studio',
  },
  description:
    'Compile declarative network topology YAML into interactive, offline, self-contained HTML network diagrams.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
    { media: '(prefers-color-scheme: light)', color: '#fff' },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="relative flex min-h-screen flex-col">
        <RootProvider>
          <Body>{children}</Body>
        </RootProvider>
      </body>
    </html>
  );
}
