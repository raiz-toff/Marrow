'use client';

import {
  Activity,
  ChevronRight,
  Command,
  Cpu,
  Layers,
  Maximize2,
  Minimize2,
  Network,
  Radio,
  Router,
  Search,
  Server,
  Shield,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn, type DeviceStatus, type TopologyDevice } from '../lib/utils.js';
import { useTopologyShell } from './topology-context.js';
import { TopologyControls } from './topology-controls.js';

export interface TopologyStageProps {
  /**
   * Optional custom URL if an embedded diagram is explicitly desired.
   * If omitted, renders the clean workspace stage without any diagram.
   */
  src?: string;
  /** Show the in-stage title & toolbar */
  showToolbar?: boolean;
  /** Show floating camera controls HUD (+ / - / fit / fullscreen) */
  showControls?: boolean;
  /** Custom overlay children or slot */
  children?: React.ReactNode;
  /** Optional custom CSS classes on the container */
  className?: string;
}

const STATUS_LED_COLOR: Record<DeviceStatus, string> = {
  up: '#10b981',
  degraded: '#f59e0b',
  down: '#f43f5e',
  planned: '#0ea5e9',
  unknown: '#71717a',
};

function getDeviceIcon(tier: string, role: string) {
  const r = role.toLowerCase();
  if (r.includes('firewall') || r.includes('security') || r.includes('dmz')) return Shield;
  if (r.includes('router') || tier === 'edge') return Router;
  if (r.includes('server') || r.includes('cluster') || r.includes('db') || tier === 'endpoint') return Server;
  return Network;
}

