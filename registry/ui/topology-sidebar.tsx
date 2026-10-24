'use client';

import {
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Cpu,
  Layers,
  Network,
  Search,
  Server,
  Shield,
  Sidebar as SidebarIcon,
} from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { cn, type DeviceStatus } from '../lib/utils.js';
import { useTopologyShell } from './topology-context.js';

const STATUS_DOT: Record<DeviceStatus, string> = {
  up: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-rose-500',
  planned: 'bg-sky-500',
  unknown: 'bg-zinc-400',
};

function MarrowBrandGlyph() {
  const id = useId();
  return (
    <svg width="20" height="20" viewBox="0 0 180 180" className="size-5 shrink-0" aria-hidden="true">
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

/**
 * Spacious gliding hover block — tracks pointer & focus inside the sidebar tree.
 */
function useGlidingHover() {
  return useCallback((area: HTMLDivElement | null) => {
    const block = area?.firstElementChild;
    if (!area || !(block instanceof HTMLElement)) return;
    let current: Element | null = null;

    const show = (item: Element | null) => {
      if (item === current) return;
      block.style.transitionProperty = current ? '' : 'opacity';
      current = item;
      if (!item) {
        block.style.opacity = '0';
        return;
      }
      const rect = item.getBoundingClientRect();
      const origin = area.getBoundingClientRect();
      block.style.translate = `${rect.left - origin.left}px ${rect.top - origin.top}px`;
      block.style.width = `${rect.width}px`;
      block.style.height = `${rect.height}px`;
      block.style.opacity = item.matches('[data-active="true"]') ? '0' : '1';
    };

    const itemOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest('button[data-nav-item]') : null;

    const onPointerOver = (e: PointerEvent) => {
      const item = itemOf(e.target);
      if (item && e.pointerType === 'mouse') show(item);
    };
    const onPointerLeave = () => show(null);

    area.addEventListener('pointerover', onPointerOver);
    area.addEventListener('pointerleave', onPointerLeave);
    return () => {
      area.removeEventListener('pointerover', onPointerOver);
      area.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);
}

export function TopologySidebar({ className }: { className?: string }) {
  const {
    data,
    sidebarCollapsed,
    setSidebarCollapsed,
    activeZoneId,
    setActiveZoneId,
    selectedDeviceId,
    focusDevice,
    fitView,
    setSearchOpen,
    viewSettings,
    updateViewSetting,
  } = useTopologyShell();

  const [zoneDropdownOpen, setZoneDropdownOpen] = useState(false);
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.zones.map((z) => [z.id, true])),
  );

  const followRef = useGlidingHover();
  const activeZone = data.zones.find((z) => z.id === activeZoneId) ?? null;

  const toggleZoneGroup = (zoneId: string) => {
    setExpandedZones((prev) => ({ ...prev, [zoneId]: !prev[zoneId] }));
  };

  return (
    <aside
      data-collapsed={sidebarCollapsed}
      inert={sidebarCollapsed || undefined}
      className={cn(
        '[grid-area:sidebar] flex min-h-0 overflow-clip text-sm transition-[width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] max-md:hidden',
        sidebarCollapsed ? 'w-2' : 'w-[268px]',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col shrink-0 w-[268px] h-full transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          sidebarCollapsed && '-translate-x-3 opacity-0 pointer-events-none',
        )}
      >
        {/* Spacious Header: Brand Mark + Collapse Trigger */}
        <div className="flex items-center gap-2 h-14 my-1 ps-5 pe-3 shrink-0">
          <div className="inline-flex items-center gap-2.5 min-w-0 me-auto">
            <MarrowBrandGlyph />
            <div className="flex flex-col min-w-0">
              <span className="text-[0.9375rem] font-semibold leading-tight truncate text-fd-foreground">
                Marrow Studio
              </span>
              <span className="text-[11px] text-fd-muted-foreground truncate">
                {data.devices.length} devices · {data.links.length} links
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            title="Collapse sidebar (Ctrl+B)"
            aria-label="Collapse sidebar"
            className="inline-flex items-center justify-center size-8 rounded-lg text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground transition-colors"
          >
            <SidebarIcon className="size-4" />
          </button>
        </div>

        {/* Spacious Switcher Dropdown + Search Trigger */}
        <div className="flex flex-col gap-2 px-3 shrink-0">
          {/* Domain / Zone Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setZoneDropdownOpen((prev) => !prev)}
              className="flex w-full h-10 items-center gap-2.5 rounded-xl border bg-fd-secondary/50 ps-2.5 pe-2.5 text-start font-medium outline-none transition-colors hover:bg-fd-accent text-fd-foreground"
            >
              <span
                className="flex items-center justify-center size-5 rounded-md shrink-0 text-fd-primary"
                style={activeZone?.accent ? { color: activeZone.accent } : undefined}
              >
                {activeZone ? <Building2 className="size-4" /> : <Network className="size-4" />}
              </span>
              <span className="flex-1 truncate text-xs font-medium">
                {activeZone ? activeZone.label : 'All Topology Zones'}
              </span>
              <ChevronsUpDown className="size-3.5 text-fd-muted-foreground shrink-0" />
            </button>

            {zoneDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 flex flex-col p-1 rounded-2xl border bg-fd-popover text-fd-popover-foreground shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    fitView();
                    setZoneDropdownOpen(false);
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs hover:bg-fd-accent transition-colors"
                >
                  <Network className="size-4 mt-0.5 text-fd-primary shrink-0" />
                  <span className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium truncate">All Topology Zones</span>
                    <span className="text-[11px] text-fd-muted-foreground truncate">
                      Full {data.layoutArchetype ?? 'zoned-tiered'} overview ({data.devices.length} nodes)
                    </span>
                  </span>
                  {!activeZoneId && <Check className="size-3.5 mt-0.5 text-fd-primary shrink-0" />}
                </button>

                {data.zones.map((zone) => {
                  const count = data.devices.filter((d) => d.zone === zone.id).length;
                  const isSelected = activeZoneId === zone.id;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => {
                        setActiveZoneId(zone.id);
                        setZoneDropdownOpen(false);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs hover:bg-fd-accent transition-colors"
                    >
                      <Building2
                        className="size-4 mt-0.5 shrink-0"
                        style={{ color: zone.accent ?? 'var(--color-fd-primary)' }}
                      />
                      <span className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium truncate">{zone.label}</span>
                        <span className="text-[11px] text-fd-muted-foreground truncate">
                          {zone.subtitle ?? `${count} devices`}
                        </span>
                      </span>
                      {isSelected && <Check className="size-3.5 mt-0.5 text-fd-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Spacious Search Pill */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex w-full h-10 items-center gap-2.5 rounded-xl border bg-fd-secondary/50 ps-2.5 pe-2 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground transition-colors"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 text-start text-xs truncate">Search devices, IPs…</span>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-mono">
              <kbd className="px-1.5 py-0.5 rounded-md border bg-fd-background text-fd-muted-foreground shadow-2xs">
                Ctrl
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded-md border bg-fd-background text-fd-muted-foreground shadow-2xs">
                K
              </kbd>
            </span>
          </button>
        </div>

        {/* Scrollable Navigation Viewport with Gliding Hover */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-6 mt-1">
          <div ref={followRef} className="relative flex flex-col">
            {/* Gliding Hover Highlight Block */}
            <div
              aria-hidden="true"
              className="absolute top-0 left-0 rounded-lg bg-fd-accent/60 opacity-0 pointer-events-none transition-[translate,width,height,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            />

            {/* Topology Zones & Devices Tree */}
            <p className="mb-1.5 px-2.5 text-xs font-medium text-fd-muted-foreground">
              Topology Explorer
            </p>

            <button
              type="button"
              data-nav-item="true"
              data-active={!activeZoneId && !selectedDeviceId}
              onClick={() => fitView()}
              className={cn(
                'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start text-xs transition-colors',
                !activeZoneId && !selectedDeviceId
                  ? 'bg-fd-primary/10 text-fd-primary font-medium'
                  : 'text-fd-muted-foreground hover:text-fd-foreground',
              )}
            >
              <Layers className="size-3.5 shrink-0" />
              <span className="flex-1 truncate">Full Fabric Overview</span>
              <span className="text-[11px] font-mono opacity-70">{data.devices.length}</span>
            </button>

            {data.zones.map((zone) => {
              const zoneDevices = data.devices.filter((d) => d.zone === zone.id);
              const isExpanded = expandedZones[zone.id] ?? true;

              return (
                <div key={zone.id} className="mt-1 flex flex-col">
                  <button
                    type="button"
                    data-nav-item="true"
                    onClick={() => toggleZoneGroup(zone.id)}
                    className="relative flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-fd-foreground/90 hover:text-fd-foreground transition-colors"
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: zone.accent ?? 'var(--color-fd-primary)' }}
                    />
                    <span className="flex-1 truncate">{zone.label}</span>
                    <span className="text-[11px] text-fd-muted-foreground font-mono">
                      {zoneDevices.length}
                    </span>
                    <ChevronRight
                      className={cn(
                        'size-3.5 text-fd-muted-foreground transition-transform duration-200',
                        isExpanded && 'rotate-90',
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="relative flex flex-col ms-3.5 ps-2 mt-0.5">
                      <span className="absolute start-0 inset-y-1 w-px bg-fd-border" />
                      {zoneDevices.map((dev) => {
                        const isActive = selectedDeviceId === dev.id;
                        const TierIcon =
                          dev.tier === 'edge'
                            ? Shield
                            : dev.tier === 'core'
                              ? Cpu
                              : Server;
                        return (
                          <button
                            key={dev.id}
                            type="button"
                            data-nav-item="true"
                            data-active={isActive}
                            onClick={() => focusDevice(dev.id)}
                            className={cn(
                              'relative flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs transition-colors',
                              isActive
                                ? 'bg-fd-primary/10 text-fd-primary font-medium'
                                : 'text-fd-muted-foreground hover:text-fd-foreground',
                            )}
                          >
                            {isActive && (
                              <span className="absolute -start-2 inset-y-1.5 w-0.5 rounded-full bg-fd-primary" />
                            )}
                            <TierIcon className="size-3.5 shrink-0 opacity-80" />
                            <span className="flex-1 truncate font-mono text-[11.5px]">
                              {dev.label}
                            </span>
                            <span
                              className={cn('size-2 rounded-full shrink-0', STATUS_DOT[dev.status])}
                              title={`Status: ${dev.status}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* View Controls Section */}
            <p className="mt-5 mb-1.5 px-2.5 text-xs font-medium text-fd-muted-foreground">
              Canvas Layers
            </p>
            <div className="flex flex-col gap-1 px-2">
              {(
                [
                  ['labels', 'Hostname & IP Labels'],
                  ['ports', 'Interface Port Chips'],
                  ['motion', 'Active Traffic Flow'],
                  ['minimap', 'Viewport Minimap'],
                ] as const
              ).map(([key, label]) => {
                const checked = viewSettings[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1 px-1 text-xs text-fd-muted-foreground"
                  >
                    <span>{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      onClick={() => updateViewSetting(key, !checked)}
                      className={cn(
                        'relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                        checked ? 'bg-fd-primary' : 'bg-fd-border',
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block size-3.5 rounded-full bg-fd-background shadow-xs transition-transform',
                          checked ? 'translate-x-3.5' : 'translate-x-0',
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Status & Link Mode Legend */}
            <p className="mt-5 mb-1.5 px-2.5 text-xs font-medium text-fd-muted-foreground">
              Telemetry Legend
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-2.5 py-1.5 text-[11px] text-fd-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>Operational (up)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" />
                <span>Degraded</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-rose-500" />
                <span>Down / Fault</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-sky-500" />
                <span>Planned Window</span>
              </div>
              <div className="col-span-2 flex items-center gap-2 pt-1 border-t border-fd-border/50">
                <span className="w-5 h-1 rounded-full bg-fd-foreground/60 relative">
                  <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-fd-card" />
                </span>
                <span>L2 Trunk (Double Rail)</span>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <span className="w-5 border-t-2 border-dashed border-fd-foreground/60" />
                <span>Overlay / IPSec Tunnel</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Brand Footer */}
        <div className="px-4 py-3 border-t border-fd-border/60 flex items-center justify-between text-[11px] text-fd-muted-foreground shrink-0">
          <span className="font-mono uppercase tracking-wider font-medium">
            {data.layoutArchetype ?? 'zoned-tiered'} · {data.rendererTier ?? 'svg-hero'}
          </span>
          <span className="font-mono opacity-75">v{data.version ?? '2.0'}</span>
        </div>
      </div>
    </aside>
  );
}
