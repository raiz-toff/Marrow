import type { Scene, SceneEdge, SceneNode, ScenePortChip } from '@marrow/scene';
import { interactEdge, interactNode, readTheme, resolveScene, type EdgePaint, type Theme, type VisualScene } from '@marrow/visual';
import type { CameraState } from './camera.js';

/**
 * The scale-tier renderer: immediate-mode Canvas 2D over the SAME scene the
 * SVG renderer draws — including the routed orthogonal polylines (the reason
 * this exists instead of a straight-edge WebGL graph library). Viewport
 * culling + rAF batching keep 60fps to well past the 1,200-element page cap.
 *
 * What to paint (paths, widths, dashes, colours, draw order, proportions)
 * comes from @marrow/visual — the same resolution the SVG tier renders — so
 * this file only turns paint into draw calls and owns the camera concerns
 * (zoom compensation, culling, LOD).
 */

/** Below this zoom the far LOD band applies (matches the runtime's data-zoom="far"). */
const FAR_ZOOM = 0.7;

interface FocusState {
  focus: string;
  adjacent: Set<string>;
  edges: Set<string>;
}

/** The theme as the stylesheet currently resolves it (live CSS variables). */
function liveTheme(): Theme {
  const cs = getComputedStyle(document.documentElement);
  const scheme = document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark';
  return readTheme((name) => cs.getPropertyValue(name), scheme);
}