export function TopologyStage({
  src,
  showToolbar = true,
  showControls = true,
  children,
  className,
}: TopologyStageProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, selectedDevice, activeZoneId, viewSettings, setSearchOpen } = useTopologyShell();

  const activeZone = data.zones.find((z) => z.id === (activeZoneId || selectedDevice?.zone));
  const activeZoneLabel = activeZone?.label || 'All Zones';

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const DeviceIcon = selectedDevice
    ? getDeviceIcon(selectedDevice.tier, selectedDevice.role)
    : Network;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col flex-1 min-h-[460px] w-full h-full overflow-hidden rounded-xl border border-fd-border/60 bg-fd-card/40 text-fd-foreground shadow-inner select-none transition-all',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : '',
        className,
      )}
    >
      {/* ── Top Floating Stage Bar: Breadcrumb + Search Trigger ── */}
      {showToolbar && (
        <div className="absolute top-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Left: Breadcrumbs */}
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border border-fd-border/70 bg-fd-background/90 backdrop-blur-md shadow-xs">
            <Layers className="size-3.5 text-fd-primary" />
            <span className="text-xs font-semibold text-fd-foreground tracking-tight">
              {data.title || 'Marrow Studio'}
            </span>
            <ChevronRight className="size-3 text-fd-muted-foreground/60" />
            <span className="text-[11px] font-mono text-fd-primary">
              {activeZoneLabel}
            </span>
          </div>

          {/* Right: Quick Search Button + Fullscreen */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-fd-border/70 bg-fd-background/90 backdrop-blur-md text-xs font-medium text-fd-muted-foreground hover:text-fd-foreground hover:border-fd-primary/50 transition-all shadow-xs cursor-pointer"
            >
              <Search className="size-3.5 text-fd-muted-foreground" />
              <span className="hidden sm:inline">Search devices…</span>
              <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-fd-muted border border-fd-border rounded text-fd-muted-foreground">
                Ctrl K
              </kbd>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="p-1.5 rounded-xl border border-fd-border/70 bg-fd-background/90 backdrop-blur-md text-fd-muted-foreground hover:text-fd-foreground transition-all shadow-xs cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Main Stage Area: Clean Workspace Viewport (No Topology Diagram) ── */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 w-full h-full min-h-[400px] overflow-hidden bg-fd-background/60">
        {/* Subtle Engineering Dot Grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-[0.25]"
          style={{
            backgroundImage:
              'radial-gradient(var(--color-fd-border, #3f3f46) 1.2px, transparent 1.2px)',
            backgroundSize: '20px 20px',
          }}
        />

        {src ? (
          <iframe
            src={src}
            title={data.title}
            className="relative z-10 w-full h-full border-0 block"
            allow="fullscreen"
          />
        ) : (
          /* Active Hardware Telemetry Stage Card */
          <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-lg">
            {selectedDevice ? (
              <div className="w-full rounded-2xl border border-fd-border/80 bg-fd-card/90 backdrop-blur-md p-5 shadow-xl transition-all">
                {/* Header Row */}
                <div className="flex items-center justify-between pb-3 border-b border-fd-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-xl bg-fd-primary/10 border border-fd-primary/20 text-fd-primary shadow-xs">
                      <DeviceIcon className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-fd-foreground">
                          {selectedDevice.label}
                        </span>
                        <span
                          className="size-2 rounded-full inline-block shadow-xs"
                          style={{
                            backgroundColor:
                              STATUS_LED_COLOR[selectedDevice.status] || '#10b981',
                          }}
                          title={`Status: ${selectedDevice.status.toUpperCase()}`}
                        />
                      </div>
                      <span className="text-xs text-fd-muted-foreground">
                        {selectedDevice.role}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-fd-border bg-fd-muted/70 text-fd-muted-foreground uppercase tracking-wider">
                    Tier: {selectedDevice.tier}
                  </span>
                </div>

                {/* Hardware Telemetry Spec Grid */}
                <div className="grid grid-cols-2 gap-2.5 py-3.5 text-xs">
                  <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-fd-background/50 border border-fd-border/40">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-fd-muted-foreground">
                      Management IP
                    </span>
                    <span className="font-mono font-medium text-fd-foreground">
                      {selectedDevice.ip || 'DHCP Assigned'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-fd-background/50 border border-fd-border/40">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-fd-muted-foreground">
                      Hardware Model
                    </span>
                    <span className="font-medium truncate text-fd-foreground" title={selectedDevice.model}>
                      {selectedDevice.model || 'Standard Chassis'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-fd-background/50 border border-fd-border/40">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-fd-muted-foreground">
                      Network OS
                    </span>
                    <span className="font-medium truncate text-fd-foreground" title={selectedDevice.os}>
                      {selectedDevice.os || 'Enterprise OS'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-fd-background/50 border border-fd-border/40">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-fd-muted-foreground">
                      Interfaces Configured
                    </span>
                    <span className="font-mono font-medium text-fd-primary">
                      {selectedDevice.interfaces.length} Connected Ports
                    </span>
                  </div>
                </div>

                {/* Interactive Guidance Footer */}
                <div className="pt-2.5 border-t border-fd-border/50 flex items-center justify-between text-[11px] text-fd-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Activity className="size-3.5 text-fd-primary" />
                    <span>Telemetry synced with right Inspector drawer</span>
                  </span>
                  <span className="font-mono text-[10px] text-fd-muted-foreground/70">
                    Zone: {selectedDevice.zone.toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-fd-border bg-fd-card/40">
                <Network className="size-8 text-fd-muted-foreground/50 mb-2" />
                <span className="text-sm font-semibold text-fd-foreground">No Hardware Selected</span>
                <span className="text-xs text-fd-muted-foreground mt-1 max-w-xs">
                  Click any device in the left sidebar or press Ctrl+K to inspect telemetry.
                </span>
              </div>
            )}

            {/* Stage Purpose Callout */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-fd-border/60 bg-fd-muted/40 text-[11px] text-fd-muted-foreground">
              <Sparkles className="size-3 text-fd-primary" />
              <span>Workspace Stage frames device selection, sidebar, and inspector controls</span>
            </div>
          </div>
        )}

        {/* Custom Overlay Children */}
        {children}

        {/* Floating Camera Controls HUD */}
        {showControls && <TopologyControls />}

        {/* Bottom Left Engineering Blueprint Watermark */}
        {viewSettings?.watermark !== 'off' && (
          <div
            aria-hidden="true"
            className="absolute left-3.5 bottom-3 z-10 pointer-events-none select-none flex items-baseline gap-2"
          >
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-fd-muted-foreground/60">
              fig. 01 — Marrow Workspace Studio
            </span>
            <span className="hidden sm:inline text-[9px] font-mono text-fd-muted-foreground/40">
              Zero-Diagram Shell Mode
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Export aliases so existing imports work cleanly */
export const TopologyCanvas = TopologyStage;
export const TopologyViewport = TopologyStage;
