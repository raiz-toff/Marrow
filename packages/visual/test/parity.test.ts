/**
 * Parity: the generated stylesheet (hero tier) and the imperative fold (scale
 * tier) must paint every edge identically. A tiny cascade evaluator runs the
 * real `visualCss()` + `themeVars()` and is compared, combination by
 * combination, with `interactEdge(resolveScene(...))`.
 */
import { describe, expect, test } from 'vitest';
import type { Scene, SceneEdge } from '@marrow/scene';
import { DEFAULT_THEMES, interactEdge, resolveScene, themeVars, visualCss, type Theme } from '@marrow/visual';

interface CssRule {
  selector: string;
  decls: Array<[string, string]>;
  order: number;
}

/** Top-level style rules only; @media / @keyframes blocks are skipped. */
function parseCss(css: string): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  let i = 0;
  let order = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1) break;
    const head = src.slice(i, open).trim();
    if (head.startsWith('@')) {
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      i = j;
      continue;
    }
    const close = src.indexOf('}', open);
    const body = src.slice(open + 1, close);
    const decls = body
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const k = d.indexOf(':');
        return [d.slice(0, k).trim(), d.slice(k + 1).trim()] as [string, string];
      });
    for (const sel of head.split(',')) rules.push({ selector: sel.trim(), decls, order: order++ });
    i = close + 1;
  }
  return rules;
}

const CONTEXT: Record<string, string> = {
  ':where(:root[data-zoom="far"])': 'far',
  '.focus-mode': 'dimmed',
  ':root[data-motion="off"]': 'motionOff',
};

function specificity(sel: string): number {
  return (sel.replace(/:where\([^)]*\)/g, '').match(/\.[\w-]+|\[[^\]]*\]|:(?!not\()[\w-]+/g) ?? []).length;
}

/** Does `selector` match an `.m-edge` element with `classes` under `ctx`? */
function matches(selector: string, classes: Set<string>, ctx: Set<string>): boolean {
  if (/[+>~]/.test(selector)) return false;
  const parts = selector.split(/\s+/);
  const subject = parts.pop()!;
  for (const anc of parts) {
    const c = CONTEXT[anc];
    if (c === undefined || !ctx.has(c)) return false;
  }
  const m = /^((?:\.[\w-]+)+)((?::not\(\.[\w-]+\))*)$/.exec(subject);
  if (!m) return false;
  const need = m[1]!.split('.').filter(Boolean);
  if (!need.includes('m-edge')) return false;
  if (!need.every((c) => classes.has(c))) return false;
  const not = [...m[2]!.matchAll(/:not\(\.([\w-]+)\)/g)].map((x) => x[1]!);
  return !not.some((c) => classes.has(c));
}

function cascade(rules: CssRule[], classes: Set<string>, ctx: Set<string>): Map<string, string> {
  const won = new Map<string, { spec: number; order: number; value: string }>();
  for (const r of rules) {
    if (!matches(r.selector, classes, ctx)) continue;
    const spec = specificity(r.selector);
    for (const [k, v] of r.decls) {
      const prev = won.get(k);
      if (!prev || spec > prev.spec || (spec === prev.spec && r.order > prev.order)) won.set(k, { spec, order: r.order, value: v });
    }
  }
  return new Map([...won].map(([k, v]) => [k, v.value]));
}

/** A theme whose every colour, width and dash is distinct, so a wrong var can't hide. */
function distinctTheme(): Theme {
  const d = DEFAULT_THEMES.dark;
  let n = 0;
  const hex = (): string => `#0000${(++n).toString(16).padStart(2, '0')}`;
  const palette = Object.fromEntries(Object.keys(d.palette).map((k) => [k, hex()])) as unknown as Theme['palette'];
  const status = Object.fromEntries(Object.keys(d.status).map((k) => [k, hex()])) as unknown as Theme['status'];
  return {
    palette,
    status,
    links: {
      widthDefault: 1.1,
      width10g: 2.2,
      width40g: 3.3,
      widthTrunk: 4.4,
      widthSlot: 1.6,
      widthStack: 5.5,
      dashTunnel: [9, 6],
      dashPeering: [1.5, 5],
      dashDegraded: [14, 7],
      dashPlanned: [2, 7.5],
      dashFlow: [8, 6.5],
    },
  };
}

const varName = (v: string | undefined): string | undefined => /^var\((--[\w-]+)\)$/.exec(v ?? '')?.[1];
const dashOf = (v: string | undefined, vars: Map<string, string>): number[] => {
  if (v === undefined || v === 'none') return [];
  const name = varName(v);
  const raw = name ? vars.get(name)! : v;
  return raw.split(/\s+/).map(Number);
};

