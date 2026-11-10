/**
 * The paint rule list: the per-dimension tables compiled into ONE ordered list
 * (base → speed → mode → flow → status → path/selection → far/dimmed). It has
 * two interpreters — `foldEdge` (imperative renderers) and `edgeCss` (the
 * class-driven stylesheet) — so the canvas and the CSS cascade read the same
 * precedence and cannot disagree.
 *
 * Every class rule is `.m-edge.<one class>` (equal specificity), so source
 * order IS precedence, exactly like the fold. State rules carry an ancestor
 * context and a `:not()` guard; they sit last and outrank every class rule.
 */
import { EDGE_OPACITY, MODES, NO_DASH, SPEEDS, STATUSES, type Cap, type Decl } from './spec.js';
import { dashPeriod, tokenValue, type Theme } from './tokens.js';

export type Ctx = 'far' | 'dimmed';

interface Rule {
  /** Class the edge must carry (absent = base rule). */
  readonly cls?: string;
  /** Classes the edge must NOT carry. */
  readonly not?: readonly string[];
  /** Ancestor state the rule needs. */
  readonly ctx?: Ctx;
  readonly set: Decl;
}

const STATE_GUARD = ['is-path', 'is-selected'] as const;

const EDGE_RULES: readonly Rule[] = [
  {
    set: {
      color: '--edge',
      width: '--edge-width-default',
      dash: NO_DASH,
      cap: 'butt',
      opacity: EDGE_OPACITY.base,
      flow: false,
    },
  },
  ...SPEEDS.flatMap((s) => s.ids.map((id): Rule => ({ cls: `m-speed-${id}`, set: { width: s.width } }))),
  ...MODES.filter((m) => m.edge !== undefined).map((m): Rule => ({ cls: `m-mode-${m.id}`, set: m.edge! })),
  // traffic reads as accent; status colours below still win
  { cls: 'm-flow', set: { color: '--m-accent', flow: true } },
  ...STATUSES.filter((s) => s.edge !== undefined).map((s): Rule => ({ cls: `m-status-${s.id}`, set: s.edge! })),
  { cls: 'is-path', set: { color: '--m-accent', opacity: EDGE_OPACITY.path } },
  { cls: 'is-selected', set: { color: '--m-accent', opacity: EDGE_OPACITY.path } },
  { cls: 'm-leaf', not: STATE_GUARD, ctx: 'far', set: { opacity: EDGE_OPACITY.far } },
  { not: STATE_GUARD, ctx: 'dimmed', set: { opacity: EDGE_OPACITY.dimmed } },
];

export interface Folded {
  color: string;
  width: string;
  dash: string;
  cap: Cap;
  opacity: number;
  flow: boolean;
}

/** Fold the rule list over an edge's classes and ancestor state. */
export function foldEdge(classes: ReadonlySet<string>, ctx: ReadonlySet<Ctx>): Folded {
  const out: Folded = { color: '--edge', width: '--edge-width-default', dash: NO_DASH, cap: 'butt', opacity: 1, flow: false };
  for (const r of EDGE_RULES) {
    if (r.cls !== undefined && !classes.has(r.cls)) continue;
    if (r.ctx !== undefined && !ctx.has(r.ctx)) continue;
    if (r.not !== undefined && r.not.some((c) => classes.has(c))) continue;
    Object.assign(out, r.set);
  }
  return out;
}

export interface Stroke {
  color: string;
  width: number;
  dash: readonly number[];
  cap: 'butt' | 'round';
  opacity: number;
}

const EMPTY: readonly number[] = Object.freeze([]);

export function strokeOf(f: Folded, t: Theme): Stroke {
  const color = tokenValue(t, f.color);
  const width = tokenValue(t, f.width);
  const dash = f.dash === NO_DASH ? EMPTY : tokenValue(t, f.dash);
  return {
    color: typeof color === 'string' ? color : t.palette.edge,
    width: typeof width === 'number' ? width : t.links.widthDefault,
    dash: Array.isArray(dash) ? dash : EMPTY,
    cap: f.cap,
    opacity: f.opacity,
  };
}

export function flowOf(t: Theme): { dash: readonly number[]; period: number } {
  return { dash: t.links.dashFlow, period: dashPeriod(t.links.dashFlow) };
}

// ─── the CSS interpreter ─────────────────────────────────────────────────────

const CTX_PREFIX: Record<Ctx, string> = {
  // :where() keeps the zoom band at zero weight so focus dimming (same weight,
  // later) wins over it, matching the fold order
  far: ':where(:root[data-zoom="far"]) ',
  dimmed: '.focus-mode ',
};

const v = (name: string): string => `var(${name})`;

function declCss(d: Decl, flowCss: string): string {
  const out: string[] = [];
  if (d.color !== undefined) out.push(`stroke: ${v(d.color)}`);
  if (d.width !== undefined) out.push(`stroke-width: ${v(d.width)}`);
  if (d.dash !== undefined) out.push(`stroke-dasharray: ${d.dash === NO_DASH ? 'none' : v(d.dash)}`);
  if (d.cap !== undefined) out.push(`stroke-linecap: ${d.cap}`);
  if (d.opacity !== undefined) out.push(`opacity: ${d.opacity}`);
  if (d.flow === true) out.push(`stroke-dasharray: ${v('--dash-flow')}`, `animation: ${flowCss}`);
  if (d.flow === false) out.push('animation: none');
  return out.join('; ');
}

function ruleSelector(r: Rule, el = 'm-edge'): string {
  return (
    (r.ctx !== undefined ? CTX_PREFIX[r.ctx] : '') +
    `.${el}` +
    (r.cls !== undefined ? `.${r.cls}` : '') +
    (r.not ?? []).map((c) => `:not(.${c})`).join('')
  );
}

/**
 * The edge rules as CSS, plus the motion-off restatement: with motion off a
 * flowing edge drops its flow dash and falls back to whatever the non-flow
 * rules give it (mode dash, status dash) — generated from the same list.
 */
export function edgeCss(flowCss: string, base: string): string {
  const lines: string[] = [];
  for (const r of EDGE_RULES) {
    const extra = r.cls === undefined && r.ctx === undefined ? base + '; ' : '';
    lines.push(`${ruleSelector(r)} { ${extra}${declCss(r.set, flowCss)}; }`);
  }
  return lines.join('\n');
}

export function motionOffCss(prefix: string): string {
  const baseDash = EDGE_RULES[0]!.set.dash ?? NO_DASH;
  const lines = [`${prefix}.m-edge.m-flow { animation: none; stroke-dasharray: ${baseDash === NO_DASH ? 'none' : v(baseDash)}; }`];
  for (const r of EDGE_RULES) {
    if (r.cls === undefined || r.cls === 'm-flow' || r.ctx !== undefined || r.set.dash === undefined) continue;
    lines.push(`${prefix}.m-edge.m-flow.${r.cls} { stroke-dasharray: ${r.set.dash === NO_DASH ? 'none' : v(r.set.dash)}; }`);
  }
  return lines.join('\n');
}
