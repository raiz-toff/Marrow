'use client';

import {
  Building2,
  ChevronRight,
  Cpu,
  Home,
  List,
  Server,
  Shield,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { cn } from './topology-types.js';
import { useTopologyShell } from './topology-context.js';
import { STATUS_DOT } from './topology-legend.js';

/**
 * Spacious gliding hover block — tracks pointer & focus inside the tree.
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

export interface TopologyTreeViewProps {
  title?: string;
  showOverview?: boolean;
  showInventory?: boolean;
  showTierIcons?: boolean;
  showStatusDots?: boolean;
  defaultExpandedAll?: boolean;
  className?: string;
}

export function TopologyTreeView({
  title = 'Browse',
  showOverview = true,
  showInventory = true,
  showTierIcons = true,
  showStatusDots = true,
  defaultExpandedAll = true,
  className,
}: TopologyTreeViewProps) {
  const {
    data,
    activeZoneId,
    setActiveZoneId,
    selectedDeviceId,
    focusDevice,
    fitView,
  } = useTopologyShell();

  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.zones.map((z) => [z.id, defaultExpandedAll])),
  );

  const followRef = useGlidingHover();

  const toggleZoneGroup = (zoneId: string) => {
    setExpandedZones((prev) => ({ ...prev, [zoneId]: !prev[zoneId] }));
  };

  return (
    <section className={cn('flex flex-col', className)}>
      {title && (
        <h4 className="flex items-center h-7 px-2 text-xs font-medium text-fd-muted-foreground">
          {title}
        </h4>
      )}
      <div ref={followRef} className="relative flex flex-col gap-0.5">
        {/* Gliding Hover Highlight Block */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 rounded-lg bg-fd-accent/60 opacity-0 pointer-events-none transition-[translate,width,height,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        />

        {/* Overview Row */}
        {showOverview && (
          <button
            type="button"
            data-nav-item="true"
            data-active={!activeZoneId && !selectedDeviceId}
            onClick={() => {
              setActiveZoneId(null);
              fitView();
            }}
            className={cn(
              'relative flex w-full items-center gap-2 rounded-lg px-2.5 h-[34px] text-start text-xs transition-colors',
              !activeZoneId && !selectedDeviceId
                ? 'bg-fd-accent font-medium text-fd-foreground'
                : 'text-fd-muted-foreground hover:text-fd-foreground',
            )}
          >
            <Home className="size-4 shrink-0 opacity-70" />
            <span className="flex-1 truncate">Overview</span>
            <em className="not-italic text-[11px] font-mono opacity-60">
              {data.devices.length}
            </em>
          </button>
        )}

        {/* Zones (Grouped Nav) */}
        {data.zones.map((zone) => {
          const zoneDevices = data.devices.filter((d) => d.zone === zone.id);
          const isZoneActive = activeZoneId === zone.id;
          const isExpanded = expandedZones[zone.id] ?? true;

          return (
            <div key={zone.id} className="flex flex-col">
              <div className="flex items-center">
                <button
                  type="button"
                  data-nav-item="true"
                  data-active={isZoneActive}
                  onClick={() => {
                    setActiveZoneId(zone.id);
                  }}
                  className={cn(
                    'relative flex-1 flex items-center gap-2 rounded-lg px-2.5 h-[34px] text-start text-xs transition-colors',
                    isZoneActive
                      ? 'bg-fd-accent font-medium text-fd-foreground'
                      : 'text-fd-muted-foreground hover:text-fd-foreground',
                  )}
                >
                  <Building2
                    className="size-4 shrink-0"
                    style={zone.accent ? { color: zone.accent } : undefined}
                  />
                  <span className="flex-1 truncate">{zone.label}</span>
                  <em className="not-italic text-[11px] font-mono opacity-60">
                    {zoneDevices.length}
                  </em>
                </button>
                <button
                  type="button"
                  onClick={() => toggleZoneGroup(zone.id)}
                  aria-label={`Toggle ${zone.label} devices`}
                  className="flex items-center justify-center size-7 text-fd-muted-foreground hover:text-fd-foreground"
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 transition-transform duration-200',
                      isExpanded && 'rotate-90',
                    )}
                  />
                </button>
              </div>

              {/* Zone Devices List */}
              {isExpanded && (
                <div className="relative flex flex-col ms-4 ps-2 my-0.5 border-l border-fd-border/60">
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
                          'relative flex w-full items-center gap-2 rounded-md px-2 h-7 text-start text-xs transition-colors',
                          isActive
                            ? 'bg-fd-primary/10 text-fd-primary font-medium'
                            : 'text-fd-muted-foreground hover:text-fd-foreground',
                        )}
                      >
                        {isActive && (
                          <span className="absolute -start-[9px] inset-y-1 w-0.5 rounded-full bg-fd-primary" />
                        )}
                        {showTierIcons && (
                          <TierIcon className="size-3.5 shrink-0 opacity-70" />
                        )}
                        <span className="flex-1 truncate font-mono text-[11px]">
                          {dev.label}
                        </span>
                        {showStatusDots && (
                          <span
                            className={cn(
                              'size-2 rounded-full shrink-0',
                              STATUS_DOT[dev.status],
                            )}
                            title={`Status: ${dev.status}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Inventory Row */}
        {showInventory && (
          <button
            type="button"
            data-nav-item="true"
            onClick={() => fitView()}
            className="relative flex w-full items-center gap-2 rounded-lg px-2.5 h-[34px] text-start text-xs text-fd-muted-foreground hover:text-fd-foreground transition-colors"
          >
            <List className="size-4 shrink-0 opacity-70" />
            <span className="flex-1 truncate">Inventory</span>
            <em className="not-italic text-[11px] font-mono opacity-60">
              {data.devices.length}
            </em>
          </button>
        )}
      </div>
    </section>
  );
}
