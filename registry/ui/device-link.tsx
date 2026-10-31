'use client';

import React from 'react';
import {
  Server,
  Network,
  Router,
  Shield,
  Laptop,
  Cloud,
  HardDrive,
  type LucideIcon,
} from 'lucide-react';
import { cn, type DeviceStatus } from './topology-types.js';
import { CableBadge, type CableBadgeProps } from './cable-badge.js';

export type DeviceRole =
  | 'host'
  | 'server'
  | 'switch'
  | 'router'
  | 'firewall'
  | 'cloud'
  | 'storage'
  | 'endpoint'
  | string;

export interface InlineDevice {
  name: string;
  role?: DeviceRole;
  /** Custom SVG markup, an image URL (e.g. /icons/cisco/router.svg), or React icon element */
  icon?: React.ReactNode | string;
  port?: string;
  ip?: string;
  status?: DeviceStatus;
}

export type InlineCable = CableBadgeProps;

export interface DeviceLinkProps {
  from: InlineDevice;
  to: InlineDevice;
  cable?: CableBadgeProps;
  variant?: 'card' | 'inline';
  className?: string;
}

const ROLE_ICONS: Record<string, LucideIcon> = {
  host: Laptop,
  endpoint: Laptop,
  server: Server,
  switch: Network,
  router: Router,
  firewall: Shield,
  cloud: Cloud,
  storage: HardDrive,
};

const STATUS_LED: Record<DeviceStatus, string> = {
  up: 'bg-emerald-500 shadow-emerald-500/50',
  degraded: 'bg-amber-500 shadow-amber-500/50',
  down: 'bg-rose-500 shadow-rose-500/50',
  planned: 'bg-sky-500 shadow-sky-500/50',
  unknown: 'bg-slate-400 shadow-slate-400/50',
};

function renderDeviceIcon(
  icon: React.ReactNode | string | undefined,
  role: string | undefined,
  className?: string,
): React.ReactNode {
  if (React.isValidElement(icon)) {
    return icon;
  }
  if (typeof icon === 'string') {
    const trimmed = icon.trim();
    if (trimmed.startsWith('<svg')) {
      return (
        <span
          className={cn(
            'inline-flex items-center justify-center shrink-0 [&>svg]:size-full [&>svg]:max-h-full [&>svg]:max-w-full',
            className,
          )}
          dangerouslySetInnerHTML={{ __html: trimmed }}
        />
      );
    }
    if (
      trimmed.startsWith('/') ||
      trimmed.startsWith('http') ||
      trimmed.startsWith('data:') ||
      trimmed.endsWith('.svg') ||
      trimmed.endsWith('.png') ||
      trimmed.endsWith('.webp')
    ) {
      return (
        <img
          src={trimmed}
          alt=""
          aria-hidden="true"
          className={cn('object-contain shrink-0 max-h-full max-w-full', className)}
        />
      );
    }
  }

  const RoleIcon = (role && ROLE_ICONS[role]) || Server;
  return <RoleIcon className={cn('shrink-0 text-fd-foreground/80', className)} />;
}

export function DeviceLink({
  from,
  to,
  cable = {},
  variant = 'card',
  className,
}: DeviceLinkProps) {
  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-fd-border bg-fd-card text-xs font-sans text-fd-foreground shadow-xs align-middle select-none',
          className,
        )}
      >
        {/* Host A */}
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span
            className={cn(
              'size-2 rounded-full shrink-0 shadow-xs',
              STATUS_LED[from.status ?? 'up'],
            )}
          />
          {renderDeviceIcon(from.icon, from.role, 'size-3.5')}
          <span>{from.name}</span>
          {from.port && (
            <span className="font-mono text-[10px] text-fd-muted-foreground bg-fd-muted px-1 rounded">
              {from.port}
            </span>
          )}
        </span>

        {/* Cable connection composed directly via CableBadge */}
        <CableBadge {...cable} variant="pill" />

        {/* Host B */}
        <span className="inline-flex items-center gap-1.5 font-medium">
          {to.port && (
            <span className="font-mono text-[10px] text-fd-muted-foreground bg-fd-muted px-1 rounded">
              {to.port}
            </span>
          )}
          {renderDeviceIcon(to.icon, to.role, 'size-3.5')}
          <span>{to.name}</span>
          <span
            className={cn(
              'size-2 rounded-full shrink-0 shadow-xs',
              STATUS_LED[to.status ?? 'up'],
            )}
          />
        </span>
      </span>
    );
  }

  // Variant: card (stand-alone micro topology block)
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-fd-border bg-fd-card/80 backdrop-blur-xs text-fd-foreground shadow-xs font-sans select-none overflow-hidden max-w-full',
        className,
      )}
    >
      {/* Background subtle wire glow */}
      <div className="absolute inset-x-12 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-emerald-500/10 via-sky-500/20 to-emerald-500/10 blur-xs pointer-events-none" />

      {/* Device A */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex items-center justify-center size-10 rounded-xl border border-fd-border bg-fd-muted/50 text-fd-foreground shadow-xs p-1.5">
          {renderDeviceIcon(from.icon, from.role, 'size-6')}
          <span
            className={cn(
              'absolute -top-1 -right-1 size-2.5 rounded-full ring-2 ring-fd-background shadow-xs',
              STATUS_LED[from.status ?? 'up'],
            )}
            title={`Status: ${from.status ?? 'up'}`}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">{from.name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {from.ip && (
              <span className="font-mono text-[10.5px] text-fd-muted-foreground bg-fd-muted/70 px-1.5 py-0.5 rounded-md">
                {from.ip}
              </span>
            )}
            {from.role && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-fd-muted-foreground/80">
                {from.role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interconnect Cable with Ports and composed CableBadge */}
      <div className="flex flex-col items-center justify-center flex-1 min-w-[120px] px-2">
        <div className="flex items-center justify-between w-full text-[10.5px] font-mono text-fd-muted-foreground font-medium mb-1 px-1">
          <span>{from.port || 'port'}</span>
          <span>{to.port || 'port'}</span>
        </div>

        {/* Unified CableBadge wire */}
        <CableBadge {...cable} variant="wire" />

        <div className="text-[10px] text-fd-muted-foreground/70 uppercase tracking-wider font-semibold mt-1">
          {cable.mode || 'routed'}
        </div>
      </div>

      {/* Device B */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex flex-col text-right">
          <span className="text-sm font-semibold tracking-tight">{to.name}</span>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            {to.role && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-fd-muted-foreground/80">
                {to.role}
              </span>
            )}
            {to.ip && (
              <span className="font-mono text-[10.5px] text-fd-muted-foreground bg-fd-muted/70 px-1.5 py-0.5 rounded-md">
                {to.ip}
              </span>
            )}
          </div>
        </div>
        <div className="relative flex items-center justify-center size-10 rounded-xl border border-fd-border bg-fd-muted/50 text-fd-foreground shadow-xs p-1.5">
          {renderDeviceIcon(to.icon, to.role, 'size-6')}
          <span
            className={cn(
              'absolute -top-1 -right-1 size-2.5 rounded-full ring-2 ring-fd-background shadow-xs',
              STATUS_LED[to.status ?? 'up'],
            )}
            title={`Status: ${to.status ?? 'up'}`}
          />
        </div>
      </div>
    </div>
  );
}
