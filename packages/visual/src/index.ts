/**
 * @marrow/visual — the VISUAL LANGUAGE of Marrow: how Scene geometry is
 * painted. Symbols, px widths and dashes, status colours and draw order,
 * chip/LED proportions and the theme tokens behind them live here once.
 * Both tiers consume it: render-svg (hero tier) translates `resolveScene`
 * into markup styled by `visualCss()`; the runtime canvas engine (scale tier)
 * turns the same paint into draw calls. Its only runtime dependency is the
 * dependency-free @marrow/model (tier and status order); types from @marrow/scene.
 */
export {
  DEFAULT_THEMES,
  readTheme,
  themeVars,
  type LinkTokens,
  type PaletteTokens,
  type StatusTokens,
  type Theme,
} from './tokens.js';
export type { LinkFields, LinkGlyph, LinkPattern } from './spec.js';
export { encapLabel, protocolLabel } from './spec.js';
export { edgeClasses, linkPresentation, linkSemanticsWords, type LinkPresentation } from './link.js';
export type { Stroke } from './rules.js';
export {
  interactEdge,
  interactNode,
  resolveScene,
  type EdgePaint,
  type Interaction,
  type NodePaint,
  type Pill,
  type VisualScene,
} from './resolve.js';
export { visualCss } from './css.js';
export { cssSafe, escapeHtml } from './escape.js';
export { STAGE_ATTR, STAGE_HOOKS } from './hooks.js';
