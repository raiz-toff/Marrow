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

export function useMode(): string | undefined {
  const { slug = [] } = useParams();
  if (Array.isArray(slug)) return getSection(slug[0]);
}

export function MarrowIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      {/* First "r" stem and curve: adapts to current foreground text color in dark/light mode */}
      <g stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 26V13a5 5 0 0 1 5-5" />
        <path d="M17 26V13" />
      </g>
      {/* Second "r" curve with Marrow's signature arrow terminal: branded primary accent */}
      <g stroke="var(--color-fd-primary, currentColor)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 13a5 5 0 0 1 5-5h3" />
        <path d="M22.8 5.8L25 8l-2.2 2.2" />
      </g>
    </svg>
  );
}
