'use client';

import { cn, type DeviceStatus } from './topology-types.js';

export const STATUS_DOT: Record<DeviceStatus, string> = {
  up: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-rose-500',
  planned: 'bg-sky-500',
  unknown: 'bg-zinc-400',
};

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  up: 'up',
  degraded: 'degraded',
  down: 'down',
  planned: 'planned',
  unknown: 'unknown',
};

export interface TopologyStatusLegendProps {
  className?: string;
  variant?: 'grid' | 'inline' | 'compact';
  statuses?: DeviceStatus[];
}

export function TopologyStatusLegend({
  className,
  variant = 'grid',
  statuses = ['up', 'degraded', 'down', 'planned'],
}: TopologyStatusLegendProps) {
  return (
    <ul
      className={cn(
        'list-none m-0 p-0 text-xs text-fd-muted-foreground',
        variant === 'grid' && 'grid grid-cols-2 gap-x-2 gap-y-1.5',
        variant === 'inline' && 'flex flex-wrap items-center gap-3',
        variant === 'compact' && 'flex flex-col gap-1',
        className,
      )}
    >
      {statuses.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <i
            className={cn('size-2 rounded-full inline-block shrink-0', STATUS_DOT[status])}
            aria-hidden="true"
          />
          <span className="capitalize">{STATUS_LABELS[status] ?? status}</span>
        </li>
      ))}
    </ul>
  );
}

export interface TopologyLinkLegendProps {
  className?: string;
}

export function TopologyLinkLegend({ className }: TopologyLinkLegendProps) {
  return (
    <ul className={cn('list-none m-0 p-0 text-xs text-fd-muted-foreground flex flex-col gap-1.5', className)}>
      <li className="flex items-center gap-2">
        <span className="w-4 border-t-2 border-fd-foreground/60 inline-block shrink-0" aria-hidden="true" />
        <span>link</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="w-4 border-t-2 border-dashed border-fd-foreground/60 inline-block shrink-0" aria-hidden="true" />
        <span>degraded / planned</span>
      </li>
    </ul>
  );
}

export interface TopologyLegendProps {
  title?: string;
  showStatuses?: boolean;
  showLinks?: boolean;
  variant?: 'grid' | 'inline' | 'compact';
  className?: string;
}

export function TopologyLegend({
  title = 'Legend',
  showStatuses = true,
  showLinks = true,
  variant = 'grid',
  className,
}: TopologyLegendProps) {
  return (
    <section className={cn('flex flex-col', className)}>
      {title && (
        <h4 className="flex items-center h-7 px-2 text-xs font-medium text-fd-muted-foreground">
          {title}
        </h4>
      )}
      <div className="flex flex-col gap-2 px-2">
        {showStatuses && <TopologyStatusLegend variant={variant} />}
        {showStatuses && showLinks && (
          <div className="border-t border-fd-border/40" />
        )}
        {showLinks && <TopologyLinkLegend />}
      </div>
    </section>
  );
}
