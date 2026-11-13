'use client';

import { useParams } from 'next/navigation';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { getSection } from '@/lib/shared';

// Suppress the React 19 false-positive warning for inline theme script tags in RootProvider
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

export function Body({ children }: { children: ReactNode }) {
  const mode = useMode();

  return <div className={cn(mode, 'flex flex-1 flex-col')}>{children}</div>;
}

function useMode(): string | undefined {
  const { slug = [] } = useParams();
  if (Array.isArray(slug)) return getSection(slug[0]);
}
