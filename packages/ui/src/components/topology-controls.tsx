'use client';

import { Command, Map as MapIcon, Maximize2, Minus, Minimize2, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn, type DeviceStatus } from '../lib/utils.js';
import { useTopologyShell } from './topology-context.js';

const MINI_DOT_COLOR: Record<DeviceStatus, string> = {
  up: '#10b981',
  degraded: '#f59e0b',
  down: '#f43f5e',
  planned: '#0ea5e9',
  unknown: '#71717a',
};

export function TopologyMinimap({ className }: { className?: string }) {
  const { data, camera, setCamera, selectedDeviceId, viewSettings } = useTopologyShell();
  const [collapsed, setCollapsed] = useState(false);

  if (!viewSettings.minimap) return null;

  const totalWidth = data.width ?? 1200;
  const totalHeight = data.height ?? 800;
  const miniW = 168;
  const miniH = Math.round((totalHeight / totalWidth) * miniW);

  // Viewport indicator box inside minimap coordinates
  const viewW = Math.min(totalWidth, totalWidth / camera.k);
  const viewH = Math.min(totalHeight, totalHeight / camera.k);
  const viewX = Math.max(
    0,
    Math.min(totalWidth - viewW, (totalWidth - viewW) / 2 - camera.x / camera.k),
  );
  const viewY = Math.max(
    0,
    Math.min(totalHeight - viewH, (totalHeight - viewH) / 2 - camera.y / camera.k),
  );

  return (
    <div
      className={cn(
        'absolute bottom-3 right-14 z-20 rounded-xl border bg-fd-popover/90 backdrop-blur-md shadow-md transition-all',
        collapsed ? 'p-1' : 'p-1.5',
        className,
      )}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expand minimap"
          aria-label="Expand minimap"
          className="flex items-center justify-center size-8 rounded-lg text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors"
        >
          <MapIcon className="size-4" />
        </button>
      ) : (
        <div className="relative group">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Collapse minimap"
            aria-label="Collapse minimap"
            className="absolute top-1 right-1 z-10 flex items-center justify-center size-5 rounded-md border bg-fd-background/90 text-fd-muted-foreground opacity-0 group-hover:opacity-100 hover:text-fd-foreground transition-opacity"
          >
            <Minimize2 className="size-3" />
          </button>
          <svg
            width={miniW}
            height={miniH}
            viewBox={`0 0 ${totalWidth} ${totalHeight}`}
            className="block rounded-lg bg-fd-card/60 cursor-crosshair"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = ((e.clientX - rect.left) / rect.width) * totalWidth;
              const clickY = ((e.clientY - rect.top) / rect.height) * totalHeight;
              setCamera((prev) => ({
                ...prev,
                x: (totalWidth / 2 - clickX) * prev.k,
                y: (totalHeight / 2 - clickY) * prev.k,
              }));
            }}
          >
            {data.zones.map((z) => (
              <rect
                key={z.id}
                x={z.x}
                y={z.y}
                width={z.width}
                height={z.height}
                rx={12}
                fill={z.accent ?? '#3b82f6'}
                fillOpacity={0.12}
                stroke={z.accent ?? '#3b82f6'}
                strokeOpacity={0.45}
                strokeWidth={4}
              />
            ))}
            {data.devices.map((d) => (
              <circle
                key={d.id}
                cx={d.x}
                cy={d.y}
                r={selectedDeviceId === d.id ? 18 : 12}
                fill={MINI_DOT_COLOR[d.status]}
                stroke={selectedDeviceId === d.id ? '#ffffff' : 'none'}
                strokeWidth={5}
              />
            ))}
            <rect
              x={viewX}
              y={viewY}
              width={viewW}
              height={viewH}
              rx={10}
              fill="var(--color-fd-primary, #3b82f6)"
              fillOpacity={0.12}
              stroke="var(--color-fd-primary, #3b82f6)"
              strokeWidth={6}
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export function TopologyControls({ className }: { className?: string }) {
  const { zoomIn, zoomOut, fitView, setSearchOpen } = useTopologyShell();

  return (
    <div
      aria-label="Camera controls"
      className={cn(
        'absolute bottom-3 right-3 z-20 flex flex-col gap-0.5 p-1 rounded-xl border bg-fd-popover/90 backdrop-blur-md shadow-md',
        className,
      )}
    >
      <button
        type="button"
        onClick={zoomIn}
        title="Zoom in (+)"
        aria-label="Zoom in"
        className="flex items-center justify-center size-8 rounded-lg text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors"
      >
        <Plus className="size-4" />
      </button>
      <button
        type="button"
        onClick={zoomOut}
        title="Zoom out (−)"
        aria-label="Zoom out"
        className="flex items-center justify-center size-8 rounded-lg text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors"
      >
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        onClick={fitView}
        title="Fit view (F)"
        aria-label="Fit view"
        className="flex items-center justify-center size-8 rounded-lg text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors"
      >
        <Maximize2 className="size-3.5" />
      </button>
      <div className="my-0.5 h-px bg-fd-border" />
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        title="Command center (Ctrl+K)"
        aria-label="Open command center"
        className="flex items-center justify-center size-8 rounded-lg text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors"
      >
        <Command className="size-3.5" />
      </button>
    </div>
  );
}
