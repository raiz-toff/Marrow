'use client';

import React from 'react';
import { Activity, Radio, Shield, Network } from 'lucide-react';
import { cn, type DeviceStatus, type LinkMode } from '../lib/utils.js';

export interface CableBadgeProps {
  mode?: LinkMode;
  speed?: string;
  status?: DeviceStatus;
  animated?: boolean;
  label?: string;
  className?: string;
}

const MODE_LABEL: Record<LinkMode, string> = {
  trunk: 'Trunk (802.1Q)',
  access: 'Access Port',
  routed: 'Routed L3',
  tunnel: 'Overlay Tunnel',
  peering: 'eBGP Peering',
  stack: 'StackWise Backplane',
};

export function CableBadge({
  mode = 'trunk',
  speed = '10G',
  status = 'up',
  animated = false,
  label,
  className,
}: CableBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-fd-border bg-fd-card text-xs shadow-xs',
        className,
      )}
    >
      {/* Cable line preview */}
      <div className="relative flex items-center w-6 h-2 shrink-0">
        <span
          className={cn(
            'w-full h-0.5 rounded-full',
            status === 'up' && 'bg-emerald-500',
            status === 'degraded' && 'bg-amber-500',
            status === 'down' && 'bg-rose-500',
            status === 'planned' && 'bg-sky-500 border-dashed',
            mode === 'trunk' && 'border-y border-emerald-500 h-1 bg-transparent',
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
        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-fd-primary/10 text-fd-primary font-semibold">
          {speed}
        </span>
      )}
    </div>
  );
}
