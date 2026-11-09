import { describe, expect, test } from 'vitest';
import type { Scene, SceneEdge, SceneNode } from '@marrow/scene';
import {
  DEFAULT_THEMES,
  edgeClasses,
  interactEdge,
  interactNode,
  linkSemanticsWords,
  readTheme,
  resolveScene,
  themeVars,
  type Theme,
} from '@marrow/visual';

const node = (id: string, x: number, w = 64, extra: Partial<SceneNode> = {}): SceneNode => ({
  id,
  chip: { x, y: 20, w, h: w },
  labelBox: { x, y: 20 + w + 6, w, h: 17 },
  box: { x, y: 20, w, h: w + 23 },
  label: id,
  icon: 'generic/x',
  status: 'up',
  hero: false,
  ...extra,
});

const edge = (id: string, extra: Partial<SceneEdge> = {}): SceneEdge => ({
  id,
  from: { node: 'a' },
  to: { node: 'b' },
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 60 },
    { x: 200, y: 60 },
  ],
  status: 'up',
  animated: false,
  ...extra,
});

const scene = (edges: SceneEdge[], nodes: SceneNode[] = [node('a', 0), node('b', 300)]): Scene => ({
  size: { w: 600, h: 400 },
  nodes,
  edges,
  zones: [],
});

describe('chip proportions', () => {
  test('64 px chip: rx 13, inset 8, corner-arc LED r 4.2', () => {
    const n = resolveScene(scene([], [node('a', 100, 64)])).nodes[0]!;
    expect(n.chip).toEqual({ x: 100, y: 20, w: 64, h: 64, r: 13 });
    expect(n.icon).toEqual({ x: 108, y: 28, w: 48, h: 48 });
    expect(n.led).toMatchObject({ cx: 160.2, cy: 23.8, r: 4.2 });
  });

  test('48 px chip scales the same ratios (rounded)', () => {
    const n = resolveScene(scene([], [node('a', 100, 48)])).nodes[0]!;
    expect(n.chip.r).toBe(10);
    expect(n.icon).toEqual({ x: 106, y: 26, w: 36, h: 36 });
    expect(n.led).toMatchObject({ cx: 145.1, cy: 22.9, r: 3.2 });
  });

  test('badge right cap centres on the bottom-right corner arc', () => {
    const n = resolveScene(scene([], [node('a', 100, 64, { badge: '12' })])).nodes[0]!;
    expect(n.badge).toMatchObject({ w: 26, h: 17, r: 8.5, x: 142.7, y: 71.7, textX: 155.7, textY: 84.2, text: '12' });
  });

  test('LED fill is the status colour; unknown statuses collapse to unknown', () => {
    const t = DEFAULT_THEMES.light;
    const [up, odd] = resolveScene(scene([], [node('a', 0), node('b', 100, 64, { status: 'weird' })]), t).nodes;
    expect(up!.led.fill).toBe(t.status.up);
    expect(odd!.led.fill).toBe(t.status.unknown);
    expect(odd!.classes).toContain('m-status-unknown');
  });
});

describe('draw order', () => {
  test('status rank first (up < unknown < planned < degraded < down), then id by code unit', () => {
    const edges = [
      edge('é', { status: 'up' }),
      edge('b', { status: 'down' }),
      edge('a', { status: 'up' }),
      edge('Z', { status: 'up' }),
      edge('B', { status: 'up' }),
      edge('p', { status: 'planned' }),
      edge('d', { status: 'degraded' }),
      edge('u', { status: 'mystery' }),
    ];
    expect(resolveScene(scene(edges)).edges.map((e) => e.id)).toEqual(['B', 'Z', 'a', 'é', 'u', 'p', 'd', 'b']);
  });
});

describe('path geometry', () => {
  test('8 px fillets as M/L/Q, 2 dp coordinates', () => {
    const p = resolveScene(scene([edge('e')])).edges[0]!;
    expect(p.d).toBe('M0 0 L92 0 Q100 0 100 8 L100 52 Q100 60 108 60 L200 60');
  });

  test('len sits between the polyline minus fillet shortening and the polyline, at 1 dp', () => {
    const p = resolveScene(scene([edge('e')])).edges[0]!;
    const poly = 100 + 60 + 100;
    const shortening = 2 * (2 * 8 - 8 * Math.SQRT2); // two 90° bends: 2r − chord
    expect(p.len).toBeLessThanOrEqual(poly);
    expect(p.len).toBeGreaterThanOrEqual(poly - shortening);
    expect(Math.round(p.len * 10)).toBe(p.len * 10);
  });

  test('straight and degenerate polylines never throw', () => {
    const [two, none] = resolveScene(
      scene([
        edge('a', { points: [{ x: 1.006, y: 2 }, { x: 11, y: 2 }] }),
        edge('b', { points: [] }),
      ]),
    ).edges;
    expect(two!.d).toBe('M1.01 2 L11 2');
    expect(two!.len).toBe(10);
    expect(none!.d).toBe('');
    expect(none!.len).toBe(0);
  });
});

