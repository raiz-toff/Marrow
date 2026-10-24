// Marrow UI Component Suite (React / Next.js / shadcn TSX)
// Exclusively the two production-ready components: Marrow Diagram Embed and Cable & Link Badge

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
  MarrowEmbed,
  MarrowDiagram,
  TopologyCanvas,
  TopologyStage,
  TopologyViewport,
  type MarrowEmbedProps,
  type MarrowEmbedPreset,
  type TopologyStageProps,
} from "./components/topology-canvas.js";

export {
  CableBadge,
  type CableBadgeProps,
} from "./components/cable-badge.js";
