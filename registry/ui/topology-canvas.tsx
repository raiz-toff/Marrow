'use client';

import {
  ChevronRight,
  Download,
  PanelRight,
  Search,
  Sidebar as SidebarIcon,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { cn, type DeviceStatus, type TopologyDevice, type TopologyLink } from '../lib/utils.js';
import { useTopologyShell } from './topology-context.js';
import { TopologyControls, TopologyMinimap } from './topology-controls.js';

const STATUS_LED_COLOR: Record<DeviceStatus, string> = {
  up: '#10b981',
  degraded: '#f59e0b',
  down: '#f43f5e',
  planned: '#0ea5e9',
  unknown: '#71717a',
};

function speedStrokeWidth(speed: TopologyLink['speed'], mode: TopologyLink['mode']): number {
  if (mode === 'stack') return 5;
  if (mode === 'trunk') return 4.5;
  switch (speed) {
    case '100G':
    case '400G':
      return 3.5;
    case '40G':
    case '25G':
      return 2.75;
    case '10G':
      return 2.2;
    default:
      return 1.6;
  }
}

function DeviceVendorGlyph({ tier }: { tier: TopologyDevice['tier'] }) {
  if (tier === 'edge') {
    // Router cross-arrows glyph
    return (
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="0" cy="0" r="12" strokeOpacity="0.35" />
        <path d="M-7 0h14M3 -4l4 4-4 4M-3 -4l-4 4 4 4M0 -7v14" />
      </g>
    );
  }
  if (tier === 'core') {
    // Core switch multi-layer glyph
    return (
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="-11" y="-11" width="22" height="22" rx="5" strokeOpacity="0.35" />
        <path d="M-6 -4h12M3 -7l3 3-3 3M6 4H-6M-3 1l-3 3 3 3" />
      </g>
    );
  }
  if (tier === 'distribution') {
    return (
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M-8 -3h16M4 -6l4 3-4 3M8 3H-8M-4 0l-4 3 4 3" />
      </g>
    );
  }
  return (
    <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="-9" y="-6" width="18" height="12" rx="2.5" />
      <circle cx="-4" cy="0" r="1" fill="currentColor" />
      <circle cx="0" cy="0" r="1" fill="currentColor" />
      <circle cx="4" cy="0" r="1" fill="currentColor" />
    </g>
  );
}

export function TopologyCanvas({ className }: { className?: string }) {
  const {
    data,
    sidebarCollapsed,
    setSidebarCollapsed,
    selectedDeviceId,
    selectDevice,
    selectedLinkId,
    selectLink,
    hoveredDeviceId,
    setHoveredDeviceId,
    activeZoneId,
    setActiveZoneId,
    inspectorOpen,
    setInspectorOpen,
    setSearchOpen,
    camera,
    setCamera,
    viewSettings,
    neighborsByDevice,
  } = useTopologyShell();

  const patternId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; camX: number; camY: number }>({
    x: 0,
    y: 0,
    camX: 0,
    camY: 0,
  });

  const deviceById = new Map(data.devices.map((d) => [d.id, d]));
  const activeZone = data.zones.find((z) => z.id === activeZoneId) ?? null;
  const focusTargetId = hoveredDeviceId ?? selectedDeviceId;
  const focusNeighbors = focusTargetId ? neighborsByDevice.get(focusTargetId) : null;

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const rawSvg = serializer.serializeToString(svgRef.current);
    const blob = new Blob([rawSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="marrow-spacious-main"
      className={cn(
        '@container relative flex flex-col min-w-0 min-h-0 [grid-area:main] mx-2 my-2 bg-fd-background md:ms-0 overflow-clip rounded-2xl border shadow-sm',
        className,
      )}
    >
      {/* Spacious Floating Top Header inside Main Card */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 h-14 ps-5 pe-4 bg-linear-to-b from-fd-background via-fd-background/85 to-transparent pointer-events-none *:pointer-events-auto">
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar (Ctrl+B)"
            aria-label="Expand sidebar"
            className="-ms-1.5 inline-flex items-center justify-center size-8 rounded-lg text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors"
          >
            <SidebarIcon className="size-4" />
          </button>
        )}

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium min-w-0">
          <button
            type="button"
            onClick={() => {
              setActiveZoneId(null);
              selectDevice(null);
            }}
            className="text-fd-muted-foreground hover:text-fd-foreground transition-colors truncate"
          >
            {data.title}
          </button>
          {activeZone && (
            <>
              <ChevronRight className="size-3.5 text-fd-muted-foreground/50 shrink-0" />
              <span className="text-fd-foreground font-semibold truncate">{activeZone.label}</span>
            </>
          )}
          {selectedDeviceId && (
            <>
              <ChevronRight className="size-3.5 text-fd-muted-foreground/50 shrink-0" />
              <span className="font-mono text-fd-primary font-semibold truncate">
                {selectedDeviceId}
              </span>
            </>
          )}
        </nav>

        {/* Right Floating Action Bar */}
        <div className="ms-auto flex items-center gap-1 rounded-xl border bg-fd-background/90 backdrop-blur-md p-1 shadow-xs">
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono text-fd-muted-foreground">
            {Math.round(camera.k * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            title="Search devices (Ctrl+K)"
            className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg text-xs text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors md:hidden"
          >
            <Search className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleExportSvg}
            title="Export vector SVG"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">SVG</span>
          </button>
          <div className="h-4 w-px bg-fd-border mx-0.5" />
          <button
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen)}
            title="Toggle Inspector Drawer"
            aria-label="Toggle Inspector Drawer"
            className={cn(
              'inline-flex items-center justify-center size-7 rounded-lg transition-colors',
              inspectorOpen
                ? 'bg-fd-primary/15 text-fd-primary'
                : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground',
            )}
          >
            <PanelRight className="size-4" />
          </button>
        </div>
      </header>

      {/* Interactive Pan/Zoom SVG Stage */}
      <div
        role="application"
        aria-label={data.title}
        className={cn(
          'relative flex-1 w-full h-full select-none overflow-hidden',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[data-interactive-node],[data-interactive-link]')) {
            return;
          }
          setDragging(true);
          dragOrigin.current = {
            x: e.clientX,
            y: e.clientY,
            camX: camera.x,
            camY: camera.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          const dx = e.clientX - dragOrigin.current.x;
          const dy = e.clientY - dragOrigin.current.y;
          setCamera((prev) => ({
            ...prev,
            x: dragOrigin.current.camX + dx,
            y: dragOrigin.current.camY + dy,
          }));
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.08 : 0.92;
            setCamera((prev) => ({
              ...prev,
              k: Math.max(0.45, Math.min(2.6, Number((prev.k * factor).toFixed(3)))),
            }));
          }
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${data.width} ${data.height}`}
          className="w-full h-full block"
        >
          <defs>
            <pattern
              id={patternId}
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="2"
                cy="2"
                r="1"
                fill="currentColor"
                className="text-fd-muted-foreground/20"
              />
            </pattern>
          </defs>

          {/* Dot Grid Background */}
          <rect width={data.width} height={data.height} fill={`url(#${patternId})`} />

          {/* Camera Transform Group */}
          <g
            transform={`translate(${data.width / 2 + camera.x}, ${data.height / 2 + camera.y}) scale(${camera.k}) translate(${-data.width / 2}, ${-data.height / 2})`}
            className="transition-transform duration-75 ease-out"
          >
            {/* Layer 1: Containment Zones */}
            {data.zones.map((zone) => {
              const isZoneDimmed = activeZoneId && activeZoneId !== zone.id;
              const accent = zone.accent ?? '#3b82f6';
              return (
                <g
                  key={zone.id}
                  className={cn(
                    'transition-opacity duration-200',
                    isZoneDimmed ? 'opacity-25' : 'opacity-100',
                  )}
                >
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    rx={16}
                    fill={accent}
                    fillOpacity={0.055}
                    stroke={accent}
                    strokeOpacity={0.35}
                    strokeWidth={1.5}
                    strokeDasharray={zone.id === 'dmz-sec' ? '6 4' : undefined}
                  />
                  <text
                    x={zone.x + 18}
                    y={zone.y + 24}
                    fill={accent}
                    className="text-[11px] font-semibold uppercase tracking-widest"
                  >
                    {zone.label}
                  </text>
                  {zone.subtitle && (
                    <text
                      x={zone.x + 18}
                      y={zone.y + 40}
                      fill="currentColor"
                      className="text-[10px] text-fd-muted-foreground opacity-70 font-mono"
                    >
                      {zone.subtitle}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Layer 2: Network Links & Port Chips */}
            {data.links.map((link) => {
              const fromDev = deviceById.get(link.from.device);
              const toDev = deviceById.get(link.to.device);
              if (!fromDev || !toDev) return null;

              const isSelected = selectedLinkId === link.id;
              const isConnectedToFocus =
                focusTargetId === link.from.device || focusTargetId === link.to.device;
              const isDimmed =
                Boolean(focusTargetId && !isConnectedToFocus) ||
                Boolean(
                  activeZoneId &&
                    fromDev.zone !== activeZoneId &&
                    toDev.zone !== activeZoneId,
                );

              const x1 = fromDev.x;
              const y1 = fromDev.y;
              const x2 = toDev.x;
              const y2 = toDev.y;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              // Orthogonal / smooth cubic spline path
              const isHorizontal = Math.abs(y1 - y2) < 30;
              const pathD = isHorizontal
                ? `M ${x1} ${y1} L ${x2} ${y2}`
                : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

              const strokeW = speedStrokeWidth(link.speed, link.mode);
              const strokeColor =
                link.status === 'degraded'
                  ? '#f59e0b'
                  : link.status === 'down'
                    ? '#f43f5e'
                    : link.status === 'planned'
                      ? '#0ea5e9'
                      : isSelected || isConnectedToFocus
                        ? 'var(--color-fd-primary, #3b82f6)'
                        : 'currentColor';

              const dashArray =
                link.mode === 'tunnel' || link.status === 'degraded'
                  ? '7 5'
                  : link.mode === 'peering' || link.status === 'planned'
                    ? '3 5'
                    : undefined;

              // Port chip coordinates (25% and 75% along segment)
              const p1x = x1 + (x2 - x1) * 0.24;
              const p1y = y1 + (y2 - y1) * 0.24;
              const p2x = x1 + (x2 - x1) * 0.76;
              const p2y = y1 + (y2 - y1) * 0.76;

              return (
                <g
                  key={link.id}
                  data-interactive-link="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectLink(link.id);
                  }}
                  className={cn(
                    'cursor-pointer transition-opacity duration-200',
                    isDimmed ? 'opacity-15' : 'opacity-95 hover:opacity-100',
                  )}
                >
                  {/* Wide transparent hit target */}
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} />

                  {/* Main cable stroke */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected ? strokeW + 1.2 : strokeW}
                    strokeDasharray={dashArray}
                    strokeLinecap="round"
                    className={cn(
                      link.status === 'up' &&
                        !isSelected &&
                        !isConnectedToFocus &&
                        'text-fd-muted-foreground/65',
                    )}
                  />

                  {/* Trunk double-rail center slot */}
                  {link.mode === 'trunk' && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="var(--color-fd-background, #09090b)"
                      strokeWidth={1.5}
                    />
                  )}

                  {/* Active Traffic Flow Animation Overlay */}
                  {viewSettings.motion && link.flow && link.status === 'up' && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="var(--color-fd-primary, #f59e0b)"
                      strokeWidth={2}
                      strokeDasharray="6 18"
                      className="animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                    />
                  )}

                  {/* Midpoint Link Protocol / VLAN Chip */}
                  {(link.protocol || link.vlan) && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-38}
                        y={-9}
                        width={76}
                        height={18}
                        rx={9}
                        fill="var(--color-fd-background, #09090b)"
                        stroke={
                          isSelected
                            ? 'var(--color-fd-primary, #3b82f6)'
                            : 'var(--color-fd-border, #27272a)'
                        }
                        strokeWidth={1.2}
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        fill="currentColor"
                        className="text-[9.5px] font-mono font-semibold text-fd-foreground"
                      >
                        {link.protocol ?? link.vlan}
                      </text>
                    </g>
                  )}

                  {/* Interface Port Chips */}
                  {viewSettings.ports && (
                    <>
                      <g transform={`translate(${p1x}, ${p1y})`}>
                        <rect
                          x={-22}
                          y={-8}
                          width={44}
                          height={16}
                          rx={6}
                          fill="var(--color-fd-card, #18181b)"
                          stroke="var(--color-fd-border, #27272a)"
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          fill="currentColor"
                          className="text-[8.5px] font-mono text-fd-muted-foreground"
                        >
                          {link.from.port}
                        </text>
                      </g>
                      <g transform={`translate(${p2x}, ${p2y})`}>
                        <rect
                          x={-22}
                          y={-8}
                          width={44}
                          height={16}
                          rx={6}
                          fill="var(--color-fd-card, #18181b)"
                          stroke="var(--color-fd-border, #27272a)"
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          fill="currentColor"
                          className="text-[8.5px] font-mono text-fd-muted-foreground"
                        >
                          {link.to.port}
                        </text>
                      </g>
                    </>
                  )}
                </g>
              );
            })}

            {/* Layer 3: Hardware Device Nodes */}
            {data.devices.map((dev) => {
              const isSelected = selectedDeviceId === dev.id;
              const isHovered = hoveredDeviceId === dev.id;
              const isNeighbor = Boolean(focusNeighbors?.has(dev.id));
              const isDimmed =
                Boolean(focusTargetId && !isSelected && !isHovered && !isNeighbor) ||
                Boolean(activeZoneId && dev.zone !== activeZoneId);

              return (
                <g
                  key={dev.id}
                  data-interactive-node="true"
                  transform={`translate(${dev.x}, ${dev.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectDevice(dev.id);
                  }}
                  onPointerEnter={() => setHoveredDeviceId(dev.id)}
                  onPointerLeave={() => setHoveredDeviceId(null)}
                  className={cn(
                    'cursor-pointer transition-opacity duration-200',
                    isDimmed ? 'opacity-20' : 'opacity-100',
                  )}
                >
                  {/* Selection Outer Ring */}
                  {isSelected && (
                    <rect
                      x={-34}
                      y={-34}
                      width={68}
                      height={68}
                      rx={18}
                      fill="none"
                      stroke="var(--color-fd-primary, #f59e0b)"
                      strokeWidth={2.2}
                    />
                  )}

                  {/* Node Hardware Chip */}
                  <rect
                    x={-28}
                    y={-28}
                    width={56}
                    height={56}
                    rx={14}
                    fill="var(--color-fd-card, #18181b)"
                    stroke={
                      isSelected
                        ? 'var(--color-fd-primary, #f59e0b)'
                        : isHovered
                          ? 'var(--color-fd-foreground, #fafafa)'
                          : 'var(--color-fd-border, #27272a)'
                    }
                    strokeWidth={isSelected ? 2 : 1.5}
                  />

                  {/* Vendor / Tier Icon */}
                  <g className="text-fd-foreground">
                    <DeviceVendorGlyph tier={dev.tier} />
                  </g>

                  {/* Corner-Anchored Status LED with Halo */}
                  <circle
                    cx={20}
                    cy={-20}
                    r={5.5}
                    fill={STATUS_LED_COLOR[dev.status]}
                    stroke="var(--color-fd-background, #09090b)"
                    strokeWidth={2.2}
                  />

                  {/* Hostname + Management IP Labels */}
                  {viewSettings.labels && (
                    <g transform="translate(0, 42)">
                      <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        fill="currentColor"
                        style={{
                          paintOrder: 'stroke',
                          stroke: 'var(--color-fd-background, #09090b)',
                          strokeWidth: '4px',
                          strokeLinejoin: 'round',
                        }}
                        className="text-[11.5px] font-semibold font-mono text-fd-foreground"
                      >
                        {dev.label}
                      </text>
                      {dev.ip && (
                        <text
                          x={0}
                          y={14}
                          textAnchor="middle"
                          fill="currentColor"
                          style={{
                            paintOrder: 'stroke',
                            stroke: 'var(--color-fd-background, #09090b)',
                            strokeWidth: '3px',
                          }}
                          className="text-[9.5px] font-mono text-fd-muted-foreground"
                        >
                          {dev.ip}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Blueprint / Minimal Watermark in Bottom-Left */}
        {viewSettings.watermark !== 'off' && (
          <div
            aria-hidden="true"
            className="absolute left-4 bottom-3 z-10 pointer-events-none select-none flex items-baseline gap-2.5"
          >
            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-fd-muted-foreground/50">
              fig. 01 — {data.title}
            </span>
            {data.subtitle && (
              <span className="hidden lg:inline text-[10px] font-mono text-fd-muted-foreground/35">
                {data.subtitle}
              </span>
            )}
          </div>
        )}

        {/* Floating Minimap & Camera Controls */}
        <TopologyMinimap />
        <TopologyControls />
      </div>
    </div>
  );
}
