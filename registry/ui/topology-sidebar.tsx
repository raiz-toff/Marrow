'use client';

import { X } from 'lucide-react';
import React, { useId } from 'react';
import { cn } from './topology-types.js';
import { useTopologyShell } from './topology-context.js';
import { TopologyTreeView } from './topology-tree.js';
import { TopologyLegend } from './topology-legend.js';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function MarrowBrandGlyph() {
  const id = useId();
  return (
    <svg width="18" height="18" viewBox="0 0 180 180" className="size-4 shrink-0" aria-hidden="true">
      <circle
        cx="90"
        cy="90"
        r="86"
        fill={`url(#${id}-grad)`}
        stroke="var(--color-fd-primary, currentColor)"
        strokeWidth="6"
      />
      <defs>
        <linearGradient id={`${id}-grad`} gradientTransform="rotate(45)">
          <stop offset="40%" stopColor="var(--color-fd-background, #09090b)" />
          <stop offset="100%" stopColor="var(--color-fd-primary, #f59e0b)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function TopologySidebarHeader({
  title,
  stats,
  className,
}: {
  title?: string;
  stats?: string;
  className?: string;
}) {
  const { data, setSidebarCollapsed } = useTopologyShell();
  const displayTitle = title ?? data.title ?? 'Two Sites';
  const displayStats =
    stats ?? `${data.devices.length} devices · ${data.zones.length} zones`;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-3.5 py-3 border-b border-fd-border bg-fd-card shrink-0',
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <strong className="block text-sm font-semibold truncate text-fd-foreground">
          {displayTitle}
        </strong>
        <small className="block text-[11px] text-fd-muted-foreground truncate mt-0.5">
          {displayStats}
        </small>
      </div>
      <button
        type="button"
        onClick={() => setSidebarCollapsed(true)}
        title="Close sidebar"
        aria-label="Close sidebar"
        className="flex items-center justify-center size-7 rounded-md text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors shrink-0"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function TopologyMenubar({
  className,
  onAction,
}: {
  className?: string;
  onAction?: (action: 'view' | 'export' | 'help') => void;
}) {
  return (
    <nav
      className={cn(
        'flex items-center gap-0.5 mx-3.5 my-2 p-0.5 rounded-lg border border-fd-border bg-fd-muted/40 shrink-0',
        className,
      )}
      role="menubar"
      aria-label="Application menu"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => onAction?.('view')}
        className="flex-1 py-1 px-2 text-xs font-medium text-fd-muted-foreground hover:text-fd-foreground rounded-md transition-colors text-center"
      >
        View
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAction?.('export')}
        className="flex-1 py-1 px-2 text-xs font-medium text-fd-muted-foreground hover:text-fd-foreground rounded-md transition-colors text-center"
      >
        Export
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAction?.('help')}
        className="flex-1 py-1 px-2 text-xs font-medium text-fd-muted-foreground hover:text-fd-foreground rounded-md transition-colors text-center"
      >
        Help
      </button>
    </nav>
  );
}

export function TopologyAbout({
  className,
  layout,
  renderer,
}: {
  className?: string;
  layout?: string;
  renderer?: string;
}) {
  const { data } = useTopologyShell();
  const displayLayout = layout ?? data.layoutArchetype ?? 'zoned-mosaic';
  const displayRenderer = renderer ?? data.rendererTier ?? 'svg-hero';

  return (
    <section className={cn('flex flex-col', className)}>
      <h4 className="flex items-center h-7 px-2 text-xs font-medium text-fd-muted-foreground">
        About
      </h4>
      <div className="flex flex-col gap-1 px-2 text-xs">
        <div className="flex items-center justify-between text-fd-muted-foreground">
          <span>Layout</span>
          <em className="not-italic font-mono text-fd-foreground font-medium">
            {displayLayout}
          </em>
        </div>
        <div className="flex items-center justify-between text-fd-muted-foreground">
          <span>Renderer</span>
          <em className="not-italic font-mono text-fd-foreground font-medium">
            {displayRenderer}
          </em>
        </div>
      </div>
    </section>
  );
}

export function TopologySidebarFooter({
  className,
  brandName = 'Marrow',
  githubUrl = 'https://github.com/raiz-toff/Marrow',
}: {
  className?: string;
  brandName?: string;
  githubUrl?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3.5 py-2.5 border-t border-fd-border bg-fd-card shrink-0 text-xs text-fd-muted-foreground',
        className,
      )}
    >
      <div className="inline-flex items-center gap-2 min-w-0">
        <MarrowBrandGlyph />
        <span className="font-semibold text-fd-foreground">{brandName}</span>
      </div>
      {githubUrl && (
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Source repository"
          aria-label="Source repository"
          className="p-1 rounded-md text-fd-muted-foreground hover:text-fd-foreground transition-colors"
        >
          <GithubIcon className="size-3.5" />
        </a>
      )}
    </div>
  );
}

export function TopologySidebarContent({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 flex flex-col gap-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TopologySidebarProps {
  className?: string;
  children?: React.ReactNode;
}

export function TopologySidebar({ className, children }: TopologySidebarProps) {
  const { sidebarCollapsed } = useTopologyShell();

  return (
    <aside
      data-collapsed={sidebarCollapsed}
      inert={sidebarCollapsed || undefined}
      className={cn(
        '[grid-area:sidebar] flex min-h-0 overflow-clip text-sm transition-[width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] max-md:hidden',
        sidebarCollapsed ? 'w-0 border-r-0' : 'w-[268px] border-r border-fd-border',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col shrink-0 w-[268px] h-full transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          sidebarCollapsed && '-translate-x-3 opacity-0 pointer-events-none',
        )}
      >
        {children ?? (
          <>
            <TopologySidebarHeader />
            <TopologyMenubar />
            <TopologySidebarContent>
              <TopologyTreeView />
              <TopologyLegend />
              <TopologyAbout />
            </TopologySidebarContent>
            <TopologySidebarFooter />
          </>
        )}
      </div>
    </aside>
  );
}
