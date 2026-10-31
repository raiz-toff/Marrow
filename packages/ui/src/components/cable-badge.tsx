'use client';

import React from 'react';
import { cn, type DeviceStatus, type LinkMode } from '../lib/utils.js';

export interface CableBadgeProps {
  mode?: LinkMode;
  speed?: string;
  status?: DeviceStatus;
  animated?: boolean;
  label?: string;
  /** 'badge' (standalone pill), 'wire' (stretched cable line with center chip), or 'pill' (compact) */
  variant?: 'badge' | 'wire' | 'pill';
  className?: string;
}

export const MODE_LABEL: Record<LinkMode, string> = {
  trunk: 'Trunk (802.1Q)',
  access: 'Access Port',
  routed: 'Routed L3',
  tunnel: 'Overlay Tunnel',
  peering: 'eBGP Peering',
  stack: 'StackWise Backplane',
};

export const CABLE_STATUS_COLOR: Record<DeviceStatus, string> = {
  up: 'bg-emerald-500 border-emerald-500 text-emerald-500',
  degraded: 'bg-amber-500 border-amber-500 text-amber-500',
  down: 'bg-rose-500 border-rose-500 text-rose-500',
  planned: 'bg-sky-500 border-sky-500 text-sky-500',
  unknown: 'bg-slate-400 border-slate-400 text-slate-400',
};

export function CableBadge({
  mode = 'trunk',
  speed = '10G',
  status = 'up',
  animated = false,
  label,
  variant = 'badge',
  className,
}: CableBadgeProps) {
  // Wire mode: stretches horizontally between devices with extending lines and a center speed pill
  if (variant === 'wire') {
    return (
      <div className={cn('relative flex items-center justify-center w-full my-0.5', className)}>
        {/* Full-width cable wire */}
        <div
          className={cn(
            'w-full transition-all',
            mode === 'trunk' && 'border-y border-emerald-500 h-2 bg-emerald-500/10',
            mode === 'tunnel' && 'border-b-2 border-dashed border-sky-500 h-0',
            mode === 'peering' && 'border-b-2 border-dotted border-purple-500 h-0',
            mode === 'stack' && 'h-1.5 rounded-full bg-indigo-500',
            mode !== 'trunk' &&
              mode !== 'tunnel' &&
              mode !== 'peering' &&
              mode !== 'stack' &&
              cn('h-1 rounded-full', CABLE_STATUS_COLOR[status]?.split(' ')[0]),
          )}
        />

        {/* Center badge chip */}
        <div className="absolute flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-fd-border bg-fd-background shadow-xs text-[10.5px] font-mono font-bold tracking-tight">
          {animated && (
            <span
              className={cn(
                'size-1.5 rounded-full animate-ping',
                status === 'up' ? 'bg-emerald-400' : 'bg-amber-400',
              )}
            />
          )}
          <span className="text-fd-foreground">{label || speed}</span>
          {mode === 'trunk' && (
            <span className="text-[9px] font-sans font-medium text-fd-muted-foreground uppercase">
              Trunk
            </span>
          )}
          {mode === 'tunnel' && (
            <span className="text-[9px] font-sans font-medium text-sky-500 uppercase">
              Tunnel
            </span>
          )}
        </div>
      </div>
    );
  }

  // Pill mode: ultra-compact cable connection for inline text
  if (variant === 'pill') {
    return (
      <span className={cn('relative inline-flex items-center justify-center px-1 shrink-0', className)}>
        <span
          className={cn(
            'w-8 transition-all',
            mode === 'trunk' && 'border-y border-emerald-500 h-1.5 bg-transparent',
            mode === 'tunnel' && 'border-b-2 border-dashed border-sky-500 h-0',
            mode === 'peering' && 'border-b-2 border-dotted border-purple-500 h-0',
            mode !== 'trunk' &&
              mode !== 'tunnel' &&
              mode !== 'peering' &&
              cn('h-0.5 rounded-full', CABLE_STATUS_COLOR[status]?.split(' ')[0]),
          )}
        />
        {speed && (
          <span className="absolute -top-3.5 text-[9px] font-mono font-bold tracking-tight text-fd-muted-foreground">
            {speed}
          </span>
        )}
        {animated && (
          <span className="absolute size-1.5 rounded-full bg-emerald-400 animate-ping" />
        )}
      </span>
    );
  }

  // Default: standalone badge
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-fd-border bg-fd-card text-xs shadow-xs font-sans select-none',
        className,
      )}
    >
      {/* Cable line preview */}
      <div className="relative flex items-center w-6 h-2 shrink-0">
        <span
          className={cn(
            'w-full h-0.5 rounded-full',
            mode === 'trunk' && 'border-y border-emerald-500 h-1.5 bg-transparent',
            mode === 'tunnel' && 'border-b border-dashed border-sky-500 h-0',
            mode === 'peering' && 'border-b border-dotted border-purple-500 h-0',
            mode !== 'trunk' &&
              mode !== 'tunnel' &&
              mode !== 'peering' &&
              cn('h-0.5 rounded-full', CABLE_STATUS_COLOR[status]?.split(' ')[0]),
          )}
        />
        {animated && (
          <span className="absolute inset-0 animate-ping opacity-75 rounded-full bg-emerald-400" />
        )}
      </div>

      <span className="font-medium text-fd-foreground">
        {label || MODE_LABEL[mode] || mode}
      </span>

      {speed && (
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-fd-primary/10 text-fd-primary font-semibold">
          {speed}
        </span>
      )}
    </div>
  );
}