describe('edge paint', () => {
  test('unknown mode/speed → solid at default width', () => {
    const t = DEFAULT_THEMES.dark;
    const p = resolveScene(scene([edge('e', { mode: 'warp', speed: '7T' })])).edges[0]!;
    expect(p.stroke).toEqual({ color: t.palette.edge, width: t.links.widthDefault, dash: [], cap: 'butt', opacity: 0.92 });
  });

  test('speed classes compare case-insensitively', () => {
    const t = DEFAULT_THEMES.dark;
    const [a, b] = resolveScene(scene([edge('a', { speed: '10G' }), edge('b', { speed: '10g' })])).edges;
    expect(a!.stroke.width).toBe(t.links.width10g);
    expect(b!.stroke.width).toBe(t.links.width10g);
  });

  test('status dash beats flow beats mode dash', () => {
    const t = DEFAULT_THEMES.dark;
    const [tunnel, flowTunnel, degradedFlow] = resolveScene(
      scene([
        edge('1', { mode: 'tunnel' }),
        edge('2', { mode: 'tunnel', animated: true }),
        edge('3', { mode: 'tunnel', animated: true, status: 'degraded' }),
      ]),
    ).edges;
    expect(tunnel!.stroke.dash).toEqual(t.links.dashTunnel);
    expect(tunnel!.flow).toBeUndefined();
    expect(flowTunnel!.flow).toEqual({ dash: t.links.dashFlow, period: 14, seconds: 1.1 });
    expect(flowTunnel!.stroke.dash).toEqual(t.links.dashTunnel); // resting dash when motion is off
    expect(degradedFlow!.stroke.dash).toEqual(t.links.dashDegraded);
    expect(degradedFlow!.flow).toBeUndefined();
  });

  test('trunk carries a bg rail; peering is .82 opaque', () => {
    const t = DEFAULT_THEMES.dark;
    const [trunk, peer] = resolveScene(scene([edge('1', { mode: 'trunk' }), edge('2', { mode: 'peering' })])).edges;
    expect(trunk!.rail).toEqual({ color: t.palette.bg, width: t.links.widthSlot, dash: [], cap: 'butt', opacity: 0.92 });
    expect(peer!.stroke.opacity).toBe(0.82);
  });

  test('label and chip pills share one width estimate and stack 16 px apart', () => {
    const p = resolveScene(scene([edge('e', { label: '×4', mode: 'tunnel', encap: 'ipsec' })])).edges[0]!;
    expect(p.label).toMatchObject({ w: 28, h: 18, r: 9, text: '×4' });
    expect(p.chip).toMatchObject({ h: 16, r: 8, text: 'IPsec', glyph: 'lock' });
    expect(p.chip!.y - p.label!.y).toBe(16 + 9 - 8);
    expect(p.chip!.w).toBeCloseTo(14 + 12 + 5 * 6.3, 2);
  });

  test('interaction: path → accent at full opacity; dimmed and far leaf fade', () => {
    const t = DEFAULT_THEMES.dark;
    const leafScene = scene([edge('e', { status: 'down' })], [node('a', 0, 64, { tier: 'endpoint' }), node('b', 300)]);
    const p = resolveScene(leafScene).edges[0]!;
    expect(p.classes).toBe('m-edge m-status-down m-leaf');
    expect(interactEdge(p, {}, t).color).toBe(t.status.down);
    expect(interactEdge(p, { path: true }, t)).toMatchObject({ color: t.palette.accent, opacity: 1 });
    expect(interactEdge(p, { dimmed: true }, t).opacity).toBe(0.08);
    expect(interactEdge(p, { far: true }, t).opacity).toBe(0.18);
    expect(interactEdge(p, { far: true, dimmed: true }, t).opacity).toBe(0.08);
    expect(interactEdge(p, { far: true, path: true }, t).opacity).toBe(1);
  });

  test('node ring: hero/selected use --ring; ghosts dash; dimmed fades', () => {
    const t = DEFAULT_THEMES.dark;
    const [hero, ghost] = resolveScene(scene([], [node('a', 0, 64, { hero: true }), node('b', 100, 64, { ghost: true })])).nodes;
    expect(hero!.ring).toMatchObject({ color: t.palette.ring, width: 1.5 });
    expect(interactNode(hero!, { selected: true }, t)).toMatchObject({ color: t.palette.ring, width: 2 });
    expect(interactNode(ghost!, {}, t)).toMatchObject({ color: t.palette.chipLine, dash: [4, 3], opacity: 0.55 });
    expect(interactNode(ghost!, { focused: true, dimmed: true }, t)).toMatchObject({ color: t.palette.inkDim, opacity: 0.15 });
  });
});

