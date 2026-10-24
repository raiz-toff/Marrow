"use client";

import React from "react";
import { cn, DEFAULT_TOPOLOGY_DATA, type TopologyData } from "../lib/utils.js";
import { TopologyProvider, useTopologyShell } from "./topology-context.js";
import { TopologySidebar } from "./topology-sidebar.js";
import { TopologyCanvas } from "./topology-canvas.js";
import { TopologyInspector } from "./topology-inspector.js";
import { TopologySearch } from "./topology-search.js";

export interface TopologyShellProps {
  /** Topology dataset to render. Defaults to a realistic 9-device US-East Core & Campus fabric. */
  data?: TopologyData;
  /** Initial selected device ID (defaults to 'core-sw-01' so the right inspector card is visible). */
  defaultSelectedDeviceId?: string | null;
  /** Start with left sidebar collapsed. */
  defaultSidebarCollapsed?: boolean;
  /** Height class or CSS height for embedded mode vs fullscreen mode. */
  height?: string;
  /** Optional additional className on the outer Spacious shell container. */
  className?: string;
  /** Optional custom children if composing custom slots. */
  children?: React.ReactNode;
}

function TopologyShellLayout({
  height = "720px",
  className,
  children,
}: {
  height?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { sidebarCollapsed } = useTopologyShell();

  return (
    <div
      style={
        {
          "--fd-sidebar-col": sidebarCollapsed ? "0px" : "268px",
          height,
          gridTemplate: `"sidebar main right" 1fr / var(--fd-sidebar-col) minmax(0, 1fr) auto`,
        } as React.CSSProperties
      }
      className={cn(
        "relative grid w-full overflow-hidden rounded-2xl border border-fd-border bg-fd-card text-fd-foreground shadow-md transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] select-none",
        className,
      )}
    >
      {children ?? (
        <>
          <TopologySidebar />
          <TopologyCanvas />
          <TopologyInspector />
          <TopologySearch />
        </>
      )}
    </div>
  );
}

export function TopologyShell({
  data = DEFAULT_TOPOLOGY_DATA,
  defaultSelectedDeviceId = "hq-core-01",
  defaultSidebarCollapsed = false,
  height = "720px",
  className,
  children,
}: TopologyShellProps) {
  return (
    <TopologyProvider
      data={data}
      defaultSelectedDeviceId={defaultSelectedDeviceId}
      defaultSidebarCollapsed={defaultSidebarCollapsed}
    >
      <TopologyShellLayout height={height} className={className}>
        {children}
      </TopologyShellLayout>
    </TopologyProvider>
  );
}
