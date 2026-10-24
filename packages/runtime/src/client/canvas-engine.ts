import type { CameraState } from './camera.js';
import { linkDisplay } from './link.js';

/**
 * The scale-tier renderer: immediate-mode Canvas 2D over the SAME scene the
 * SVG renderer draws — including the routed orthogonal polylines (the reason
 * this exists instead of a straight-edge WebGL graph library). Viewport
 * culling + rAF batching keep 60fps to well past the 1,200-element page cap.
 */

export interface CScene {
  size: { w: number; h: number };
  nodes: Array<{
    id: string;
    chip: { x: number; y: number; w: number; h: number };
    labelBox: { x: number; y: number; w: number; h: number };
    box: { x: number; y: number; w: number; h: number };
    label: string;
    icon: string;
    status: string;
    hero: boolean;
    ghost?: boolean;
    href?: string;
    badge?: string;
    accent?: string;
    tier?: string;
    labelSize?: number;
  }>;
  edges: Array<{
    id: string;
    from: { node: string; port?: string };
    to: { node: string; port?: string };
    points: Array<{ x: number; y: number }>;
    status: string;
    animated: boolean;
    speed?: string;
    kind?: string;
    mode?: string;
    vlans?: string;
    nativeVlan?: number;
    encap?: string;
    protocol?: string;
    lacp?: string;
    label?: string;
  }>;
  zones: Array<{ id: string; name: string; box: { x: number; y: number; w: number; h: number }; depth: number; accent?: string }>;
  portChips?: Array<{
    box: { x: number; y: number; w: number; h: number };
    label: string;
    node: string;
    edge?: string;
    summary?: boolean;
  }>;
}

interface FocusState {
  focus: string;
  adjacent: Set<string>;
  edges: Set<string>;
}

interface ThemeColors {
  up: string;
  down: string;
  degraded: string;
  planned: string;
  unknown: string;
  edge: string;
  accent: string;
  accentInk: string;
  chip: string;
  chipLine: string;
  ink: string;
  inkDim: string;
  bg: string;
  zone: string;
  bgRaise: string;
  line: string;
  edgeWidthDefault: number;
  edgeWidth10g: number;
  edgeWidth40g: number;
  edgeWidthTrunk: number;
  edgeWidthSlot: number;
  edgeWidthStack: number;
  dashDegraded: number[];
  dashPlanned: number[];
}

function statusColor(c: ThemeColors, status: string): string {
  switch (status) {
    case 'up':
      return c.up;
    case 'down':
      return c.down;
    case 'degraded':
      return c.degraded;
    case 'planned':
      return c.planned;
    default:
      return c.unknown;
  }
}