describe('CSS cascade ≡ imperative fold', () => {
  const theme = distinctTheme();
  const vars = new Map(themeVars(theme));
  const rules = parseCss(visualCss());

  const statuses = ['up', 'unknown', 'planned', 'degraded', 'down', 'weird'];
  const speeds = [undefined, '1G', '10G', '25g', '40G', '100G', '400G'];
  const modes: Array<Partial<SceneEdge>> = [
    {},
    { mode: 'access' },
    { mode: 'trunk' },
    { mode: 'routed' },
    { mode: 'tunnel' },
    { mode: 'peering' },
    { mode: 'stack' },
    { mode: 'weird' },
    { encap: 'ipsec' },
  ];
  const states = [{}, { path: true }, { selected: true }, { dimmed: true }, { far: true }, { far: true, dimmed: true }];

  test('every status × speed × mode × flow × state × motion combination agrees', () => {
    let checked = 0;
    for (const status of statuses)
      for (const speed of speeds)
        for (const mode of modes)
          for (const animated of [false, true])
            for (const leaf of [false, true]) {
              const e: SceneEdge = {
                id: 'e',
                from: { node: 'a' },
                to: { node: 'b' },
                points: [
                  { x: 0, y: 0 },
                  { x: 50, y: 0 },
                ],
                status,
                animated,
                ...(speed !== undefined ? { speed } : {}),
                ...mode,
              };
              const scene: Scene = {
                size: { w: 100, h: 100 },
                nodes: [
                  { id: 'a', chip: { x: 0, y: 0, w: 1, h: 1 }, labelBox: { x: 0, y: 0, w: 1, h: 1 }, box: { x: 0, y: 0, w: 1, h: 1 }, label: 'a', icon: 'x', status: 'up', hero: false, ...(leaf ? { tier: 'endpoint' } : {}) },
                ],
                edges: [e],
                zones: [],
              };
              const p = resolveScene(scene, theme).edges[0]!;
              for (const s of states) {
                const stroke = interactEdge(p, s, theme);
                const classes = new Set(p.classes.split(' '));
                if ('path' in s) classes.add('is-path');
                if ('selected' in s) classes.add('is-selected');
                for (const motionOff of [false, true]) {
                  const ctx = new Set<string>();
                  if ('far' in s) ctx.add('far');
                  if ('dimmed' in s) ctx.add('dimmed');
                  if (motionOff) ctx.add('motionOff');
                  const css = cascade(rules, classes, ctx);
                  const label = `${p.classes} ${JSON.stringify(s)} motionOff=${motionOff}`;
                  expect(vars.get(varName(css.get('stroke'))!), label).toBe(stroke.color);
                  expect(parseFloat(vars.get(varName(css.get('stroke-width'))!)!), label).toBe(stroke.width);
                  expect(Number(css.get('opacity')), label).toBe(stroke.opacity);
                  expect(css.get('stroke-linecap') ?? 'butt', label).toBe(stroke.cap);
                  const animating = !motionOff && p.flow !== undefined;
                  expect(dashOf(css.get('stroke-dasharray'), vars), label).toEqual([
                    ...(animating ? p.flow!.dash : stroke.dash),
                  ]);
                  expect((css.get('animation') ?? 'none').startsWith('mFlow'), label).toBe(animating);
                  checked++;
                }
              }
            }
    expect(checked).toBe(statuses.length * speeds.length * modes.length * 2 * 2 * states.length * 2);
  });
});

describe('visualCss closure (ADR-0013)', () => {
  const css = visualCss();

  test('no colour literals', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch)\(/);
  });

  test('every var(--x) it references is emitted by themeVars (or is per-element geometry)', () => {
    const emitted = new Set(themeVars(DEFAULT_THEMES.dark).map(([k]) => k));
    const geometry = new Set(['--len']);
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!));
    const missing = [...used].filter((v) => !emitted.has(v) && !geometry.has(v));
    expect(missing).toEqual([]);
  });

  test('px dashes: no pathLength-normalised units survive', () => {
    expect(css).not.toContain('pathLength');
    for (const [, v] of themeVars(DEFAULT_THEMES.dark).filter(([k]) => k.startsWith('--dash-'))) {
      expect(v.split(' ').map(Number).some((n) => n >= 1)).toBe(true);
    }
  });
});