describe('determinism', () => {
  const rng = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const shuffle = <T>(xs: T[], r: () => number): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };

  test('shuffled edge arrays resolve byte-identically; nodes keep scene order', () => {
    const statuses = ['up', 'down', 'degraded', 'planned', 'unknown', 'x'];
    const modes = [undefined, 'trunk', 'tunnel', 'peering', 'stack', 'access', 'routed'];
    const edges = Array.from({ length: 40 }, (_, i) =>
      edge(`e${(i * 7) % 40}`, {
        status: statuses[i % statuses.length]!,
        mode: modes[i % modes.length],
        speed: i % 3 === 0 ? '10G' : undefined,
        animated: i % 4 === 0,
        label: i % 5 === 0 ? `×${i}` : undefined,
        points: [
          { x: i, y: 0 },
          { x: i + 50.123, y: 0 },
          { x: i + 50.123, y: 33.333 },
        ],
      }),
    );
    const nodes = [node('a', 0, 64, { tier: 'core' }), node('b', 300, 48, { tier: 'access', badge: '3' })];
    const ref = JSON.stringify(resolveScene(scene(edges, nodes)));
    const r = rng(42);
    for (let k = 0; k < 5; k++) {
      expect(JSON.stringify(resolveScene(scene(shuffle(edges, r), nodes)))).toBe(ref);
    }
    expect(resolveScene(scene(edges, nodes)).nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('themes', () => {
  test('readTheme(themeVars(t)) round-trips dark and light', () => {
    for (const scheme of ['dark', 'light'] as const) {
      const t = DEFAULT_THEMES[scheme];
      const vars = new Map(themeVars(t));
      expect(readTheme((v) => vars.get(v), scheme)).toEqual(t);
    }
  });

  test('a customised theme round-trips too', () => {
    const t: Theme = {
      palette: { ...DEFAULT_THEMES.dark.palette, bg: 'oklch(0.2 0 0)', edge: '#123456' },
      status: { ...DEFAULT_THEMES.dark.status, down: 'rgb(200 0 0)' },
      links: { ...DEFAULT_THEMES.dark.links, width10g: 3.25, dashTunnel: [10, 4, 2, 4] },
    };
    const vars = new Map(themeVars(t));
    expect(readTheme((v) => vars.get(v), 'dark')).toEqual(t);
  });

  test('a throwing getter never throws', () => {
    expect(
      readTheme(() => {
        throw new Error('no DOM');
      }, 'dark'),
    ).toEqual(DEFAULT_THEMES.dark);
  });

  test('every palette and status key owns exactly one CSS variable', () => {
    const base = DEFAULT_THEMES.dark;
    const before = new Map(themeVars(base));
    const owners = new Map<string, string>();
    for (const group of ['palette', 'status'] as const) {
      for (const key of Object.keys(base[group])) {
        const t = { ...base, [group]: { ...base[group], [key]: '#0a1b2c' } } as Theme;
        const changed = themeVars(t).filter(([k, v]) => before.get(k) !== v);
        expect(changed, `${group}.${key}`).toHaveLength(1);
        const cssVar = changed[0]![0];
        expect(owners.has(cssVar), `${cssVar} shared by ${owners.get(cssVar)} and ${key}`).toBe(false);
        owners.set(cssVar, key);
      }
    }
    expect(owners.size).toBe(Object.keys(base.palette).length + Object.keys(base.status).length);
  });

  test('themeVars emits px units and derived flow vars', () => {
    const vars = new Map(themeVars(DEFAULT_THEMES.dark));
    expect(vars.get('--edge-width-10g')).toBe('3px');
    expect(vars.get('--dash-tunnel')).toBe('9 6');
    expect(vars.get('--dash-flow')).toBe('8 6');
    expect(vars.get('--flow-period')).toBe('14px');
  });
});

describe('link helpers', () => {
  test('edgeClasses derives the tunnel mode from encap and lower-cases speed', () => {
    expect(edgeClasses({ status: 'down', speed: '10G', encap: 'gre', animated: true })).toBe(
      'm-edge m-status-down m-speed-10g m-mode-tunnel m-flow',
    );
  });

  test('linkSemanticsWords', () => {
    expect(linkSemanticsWords({ mode: 'trunk', vlans: '10,20', nativeVlan: 99, lag: 'po1', lacp: 'active' })).toEqual([
      'trunk 10,20',
      'native 99',
      'po1 · LACP active',
    ]);
    expect(linkSemanticsWords({ encap: 'ipsec' })).toEqual(['IPsec tunnel']);
    expect(linkSemanticsWords({ mode: 'routed', protocol: 'ospf' })).toEqual(['routed · OSPF']);
  });
});
