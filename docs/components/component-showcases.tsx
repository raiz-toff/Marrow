'use client';

import React, { useState, useEffect } from 'react';
import {
  TopologyProvider,
  TopologyInspector,
  TopologySidebar,
  TopologyTreeView,
  TopologyLegend,
  TopologyStatusLegend,
  TopologyLinkLegend,
  TopologyCanvas,
  TopologySearch,
  TopologyShell,
  DEFAULT_TOPOLOGY_DATA,
  useTopologyShell,
} from '@marrow/ui';
import {
  Server,
  Shield,
  Network,
  Router,
  Search,
  Sparkles,
  Layers,
  Maximize2,
  Minimize2,
  ExternalLink,
  ListTree,
  Activity,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
 * 1. Topology Inspector Showcase: Authentic Hardware Telemetry
 * ───────────────────────────────────────────────────────────── */

const SHOWCASE_DEVICES = [
  {
    id: 'hq-core-01',
    label: 'HQ Core 1',
    role: 'Campus Core Switch',
    icon: Network,
    badge: 'StackWise-Virtual',
    accent: '#7aa2ff',
  },
  {
    id: 'hq-fw',
    label: 'HQ Firewall',
    role: 'Perimeter Next-Gen Firewall',
    icon: Shield,
    badge: 'IPSec Tunnel',
    accent: '#f59e0b',
  },
  {
    id: 'dc-rt',
    label: 'DC Router',
    role: 'Datacenter Edge Router',
    icon: Router,
    badge: 'WAN eBGP',
    accent: '#3b82f6',
  },
  {
    id: 'dc-sw',
    label: 'DC Switch',
    role: 'Spine/Leaf Multilayer',
    icon: Server,
    badge: '25G Server VTEP',
    accent: '#4fc3a1',
  },
];

export function InspectorShowcase() {
  const [selectedId, setSelectedId] = useState('hq-core-01');

  return (
    <div className="flex flex-col w-full gap-4 items-center">
      {/* Device Selector Pill Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-3xl">
        <span className="text-[11px] font-mono text-fd-muted-foreground me-1 uppercase tracking-wider">
          Select Hardware:
        </span>
        {SHOWCASE_DEVICES.map((d) => {
          const Icon = d.icon;
          const isSelected = selectedId === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedId(d.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'border-fd-primary bg-fd-primary/10 text-fd-foreground shadow-xs'
                  : 'border-fd-border bg-fd-card/60 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground'
              }`}
            >
              <Icon className="size-3.5" style={{ color: d.accent }} />
              <span className="font-semibold">{d.label}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-fd-muted text-fd-muted-foreground">
                {d.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Floating Sibling Inspector Card */}
      <div className="relative w-full max-w-[440px] rounded-2xl border border-fd-border bg-fd-background p-1 shadow-lg">
        <TopologyProvider
          key={selectedId}
          data={DEFAULT_TOPOLOGY_DATA}
          defaultSelectedDeviceId={selectedId}
        >
          <div className="w-full">
            <TopologyInspector className="w-full my-0 me-0 border-0 shadow-none" />
          </div>
        </TopologyProvider>
      </div>

      <p className="text-[11px] text-fd-muted-foreground text-center">
        💡 Switch devices above to inspect live port tables, LLDP neighbor discovery, and copyable vendor CLI configurations.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 2. Topology Controls & Minimap Showcase
 * ───────────────────────────────────────────────────────────── */

export function ControlsShowcase() {
  return (
    <div className="flex flex-col w-full gap-3">
      <div className="relative w-full h-[500px] rounded-2xl border border-fd-border bg-fd-card overflow-hidden shadow-md">
        <TopologyProvider
          data={DEFAULT_TOPOLOGY_DATA}
          defaultSelectedDeviceId="hq-core-01"
        >
          <TopologyCanvas className="m-0 border-0 rounded-none h-full w-full" />
        </TopologyProvider>
      </div>

      <div className="flex items-center justify-between px-2 text-[11px] text-fd-muted-foreground">
        <span>
          🧭 <strong>Floating Controls HUD</strong>: Click <strong>+</strong> / <strong>−</strong> to adjust zoom, <strong>Fit</strong> to frame content, or <strong>Ctrl+K</strong> to trigger device search.
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 2b. Complete Shell Showcase: Full Workspace without Topology Diagram
 * ───────────────────────────────────────────────────────────── */

export function CompleteShellShowcase() {
  return (
    <div className="w-full">
      <TopologyShell height="680px" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 3. Topology Sidebar Showcase: Living Navigation Rail
 * ───────────────────────────────────────────────────────────── */

export function SidebarShowcase() {
  return (
    <div className="flex flex-col w-full gap-3 items-center">
      <div className="relative w-full max-w-[320px] h-[540px] rounded-2xl border border-fd-border bg-fd-card overflow-hidden shadow-md">
        <TopologyProvider
          data={DEFAULT_TOPOLOGY_DATA}
          defaultSelectedDeviceId="hq-core-01"
        >
          <TopologySidebar className="w-full border-0" />
        </TopologyProvider>
      </div>

      <p className="text-[11px] text-fd-muted-foreground text-center">
        ⚡ Move your cursor across zones and devices to see the gliding hover indicator block in action.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 4. Command Search Showcase: Spotlight Command Center
 * ───────────────────────────────────────────────────────────── */

function SearchTriggerBox() {
  const { setSearchOpen } = useTopologyShell();
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-4 w-full">
      <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
        <Sparkles className="size-4 text-fd-primary" />
        <span>Try searching for hostnames, subnets, zones, or links</span>
      </div>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="inline-flex items-center justify-between gap-6 px-5 py-3 rounded-2xl border border-fd-border bg-fd-card text-fd-foreground hover:border-fd-primary/60 transition-all shadow-md font-medium text-sm cursor-pointer w-full max-w-md group"
      >
        <span className="flex items-center gap-2.5 text-fd-muted-foreground group-hover:text-fd-foreground transition-colors">
          <Search className="size-4" />
          <span>Search devices, IPs, interfaces…</span>
        </span>
        <kbd className="px-2 py-0.5 text-xs font-mono bg-fd-muted border border-fd-border rounded-md shadow-2xs">
          Ctrl K
        </kbd>
      </button>
      <span className="text-[11px] text-fd-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-fd-muted border rounded">Ctrl+K</kbd> or click the bar above
      </span>
    </div>
  );
}

export function SearchShowcase() {
  return (
    <div className="w-full flex items-center justify-center">
      <TopologyProvider data={DEFAULT_TOPOLOGY_DATA}>
        <SearchTriggerBox />
        <TopologySearch />
      </TopologyProvider>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 5. Complete Component Workbench: Zero-Diagram Testing Studio
 * ───────────────────────────────────────────────────────────── */

function WorkbenchDiagnostics() {
  const {
    selectedDeviceId,
    selectedDevice,
    activeZoneId,
    sidebarCollapsed,
    setSidebarCollapsed,
    inspectorOpen,
    setInspectorOpen,
    inspectorTab,
    setInspectorTab,
    setSearchOpen,
  } = useTopologyShell();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-fd-border bg-fd-card text-xs font-mono">
      {/* State Indicators */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-fd-muted-foreground font-semibold">
          Active State:
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-fd-border bg-fd-background text-fd-foreground font-medium">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Device: <strong className="text-fd-primary">{selectedDeviceId || 'None'}</strong>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-fd-border bg-fd-background text-fd-muted-foreground">
          Zone: <span className="text-fd-foreground">{activeZoneId || selectedDevice?.zone || 'all'}</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-fd-border bg-fd-background text-fd-muted-foreground">
          Tab: <span className="text-fd-foreground">{inspectorTab}</span>
        </span>
      </div>

      {/* Direct Shell Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSidebarCollapsed((p) => !p)}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-sans font-medium transition-all cursor-pointer ${
            sidebarCollapsed
              ? 'border-fd-border bg-fd-muted text-fd-muted-foreground'
              : 'border-fd-primary/40 bg-fd-primary/10 text-fd-primary'
          }`}
        >
          {sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        </button>

        <button
          type="button"
          onClick={() => setInspectorOpen(!inspectorOpen)}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-sans font-medium transition-all cursor-pointer ${
            inspectorOpen
              ? 'border-fd-primary/40 bg-fd-primary/10 text-fd-primary'
              : 'border-fd-border bg-fd-muted text-fd-muted-foreground'
          }`}
        >
          {inspectorOpen ? 'Inspector Open' : 'Inspector Closed'}
        </button>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-fd-border bg-fd-background hover:border-fd-primary text-fd-foreground transition-all cursor-pointer text-[11px] font-sans font-medium"
        >
          <Search className="size-3" />
          <span>Search</span>
          <kbd className="px-1 text-[9px] bg-fd-muted rounded">⌘K</kbd>
        </button>
      </div>
    </div>
  );
}

export function ComponentWorkbench() {
  const [activeMode, setActiveMode] = useState<
    'all' | 'sidebar' | 'tree' | 'legend' | 'inspector' | 'controls' | 'search'
  >('all');
  const [activeDeviceId, setActiveDeviceId] = useState('hq-core-01');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Allow pressing Escape to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-fd-background p-4 sm:p-6 overflow-hidden flex flex-col gap-3 shadow-2xl'
          : 'relative flex flex-col w-full gap-5'
      }
    >
      {/* Workbench Navigation Pill Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-fd-border">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl border border-fd-border bg-fd-card">
          {[
            { id: 'all', label: 'All Components (Assembled Shell)' },
            { id: 'sidebar', label: 'Sidebar (Compound)' },
            { id: 'tree', label: 'Tree View (Modular)' },
            { id: 'legend', label: 'Legend (Modular)' },
            { id: 'inspector', label: 'Inspector' },
            { id: 'controls', label: 'Controls HUD' },
            { id: 'search', label: 'Command Search' },
          ].map((tab) => {
            const isActive = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMode(tab.id as typeof activeMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-fd-primary text-fd-primary-foreground font-semibold shadow-xs'
                    : 'text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted/50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Device Switcher & Fullscreen Button */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-fd-muted-foreground uppercase tracking-wider hidden sm:inline">
            Focus:
          </span>
          <select
            value={activeDeviceId}
            onChange={(e) => setActiveDeviceId(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-mono rounded-xl border border-fd-border bg-fd-card text-fd-foreground focus:outline-hidden focus:border-fd-primary cursor-pointer"
          >
            {DEFAULT_TOPOLOGY_DATA.devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} ({d.zone})
              </option>
            ))}
          </select>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand to Fullscreen'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              isFullscreen
                ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground shadow-sm font-semibold'
                : 'border-fd-border bg-fd-card hover:bg-fd-muted text-fd-foreground shadow-2xs'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="size-3.5" />
                <span>Exit Fullscreen</span>
                <kbd className="px-1 text-[9px] bg-fd-primary-foreground/20 rounded font-mono">
                  Esc
                </kbd>
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                <span>Go Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Sandbox Area */}
      <TopologyProvider
        key={activeDeviceId}
        data={DEFAULT_TOPOLOGY_DATA}
        defaultSelectedDeviceId={activeDeviceId}
      >
        <WorkbenchDiagnostics />

        {activeMode === 'all' && (
          <div className="w-full flex-1 min-h-0">
            <TopologyShell height={isFullscreen ? 'calc(100vh - 140px)' : '680px'} />
          </div>
        )}

        {activeMode === 'inspector' && (
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-fd-border bg-fd-card/50">
            <div className="w-full max-w-[420px] rounded-2xl border border-fd-border bg-fd-background p-1 shadow-xl">
              <TopologyInspector className="w-full my-0 me-0 border-0 shadow-none" />
            </div>
          </div>
        )}

        {activeMode === 'sidebar' && (
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-fd-border bg-fd-card/50">
            <div className="w-full max-w-[300px] h-[580px] rounded-2xl border border-fd-border bg-fd-card overflow-hidden shadow-xl">
              <TopologySidebar className="w-full border-0" />
            </div>
          </div>
        )}

        {activeMode === 'tree' && (
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-fd-border bg-fd-card/50">
            <div className="w-full max-w-[360px] rounded-2xl border border-fd-border bg-fd-card p-4 shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-fd-border">
                <div>
                  <span className="text-xs font-semibold text-fd-foreground block">
                    Modular &lt;TopologyTreeView /&gt;
                  </span>
                  <span className="text-[11px] text-fd-muted-foreground">
                    Standalone zone & device hierarchy with status LEDs
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-fd-primary/10 text-fd-primary font-medium">
                  Isolated Primitive
                </span>
              </div>
              <TopologyTreeView showOverview showInventory showTierIcons showStatusDots />
            </div>
          </div>
        )}

        {activeMode === 'legend' && (
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-fd-border bg-fd-card/50">
            <div className="w-full max-w-xl flex flex-col gap-5">
              {/* 1. Full Default Legend */}
              <div className="rounded-2xl border border-fd-border bg-fd-card p-4 shadow-xl flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-fd-border">
                  <div>
                    <span className="text-xs font-semibold text-fd-foreground block">
                      Full &lt;TopologyLegend /&gt;
                    </span>
                    <span className="text-[11px] text-fd-muted-foreground">
                      Default grid variant used in sidebar & footer
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-fd-primary/10 text-fd-primary font-medium">
                    Compound Section
                  </span>
                </div>
                <TopologyLegend />
              </div>

              {/* 2. Standalone Sub-Primitives */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status Legend */}
                <div className="rounded-2xl border border-fd-border bg-fd-card p-4 shadow-md flex flex-col gap-2">
                  <span className="text-xs font-semibold text-fd-foreground">
                    &lt;TopologyStatusLegend variant="grid" /&gt;
                  </span>
                  <span className="text-[11px] text-fd-muted-foreground">
                    Status telemetry dots (up, degraded, down, planned)
                  </span>
                  <div className="pt-2">
                    <TopologyStatusLegend variant="grid" />
                  </div>
                </div>

                {/* Link Legend */}
                <div className="rounded-2xl border border-fd-border bg-fd-card p-4 shadow-md flex flex-col gap-2">
                  <span className="text-xs font-semibold text-fd-foreground">
                    &lt;TopologyLinkLegend /&gt;
                  </span>
                  <span className="text-[11px] text-fd-muted-foreground">
                    Cable physical trunk & tunnel dash styles
                  </span>
                  <div className="pt-2">
                    <TopologyLinkLegend />
                  </div>
                </div>
              </div>

              {/* 3. Inline HUD Variant */}
              <div className="rounded-2xl border border-fd-border bg-fd-background p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-fd-foreground block">
                    Inline HUD Bar Variant
                  </span>
                  <span className="text-[11px] text-fd-muted-foreground">
                    Compact status row ready to float on canvas or bottom dock
                  </span>
                </div>
                <TopologyStatusLegend variant="inline" />
              </div>
            </div>
          </div>
        )}

        {activeMode === 'controls' && (
          <div className="relative w-full h-[400px] rounded-2xl border border-fd-border bg-fd-card overflow-hidden flex items-center justify-center">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.25]"
              style={{
                backgroundImage:
                  'radial-gradient(var(--color-fd-border, #3f3f46) 1.2px, transparent 1.2px)',
                backgroundSize: '20px 20px',
              }}
            />
            <div className="relative z-10 flex flex-col items-center gap-2 text-center p-6 rounded-2xl border border-fd-border bg-fd-background/80 backdrop-blur-md max-w-sm">
              <span className="text-sm font-semibold text-fd-foreground">
                Floating Controls HUD Test
              </span>
              <span className="text-xs text-fd-muted-foreground">
                Notice the floating vertical control pill in the bottom-right corner. It provides Zoom In, Zoom Out, Fit View, and Ctrl+K shortcuts.
              </span>
            </div>
            <TopologyCanvas className="m-0 border-0 rounded-none h-full w-full" />
          </div>
        )}

        {activeMode === 'search' && (
          <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-fd-border bg-fd-card/50">
            <SearchTriggerBox />
            <TopologySearch />
          </div>
        )}
      </TopologyProvider>
    </div>
  );
}

export function TreeViewShowcase() {
  return (
    <TopologyProvider defaultSelectedDeviceId="hq-core-01">
      <div className="w-full max-w-[340px] rounded-2xl border border-fd-border bg-fd-card p-4 shadow-xl">
        <TopologyTreeView />
      </div>
    </TopologyProvider>
  );
}

export function LegendShowcase() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-fd-border bg-fd-card p-4 shadow-xl">
      <TopologyLegend />
    </div>
  );
}


