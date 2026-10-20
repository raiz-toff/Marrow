import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Geist, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Body } from '@/app/layout.client';

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
      <Body>
        <RootProvider>{children}</RootProvider>
      </Body>
    </html>
  );
}