export class CanvasEngine {
  private readonly ctx2d: CanvasRenderingContext2D;
  private camera: CameraState = { x: 0, y: 0, k: 1 };
  private focus: FocusState | undefined;
  private selected: string | undefined;
  private raf = 0;
  private theme: Theme = liveTheme();
  private visual: VisualScene;
  /** One Path2D per edge, built from the shared `d` — the exact SVG curve. */
  private readonly paths = new Map<string, Path2D>();
  private readonly edgeBounds = new Map<string, { x: number; y: number; w: number; h: number }>();
  private readonly icons = new Map<string, ImageBitmap | HTMLImageElement>();
  /** Measured label widths in the platform's actual font (cache, px @12px). */
  private readonly labelWidths = new Map<string, number>();
  /** Zone titles ellipsized to their panel width (cache, keyed id@fontPx). */
  private readonly zoneTitles = new Map<string, string>();
  private readonly nodeById = new Map<string, SceneNode>();
  private readonly grid = new Map<string, string[]>();
  private static readonly CELL = 160;
  private entranceStart = performance.now();
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stage: HTMLElement,
    readonly scene: Scene,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx2d = ctx;
    this.visual = resolveScene(scene, this.theme);
    for (const e of scene.edges) this.edgeBounds.set(e.id, polyBounds(e.points));
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
      this.theme = liveTheme();
      this.visual = resolveScene(this.scene, this.theme);
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
  nodeAt(worldX: number, worldY: number): SceneNode | undefined {
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
  edgeAt(worldX: number, worldY: number, tolerance: number): SceneEdge | undefined {
    let best: SceneEdge | undefined;
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
  private portChip(g: CanvasRenderingContext2D, k: number, c: ScenePortChip): void {
    const p = this.theme.palette;
    g.font = c.summary ? '700 9px ui-monospace, monospace' : '500 9px ui-monospace, monospace';
    g.fillStyle = p.bgRaise;
    g.strokeStyle = p.line;
    g.lineWidth = 1 / k;
    roundRect(g, c.box.x, c.box.y, c.box.w, c.box.h, 4);
    g.fill();
    g.stroke();
    g.fillStyle = c.summary ? p.ink : p.inkDim;
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
    this.ctxOverride.fillStyle = this.theme.palette.bg;
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
    const t = this.theme;
    const c = t.palette;
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
    const now = performance.now();
    const far = k < FAR_ZOOM;

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

    // edges — paints arrive in draw order (healthy first, alarms on top)
    for (const p of this.visual.edges) {
      const bounds = this.edgeBounds.get(p.id);
      if (bounds === undefined || !visible(bounds, 8)) continue;
      const inPath = this.focus?.edges.has(p.id) ?? false;
      const stroke = interactEdge(p, { path: inPath, dimmed: (focusMode && !inPath) || searchMode, far }, t);
      const alpha = stroke.opacity * entrance;
      const path = this.edgePath(p);
      g.globalAlpha = alpha;
      g.strokeStyle = stroke.color;
      // widths compensate zoom by 1/√k so thin links stay legible far out
      g.lineWidth = stroke.width / Math.sqrt(k);
      g.lineJoin = 'round';
      g.lineCap = stroke.cap;
      if (animate && p.flow) {
        g.setLineDash(p.flow.dash);
        g.lineDashOffset = p.flow.period * (1 - ((now / 1000 / p.flow.seconds) % 1));
      } else {
        g.setLineDash(stroke.dash);
      }
      g.stroke(path);
      g.setLineDash([]);
      g.lineDashOffset = 0;
      // trunk = double rail: carve a thin bg-coloured slot down the casing
      if (p.rail) {
        g.strokeStyle = p.rail.color;
        g.lineWidth = p.rail.width / Math.sqrt(k);
        g.lineCap = p.rail.cap;
        g.stroke(path);
      }
      if (!showLabels) continue;
      if (p.label) {
        const l = p.label;
        g.font = `700 ${l.fontPx}px system-ui, sans-serif`;
        this.pill(g, k, l, c.bg, c.lineStrong);
        g.fillStyle = c.ink;
        g.textAlign = 'center';
        g.fillText(l.text, l.textX, l.textY);
        g.textAlign = 'left';
      }
      // semantic chip (VLANs / encap / protocol / lag)
      if (p.chip) {
        const ch = p.chip;
        this.pill(g, k, ch, c.bg, c.lineStrong);
        if (ch.glyph === 'lock' || ch.glyph === 'bundle') chipGlyph(g, ch.glyph, ch.glyphX, ch.y + ch.h / 2, c.inkDim);
        g.font = `600 ${ch.fontPx}px system-ui, sans-serif`;
        g.fillStyle = c.ink;
        g.textAlign = 'center';
        g.fillText(ch.text, ch.textX, ch.textY);
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

    // nodes — paints are in scene order, index-aligned with scene.nodes
    this.scene.nodes.forEach((n, i) => {
      const np = this.visual.nodes[i];
      if (np === undefined || !visible(n.box)) return;
      const isFocus = this.focus?.focus === n.id;
      const isAdj = this.focus?.adjacent.has(n.id) ?? false;
      const isSel = this.selected === n.id;
      const isSearchMatch = this.searchMatches?.has(n.id) ?? false;
      const dimmed = (focusMode && !isFocus && !isAdj && !isSel) || (searchMode && !isSearchMatch);
      const ring = interactNode(np, { selected: isSel, path: searchMode && isSearchMatch, focused: isFocus, dimmed }, t);
      g.globalAlpha = ring.opacity * entrance;

      const chip = np.chip;
      g.fillStyle = c.chip;
      g.strokeStyle = ring.color;
      g.lineWidth = ring.width / Math.sqrt(k);
      g.setLineDash(ring.dash);
      roundRect(g, chip.x, chip.y, chip.w, chip.h, chip.r);
      g.fill();
      g.stroke();
      g.setLineDash([]);

      const icon = this.icons.get(n.icon);
      if (icon) {
        g.drawImage(icon, np.icon.x, np.icon.y, np.icon.w, np.icon.h);
      } else {
        g.fillStyle = c.inkDim;
        g.font = `700 ${Math.round(18 * (chip.w / 64))}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText(n.label.slice(0, 2).toUpperCase(), chip.x + chip.w / 2, chip.y + chip.h / 2 + 6);
        g.textAlign = 'left';
      }

      // status LED — centered on the chip's corner arc, bg halo ring
      g.fillStyle = np.led.fill;
      g.strokeStyle = c.bg;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(np.led.cx, np.led.cy, np.led.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      if (np.badge) {
        const b = np.badge;
        g.lineWidth = 2;
        g.fillStyle = n.accent ?? c.accent;
        g.strokeStyle = c.bg;
        roundRect(g, b.x, b.y, b.w, b.h, b.r);
        g.fill();
        g.stroke();
        g.font = `700 ${b.fontPx}px system-ui, sans-serif`;
        g.fillStyle = c.accentInk;
        g.textAlign = 'center';
        g.fillText(b.text, b.textX, b.textY);
        g.textAlign = 'left';
      }

      if (showLabels) {
        const l = np.label;
        g.font = `${l.size}px system-ui, sans-serif`;
        // layout reserved labelBox from a deterministic glyph table; the
        // platform font may run wider — condense so it can never overflow
        let tw = this.labelWidths.get(n.label);
        if (tw === undefined) {
          tw = g.measureText(n.label).width;
          this.labelWidths.set(n.label, tw);
        }
        const squeeze = tw > l.w ? l.w / tw : 1;
        if (squeeze < 1) {
          g.save();
          g.translate(l.x, l.y);
          g.scale(squeeze, 1);
          g.translate(-l.x, -l.y);
        }
        g.textAlign = 'center';
        g.lineWidth = 3;
        g.strokeStyle = c.bg;
        g.strokeText(n.label, l.x, l.y);
        g.fillStyle = c.ink;
        g.fillText(n.label, l.x, l.y);
        g.textAlign = 'left';
        if (squeeze < 1) g.restore();
      }
    });
    g.globalAlpha = 1;

    // animated links keep flowing
    if (animate && this.visual.edges.some((e) => e.flow !== undefined)) this.requestDraw();
  }

  private edgePath(p: EdgePaint): Path2D {
    let path = this.paths.get(p.id);
    if (path === undefined) {
      path = new Path2D(p.d);
      this.paths.set(p.id, path);
    }
    return path;
  }

  /** A filled + outlined pill (hairline outline at any zoom). */
  private pill(
    g: CanvasRenderingContext2D,
    k: number,
    r: { x: number; y: number; w: number; h: number; r: number },
    fill: string,
    line: string,
  ): void {
    g.fillStyle = fill;
    g.strokeStyle = line;
    g.lineWidth = 1 / k;
    roundRect(g, r.x, r.y, r.w, r.h, r.r);
    g.fill();
    g.stroke();
  }
}

/** The chip glyphs the SVG tier draws (render-svg chipGlyph), as draw calls. */
function chipGlyph(g: CanvasRenderingContext2D, kind: 'lock' | 'bundle', x: number, cy: number, color: string): void {
  g.save();
  g.lineWidth = 1.3;
  g.lineCap = 'round';
  g.strokeStyle = color;
  g.fillStyle = color;
  if (kind === 'lock') {
    const by = cy - 1.5;
    roundRect(g, x, by, 9, 6.5, 1.5);
    g.fill();
    g.beginPath();
    g.moveTo(x + 1.7, by);
    g.lineTo(x + 1.7, by - 1.8);
    g.arc(x + 4.5, by - 1.8, 2.8, Math.PI, 0);
    g.lineTo(x + 7.3, by);
    g.stroke();
  } else {
    g.beginPath();
    for (const dx of [0, 4, 8]) {
      g.moveTo(x + dx, cy - 4);
      g.lineTo(x + dx, cy + 4);
    }
    g.stroke();
  }
  g.restore();
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
