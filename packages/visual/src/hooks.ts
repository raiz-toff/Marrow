/**
 * Stage hooks — the selectors the runtime binds to inside a rendered diagram.
 *
 * The diagram's classes are part of the visual language (`resolveScene` and
 * `edgeClasses` spell `m-node` / `m-edge`; render-svg prints the rest), so the
 * selectors that find them live here too. The page contract
 * (`@marrow/runtime` `page-contract.ts`) re-exports them beside the chrome
 * hooks.
 *
 * Port chips carry `data-edge` AND `data-node`, so anything that maps ids to
 * the node groups or edge paths themselves must use the class-qualified
 * `node` / `edge` selectors, never the bare attribute ones.
 */
export const STAGE_HOOKS = {
  /** The hero-tier diagram root (`data-w` / `data-h` carry the scene size). */
  svg: '.m-svg',
  /** The scale-tier drawing surface. */
  canvas: '.m-canvas',
  /** The hidden icon sprite on scale-tier pages. */
  sprite: 'svg.m-sprite',
  /** The group the camera transforms. */
  camera: '.m-camera',
  /** A device node group — class-qualified so port chips never match. */
  node: '.m-node[data-node]',
  /** A link path — class-qualified so chips, rails and hit areas never match. */
  edge: '.m-edge[data-edge]',
  /** Anything bound to a node id: node groups and port chips. */
  nodeBound: '[data-node]',
  /** Anything bound to an edge id: paths, rails, hit areas, labels, chips. */
  edgeBound: '[data-edge]',
  /** A port chip (also edge- and node-bound). */
  portChip: '.m-portlabel',
  /** A zone group and its panel rect. */
  zone: '.m-zone[data-zone]',
  zonePanel: '.m-zone-panel',
} as const;

/** The data attributes stage elements carry, as dataset keys → attribute names. */
export const STAGE_ATTR = {
  node: 'data-node',
  edge: 'data-edge',
  href: 'data-href',
  w: 'data-w',
  h: 'data-h',
  from: 'data-from',
  to: 'data-to',
  meta: 'data-meta',
} as const;
