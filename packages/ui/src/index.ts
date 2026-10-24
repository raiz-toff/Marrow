// Marrow UI Component Registry (React / Next.js / shadcn TSX)
export {
  cn,
  DEFAULT_TOPOLOGY_DATA,
  type DeviceStatus,
  type LinkMode,
  type TopologyData,
  type TopologyDevice,
  type TopologyInterface,
  type TopologyLink,
  type TopologyViewSettings,
  type TopologyZone,
} from "./lib/utils.js";

export {
  TopologyProvider,
  useTopologyShell,
  type CameraState,
  type InspectorTab,
  type TopologyContextValue,
  type TopologyProviderProps,
} from "./components/topology-context.js";

export {
  TopologySidebar,
  TopologySidebarHeader,
  TopologyMenubar,
  TopologySidebarContent,
  TopologyAbout,
  TopologySidebarFooter,
  type TopologySidebarProps,
} from "./components/topology-sidebar.js";

export {
  TopologyTreeView,
  type TopologyTreeViewProps,
} from "./components/topology-tree.js";

export {
  TopologyLegend,
  TopologyStatusLegend,
  TopologyLinkLegend,
  STATUS_DOT,
  STATUS_LABELS,
  type TopologyLegendProps,
  type TopologyStatusLegendProps,
  type TopologyLinkLegendProps,
} from "./components/topology-legend.js";

export { TopologyCanvas, TopologyViewport } from "./components/topology-canvas.js";

export {
  TopologyControls,
  TopologyMinimap,
} from "./components/topology-controls.js";

export { TopologyInspector } from "./components/topology-inspector.js";

export {
  TopologySearch,
  type TopologySearchProps,
} from "./components/topology-search.js";

export {
  TopologyShell,
  type TopologyShellProps,
} from "./components/topology-shell.js";