export function parsePx(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = /^([\d.]+)px$/i.exec(value.trim());
  if (match && match[1]) {
    const n = parseFloat(match[1]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  const n = parseFloat(value.trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseDash(value: string | undefined, fallback: number[]): number[] {
  if (!value) return fallback;
  const parts = value.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  return parts.length >= 2 ? parts : fallback;
}

function themeColors(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string): string => cs.getPropertyValue(name).trim() || fallback;
  const n = (name: string, fallback: number): number => parsePx(cs.getPropertyValue(name), fallback);
  const d = (name: string, fallback: number[]): number[] => parseDash(cs.getPropertyValue(name), fallback);
  return {
    up: v('--up', '#22c55e'),
    down: v('--down', '#ef4444'),
    degraded: v('--degraded', '#f59e0b'),
    planned: v('--planned', '#71717a'),
    unknown: v('--unknown', '#71717a'),
    edge: v('--edge', '#d4d4d8'),
    accent: v('--m-accent', '#3b82f6'),
    accentInk: v('--m-accent-ink', '#ffffff'),
    chip: v('--chip', '#18181b'),
    chipLine: v('--chip-line', '#3f3f46'),
    ink: v('--ink', '#fafafa'),
    inkDim: v('--ink-dim', '#a1a1aa'),
    bg: v('--bg', '#09090b'),
    zone: v('--zone', '#71717a'),
    bgRaise: v('--bg-raise', '#27272a'),
    line: v('--line', '#27272a'),
    edgeWidthDefault: n('--edge-width-default', 1.5),
    edgeWidth10g: n('--edge-width-10g', 3),
    edgeWidth40g: n('--edge-width-40g', 4.5),
    edgeWidthTrunk: n('--edge-width-trunk', 4.5),
    edgeWidthSlot: n('--edge-width-slot', 1.7),
    edgeWidthStack: n('--edge-width-stack', 5),
    dashDegraded: d('--dash-degraded', [14, 7]),
    dashPlanned: d('--dash-planned', [2, 7]),
  };
}

export class CanvasEngine {
  private readonly ctx2d: CanvasRenderingContext2D;
  private camera: CameraState = { x: 0, y: 0, k: 1 };
  private focus: FocusState | undefined;
  private selected: string | undefined;
  private raf = 0;
  private colors = themeColors();
  private readonly icons = new Map<string, ImageBitmap | HTMLImageElement>();
  /** Measured label widths in the platform's actual font (cache, px @12px). */
  private readonly labelWidths = new Map<string, number>();
  /** Zone titles ellipsized to their panel width (cache, keyed id@fontPx). */
  private readonly zoneTitles = new Map<string, string>();
  private readonly nodeById = new Map<string, CScene['nodes'][number]>();
  private readonly grid = new Map<string, string[]>();
  private static readonly CELL = 160;
  private entranceStart = performance.now();
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stage: HTMLElement,
    readonly scene: CScene,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx2d = ctx;
    for (const n of scene.nodes) {
      this.nodeById.set(n.id, n);
      const c0 = Math.floor(n.box.x / CanvasEngine.CELL);
      const c1 = Math.floor((n.box.x + n.box.w) / CanvasEngine.CELL);
      const r0 = Math.floor(n.box.y / CanvasEngine.CELL);
      const r1 = Math.floor((n.box.y + n.box.h) / CanvasEngine.CELL);
      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          const key = `${c}:${r}`;
          (this.grid.get(key) ?? this.grid.set(key, []).get(key)!).push(n.id);
        }
      }
    }
    this.resize();
    new ResizeObserver(() => {
      this.resize();
      this.requestDraw();
    }).observe(stage);
    void this.loadIcons();
    // theme switches re-read the CSS variables
    new MutationObserver(() => {
      this.colors = themeColors();
      this.requestDraw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (!this.reduced) {
      const tick = (): void => {
        this.requestDraw();
        if (performance.now() - this.entranceStart < 1400) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  private labelMode: 'auto' | 'on' | 'off' = 'auto';
  private portMode: 'auto' | 'on' | 'off' = 'auto';
  private motion = true;
  private searchMatches: Set<string> | undefined;

  setPortMode(mode: 'auto' | 'on' | 'off'): void {
    this.portMode = mode;
    this.requestDraw();
  }

  applyCamera(state: CameraState): void {
    this.camera = state;
    this.requestDraw();
  }

  setLabelMode(mode: 'auto' | 'on' | 'off'): void {
    this.labelMode = mode;
    this.requestDraw();
  }

  setMotion(on: boolean): void {
    this.motion = on;
    this.requestDraw();
  }

  setFocus(focus: FocusState | undefined): void {
    this.focus = focus;
    this.requestDraw();
  }

  setSearchMatches(matches: Set<string> | undefined): void {
    this.searchMatches = matches;
    this.requestDraw();
  }

  setSelected(id: string | undefined): void {
    this.selected = id;
    this.requestDraw();
  }

  nodeBox(id: string): { x: number; y: number; w: number; h: number } | undefined {
    return this.nodeById.get(id)?.box;
  }

  /** World-space hit test via the spatial grid. */
  nodeAt(worldX: number, worldY: number): CScene['nodes'][number] | undefined {
    const key = `${Math.floor(worldX / CanvasEngine.CELL)}:${Math.floor(worldY / CanvasEngine.CELL)}`;
    for (const id of this.grid.get(key) ?? []) {
      const n = this.nodeById.get(id)!;
      if (worldX >= n.box.x && worldX <= n.box.x + n.box.w && worldY >= n.box.y && worldY <= n.box.y + n.box.h) {
        return n;
      }
    }
    return undefined;
  }

  /** Nearest edge within tolerance (for tooltips); linear scan is fine here. */
  edgeAt(worldX: number, worldY: number, tolerance: number): CScene['edges'][number] | undefined {
    let best: CScene['edges'][number] | undefined;
    let bestDist = tolerance;
    for (const e of this.scene.edges) {
      for (let i = 0; i < e.points.length - 1; i++) {
        const d = pointSegmentDistance(worldX, worldY, e.points[i]!, e.points[i + 1]!);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
    }
    return best;
  }

  /** Draw one pre-placed port chip (geometry comes from the scene). */
  private portChip(g: CanvasRenderingContext2D, k: number, c: NonNullable<CScene['portChips']>[number]): void {
    g.font = c.summary ? '700 9px ui-monospace, monospace' : '500 9px ui-monospace, monospace';
    g.fillStyle = this.colors.bgRaise;
    g.strokeStyle = this.colors.line;
    g.lineWidth = 1 / k;
    roundRect(g, c.box.x, c.box.y, c.box.w, c.box.h, 4);
    g.fill();
    g.stroke();
    g.fillStyle = c.summary ? this.colors.ink : this.colors.inkDim;
    g.textAlign = 'center';
    g.fillText(c.label, c.box.x + c.box.w / 2, c.box.y + c.box.h / 2 + 3);
    g.textAlign = 'left';
  }

  /** Ellipsize a zone title to its panel width, measured in the context's
   *  current font/letterSpacing. Codepoint-safe (never strands a surrogate). */
  private zoneTitle(g: CanvasRenderingContext2D, id: string, upper: string, maxW: number, fontPx: number): string {
    const key = `${id}@${Math.round(fontPx)}`;
    const hit = this.zoneTitles.get(key);
    if (hit !== undefined) return hit;
    let out = upper;
    if (g.measureText(upper).width > maxW) {
      const chars = [...upper];
      while (chars.length > 0 && g.measureText(chars.join('') + '…').width > maxW) chars.pop();
      out = chars.join('').trimEnd() + '…';
    }
    this.zoneTitles.set(key, out);
    return out;
  }

  private resize(): void {
    const rect = this.stage.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  private async loadIcons(): Promise<void> {
    const sprite = document.querySelector('svg.m-sprite');
    if (!sprite) return;
    const unique = [...new Set(this.scene.nodes.map((n) => n.icon))];
    await Promise.all(
      unique.map(async (iconId) => {
        const symbol = sprite.querySelector(`#ic-${cssSafe(iconId)}`);
        if (!symbol) return;
        const viewBox = symbol.getAttribute('viewBox') ?? '0 0 100 100';
        const svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="96" height="96">${symbol.innerHTML}</svg>`;
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`icon ${iconId}`));
            img.src = url;
          });
          this.icons.set(iconId, typeof createImageBitmap === 'function' ? await createImageBitmap(img) : img);
        } catch {
          /* fallback initials are drawn instead */
        } finally {
          URL.revokeObjectURL(url);
        }
      }),
    );
    this.requestDraw();
  }

  requestDraw(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  /** Render the ENTIRE scene into a fresh bitmap for export (focus cleared). */
  exportBitmap(maxDim = 2800): HTMLCanvasElement {
    const k = Math.min(maxDim / this.scene.size.w, maxDim / this.scene.size.h, 2);
    const out = document.createElement('canvas');
    out.width = Math.round(this.scene.size.w * k);
    out.height = Math.round(this.scene.size.h * k);
    const savedFocus = this.focus;
    const savedCamera = this.camera;
    const savedCanvas = { c: this.canvasOverride, g: this.ctxOverride, w: this.viewportOverride };
    this.focus = undefined;
    this.camera = { x: 0, y: 0, k };
    this.canvasOverride = out;
    this.ctxOverride = out.getContext('2d')!;
    this.viewportOverride = { w: out.width, h: out.height };
    // export renders on a page background so PNGs aren't transparent
    this.ctxOverride.fillStyle = this.colors.bg;
    this.ctxOverride.fillRect(0, 0, out.width, out.height);
    try {
      this.draw();
    } finally {
      this.focus = savedFocus;
      this.camera = savedCamera;
      this.canvasOverride = savedCanvas.c;
      this.ctxOverride = savedCanvas.g;
      this.viewportOverride = savedCanvas.w;
      this.requestDraw();
    }
    return out;
  }

  private canvasOverride: HTMLCanvasElement | undefined;
  private ctxOverride: CanvasRenderingContext2D | undefined;
  private viewportOverride: { w: number; h: number } | undefined;

  private draw(): void {
    const exporting = this.ctxOverride !== undefined;
    const g = this.ctxOverride ?? this.ctx2d;
    const target = this.canvasOverride ?? this.canvas;
    const dpr = exporting ? 1 : Math.min(devicePixelRatio || 1, 2);
    const { x, y, k } = this.camera;
    const c = this.colors;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!exporting) g.clearRect(0, 0, target.width, target.height);
    g.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);

    // world-space viewport for culling
    const vp = this.viewportOverride ?? (() => {
      const r = this.stage.getBoundingClientRect();
      return { w: r.width, h: r.height };
    })();
    const vx0 = -x / k;
    const vy0 = -y / k;
    const vx1 = vx0 + vp.w / k;
    const vy1 = vy0 + vp.h / k;
    const visible = (b: { x: number; y: number; w: number; h: number }, pad = 24): boolean =>
      b.x + b.w > vx0 - pad && b.x < vx1 + pad && b.y + b.h > vy0 - pad && b.y < vy1 + pad;

    const entrance = this.reduced || exporting ? 1 : Math.min(1, (performance.now() - this.entranceStart) / 900);
    const focusMode = this.focus !== undefined;
    const searchMode = this.searchMatches !== undefined;
    const showLabels = this.labelMode === 'on' ? true : this.labelMode === 'off' ? false : k > 0.5;
    const showPorts = (this.portMode === 'on' && k >= 0.70) ? true : this.portMode === 'off' ? false : k > 1.3;
    const animate = this.motion && !this.reduced && !exporting;
    const flowPhase = (performance.now() / 1100) % 1;

    // zones
    for (const z of this.scene.zones) {
      if (!visible(z.box, 40)) continue;
      const accent = z.accent ?? c.zone;
      g.globalAlpha = ((focusMode || searchMode) ? 0.35 : 1) * entrance;
      g.fillStyle = withAlpha(accent, 0.09);
      g.strokeStyle = withAlpha(accent, 0.42);
      g.lineWidth = 1.2 / k;
      roundRect(g, z.box.x, z.box.y, z.box.w, z.box.h, 16);
      g.fill();
      g.stroke();
    }
    g.globalAlpha = 1;

    // edges — healthy first, alarms last (on top of shared channels); leaf
    // links fade when zoomed far out
    const statusRank: Record<string, number> = { up: 0, unknown: 1, planned: 2, degraded: 3, down: 4 };
    const tierOf = new Map(this.scene.nodes.map((n) => [n.id, n.tier]));
    const drawOrder = [...this.scene.edges].sort(
      (a, b) => (statusRank[a.status] ?? 0) - (statusRank[b.status] ?? 0) || a.id.localeCompare(b.id),
    );
    for (const e of drawOrder) {
      const first = e.points[0]!;
      const bounds = polyBounds(e.points);
      if (!visible(bounds, 8)) continue;
      const inPath = this.focus?.edges.has(e.id) ?? false;
      const leaf = tierOf.get(e.from.node) === 'endpoint' || tierOf.get(e.to.node) === 'endpoint';
      const lod = leaf && k < 0.55 ? 0.22 : 1;
      g.globalAlpha = (focusMode && !inPath ? 0.08 : searchMode ? 0.08 : 0.92) * entrance * lod;
      g.strokeStyle = inPath
        ? c.accent
        : e.status === 'down'
          ? c.down
          : e.status === 'degraded'
            ? c.degraded
            : e.status === 'planned'
              ? c.planned
              : e.animated
                ? c.accent
                : c.edge;
      // logical function → symbol (mirror of @marrow/scene linkPresentation)
      const disp = linkDisplay(e);
      let lw =
        e.speed === '40G' || e.speed === '100G' || e.speed === '400G'
          ? c.edgeWidth40g
          : e.speed === '10G' || e.speed === '25G'
            ? c.edgeWidth10g
            : c.edgeWidthDefault;
      if (disp.pattern === 'thick') lw = Math.max(lw, c.edgeWidthStack);
      else if (disp.pattern === 'double') lw = Math.max(lw, c.edgeWidthTrunk);
      g.lineWidth = lw / Math.sqrt(k);
      // status dash > flow > mode dash (tunnel/peering); mode never overrides an alarm
      const modeDash = disp.pattern === 'dashed' ? [9, 6] : disp.pattern === 'dotted' ? [1.5, 5] : [];
      g.setLineDash(
        e.status === 'degraded'
          ? c.dashDegraded
          : e.status === 'planned'
            ? c.dashPlanned
            : e.animated && animate
              ? [8, 6]
              : modeDash,
      );
      if (e.animated && animate) g.lineDashOffset = -flowPhase * 14;
      g.lineJoin = 'round';
      g.lineCap = e.status === 'planned' || disp.pattern === 'dotted' || disp.pattern === 'thick' ? 'round' : 'butt';
      // bends are filleted at the chrome's --radius (8), matching the SVG tier
      const traceEdge = (): void => {
        g.beginPath();
        g.moveTo(first.x, first.y);
        for (let i = 1; i < e.points.length - 1; i++) {
          const p = e.points[i]!;
          const next = e.points[i + 1]!;
          const prev = e.points[i - 1]!;
          const r = Math.min(8, Math.hypot(p.x - prev.x, p.y - prev.y) / 2, Math.hypot(next.x - p.x, next.y - p.y) / 2);
          if (r > 0.5) g.arcTo(p.x, p.y, next.x, next.y, r);
          else g.lineTo(p.x, p.y);
        }
        if (e.points.length > 1) {
          const last = e.points[e.points.length - 1]!;
          g.lineTo(last.x, last.y);
        }
      };
      traceEdge();
      g.stroke();
      // trunk = double rail: carve a thin bg-coloured slot down the casing
      if (disp.pattern === 'double') {
        g.setLineDash([]);
        g.strokeStyle = c.bg;
        g.lineWidth = 1.7 / Math.sqrt(k);
        traceEdge();
        g.stroke();
      }
      g.setLineDash([]);
      g.lineDashOffset = 0;
      if (e.label && showLabels) {
        const mid = polyMidpoint(e.points);
        g.font = `600 11px system-ui, sans-serif`;
        const w = g.measureText(e.label).width + 12;
        g.fillStyle = c.bgRaise;
        g.strokeStyle = c.line;
        g.lineWidth = 1 / k;
        roundRect(g, mid.x - w / 2, mid.y - 9, w, 18, 9);
        g.fill();
        g.stroke();
        g.fillStyle = c.inkDim;
        g.textAlign = 'center';
        g.fillText(e.label, mid.x, mid.y + 4);
        g.textAlign = 'left';
      }
      // semantic chip (VLANs / encap / protocol / lag) — glyphs are dropped at
      // this tier (illegible at scale); the text carries the meaning
      if (disp.chip && showLabels) {
        const mid = polyMidpoint(e.points);
        const cy = mid.y + (e.label ? 17 : 0);
        g.font = `600 10.5px system-ui, sans-serif`;
        const w = g.measureText(disp.chip).width + 14;
        g.fillStyle = c.bg;
        g.strokeStyle = c.line;
        g.lineWidth = 1 / k;
        roundRect(g, mid.x - w / 2, cy - 8, w, 16, 8);
        g.fill();
        g.stroke();
        g.fillStyle = c.ink;
        g.textAlign = 'center';
        g.fillText(disp.chip, mid.x, cy + 3.4);
        g.textAlign = 'left';
      }
    }
    g.globalAlpha = 1;

    // zone titles — drawn above edges so a crossing link is knocked out by
    // the bg halo instead of slicing through the letters
    for (const z of this.scene.zones) {
      if (!visible(z.box, 40)) continue;
      if (!showLabels && z.depth !== 0) continue;
      g.globalAlpha = (focusMode ? 0.35 : 1) * entrance;
      const fontPx = 12 / Math.max(k, 0.35);
      g.font = `650 ${fontPx}px system-ui, sans-serif`;
      const track = g as CanvasRenderingContext2D & { letterSpacing?: string };
      if ('letterSpacing' in g) track.letterSpacing = `${fontPx * 0.1}px`;
      const title = this.zoneTitle(g, z.id, z.name.toUpperCase(), z.box.w - 28, fontPx);
      const tx = z.box.x + 14;
      const ty = z.box.y + 22 / Math.max(k, 0.6);
      g.strokeStyle = c.bg;
      g.lineWidth = 3.5 * (fontPx / 12);
      g.lineJoin = 'round';
      g.strokeText(title, tx, ty);
      g.fillStyle = z.accent ?? c.zone;
      g.fillText(title, tx, ty);
      if ('letterSpacing' in g) track.letterSpacing = '0px';
    }
    g.globalAlpha = 1;

    // port chips — pre-placed collision-free by layout. In focus mode only
    // the focused device's chips show (that's when you read port numbers);
    // otherwise the ports toggle / zoom gate applies to all of them.
    for (const pc of this.scene.portChips ?? []) {
      if (!visible(pc.box, 8)) continue;
      const inPath =
        pc.edge !== undefined
          ? (this.focus?.edges.has(pc.edge) ?? false)
          : this.focus !== undefined && (this.focus.focus === pc.node || this.focus.adjacent.has(pc.node));
      if (focusMode ? !inPath : !showPorts) continue;
      g.globalAlpha = entrance;
      this.portChip(g, k, pc);
    }
    g.globalAlpha = 1;

    // nodes
    for (const n of this.scene.nodes) {
      if (!visible(n.box)) continue;
      const isFocus = this.focus?.focus === n.id;
      const isAdj = this.focus?.adjacent.has(n.id) ?? false;
      const isSel = this.selected === n.id;
      const isSearchMatch = this.searchMatches?.has(n.id) ?? false;
      const dimmed = (focusMode && !isFocus && !isAdj && !isSel) || (searchMode && !isSearchMatch);
      g.globalAlpha = (dimmed ? 0.15 : n.ghost ? 0.55 : 1) * entrance;

      // selection/hero = a clean accent ring (no glow)
      const accent = n.accent ?? c.accent;
      const ring = isSel || n.hero || (searchMode && isSearchMatch);
      g.fillStyle = c.chip;
      g.strokeStyle = ring ? accent : isFocus ? c.inkDim : c.chipLine;
      g.lineWidth = (isSel ? 2 : n.hero ? 1.5 : 1.25) / Math.sqrt(k);
      if (n.ghost) g.setLineDash([4, 3]);
      const rx = Math.round(n.chip.w * (13 / 64));
      const iconInset = Math.round(n.chip.w * (8 / 64));
      const cornerArc = Math.round(rx * (1 - 1 / Math.SQRT2) * 10) / 10;
      const ledR = Math.max(2.5, Math.round(n.chip.w * (4.2 / 64) * 10) / 10);

      roundRect(g, n.chip.x, n.chip.y, n.chip.w, n.chip.h, rx);
      g.fill();
      g.stroke();
      g.setLineDash([]);

      const icon = this.icons.get(n.icon);
      if (icon) {
        g.drawImage(icon, n.chip.x + iconInset, n.chip.y + iconInset, n.chip.w - 2 * iconInset, n.chip.h - 2 * iconInset);
      } else {
        g.fillStyle = c.inkDim;
        g.font = `700 ${Math.round(18 * (n.chip.w / 64))}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText(n.label.slice(0, 2).toUpperCase(), n.chip.x + n.chip.w / 2, n.chip.y + n.chip.h / 2 + 6);
        g.textAlign = 'left';
      }

      // status LED — centered on the chip's corner arc
      g.fillStyle = statusColor(c, n.status);
      g.strokeStyle = c.bg;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(n.chip.x + n.chip.w - cornerArc, n.chip.y + cornerArc, ledR, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      if (n.badge) {
        // badge — mirrors the LED: right cap centered on the bottom-right corner arc
        g.font = '700 11px system-ui, sans-serif';
        const bw = Math.max(17, g.measureText(n.badge).width + 12);
        const bcx = n.chip.x + n.chip.w - cornerArc;
        const bcy = n.chip.y + n.chip.h - cornerArc;
        g.fillStyle = accent;
        g.strokeStyle = c.bg;
        g.lineWidth = 2;
        roundRect(g, bcx + 8.5 - bw, bcy - 8.5, bw, 17, 8.5);
        g.fill();
        g.stroke();
        g.fillStyle = c.accentInk;
        g.textAlign = 'center';
        g.fillText(n.badge, bcx + 8.5 - bw / 2, bcy + 4);
        g.textAlign = 'left';
      }

      if (showLabels) {
        const labelSize = n.labelSize ?? 12;
        g.font = `${labelSize}px system-ui, sans-serif`;
        // layout reserved labelBox from a deterministic glyph table; the
        // platform font may run wider — condense so it can never overflow
        let tw = this.labelWidths.get(n.label);
        if (tw === undefined) {
          tw = g.measureText(n.label).width;
          this.labelWidths.set(n.label, tw);
        }
        const squeeze = tw > n.labelBox.w ? n.labelBox.w / tw : 1;
        const lx = n.labelBox.x + n.labelBox.w / 2;
        const ly = n.labelBox.y + n.labelBox.h - 4;
        if (squeeze < 1) {
          g.save();
          g.translate(lx, ly);
          g.scale(squeeze, 1);
          g.translate(-lx, -ly);
        }
        g.textAlign = 'center';
        g.lineWidth = 3;
        g.strokeStyle = c.bg;
        g.strokeText(n.label, lx, ly);
        g.fillStyle = dimmed ? c.inkDim : c.ink;
        g.fillText(n.label, lx, ly);
        g.textAlign = 'left';
        if (squeeze < 1) g.restore();
      }
    }
    g.globalAlpha = 1;

    // animated links keep flowing
    if (animate && this.scene.edges.some((e) => e.animated)) this.requestDraw();
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4 ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color;
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    return `${hex}${a}`;
  }
  return color;
}

function polyBounds(points: ReadonlyArray<{ x: number; y: number }>): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function polyMidpoint(points: ReadonlyArray<{ x: number; y: number }>): { x: number; y: number } {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.abs(points[i + 1]!.x - points[i]!.x) + Math.abs(points[i + 1]!.y - points[i]!.y);
  }
  let remaining = total / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const seg = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (seg >= remaining && seg > 0) {
      const t = remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  return points[0] ?? { x: 0, y: 0 };
}

function pointSegmentDistance(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function cssSafe(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}
