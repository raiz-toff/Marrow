import { Camera } from './camera.js';
import { edgeClasses, linkSemanticsWords } from '@marrow/visual';
import { CanvasEngine } from './canvas-engine.js';
import { devicePageIds, globalSearchDocs, loadData, type DataDevice, type DataLink, type DataTitleBlock, type EmbeddedData } from './data.js';
import {
  clampTo,
  containsPoint,
  drawnView,
  mapToWorld,
  viewInMap,
  worldInMap,
  type DrawnView,
  type MiniFrame,
} from './minimap-geometry.js';
import { closestHook, find, findAll, markHook, maybe, param, setParam } from './find.js';
import { parseHash, parseModularParams, serializeHash } from '../shared/hash.js';
import {
  applyModularParams,
  ATTR,
  EMBED,
  hookAttr,
  isEmbedMessage,
  readRoot,
  READY_FLAG,
  STAGE_ATTR,
  STAGE_HOOKS,
  storageKey,
  writeRoot,
  type Menu,
  type OneHook,
  type StorageName,
} from '../shared/page-contract.js';
import { searchDocs, type SearchDoc } from '../shared/search.js';

/** The interactive chrome. One chrome (inspector, spotlight, minimap, tooltip,
 *  themes, deep links, keyboard) over two render backends: the SVG DOM for
 *  hero-tier pages, the canvas engine for scale-tier pages. Every element it
 *  binds to is a page-contract hook (`find` / `findAll`) or a stage hook from
 *  @marrow/visual; classes it queries by name are ones it creates itself. */

const rootEl = (): HTMLElement => document.documentElement;
const rootPrefix = (): string => readRoot(rootEl(), 'root') ?? '';
const currentPage = (): string => readRoot(rootEl(), 'page') ?? 'index.html';
const inspectorOff = (): boolean => readRoot(rootEl(), 'inspector') === 'off';
const stored = (name: StorageName, dflt: string): string => localStorage.getItem(storageKey(name)) ?? dflt;
/** Open the ⌘K command center through its own button, so open/close state stays in one place. */
const openPalette = (): void => findAll(document, 'search.open')[0]?.click();

function markReady(): void {
  (window as unknown as Record<string, unknown>)[READY_FLAG] = true;
  window.dispatchEvent(new CustomEvent(EMBED.ready));
}

interface Ctx {
  mode: 'svg' | 'canvas';
  data: EmbeddedData;
  camera: Camera;
  stage: HTMLElement;
  deviceById: Map<string, DataDevice>;
  linksByDevice: Map<string, DataLink[]>;
  neighborIds: Map<string, Set<string>>;
  /** svg mode only */
  svg?: SVGSVGElement;
  nodeEls: Map<string, SVGGElement>;
  edgeEls: Map<string, SVGPathElement>;
  /** canvas mode only */
  engine?: CanvasEngine;
  selected: string | undefined;
}

export function boot(): void {
  const data = loadData();

  if (data.kind === 'inventory') {
    // document page: chrome only
    setupTheme();
    setupSidebar(undefined);
    setupSpotlight(undefined, data);
    setupMenubar(undefined);
    setupShortcutsDialog();
    setupAboutDialog();
    setupInventory();
    setupInventoryDetails(data);
    setupMobileNav();
    markReady();
    return;
  }

  const stage = find(document, 'stage.root');
  const svg = stage.querySelector<SVGSVGElement>(STAGE_HOOKS.svg);
  const canvas = stage.querySelector<HTMLCanvasElement>(STAGE_HOOKS.canvas);
  if (!svg && !canvas) throw new Error('marrow: stage page without a diagram');

  const deviceById = new Map(data.devices.map((d) => [d.id, d]));
  const linksByDevice = new Map<string, DataLink[]>();
  const neighborIds = new Map<string, Set<string>>();
  for (const l of data.links) {
    for (const [a, b] of [
      [l.from.device, l.to.device],
      [l.to.device, l.from.device],
    ] as const) {
      (linksByDevice.get(a) ?? linksByDevice.set(a, []).get(a)!).push(l);
      (neighborIds.get(a) ?? neighborIds.set(a, new Set()).get(a)!).add(b);
    }
  }

  let sceneSize = { w: 1, h: 1 };
  let engine: CanvasEngine | undefined;
  const nodeEls = new Map<string, SVGGElement>();
  const edgeEls = new Map<string, SVGPathElement>();

  if (svg) {
    sceneSize = sceneSizeOf(svg);
    // class-qualified: port chips also carry data-node/data-edge and must
    // not shadow the real node groups / edge paths in these maps
    for (const el of svg.querySelectorAll<SVGGElement>(STAGE_HOOKS.node)) nodeEls.set(el.getAttribute(STAGE_ATTR.node)!, el);
    for (const el of svg.querySelectorAll<SVGPathElement>(STAGE_HOOKS.edge)) edgeEls.set(el.getAttribute(STAGE_ATTR.edge)!, el);
  }
  if (canvas) {
    const scene = data.scene;
    if (!scene) throw new Error('marrow: canvas page without embedded scene');
    engine = new CanvasEngine(canvas, stage, scene);
    sceneSize = scene.size;
  }

  let minimapSync: () => void = () => {};
  let hashSyncSoon: () => void = () => {};

  const cameraTarget = svg?.querySelector<SVGGElement>(STAGE_HOOKS.camera) ?? undefined;
  const camera = new Camera(
    cameraTarget ?? (document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement),
    () => {
      const r = stage.getBoundingClientRect();
      return { w: r.width, h: r.height };
    },
    sceneSize,
    (s) => {
      writeRoot(rootEl(), 'zoom', s.k < 0.70 ? 'far' : s.k > 1.3 ? 'near' : 'mid');
      engine?.applyCamera(s);
      minimapSync();
      hashSyncSoon();
    },
    () => {
      const insets = { top: 0, right: 0, bottom: 0, left: 0 };
      const inspector = find(document, 'inspector.panel');
      if (!inspector.hidden && param(inspector, 'sheet') !== 'closed') {
        const stageRect = stage.getBoundingClientRect();
        const inspRect = inspector.getBoundingClientRect();
        if (inspRect.top < stageRect.bottom && inspRect.bottom > stageRect.top) {
          if (inspRect.left <= stageRect.left && inspRect.right >= stageRect.right) {
            insets.bottom = Math.max(0, stageRect.bottom - inspRect.top);
          } else if (inspRect.right >= stageRect.right && inspRect.left > stageRect.left) {
            insets.right = Math.max(0, stageRect.right - inspRect.left);
          }
        }
      }
      return insets;
    },
  );

  const ctx: Ctx = {
    mode: engine ? 'canvas' : 'svg',
    data,
    camera,
    stage,
    deviceById,
    linksByDevice,
    neighborIds,
    nodeEls,
    edgeEls,
    selected: undefined,
  };
  if (svg) ctx.svg = svg;
  if (engine) ctx.engine = engine;

  setupPanZoom(ctx, stage);
  if (ctx.mode === 'svg') {
    setupSvgPointer(ctx);
  } else {
    setupCanvasPointer(ctx);
  }
  setupInspector(ctx);
  registerYamlTabs(data);
  exposePublicApi(ctx);
  setupSpotlight(ctx, data);
  setupControls(ctx);
  setupTheme();
  setupKeyboard(ctx);
  setupContextMenu(ctx);
  setupMenubar(ctx);
  setupShortcutsDialog();
  setupAboutDialog();
  minimapSync = setupMinimap(ctx);
  setupSidebar(ctx);
  setupClickAway(ctx);
  setupMobileNav();
  hashSyncSoon = setupHash(ctx);
  syncModularParams(ctx);
  addEventListener('hashchange', () => syncModularParams(ctx));

  // re-apply persisted view settings — the ⌘K palette reads AND writes these,
  // so what it displays must be what the page is actually doing
  for (const key of ['labels', 'ports', 'motion', 'minimap'] as const) {
    if (key === 'minimap' && readRoot(rootEl(), 'minimap') === 'off') continue;
    const storedValue = localStorage.getItem(storageKey(key));
    if (storedValue !== null) applySetting(ctx, key, storedValue);
  }

  // Entrance: fit to page on all layouts on load and refresh.
  const navEntry = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
  const isReload = navEntry?.type === 'reload' || (performance as any).navigation?.type === 1;

  if (isReload && location.hash && (location.hash.includes('d=') || location.hash.includes('c='))) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  const initial = parseHash(location.hash);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  camera.fit(false);
  if (!reduced) {
    setTimeout(() => camera.fit(true), 120);
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth < 768 && !ctx.selected) {
      camera.fit(false);
    }
  });

  if (typeof ResizeObserver !== 'undefined') {
    let lastW = stage.clientWidth;
    let lastH = stage.clientHeight;
    const ro = new ResizeObserver(() => {
      const nw = stage.clientWidth;
      const nh = stage.clientHeight;
      if (nw === 0 || nh === 0) return;
      if (nw === lastW && nh === lastH) return;
      lastW = nw;
      lastH = nh;
      if (ctx.selected) {
        const b = nodeWorldBox(ctx, ctx.selected);
        if (b) {
          ctx.camera.reCenter(b, false);
        }
      }
      minimapSync();
    });
    ro.observe(stage);
  }
  const wanted = !isReload ? (initial.device ?? data.hero) : undefined;
  if (wanted !== undefined) {
    const resolved = resolveNodeFor(ctx, wanted);
    if (resolved !== undefined) selectDevice(ctx, resolved, false);
  }
  const settle = (): void => rootEl().classList.add('settled');
  setTimeout(settle, reduced ? 0 : 1900);
  addEventListener('pointerdown', settle, { once: true });

  if (document.fonts?.ready) {
    document.fonts.ready
      .then(() => requestAnimationFrame(() => markReady()))
      .catch(() => markReady());
  } else {
    requestAnimationFrame(() => markReady());
  }
}

// ─── backend-neutral node operations ────────────────────────────────────────

/** Scene size a hero-tier svg carries in `data-w` / `data-h`. */
function sceneSizeOf(svg: SVGSVGElement, fallback = 1): { w: number; h: number } {
  return {
    w: Number(svg.getAttribute(STAGE_ATTR.w)) || fallback,
    h: Number(svg.getAttribute(STAGE_ATTR.h)) || fallback,
  };
}

function hasNode(ctx: Ctx, id: string): boolean {
  return ctx.mode === 'svg' ? ctx.nodeEls.has(id) : ctx.engine!.nodeBox(id) !== undefined;
}

function nodeWorldBox(ctx: Ctx, id: string): { x: number; y: number; w: number; h: number } | undefined {
  if (ctx.mode === 'canvas') return ctx.engine!.nodeBox(id);
  const el = ctx.nodeEls.get(id);
  if (!el) return undefined;
  const b = (el as SVGGraphicsElement).getBBox();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

function linkWorldBox(ctx: Ctx, link: DataLink): { x: number; y: number; w: number; h: number } | undefined {
  if (ctx.mode === 'svg') {
    const el = ctx.edgeEls.get(link.id);
    if (el) {
      try {
        const b = (el as SVGGraphicsElement).getBBox();
        if (b && (b.width > 0 || b.height > 0)) {
          return {
            x: b.x,
            y: b.y,
            w: Math.max(b.width, 40),
            h: Math.max(b.height, 40),
          };
        }
      } catch {
        // Fallback below
      }
    }
  }
  const b1 = nodeWorldBox(ctx, link.from.device);
  const b2 = nodeWorldBox(ctx, link.to.device);
  if (!b1 && !b2) return undefined;
  if (!b1) return b2;
  if (!b2) return b1;
  const minX = Math.min(b1.x, b2.x);
  const minY = Math.min(b1.y, b2.y);
  const maxX = Math.max(b1.x + b1.w, b2.x + b2.w);
  const maxY = Math.max(b1.y + b1.h, b2.y + b2.h);
  return {
    x: minX,
    y: minY,
    w: Math.max(maxX - minX, 40),
    h: Math.max(maxY - minY, 40),
  };
}

function applyFocus(ctx: Ctx, id: string): void {
  if (ctx.mode === 'canvas') {
    const edges = new Set((ctx.linksByDevice.get(id) ?? []).map((l) => l.id));
    ctx.engine!.setFocus({ focus: id, adjacent: ctx.neighborIds.get(id) ?? new Set(), edges });
    return;
  }
  clearFocus(ctx);
  ctx.nodeEls.get(id)?.classList.add('is-focus');
  for (const nb of ctx.neighborIds.get(id) ?? []) ctx.nodeEls.get(nb)?.classList.add('is-adj');
  for (const l of ctx.linksByDevice.get(id) ?? []) {
    ctx.edgeEls.get(l.id)?.classList.add('is-path');
    setChipsHot(ctx, l.id, true);
  }
}

/** Reveal/hide the port chips belonging to one edge (progressive disclosure). */
function setChipsHot(ctx: Ctx, edgeId: string, hot: boolean): void {
  const sel = `${STAGE_HOOKS.portChip}[${STAGE_ATTR.edge}="${CSS.escape(edgeId)}"]`;
  for (const chip of ctx.svg!.querySelectorAll(sel)) chip.classList.toggle('is-hot', hot);
}

function clearFocus(ctx: Ctx): void {
  if (ctx.mode === 'canvas') {
    ctx.engine!.setFocus(undefined);
    return;
  }
  for (const el of ctx.svg!.querySelectorAll('.is-focus, .is-adj, .is-path, .is-hot')) {
    el.classList.remove('is-focus', 'is-adj', 'is-path', 'is-hot');
  }
}

function markSelected(ctx: Ctx, id: string | undefined): void {
  if (ctx.mode === 'canvas') {
    ctx.engine!.setSelected(id);
    return;
  }
  for (const el of ctx.svg!.querySelectorAll('.is-selected')) el.classList.remove('is-selected');
  if (id !== undefined) ctx.nodeEls.get(id)?.classList.add('is-selected');
}

/** A device id, or the stack node standing in for it on this page. */
function resolveNodeFor(ctx: Ctx, id: string): string | undefined {
  if (hasNode(ctx, id)) return id;
  const stack = ctx.data.devices.find((d) => d.stack?.members.includes(id));
  return stack !== undefined && hasNode(ctx, stack.id) ? stack.id : undefined;
}

// ─── pan / zoom ─────────────────────────────────────────────────────────────

function setupPanZoom(ctx: Ctx, stage: HTMLElement): void {
  stage.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const rect = stage.getBoundingClientRect();
      ctx.camera.zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, Math.exp(-ev.deltaY * 0.0016));
    },
    { passive: false },
  );

  const pointers = new Map<number, { x: number; y: number }>();
  let initialPinchDist = 0;
  let moved = false;

  stage.addEventListener('pointerdown', (ev) => {
    if (ctx.mode === 'svg' && (ev.target as Element).closest(`${STAGE_HOOKS.node}, ${STAGE_HOOKS.edgeBound}`)) return;
    if (ctx.mode === 'canvas' && hitNode(ctx, ev)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    stage.setPointerCapture(ev.pointerId);
    stage.classList.add('m-grabbing');
    moved = false;

    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      if (pts[0] && pts[1]) {
        initialPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      }
    }
  });

  stage.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const prev = pointers.get(ev.pointerId)!;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pointers.size === 1) {
      const dx = ev.clientX - prev.x;
      const dy = ev.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      ctx.camera.panBy(dx, dy);
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      if (pts[0] && pts[1]) {
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (initialPinchDist > 0 && dist > 0) {
          moved = true;
          const factor = dist / initialPinchDist;
          const rect = stage.getBoundingClientRect();
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
          ctx.camera.zoomAt(midX, midY, factor);
          initialPinchDist = dist;
        }
      }
    }
  });

  const stop = (ev: PointerEvent): void => {
    const wasPointer = pointers.has(ev.pointerId);
    pointers.delete(ev.pointerId);
    if (pointers.size === 0) {
      if (wasPointer && !moved && ctx.mode === 'canvas' && !hitNode(ctx, ev)) deselect(ctx);
      stage.classList.remove('m-grabbing');
      initialPinchDist = 0;
    } else if (pointers.size === 1) {
      initialPinchDist = 0;
    }
  };

  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
}

// ─── pointer wiring per backend ─────────────────────────────────────────────

function setupSvgPointer(ctx: Ctx): void {
  const root = rootEl();
  ctx.svg!.addEventListener('pointerover', (ev) => {
    const nodeEl = (ev.target as Element).closest<SVGGElement>(STAGE_HOOKS.node);
    if (!nodeEl) return;
    applyFocus(ctx, nodeEl.getAttribute(STAGE_ATTR.node)!);
    root.classList.add('focus-mode');
  });
  ctx.svg!.addEventListener('pointerout', (ev) => {
    if (!(ev.target as Element).closest(STAGE_HOOKS.node)) return;
    root.classList.remove('focus-mode');
    clearFocus(ctx);
    if (ctx.selected) applyFocus(ctx, ctx.selected);
  });
  ctx.svg!.addEventListener('click', (ev) => {
    const nodeEl = (ev.target as Element).closest<SVGGElement>(STAGE_HOOKS.node);
    if (nodeEl) {
      const href = nodeEl.getAttribute(STAGE_ATTR.href);
      if (href !== null) {
        location.href = rootPrefix() + href;
        return;
      }
      selectDevice(ctx, nodeEl.getAttribute(STAGE_ATTR.node)!, true);
      return;
    }
    const edgeEl = (ev.target as Element).closest<SVGElement>(STAGE_HOOKS.edgeBound);
    if (edgeEl && !inspectorOff()) {
      const edgeId = edgeEl.getAttribute(STAGE_ATTR.edge);
      const link = ctx.data.links.find((l) => l.id === edgeId);
      if (link) {
        selectLink(ctx, link);
        return;
      }
    }
    deselect(ctx);
  });
  // hovering an edge reveals its port chips even when the toggle is off
  ctx.svg!.addEventListener('pointerover', (ev) => {
    const edgeEl = (ev.target as Element).closest<SVGElement>(STAGE_HOOKS.edgeBound);
    if (edgeEl) setChipsHot(ctx, edgeEl.getAttribute(STAGE_ATTR.edge)!, true);
  });
  ctx.svg!.addEventListener('pointerout', (ev) => {
    const edgeEl = (ev.target as Element).closest<SVGElement>(STAGE_HOOKS.edgeBound);
    if (!edgeEl) return;
    const edgeId = edgeEl.getAttribute(STAGE_ATTR.edge)!;
    const edgePath = ctx.edgeEls.get(edgeId);
    if (edgePath && edgePath.classList.contains('is-path')) return;
    setChipsHot(ctx, edgeId, false);
  });
  setupTooltipSvg(ctx);
}

function toWorld(ctx: Ctx, ev: PointerEvent | MouseEvent): { x: number; y: number } {
  const rect = ctx.stage.getBoundingClientRect();
  const cam = ctx.camera.get();
  return { x: (ev.clientX - rect.left - cam.x) / cam.k, y: (ev.clientY - rect.top - cam.y) / cam.k };
}

function hitNode(ctx: Ctx, ev: PointerEvent | MouseEvent): ReturnType<CanvasEngine['nodeAt']> {
  const w = toWorld(ctx, ev);
  return ctx.engine!.nodeAt(w.x, w.y);
}

function setupCanvasPointer(ctx: Ctx): void {
  const root = rootEl();
  const tip = find(document, 'stage.tooltip');
  let hovered: string | undefined;
  ctx.stage.addEventListener('pointermove', (ev) => {
    const node = hitNode(ctx, ev);
    if (node?.id !== hovered) {
      hovered = node?.id;
      if (node) {
        applyFocus(ctx, node.id);
        root.classList.add('focus-mode');
        ctx.stage.style.cursor = 'pointer';
      } else {
        root.classList.remove('focus-mode');
        clearFocus(ctx);
        if (ctx.selected) applyFocus(ctx, ctx.selected);
        ctx.stage.style.cursor = '';
      }
    }
    if (!node) {
      const w = toWorld(ctx, ev);
      const cam = ctx.camera.get();
      const edge = ctx.engine!.edgeAt(w.x, w.y, 8 / cam.k);
      if (edge) {
        const from = ctx.deviceById.get(edge.from.node)?.name ?? edge.from.node;
        const to = ctx.deviceById.get(edge.to.node)?.name ?? edge.to.node;
        const meta = [edge.from.port, edge.to.port, edge.speed, edge.kind, ...linkSemanticsWords(edge)]
          .filter(Boolean)
          .join(' · ');
        tip.innerHTML = `<strong>${html(from)} ↔ ${html(to)}</strong>${meta ? `<span>${html(meta)}</span>` : ''}`;
        const rect = ctx.stage.getBoundingClientRect();
        tip.style.left = `${ev.clientX - rect.left + 14}px`;
        tip.style.top = `${ev.clientY - rect.top + 14}px`;
        tip.hidden = false;
        return;
      }
    }
    tip.hidden = true;
  });
  ctx.stage.addEventListener('click', (ev) => {
    const node = hitNode(ctx, ev);
    if (node) {
      if (node.href !== undefined) {
        location.href = rootPrefix() + node.href;
        return;
      }
      selectDevice(ctx, node.id, true);
      return;
    }
    const w = toWorld(ctx, ev);
    const cam = ctx.camera.get();
    const edge = ctx.engine!.edgeAt(w.x, w.y, 8 / cam.k);
    if (edge && !inspectorOff()) {
      const link = ctx.data.links.find((l) => l.id === edge.id);
      if (link) {
        selectLink(ctx, link);
        return;
      }
    }
    deselect(ctx);
  });
  ctx.stage.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });
}

// ─── selection + inspector ──────────────────────────────────────────────────

export interface InspectorTabDef {
  id: string;
  label: string;
  target?: 'device' | 'edge' | 'both';
  order?: number;
  visible?: (item: DataDevice | DataLink, ctx?: Ctx) => boolean;
  render: (
    item: DataDevice | DataLink,
    container: HTMLElement,
    ctx?: Ctx,
  ) => void | (() => void);
}

interface TabInstance {
  id: string;
  label: string;
  render?: (container: HTMLElement) => void | (() => void);
}

let activeCtx: Ctx | undefined;
let activeMaps: DeviceMaps | undefined;
let activeGoto: ((id: string) => void) | undefined;
const customTabsRegistry = new Map<string, InspectorTabDef>();
let currentActiveCleanup: (() => void) | void = undefined;
let currentInspectedItem: { type: 'device' | 'edge'; item: DataDevice | DataLink } | null = null;
let currentTabsList: TabInstance[] = [];
const eventHooks: { [key: string]: Array<(...args: any[]) => void> } = {};

function emitEvent(evt: string, ...args: any[]): void {
  const list = eventHooks[evt];
  if (list) {
    for (const fn of list) {
      try {
        fn(...args);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

function onEvent(evt: string, cb: (...args: any[]) => void): () => void {
  let list = eventHooks[evt];
  if (!list) {
    list = [];
    eventHooks[evt] = list;
  }
  list.push(cb);
  return () => {
    const arr = eventHooks[evt];
    if (arr) {
      const idx = arr.indexOf(cb);
      if (idx !== -1) arr.splice(idx, 1);
    }
  };
}

function refreshInspector(): void {
  if (!currentInspectedItem || !activeMaps || !activeGoto) return;
  if (currentInspectedItem.type === 'device') {
    fillInspector(activeMaps, currentInspectedItem.item as DataDevice, activeGoto);
  } else {
    fillLinkInspector(activeMaps, currentInspectedItem.item as DataLink, activeGoto);
  }
}

export function registerYamlTabs(data: EmbeddedData): void {
  if (!data.inspector?.tabs) return;
  for (const tab of data.inspector.tabs) {
    customTabsRegistry.set(tab.id, {
      id: tab.id,
      label: tab.label,
      target: tab.target ?? 'device',
      order: 50,
      visible: (item) => {
        if (tab.field) {
          const v =
            (item as any)[tab.field] ??
            (item as any).customFields?.[tab.field] ??
            (item as any).sections?.[tab.field];
          return v !== undefined && v !== null && v !== '';
        }
        if (tab.fields && tab.fields.length > 0) {
          return tab.fields.some((f) => {
            const v =
              (item as any)[f] ??
              (item as any).customFields?.[f] ??
              (item as any).sections?.[f];
            return v !== undefined && v !== null && v !== '';
          });
        }
        return true;
      },
      render: (item, container) => {
        if (tab.field) {
          const v =
            (item as any)[tab.field] ??
            (item as any).customFields?.[tab.field] ??
            (item as any).sections?.[tab.field];
          container.innerHTML = renderCustomSection(tab.label, v);
        } else if (tab.fields && tab.fields.length > 0) {
          const obj: Record<string, unknown> = {};
          for (const f of tab.fields) {
            const v =
              (item as any)[f] ??
              (item as any).customFields?.[f] ??
              (item as any).sections?.[f];
            if (v !== undefined) obj[f] = v;
          }
          container.innerHTML = renderCustomSection(tab.label, obj);
        } else {
          const v =
            (item as any)[tab.id] ??
            (item as any).customFields?.[tab.id] ??
            (item as any).sections?.[tab.id];
          container.innerHTML = renderCustomSection(tab.label, v);
        }
      },
    });
  }
}

export function exposePublicApi(ctx?: Ctx): void {
  if (ctx) activeCtx = ctx;
  (window as any).marrow = {
    inspector: {
      registerTab(def: InspectorTabDef): () => void {
        customTabsRegistry.set(def.id, def);
        refreshInspector();
        return () => {
          customTabsRegistry.delete(def.id);
          refreshInspector();
        };
      },
      activateTab(tabId: string): void {
        activateInspectorTab(find(document, 'inspector.panel'), tabId);
      },
      getTabs(): InspectorTabDef[] {
        return Array.from(customTabsRegistry.values());
      },
    },
    getSelected() {
      return currentInspectedItem;
    },
    selectDevice(id: string, fly = true) {
      if (activeCtx) selectDevice(activeCtx, id, fly);
    },
    selectLink(id: string) {
      if (activeCtx) {
        const link = activeCtx.data.links.find((l) => l.id === id);
        if (link) selectLink(activeCtx, link);
      }
    },
    deselect() {
      deselect(activeCtx);
    },
    openAbout() {
      openAboutDialog(activeCtx);
    },
    on: onEvent,
  };
}

export function selectDevice(ctx: Ctx, id: string, fly = true): void {
  activeCtx = ctx;
  const device = ctx.deviceById.get(id);
  if (!device || !hasNode(ctx, id)) return;
  ctx.selected = id;
  currentInspectedItem = { type: 'device', item: device };
  markSelected(ctx, id);
  rootEl().classList.add('has-selection');
  applyFocus(ctx, id);
  renderInspector(ctx, device);
  if (fly) {
    const b = nodeWorldBox(ctx, id);
    if (b) ctx.camera.flyTo(b);
  }
  syncHash(ctx);
  emitEvent('select', currentInspectedItem);
}

function deselect(ctx?: Ctx): void {
  if (ctx) {
    ctx.selected = undefined;
    markSelected(ctx, undefined);
    clearFocus(ctx);
    syncHash(ctx);
    if (window.innerWidth < 768) {
      setTimeout(() => ctx.camera.fit(true), 80);
    }
  }
  rootEl().classList.remove('has-selection');
  if (currentActiveCleanup) {
    try {
      currentActiveCleanup();
    } catch (e) {
      console.error(e);
    }
    currentActiveCleanup = undefined;
  }
  currentInspectedItem = null;
  const panel = find(document, 'inspector.panel');
  panel.hidden = true;
  setParam(panel, 'sheet', 'closed');
  find(document, 'chrome.root').style.setProperty('--inspector-offset', '0px');
  emitEvent('deselect');
}

export function selectLink(ctx: Ctx, link: DataLink, fly = true): void {
  activeCtx = ctx;
  currentInspectedItem = { type: 'edge', item: link };
  clearFocus(ctx);
  ctx.selected = undefined;
  rootEl().classList.add('has-selection');
  ctx.edgeEls.get(link.id)?.classList.add('is-path');
  setChipsHot(ctx, link.id, true);
  ctx.nodeEls.get(link.from.device)?.classList.add('is-adj');
  ctx.nodeEls.get(link.to.device)?.classList.add('is-adj');
  if (ctx.mode === 'canvas' && ctx.engine) {
    ctx.engine.setFocus({
      focus: link.from.device,
      adjacent: new Set([link.to.device]),
      edges: new Set([link.id]),
    });
  }
  fillLinkInspector(
    { deviceById: ctx.deviceById, linksByDevice: ctx.linksByDevice, devicePages: devicePageIds(ctx.data) },
    link,
    (id) => selectDevice(ctx, id, false),
  );
  if (fly && window.innerWidth < 768) {
    const b = linkWorldBox(ctx, link);
    if (b) ctx.camera.flyTo(b);
  }
  emitEvent('select', currentInspectedItem);
}

/**
 * Click-away: with a device open, a click on any section OTHER than the
 * inspector dismisses it. Nodes stay live (they re-select), and pure
 * navigation aids (zoom controls, minimap) are exempt so you can move around
 * while reading a device.
 */
function setupClickAway(ctx: Ctx): void {
  document.addEventListener('pointerdown', (ev) => {
    if (ctx.selected === undefined && !currentInspectedItem) return;
    const target = ev.target as Element;
    if (
      closestHook(target, 'inspector.panel', 'camera.controls', 'minimap.root', 'spotlight.root', 'sidebar.panel', 'chrome.commandBar') ||
      target.closest(`${STAGE_HOOKS.nodeBound}, ${STAGE_HOOKS.edgeBound}`)
    )
      return;
    if (ctx.mode === 'canvas' && hitNode(ctx, ev)) return; // canvas nodes aren't DOM
    deselect(ctx);
  });
}

/** Device detail maps shared by the diagram inspector and the inventory drawer. */
interface DeviceMaps {
  deviceById: Map<string, DataDevice>;
  linksByDevice: Map<string, DataLink[]>;
  devicePages: string[];
}

function renderInspector(ctx: Ctx, d: DataDevice): void {
  if (inspectorOff()) return;
  fillInspector(
    { deviceById: ctx.deviceById, linksByDevice: ctx.linksByDevice, devicePages: devicePageIds(ctx.data) },
    d,
    (id) => {
      const resolved = resolveNodeFor(ctx, id);
      if (resolved !== undefined) selectDevice(ctx, resolved);
    },
  );
}

function renderInlineMd(text: string): string {
  return html(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function renderMarkdownTable(md: string): string {
  const lines = md.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const headerLine = lines[0];
  const sepLine = lines[1];
  if (headerLine && sepLine && headerLine.startsWith('|') && headerLine.endsWith('|')) {
    const isSep = /^\|[\s\-:|]+\|$/.test(sepLine);
    const dataLines = isSep ? lines.slice(2) : lines.slice(1);
    const splitCells = (line: string): string[] =>
      line.slice(1, -1).split('|').map((c) => c.trim());

    const headers = splitCells(headerLine);
    const rows = dataLines.filter((l) => l.startsWith('|')).map(splitCells);

    const thead = `<thead><tr>${headers.map((hdr) => `<th>${renderInlineMd(hdr)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${renderInlineMd(cell)}</td>`).join('')}</tr>`,
      )
      .join('')}</tbody>`;
    return `<div class="m-table-wrap"><table class="m-table">${thead}${tbody}</table></div>`;
  }
  return `<div class="m-note">${renderInlineMd(md)}</div>`;
}

function renderCustomSection(title: string, content: unknown): string {
  if (content === null || content === undefined) return '';
  let inner = '';

  if (Array.isArray(content)) {
    if (content.length === 0) return '';
    const first = content[0];
    if (typeof first === 'object' && first !== null) {
      const keys = Object.keys(first);
      const thead = `<thead><tr>${keys.map((k) => `<th>${html(k)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${content
        .map(
          (row: any) =>
            `<tr>${keys.map((k) => `<td>${html(String(row?.[k] ?? ''))}</td>`).join('')}</tr>`,
        )
        .join('')}</tbody>`;
      inner = `<div class="m-table-wrap"><table class="m-table">${thead}${tbody}</table></div>`;
    } else {
      inner = `<ul class="m-members">${content.map((item) => `<li>${html(String(item))}</li>`).join('')}</ul>`;
    }
  } else if (typeof content === 'object') {
    const entries = Object.entries(content as Record<string, unknown>);
    if (entries.length === 0) return '';
    inner = `<dl class="m-facts">${entries
      .map(([k, v]) => `<dt>${html(k)}</dt><dd>${html(String(v ?? ''))}</dd>`)
      .join('')}</dl>`;
  } else if (typeof content === 'string') {
    inner = renderMarkdownTable(content);
  } else {
    inner = `<div class="m-note">${html(String(content))}</div>`;
  }

  return `<details class="m-inspector-section" open>
    <summary>
      <h3>${html(title)}</h3>
      <svg class="m-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </summary>
    <div class="m-section-body">${inner}</div>
  </details>`;
}

function activateInspectorTab(panel: HTMLElement, tabId: string): void {
  const currentTab = currentTabsList.find((t) => t.id === tabId) ?? currentTabsList[0];
  if (!currentTab) return;

  if (currentActiveCleanup) {
    try {
      currentActiveCleanup();
    } catch (e) {
      console.error(e);
    }
    currentActiveCleanup = undefined;
  }

  const tabs = findAll(panel, 'inspector.tab');
  const panes = findAll(panel, 'inspector.pane');
  for (const tab of tabs) {
    const active = param(tab, 'tab') === currentTab.id;
    tab.classList.toggle('is-active', active);
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  for (const pane of panes) {
    const active = pane.id === `m-pane-${currentTab.id}`;
    pane.classList.toggle('is-active', active);
    pane.classList.toggle('active', active);
    pane.hidden = !active;
  }

  const pane = panes.find((p) => p.id === `m-pane-${currentTab.id}`);
  if (pane && currentTab.render) {
    const cleanup = currentTab.render(pane);
    if (typeof cleanup === 'function') {
      currentActiveCleanup = cleanup;
    }
  }

  if (window.innerWidth < 768 && (currentTab.id === 'interfaces' || currentTab.id === 'config')) {
    setParam(panel, 'sheet', 'full');
  }

  emitEvent('tabchange', currentTab.id);
}

function bindInspectorTabs(panel: HTMLElement): void {
  find(panel, 'inspector.tabs').addEventListener('click', (ev) => {
    const btn = closestHook(ev.target, 'inspector.tab');
    const tab = btn ? param(btn, 'tab') : undefined;
    if (tab) activateInspectorTab(panel, tab);
  });
}

function setupInspector(ctx: Ctx): void {
  const panel = find(document, 'inspector.panel');

  find(panel, 'inspector.close').addEventListener('click', () => deselect(ctx));
  bindInspectorTabs(panel);

  const handle = find(panel, 'inspector.handle');
  // bottom-sheet drag handle (mobile): tap cycles, drag snaps peek/half/full
  let startY = 0;
  let isDragging = false;
  handle.addEventListener('pointerdown', (ev) => {
    startY = ev.clientY;
    isDragging = true;
    handle.setPointerCapture(ev.pointerId);
  });
  handle.addEventListener('pointerup', (ev) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = ev.clientY - startY;
    const current = param(panel, 'sheet') || 'half';
    let next = current;
    if (Math.abs(diff) < 10) {
      if (current === 'peek') next = 'half';
      else if (current === 'half') next = 'full';
      else if (current === 'full') next = 'half';
      else next = 'half';
    } else if (diff > 40) {
      if (current === 'full') next = 'half';
      else if (current === 'half') next = 'peek';
      else {
        deselect(ctx);
        return;
      }
    } else if (diff < -40) {
      if (current === 'peek') next = 'half';
      else if (current === 'half') next = 'full';
    }
    setParam(panel, 'sheet', next);
    setParam(panel, 'sheetSnap', next);
    if (next !== 'full') {
      if (ctx.selected) {
        const b = nodeWorldBox(ctx, ctx.selected);
        if (b) ctx.camera.flyTo(b);
      } else if (currentInspectedItem?.type === 'edge') {
        const b = linkWorldBox(ctx, currentInspectedItem.item as DataLink);
        if (b) ctx.camera.flyTo(b);
      }
    }
  });

  window.addEventListener('resize', () => {
    const offset = window.innerWidth < 768 || panel.hidden ? '0px' : '380px';
    find(document, 'chrome.root').style.setProperty('--inspector-offset', offset);
  });
}

function renderInspectorTabsAndPanes(panel: HTMLElement, tabs: TabInstance[]): void {
  currentTabsList = tabs;
  const tabsBar = find(panel, 'inspector.tabs');
  const body = find(panel, 'inspector.body');

  tabsBar.innerHTML = tabs
    .map(
      (t) =>
        `<button class="m-tab-btn" ${hookAttr('inspector.tab')} ${ATTR.tab}="${html(t.id)}" type="button" role="tab" aria-selected="false">${html(t.label)}</button>`,
    )
    .join('');

  const existingPanes = new Set<string>();
  for (const pane of findAll(body, 'inspector.pane')) {
    const id = pane.id.replace('m-pane-', '');
    existingPanes.add(id);
  }
  for (const t of tabs) {
    if (!existingPanes.has(t.id)) {
      const pane = document.createElement('div');
      pane.id = `m-pane-${t.id}`;
      pane.className = 'm-inspector-pane m-tab-pane';
      markHook(pane, 'inspector.pane');
      pane.setAttribute('role', 'tabpanel');
      pane.hidden = true;
      body.appendChild(pane);
    }
  }

  const activeBtn = findAll(tabsBar, 'inspector.tab').find((b) => b.classList.contains('is-active') || b.classList.contains('active'));
  const wantedTabId = activeBtn ? param(activeBtn, 'tab') : undefined;
  const nextTabId = tabs.some((t) => t.id === wantedTabId) ? wantedTabId! : tabs[0]?.id;
  if (nextTabId) {
    activateInspectorTab(panel, nextTabId);
  }
}

function fillInspector(maps: DeviceMaps, d: DataDevice, onGoto: (id: string) => void): void {
  if (inspectorOff()) return;
  const panel = find(document, 'inspector.panel');
  const title = find(panel, 'inspector.title');

  activeMaps = maps;
  activeGoto = onGoto;
  currentInspectedItem = { type: 'device', item: d };

  title.textContent = d.name;
  find(panel, 'inspector.desc').textContent = [d.role ?? d.tier, d.zone].filter(Boolean).join(' · ');

  const h = html;

  function renderStatusBadge(status?: string): string {
    const s = status || 'unknown';
    const safe = cssSafe(s);
    const label = s.toUpperCase();
    return `<span class="m-status-badge m-status-${safe}" title="Operational status: ${html(s)}"><span class="m-status-dot"></span><span class="m-status-text">${html(label)}</span></span>`;
  }

  function renderRoleBadge(role?: string): string {
    if (!role) return '';
    return `<span class="m-role-badge">${html(role.toUpperCase())}</span>`;
  }

  const quickBadges = [
    renderStatusBadge(d.status),
    d.role ? renderRoleBadge(d.role) : '',
    d.tier ? `<span class="m-tier-badge">${h(d.tier)}</span>` : '',
    d.zone ? `<span class="m-zone-badge">${h(d.zone)}</span>` : '',
  ].filter(Boolean).join('');

  const formattedFacts: Array<[string, string | undefined]> = [
    ['ID', `<code class="m-ip-chip">${h(d.id)}</code>`],
    ['Tier', d.tier ? `<span class="m-tier-badge">${h(d.tier)}</span>` : undefined],
    ['Zone', d.zone ? `<span class="m-zone-badge">${h(d.zone)}</span>` : undefined],
    ['Role', d.role ? renderRoleBadge(d.role) : undefined],
    ['Status', renderStatusBadge(d.status)],
    ['Mgmt IP', d.mgmtIp ? `<code class="m-ip-chip" title="Click to copy IP">${h(d.mgmtIp)}</code>` : undefined],
    ['HA pair', d.haPairWith ? `<button type="button" class="m-ha-chip" data-goto="${h(d.haPairWith)}"><span>⇄</span> ${h(d.haPairWith)}</button>` : undefined],
  ];
  const links = maps.linksByDevice.get(d.id) ?? [];
  const fullPage =
    maps.devicePages.includes(d.id) && currentPage() !== `devices/${d.id}.html`
      ? `<a class="m-full-link" href="${rootPrefix()}devices/${encodeURIComponent(d.id)}.html#d=${encodeURIComponent(d.id)}">Open page<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg></a>`
      : '';

  const tabsList: TabInstance[] = [
    {
      id: 'overview',
      label: 'Overview',
      render: (container) => {
        container.innerHTML = [
          `<div class="m-icon-badge"><svg viewBox="0 0 48 48"><use href="#ic-${cssSafe(d.icon)}" width="48" height="48"/></svg><div class="m-quick-badges">${quickBadges}</div>${fullPage}</div>`,
          `<dl class="m-facts">${formattedFacts
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `<dt>${h(k)}</dt><dd>${v!}</dd>`)
            .join('')}</dl>`,
          d.stack
            ? `<details class="m-inspector-section" open><summary><h3>Members (${d.stack.members.length})</h3><svg class="m-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></summary><div class="m-section-body"><ul class="m-members">${d.stack.members
                .map((m) => `<li>${h(m)}</li>`)
                .join('')}</ul></div></details>`
            : '',
          d.note ? `<details class="m-inspector-section" open><summary><h3>Note</h3><svg class="m-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></summary><div class="m-section-body"><div class="m-note">${renderInlineMd(d.note)}</div></div></details>` : '',
        ].join('');
        for (const btn of container.querySelectorAll<HTMLButtonElement>('[data-goto]')) {
          btn.addEventListener('click', () => onGoto(btn.dataset['goto']!));
        }
        for (const ipEl of container.querySelectorAll<HTMLElement>('.m-ip-chip')) {
          ipEl.addEventListener('click', () => {
            if (navigator.clipboard) void navigator.clipboard.writeText(ipEl.textContent?.trim() ?? '');
          });
        }
      },
    },
  ];

  if (d.interfaces.length > 0) {
    tabsList.push({
      id: 'interfaces',
      label: `Interfaces (${d.interfaces.length})`,
      render: (container) => {
        container.innerHTML = `<table class="m-table"><thead><tr><th>Name</th><th>VLAN</th><th>IP</th><th>Description</th></tr></thead><tbody>${d.interfaces
          .map(
            (i) =>
              `<tr><td>${h(i.name)}</td><td>${i.vlan ?? ''}</td><td>${h(i.ip ?? '')}</td><td>${h(i.description ?? '')}</td></tr>`,
          )
          .join('')}</tbody></table>`;
      },
    });
  }

  if (links.length > 0) {
    tabsList.push({
      id: 'neighbors',
      label: `Neighbors (${links.length})`,
      render: (container) => {
        container.innerHTML = `<ul class="m-links">${links
          .map((l) => {
            const mine = l.from.device === d.id ? l.from : l.to;
            const other = l.from.device === d.id ? l.to : l.from;
            const otherName = maps.deviceById.get(other.device)?.name ?? other.device;
            const words = [...linkSemanticsWords(l), l.kind, l.speed].filter(Boolean).join(' · ');
            const meta = `<span class="m-link-meta">${linkSwatch(l)}${words ? `<span>${h(words)}</span>` : ''}</span>`;
            return `<li><button type="button" data-goto="${h(other.device)}"><span class="m-link-other">${h(otherName)}</span><span class="m-link-ports">${h(mine.port ?? '—')} → ${h(other.port ?? '—')}</span>${meta}</button></li>`;
          })
          .join('')}</ul>`;
        for (const btn of container.querySelectorAll<HTMLButtonElement>('[data-goto]')) {
          btn.addEventListener('click', () => onGoto(btn.dataset['goto']!));
        }
      },
    });
  }

  // Custom registered tabs for devices
  const customTabs = Array.from(customTabsRegistry.values())
    .filter((t) => (!t.target || t.target === 'device' || t.target === 'both') && (!t.visible || t.visible(d, activeCtx)))
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

  for (const ct of customTabs) {
    tabsList.push({
      id: ct.id,
      label: ct.label,
      render: (container) => ct.render(d, container, activeCtx),
    });
  }

  const hasCustom =
    (d.customFields && Object.keys(d.customFields).length > 0) ||
    (d.sections && Object.keys(d.sections).length > 0);
  if (hasCustom) {
    tabsList.push({
      id: 'metadata',
      label: 'Custom Fields',
      render: (container) => {
        container.innerHTML = [
          d.customFields && Object.keys(d.customFields).length > 0
            ? renderCustomSection('Custom Fields', d.customFields)
            : '',
          ...(d.sections
            ? Object.entries(d.sections).map(([title, content]) =>
                renderCustomSection(title, content),
              )
            : []),
        ].join('');
      },
    });
  }

  if (d.config) {
    tabsList.push({
      id: 'config',
      label: 'Config',
      render: (container) => {
        container.innerHTML = `<pre class="m-config">${h(d.config!)}</pre>`;
      },
    });
  }

  renderInspectorTabsAndPanes(panel, tabsList);

  panel.hidden = false;
  const sheet = param(panel, 'sheet');
  setParam(panel, 'sheet', sheet && sheet !== 'closed' ? sheet : 'half');
  if (window.innerWidth >= 768) find(document, 'chrome.root').style.setProperty('--inspector-offset', '380px');
}

function fillLinkInspector(maps: DeviceMaps, l: DataLink, onGoto: (id: string) => void): void {
  if (inspectorOff()) return;
  const panel = find(document, 'inspector.panel');
  const title = find(panel, 'inspector.title');

  activeMaps = maps;
  activeGoto = onGoto;
  currentInspectedItem = { type: 'edge', item: l };

  const fromName = maps.deviceById.get(l.from.device)?.name ?? l.from.device;
  const toName = maps.deviceById.get(l.to.device)?.name ?? l.to.device;
  title.textContent = `${fromName} ⟷ ${toName}`;
  find(panel, 'inspector.desc').textContent = [l.kind, l.speed, l.mode].filter(Boolean).join(' · ');

  const h = html;
  const facts: Array<[string, string | undefined]> = [
    ['From', `${fromName}${l.from.port ? ` (${l.from.port})` : ''}`],
    ['To', `${toName}${l.to.port ? ` (${l.to.port})` : ''}`],
    ['Kind', l.kind],
    ['Speed', l.speed],
    ['Mode', l.mode],
    ['VLANs', l.vlans],
    ['Native VLAN', l.nativeVlan !== undefined ? String(l.nativeVlan) : undefined],
    ['LAG', l.lag],
    ['LACP', l.lacp],
    ['Protocol', l.protocol],
    ['Encap', l.encap],
    ['Status', l.status],
  ];

  const tabsList: TabInstance[] = [
    {
      id: 'overview',
      label: 'Overview',
      render: (container) => {
        container.innerHTML = [
          `<div class="m-icon-badge">${linkSwatch(l)}<span class="m-status-pill m-status-${cssSafe(l.status)}">${h(l.status)}</span></div>`,
          `<dl class="m-facts">${facts
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v!)}</dd>`)
            .join('')}</dl>`,
          l.note ? `<h3>Note</h3><div class="m-note">${h(l.note)}</div>` : '',
        ].join('');
      },
    },
  ];

  // Custom registered tabs for edges
  const customTabs = Array.from(customTabsRegistry.values())
    .filter((t) => (t.target === 'edge' || t.target === 'both') && (!t.visible || t.visible(l, activeCtx)))
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

  for (const ct of customTabs) {
    tabsList.push({
      id: ct.id,
      label: ct.label,
      render: (container) => ct.render(l, container, activeCtx),
    });
  }

  const hasCustom =
    (l.customFields && Object.keys(l.customFields).length > 0) ||
    (l.sections && Object.keys(l.sections).length > 0);
  if (hasCustom) {
    tabsList.push({
      id: 'metadata',
      label: 'Custom Fields',
      render: (container) => {
        container.innerHTML = [
          l.customFields && Object.keys(l.customFields).length > 0
            ? renderCustomSection('Custom Fields', l.customFields)
            : '',
          ...(l.sections
            ? Object.entries(l.sections).map(([t, c]) => renderCustomSection(t, c))
            : []),
        ].join('');
      },
    });
  }

  renderInspectorTabsAndPanes(panel, tabsList);

  panel.hidden = false;
  setParam(panel, 'sheet', 'half');
  if (window.innerWidth >= 768) find(document, 'chrome.root').style.setProperty('--inspector-offset', '380px');
}

// ─── spotlight ──────────────────────────────────────────────────────────────

function setupSpotlight(ctx: Ctx | undefined, data: EmbeddedData): void {
  const overlay = find(document, 'spotlight.root');
  const input = find(overlay, 'spotlight.input');
  const list = find(overlay, 'spotlight.list');

  // site mode ships a global cross-page index; single files search themselves
  const global = globalSearchDocs();
  const pageByDoc = new Map<string, string>();
  let docs: SearchDoc[];
  if (global) {
    docs = global.map((g) => {
      pageByDoc.set(g.id, g.page);
      const doc: SearchDoc = { id: g.id, name: g.name };
      if (g.role !== undefined) doc.role = g.role;
      if (g.zone !== undefined) doc.zone = g.zone;
      if (g.tier !== undefined) doc.tier = g.tier;
      if (g.ip !== undefined) doc.ip = g.ip;
      return doc;
    });
  } else {
    docs = data.devices.map((d) => {
      const doc: SearchDoc = { id: d.id, name: d.name, extra: d.interfaces.map((i) => i.name) };
      if (d.role !== undefined) doc.role = d.role;
      if (d.zone !== undefined) doc.zone = d.zone;
      if (d.tier !== undefined) doc.tier = d.tier;
      if (d.mgmtIp !== undefined) doc.ip = d.mgmtIp;
      return doc;
    });
  }
  const subOf = new Map<string, string>();
  if (global) {
    for (const g of global) subOf.set(g.id, [g.ip, g.zone, g.tier].filter(Boolean).join(' · '));
  } else {
    for (const d of data.devices) subOf.set(d.id, [d.mgmtIp, d.zone, d.tier].filter(Boolean).join(' · '));
  }
  const nameOf = new Map(docs.map((d) => [d.id, d.name]));
  const goTo = (id: string): void => {
    const page = pageByDoc.get(id);
    if (ctx !== undefined && (page === undefined || page === currentPage())) {
      const resolved = resolveNodeFor(ctx, id);
      if (resolved !== undefined) {
        selectDevice(ctx, resolved);
        return;
      }
    }
    location.href = `${rootPrefix()}${page ?? 'index.html'}#d=${encodeURIComponent(id)}`;
  };

  // ── command center (shadcn Command): grouped items — Devices, Navigation,
  // Actions — with icons and shortcut hints. Icons and behavior are sourced
  // from the live DOM (nav anchors, rail/zoom/export buttons), so the palette
  // always mirrors exactly what this page offers.
  interface Command {
    label: string;
    icon: string;
    shortcut?: string;
    keywords?: string;
    run: () => void;
  }
  // 16px Lucide icons for the View settings (the palette is their only home)
  const cic = (paths: string): string =>
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const CMD_IC = {
    moon: cic('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
    tag: cic(
      '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    ),
    plug: cic('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
    pulse: cic(
      '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    ),
    map: cic(
      '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    ),
    image: cic(
      '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    ),
    vector: cic('<circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/>'),
  };
  /** View settings as commands, each showing its live value where a shortcut
   *  would sit; running one applies + persists it (the old icon rail's job). */
  const settingCommands = (): Command[] => {
    const root = rootEl();
    const cycle3 = (key: StorageName): string => {
      const order = ['auto', 'on', 'off'];
      return order[(order.indexOf(stored(key, 'auto')) + 1) % order.length]!;
    };
    const set = (key: StorageName, value: string): void => setViewSetting(ctx, key, value);
    const cmds: Command[] = [
      {
        label: 'Toggle theme',
        icon: CMD_IC.moon,
        shortcut: readRoot(root, 'theme') ?? 'dark',
        keywords: 'dark light mode appearance',
        run: () => set('theme', readRoot(root, 'theme') === 'light' ? 'dark' : 'light'),
      },
    ];
    if (ctx !== undefined) {
      if (ctx.data.devices.length > 0) {
        cmds.push({
          label: 'Device labels',
          icon: CMD_IC.tag,
          shortcut: stored('labels', 'auto'),
          keywords: 'names show hide cycle',
          run: () => set('labels', cycle3('labels')),
        });
      }
      const hasPorts =
        ctx.data.links.some((l) => Boolean(l.from.port || l.to.port)) ||
        ctx.data.devices.some((d) => Array.isArray(d.interfaces) && d.interfaces.length > 0);
      if (hasPorts) {
        cmds.push({
          label: 'Port labels',
          icon: CMD_IC.plug,
          shortcut: stored('ports', 'auto'),
          keywords: 'interfaces chips cycle',
          run: () => set('ports', cycle3('ports')),
        });
      }
      const hasMotion = ctx.data.links.some((l) => Boolean(l.animated));
      if (hasMotion) {
        cmds.push({
          label: 'Link motion',
          icon: CMD_IC.pulse,
          shortcut: stored('motion', 'on') !== 'off' ? 'on' : 'off',
          keywords: 'animation flow dashes',
          run: () => set('motion', stored('motion', 'on') !== 'off' ? 'off' : 'on'),
        });
      }
      const showMinimap = readRoot(root, 'minimap') !== 'off' && ctx.data.devices.length >= 2;
      if (showMinimap) {
        cmds.push({
          label: 'Minimap',
          icon: CMD_IC.map,
          shortcut: stored('minimap', 'on') !== 'off' ? 'on' : 'off',
          keywords: 'overview map corner',
          run: () => set('minimap', stored('minimap', 'on') !== 'off' ? 'off' : 'on'),
        });
      }
    }
    return cmds;
  };

  const collectCommands = (): { nav: Command[]; actions: Command[]; view: Command[] } => {
    const nav: Command[] = [];
    for (const a of findAll(document, 'sidebar.navLink') as HTMLAnchorElement[]) {
      if (a.href === '') continue;
      nav.push({
        label: param(a, 'label') ?? a.querySelector('span')?.textContent ?? a.href,
        icon: a.querySelector('i')?.innerHTML ?? '',
        keywords: 'go to open page',
        run: () => {
          location.href = a.href;
        },
      });
    }
    const mac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
    const actions: Command[] = [];
    const add = (btn: HTMLElement | undefined, label: string, opts: { shortcut?: string; keywords?: string } = {}): void => {
      if (!btn) return;
      const cmd: Command = { label, icon: btn.querySelector('svg')?.outerHTML ?? '', run: () => btn.click() };
      if (opts.shortcut !== undefined) cmd.shortcut = opts.shortcut;
      if (opts.keywords !== undefined) cmd.keywords = opts.keywords;
      actions.push(cmd);
    };
    const control = (id: OneHook): HTMLElement | undefined => maybe(document, id);
    add(control('camera.fit'), 'Fit view', { shortcut: 'F', keywords: 'zoom reset center' });
    add(control('camera.zoomIn'), 'Zoom in', { shortcut: '+' });
    add(control('camera.zoomOut'), 'Zoom out', { shortcut: '−' });
    add(findAll(document, 'sidebar.toggle')[0], 'Toggle sidebar', { shortcut: mac ? '⌘B' : 'Ctrl B', keywords: 'panel browse' });
    actions.push({
      label: 'Keyboard shortcuts',
      icon: cic('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
      keywords: 'help keys guide hotkeys',
      run: openShortcutsGuide,
    });
    if (ctx !== undefined) {
      actions.push({
        label: 'Export PNG',
        icon: CMD_IC.image,
        keywords: 'download image screenshot save',
        run: () => void exportPng(ctx),
      });
      if (ctx.mode === 'svg') {
        actions.push({
          label: 'Export SVG',
          icon: CMD_IC.vector,
          keywords: 'download vector save',
          run: () => download(new Blob([standaloneSvg(ctx)], { type: 'image/svg+xml' }), `${fileStem(ctx)}.svg`),
        });
      }
    }
    return { nav, actions, view: settingCommands() };
  };

  type Entry = { kind: 'device'; id: string } | { kind: 'cmd'; cmd: Command };
  let flat: Entry[] = [];
  let active = 0;

  const clearSearchCanvas = (): void => {
    if (!ctx) return;
    ctx.stage.classList.remove('is-search-active');
    for (const el of ctx.nodeEls.values()) {
      el.classList.remove('is-search-match', 'is-search-dim');
    }
    if (ctx.mode === 'canvas' && ctx.engine) {
      ctx.engine.setSearchMatches(undefined);
    }
  };

  const updateSearchCanvas = (query: string, hits: Array<{ id: string }>): void => {
    if (!ctx) return;
    const q = query.trim();
    if (!q) {
      clearSearchCanvas();
      return;
    }
    const matched = new Set(hits.map((h) => h.id));
    ctx.stage.classList.add('is-search-active');
    for (const [id, el] of ctx.nodeEls) {
      if (matched.has(id)) {
        el.classList.add('is-search-match');
        el.classList.remove('is-search-dim');
      } else {
        el.classList.remove('is-search-match');
        el.classList.add('is-search-dim');
      }
    }
    if (ctx.mode === 'canvas' && ctx.engine) {
      ctx.engine.setSearchMatches(matched);
    }
  };

  const open = (): void => {
    overlay.hidden = false;
    input.value = '';
    render('');
    input.focus();
  };
  const close = (): void => {
    overlay.hidden = true;
    clearSearchCanvas();
  };
  const runEntry = (entry: Entry | undefined): void => {
    if (!entry) return;
    close();
    if (entry.kind === 'device') goTo(entry.id);
    else entry.cmd.run();
  };
  const render = (q: string): void => {
    const query = q.trim();
    const ql = query.toLowerCase();
    const matches = (c: Command): boolean =>
      query === '' || `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(ql);
    const { nav, actions, view } = collectCommands();
    const deviceHits = query === '' ? [] : searchDocs(query, docs);
    updateSearchCanvas(query, deviceHits);
    const navHits = nav.filter(matches);
    const actionHits = actions.filter(matches);
    const viewHits = view.filter(matches);

    flat = [];
    active = 0;
    let out = '';
    const heading = (label: string): string => `<li class="m-cmd-h">${label}</li>`;
    const sep = (): string => '<li class="m-cmd-s" aria-hidden="true"></li>';
    const item = (icon: string, name: string, right: string): string => {
      const idx = flat.length - 1;
      return `<li data-idx="${idx}" class="${idx === 0 ? 'active' : ''}"><span class="m-cmd-ic">${icon}</span><span class="m-hit-name">${html(name)}</span>${right}</li>`;
    };

    if (deviceHits.length > 0) {
      out += heading('Devices');
      for (const hit of deviceHits) {
        flat.push({ kind: 'device', id: hit.id });
        out += item('', nameOf.get(hit.id) ?? hit.id, `<span class="m-hit-sub">${html(subOf.get(hit.id) ?? '')}</span>`);
      }
    }
    for (const [label, cmds] of [
      ['Navigation', navHits],
      ['Actions', actionHits],
      ['View', viewHits],
    ] as const) {
      if (cmds.length === 0) continue;
      if (out !== '') out += sep();
      out += heading(label);
      for (const cmd of cmds) {
        flat.push({ kind: 'cmd', cmd });
        out += item(cmd.icon, cmd.label, cmd.shortcut !== undefined ? `<kbd class="m-cmd-kbd">${html(cmd.shortcut)}</kbd>` : '');
      }
    }
    if (flat.length === 0) {
      list.innerHTML = '<li class="m-empty">No results found.</li>';
      return;
    }
    list.innerHTML = out;
    for (const li of list.querySelectorAll<HTMLElement>('li[data-idx]')) {
      li.addEventListener('click', () => runEntry(flat[Number(li.dataset['idx'])]));
    }
  };
  const move = (delta: number): void => {
    const items = [...list.querySelectorAll<HTMLElement>('li[data-idx]')];
    if (items.length === 0) return;
    items[active]?.classList.remove('active');
    active = (active + delta + items.length) % items.length;
    items[active]!.classList.add('active');
    items[active]!.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') (ev.preventDefault(), move(1));
    else if (ev.key === 'ArrowUp') (ev.preventDefault(), move(-1));
    else if (ev.key === 'Enter') runEntry(flat[active]);
    else if (ev.key === 'Escape') close();
  });
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });
  // every search button (command bar, camera controls, mobile bar) opens it
  for (const btn of findAll(document, 'search.open')) btn.addEventListener('click', open);
  addEventListener('keydown', (ev) => {
    if ((ev.key === 'k' && (ev.metaKey || ev.ctrlKey)) || (ev.key === '/' && !isTyping())) {
      ev.preventDefault();
      if (overlay.hidden) open();
      else close();
    }
  });
}

// ─── menubar (shadcn Menubar; popovers share the DropdownMenu spec) ─────────

function fillAboutDialog(dlg: HTMLElement, ctx?: Ctx): void {
  const data: EmbeddedData = ctx?.data ?? loadData();

  const titleEl = find(dlg, 'about.title');
  const descEl = find(dlg, 'about.desc');
  const bodyEl = find(dlg, 'about.body');

  titleEl.textContent = data.name || 'Topology Diagram';
  descEl.textContent = data.description || '';
  descEl.hidden = !data.description;

  const author = data.author ?? data.titleBlock?.author;
  const revision = data.revision ?? data.titleBlock?.revision;
  const date = data.date ?? data.titleBlock?.date;
  const devCount = data.devices?.length ?? 0;
  const linkCount = data.links?.length ?? 0;
  const zoneCount = data.zonesCount ?? data.zones?.length ?? 0;

  const chips: string[] = [];
  if (author) chips.push(`<span class="m-about-pill"><strong>Author:</strong> ${html(author)}</span>`);
  if (revision) chips.push(`<span class="m-about-pill"><strong>Revision:</strong> ${html(revision)}</span>`);
  if (date) chips.push(`<span class="m-about-pill"><strong>Date:</strong> ${html(date)}</span>`);
  chips.push(`<span class="m-about-pill"><strong>Devices:</strong> ${devCount}</span>`);
  chips.push(`<span class="m-about-pill"><strong>Links:</strong> ${linkCount}</span>`);
  if (zoneCount > 0) chips.push(`<span class="m-about-pill"><strong>Zones:</strong> ${zoneCount}</span>`);

  const metaHtml = `<div class="m-about-meta">${chips.join('')}</div>`;

  let contentHtml = '';
  if (data.about) {
    if (typeof data.about === 'string') {
      contentHtml = `<div class="m-about-content">${renderMarkdownTable(data.about)}</div>`;
    } else if (typeof data.about === 'object') {
      const sections = Object.entries(data.about as Record<string, unknown>);
      contentHtml = `<div class="m-about-sections">${sections
        .map(([title, content]) => renderCustomSection(title, content))
        .join('')}</div>`;
    }
  } else {
    const specs: Record<string, string> = {
      'Engine Mode': ctx ? (ctx.mode === 'canvas' ? 'Canvas 2D' : 'Vector SVG') : 'Document Inventory',
      'Inventory Size': `${devCount} devices · ${linkCount} links${zoneCount ? ` · ${zoneCount} zones` : ''}`,
      'Compiler Version': 'Marrow v2 Declarative Schema',
    };
    contentHtml = `
      <div class="m-about-sections">
        ${renderCustomSection('Topology Specifications', specs)}
      </div>
      <div class="m-about-hint">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div>
          <strong>Customizing this page:</strong> You can add rich documentation, architecture decisions, operational runbooks, or contact information by declaring an <code>about:</code> section in your topology YAML.
        </div>
      </div>
    `;
  }

  bodyEl.innerHTML = metaHtml + contentHtml;
}

function openAboutDialog(ctx?: Ctx): void {
  const dlg = find(document, 'about.dialog');
  fillAboutDialog(dlg, ctx);
  dlg.hidden = false;
}

function setupAboutDialog(): void {
  const dlg = find(document, 'about.dialog');
  find(dlg, 'about.close').addEventListener('click', () => {
    dlg.hidden = true;
  });
  dlg.addEventListener('click', (ev) => {
    if (ev.target === dlg) dlg.hidden = true;
  });
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !dlg.hidden) dlg.hidden = true;
  });
}

function openShortcutsGuide(): void {
  find(document, 'shortcuts.dialog').hidden = false;
}

function setupShortcutsDialog(): void {
  const dlg = find(document, 'shortcuts.dialog');
  find(dlg, 'shortcuts.close').addEventListener('click', () => {
    dlg.hidden = true;
  });
  dlg.addEventListener('click', (ev) => {
    if (ev.target === dlg) dlg.hidden = true;
  });
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !dlg.hidden) dlg.hidden = true;
  });
}

function setupMenubar(ctx: Ctx | undefined): void {
  const bar = find(document, 'menubar.root');
  const triggers = findAll(bar, 'menubar.trigger');
  const pop = document.createElement('div');
  pop.className = 'm-ctxmenu m-menupop';
  pop.hidden = true;
  document.body.append(pop);
  let openMenu: Menu | undefined;

  const CHECK =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const mac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
  const mod = mac ? '⌘' : 'Ctrl ';
  const item = (act: string, label: string, opts: { shortcut?: string; check?: boolean | string } = {}): string =>
    `<button class="m-ctx-item" data-act="${act}">` +
    `<span class="m-ctx-check">${opts.check === true ? CHECK : ''}</span>` +
    `<span class="m-ctx-label">${html(label)}</span>` +
    (typeof opts.check === 'string'
      ? `<kbd class="m-ctx-kbd">${html(opts.check)}</kbd>`
      : opts.shortcut !== undefined
        ? `<kbd class="m-ctx-kbd">${html(opts.shortcut)}</kbd>`
        : '') +
    `</button>`;
  const sep = (): string => '<div class="m-ctx-sep"></div>';

  const content = (menu: Menu): string => {
    if (menu === 'view') {
      const stage = ctx !== undefined;
      const hasDevices = ctx !== undefined && ctx.data.devices.length > 0;
      const hasPorts =
        ctx !== undefined &&
        (ctx.data.links.some((l) => Boolean(l.from.port || l.to.port)) ||
          ctx.data.devices.some((d) => Array.isArray(d.interfaces) && d.interfaces.length > 0));
      const hasMotion = ctx !== undefined && ctx.data.links.some((l) => Boolean(l.animated));
      const showMinimap = ctx !== undefined && readRoot(rootEl(), 'minimap') !== 'off' && ctx.data.devices.length >= 2;
      const hasAnyToggle = hasDevices || hasPorts || hasMotion || showMinimap;
      return (
        (stage
          ? item('fit', 'Fit view', { shortcut: 'F' }) +
            item('zoom-in', 'Zoom in', { shortcut: `${mod}+` }) +
            item('zoom-out', 'Zoom out', { shortcut: `${mod}−` }) +
            (hasAnyToggle ? sep() : '') +
            (hasDevices ? item('t-labels', 'Device labels', { check: stored('labels', 'auto') }) : '') +
            (hasPorts ? item('t-ports', 'Port labels', { check: stored('ports', 'auto') }) : '') +
            (hasMotion ? item('t-motion', 'Link motion', { check: stored('motion', 'on') !== 'off' }) : '') +
            (showMinimap ? item('t-minimap', 'Minimap', { check: stored('minimap', 'on') !== 'off' }) : '') +
            sep()
          : '') +
        item('t-theme', 'Theme', { check: readRoot(rootEl(), 'theme') ?? 'dark' })
      );
    }
    if (menu === 'export') {
      return (
        (ctx !== undefined ? item('png', 'Export PNG') + (ctx.mode === 'svg' ? item('svg', 'Export SVG') : '') + sep() : '') +
        item('print', 'Print…', { shortcut: `${mod}P` })
      );
    }
    return (
      item('guide', 'Keyboard shortcuts') +
      item('palette', 'Command center', { shortcut: `${mod}K` }) +
      sep() +
      item('about', 'About this diagram')
    );
  };

  const menuOf = (btn: HTMLElement): Menu => param(btn, 'menu') as Menu;
  const syncTriggers = (): void => {
    for (const b of triggers) b.classList.toggle('open', menuOf(b) === openMenu);
  };
  const close = (): void => {
    pop.hidden = true;
    openMenu = undefined;
    syncTriggers();
  };
  const openFor = (btn: HTMLElement): void => {
    openMenu = menuOf(btn);
    pop.innerHTML = content(openMenu);
    pop.hidden = false;
    const r = btn.getBoundingClientRect();
    pop.style.left = '0px';
    pop.style.top = '0px';
    const isOverlaySidebar = window.innerWidth <= 1024;
    if (isOverlaySidebar) {
      const drawerW = find(document, 'sidebar.panel').offsetWidth || 280;
      const left = Math.max(12, Math.min(r.left, drawerW - pop.offsetWidth - 12));
      pop.style.left = `${left}px`;
      pop.style.top = `${Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8)}px`;
    } else {
      pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
      pop.style.top = `${Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8)}px`;
    }
    syncTriggers();
  };

  for (const btn of triggers) {
    btn.addEventListener('click', () => {
      if (openMenu === menuOf(btn)) close();
      else openFor(btn);
    });
    // Menubar behavior: with a menu open, hovering a sibling trigger switches
    btn.addEventListener('mouseenter', () => {
      if (openMenu !== undefined && openMenu !== menuOf(btn)) openFor(btn);
    });
  }

  pop.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('.m-ctx-item');
    if (!btn) return;
    const rerender = (): void => {
      if (openMenu !== undefined) pop.innerHTML = content(openMenu);
    };
    const cycle3 = (key: StorageName): void => {
      const order = ['auto', 'on', 'off'];
      setViewSetting(ctx, key, order[(order.indexOf(stored(key, 'auto')) + 1) % order.length]!);
      rerender();
    };
    const flip = (key: StorageName): void => {
      setViewSetting(ctx, key, stored(key, 'on') !== 'off' ? 'off' : 'on');
      rerender();
    };
    switch (btn.dataset['act']) {
      case 'fit': close(); ctx?.camera.fit(true); break;
      case 'zoom-in': close(); if (ctx) zoomCenter(ctx, 1.35); break;
      case 'zoom-out': close(); if (ctx) zoomCenter(ctx, 1 / 1.35); break;
      case 't-labels': cycle3('labels'); break;
      case 't-ports': cycle3('ports'); break;
      case 't-motion': flip('motion'); break;
      case 't-minimap': flip('minimap'); break;
      case 't-theme':
        setViewSetting(ctx, 'theme', readRoot(rootEl(), 'theme') === 'light' ? 'dark' : 'light');
        rerender();
        break;
      case 'png': close(); if (ctx) void exportPng(ctx); break;
      case 'svg': close(); if (ctx) download(new Blob([standaloneSvg(ctx)], { type: 'image/svg+xml' }), `${fileStem(ctx)}.svg`); break;
      case 'print': close(); window.print(); break;
      case 'guide': close(); openShortcutsGuide(); break;
      case 'palette': close(); openPalette(); break;
      case 'about': close(); openAboutDialog(ctx); break;
    }
  });

  addEventListener('pointerdown', (ev) => {
    const t = ev.target as Node;
    if (!pop.hidden && !pop.contains(t) && !bar.contains(t)) close();
  }, true);
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !pop.hidden) close();
  });
}

// ─── context menu (shadcn ContextMenu) ──────────────────────────────────────
// Right-click a node → device actions; right-click empty stage → view menu.
// Checkbox/cycle rows re-render in place instead of closing, like Radix
// checkbox items commonly do.

function setupContextMenu(ctx: Ctx): void {
  const menu = document.createElement('div');
  menu.className = 'm-ctxmenu';
  menu.hidden = true;
  document.body.append(menu);
  let forNode: string | undefined;

  const CHECK =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const mac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
  const mod = mac ? '⌘' : 'Ctrl ';

  const item = (act: string, label: string, opts: { shortcut?: string; check?: boolean | string; disabled?: boolean } = {}): string =>
    `<button class="m-ctx-item${opts.disabled ? ' disabled' : ''}" data-act="${act}" ${opts.disabled ? 'disabled' : ''}>` +
    `<span class="m-ctx-check">${opts.check === true ? CHECK : ''}</span>` +
    `<span class="m-ctx-label">${html(label)}</span>` +
    (typeof opts.check === 'string'
      ? `<kbd class="m-ctx-kbd">${html(opts.check)}</kbd>`
      : opts.shortcut !== undefined
        ? `<kbd class="m-ctx-kbd">${html(opts.shortcut)}</kbd>`
        : '') +
    `</button>`;
  const sep = (): string => '<div class="m-ctx-sep"></div>';

  const render = (): void => {
    if (forNode !== undefined) {
      const d = ctx.deviceById.get(forNode);
      if (!d) return;
      const hasPage = devicePageIds(ctx.data).includes(d.id) && currentPage() !== `devices/${d.id}.html`;
      menu.innerHTML =
        `<div class="m-ctx-title">${html(d.name)}<small>${html([d.mgmtIp, d.tier].filter(Boolean).join(' · ') || d.id)}</small></div>` +
        sep() +
        item('open', 'Open details', { shortcut: '↵' }) +
        item('fly', 'Fly to device') +
        (hasPage ? item('page', 'Open device page') : '') +
        sep() +
        item('copy-id', 'Copy device ID') +
        (d.mgmtIp !== undefined ? item('copy-ip', 'Copy mgmt IP') : '');
    } else {
      const hasDevices = ctx.data.devices.length > 0;
      const hasPorts =
        ctx.data.links.some((l) => Boolean(l.from.port || l.to.port)) ||
        ctx.data.devices.some((d) => Array.isArray(d.interfaces) && d.interfaces.length > 0);
      const hasMotion = ctx.data.links.some((l) => Boolean(l.animated));
      const showMinimap = readRoot(rootEl(), 'minimap') !== 'off' && ctx.data.devices.length >= 2;
      const hasAnyToggle = hasDevices || hasPorts || hasMotion || showMinimap;
      menu.innerHTML =
        item('fit', 'Fit view', { shortcut: 'F' }) +
        item('zoom-in', 'Zoom in', { shortcut: `${mod}+` }) +
        item('zoom-out', 'Zoom out', { shortcut: `${mod}−` }) +
        (hasAnyToggle ? sep() : '') +
        (hasDevices ? item('t-labels', 'Device labels', { check: stored('labels', 'auto') }) : '') +
        (hasPorts ? item('t-ports', 'Port labels', { check: stored('ports', 'auto') }) : '') +
        (hasMotion ? item('t-motion', 'Link motion', { check: stored('motion', 'on') !== 'off' }) : '') +
        (showMinimap ? item('t-minimap', 'Minimap', { check: stored('minimap', 'on') !== 'off' }) : '') +
        sep() +
        item('png', 'Export PNG') +
        (ctx.mode === 'svg' ? item('svg', 'Export SVG') : '') +
        sep() +
        item('palette', 'Command center', { shortcut: `${mod}K` });
    }
  };

  const close = (): void => {
    menu.hidden = true;
    forNode = undefined;
  };
  const openAt = (x: number, y: number): void => {
    render();
    menu.hidden = false;
    // clamp inside the viewport
    menu.style.left = '0px';
    menu.style.top = '0px';
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    menu.style.left = `${Math.min(x, innerWidth - w - 8)}px`;
    menu.style.top = `${Math.min(y, innerHeight - h - 8)}px`;
  };

  ctx.stage.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (ctx.mode === 'svg') {
      const nodeEl = (ev.target as Element).closest<SVGGElement>(STAGE_HOOKS.node);
      forNode = nodeEl?.getAttribute(STAGE_ATTR.node) ?? undefined;
    } else {
      forNode = hitNode(ctx, ev)?.id;
    }
    openAt(ev.clientX, ev.clientY);
  });

  menu.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('.m-ctx-item');
    if (!btn || btn.disabled) return;
    const id = forNode;
    const cycle3 = (key: StorageName): void => {
      const order = ['auto', 'on', 'off'];
      setViewSetting(ctx, key, order[(order.indexOf(stored(key, 'auto')) + 1) % order.length]!);
      render(); // toggles keep the menu open
    };
    const flip = (key: StorageName): void => {
      setViewSetting(ctx, key, stored(key, 'on') !== 'off' ? 'off' : 'on');
      render();
    };
    switch (btn.dataset['act']) {
      case 'open': close(); if (id !== undefined) selectDevice(ctx, id, false); break;
      case 'fly': close(); if (id !== undefined) selectDevice(ctx, id); break;
      case 'page': close(); if (id !== undefined) location.href = `${rootPrefix()}devices/${encodeURIComponent(id)}.html#d=${encodeURIComponent(id)}`; break;
      case 'copy-id': close(); if (id !== undefined) void navigator.clipboard?.writeText(id); break;
      case 'copy-ip': close(); if (id !== undefined) void navigator.clipboard?.writeText(ctx.deviceById.get(id)?.mgmtIp ?? ''); break;
      case 'fit': close(); ctx.camera.fit(true); break;
      case 'zoom-in': close(); zoomCenter(ctx, 1.35); break;
      case 'zoom-out': close(); zoomCenter(ctx, 1 / 1.35); break;
      case 't-labels': cycle3('labels'); break;
      case 't-ports': cycle3('ports'); break;
      case 't-motion': flip('motion'); break;
      case 't-minimap': flip('minimap'); break;
      case 'png': close(); void exportPng(ctx); break;
      case 'svg': close(); download(new Blob([standaloneSvg(ctx)], { type: 'image/svg+xml' }), `${fileStem(ctx)}.svg`); break;
      case 'palette': close(); openPalette(); break;
    }
  });

  // dismissal: click-away, Escape, wheel/pan, viewport resize
  addEventListener('pointerdown', (ev) => {
    if (!menu.hidden && !menu.contains(ev.target as Node)) close();
  }, true);
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !menu.hidden) close();
  });
  ctx.stage.addEventListener('wheel', () => close(), { passive: true });
  addEventListener('resize', () => close());
}

// ─── svg edge tooltip ───────────────────────────────────────────────────────

function setupTooltipSvg(ctx: Ctx): void {
  const tip = find(document, 'stage.tooltip');
  ctx.svg!.addEventListener('pointermove', (ev) => {
    const edge = (ev.target as Element).closest<SVGElement>(STAGE_HOOKS.edgeBound);
    if (!edge) {
      tip.hidden = true;
      return;
    }
    const edgeId = edge.getAttribute(STAGE_ATTR.edge);
    const link = ctx.data.links.find((l) => l.id === edgeId);
    const from = (link ? ctx.deviceById.get(link.from.device)?.name ?? link.from.device : edge.getAttribute(STAGE_ATTR.from)) ?? '';
    const to = (link ? ctx.deviceById.get(link.to.device)?.name ?? link.to.device : edge.getAttribute(STAGE_ATTR.to)) ?? '';
    const meta = link
      ? [link.from.port, link.to.port, link.speed, link.kind, link.mode].filter(Boolean).join(' · ')
      : edge.getAttribute(STAGE_ATTR.meta) ?? '';
    tip.innerHTML = `<strong>${html(from)} ⟷ ${html(to)}</strong>${meta ? `<span>${html(meta)}</span>` : ''}`;
    const rect = ctx.stage.getBoundingClientRect();
    tip.style.left = `${ev.clientX - rect.left + 14}px`;
    tip.style.top = `${ev.clientY - rect.top + 14}px`;
    tip.hidden = false;
  });
  ctx.svg!.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });
}

// ─── controls / theme / keyboard ────────────────────────────────────────────

function setupControls(ctx: Ctx): void {
  find(document, 'camera.fit').addEventListener('click', () => ctx.camera.fit(true));
  find(document, 'camera.zoomIn').addEventListener('click', () => zoomCenter(ctx, 1.35));
  find(document, 'camera.zoomOut').addEventListener('click', () => zoomCenter(ctx, 1 / 1.35));
}

// ─── export (reached via the ⌘K command center) ─────────────────────────────

export interface ExportOptions {
  titleBlock?: boolean;
  legend?: boolean;
  forcePorts?: boolean;
}

function fileStem(ctx: Ctx): string {
  return ctx.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topology';
}

function renderTitleBlock(
  tb: DataTitleBlock,
  x: number,
  y: number,
  w: number = 320,
  h: number = 74,
): string {
  const title = tb.title || 'Network Architecture';
  const author = tb.author || 'Marrow Studio';
  const revision = tb.revision || 'v2.0';
  const date = tb.date || new Date().toISOString().slice(0, 10);
  const logo = tb.logo
    ? `<text x="${x + 12}" y="${y + 15}" font-size="10" font-weight="700" fill="var(--m-accent, #f43f5e)" font-family="ui-sans-serif, system-ui, sans-serif" letter-spacing="0.08em">${html(tb.logo.toUpperCase())}</text>`
    : '';

  return (
    `<g class="m-blueprint-titleblock">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="var(--bg-raise, #161a22)" stroke="var(--line-strong, #30363d)" stroke-width="1.25"/>` +
    `<path d="M ${x} ${y + 24} h ${w}" stroke="var(--line, #21262d)" stroke-width="1"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="22" rx="5" fill="var(--panel, #111113)" opacity="0.6"/>` +
    (logo || `<text x="${x + 10}" y="${y + 16}" font-size="10" font-weight="700" fill="var(--ink, #c9d1d9)" font-family="ui-sans-serif, system-ui, sans-serif" letter-spacing="0.06em">MARROW ENGINEERING BLUEPRINT</text>`) +
    `<path d="M ${x + Math.round(w * 0.58)} ${y + 24} v ${h - 24}" stroke="var(--line, #21262d)" stroke-width="1"/>` +
    `<path d="M ${x} ${y + 49} h ${w}" stroke="var(--line, #21262d)" stroke-width="1"/>` +
    `<text x="${x + 10}" y="${y + 35}" font-size="7.5" font-weight="600" fill="var(--ink-dim, #8b949e)" font-family="ui-monospace, monospace" letter-spacing="0.05em">TITLE</text>` +
    `<text x="${x + 10}" y="${y + 46}" font-size="10.5" font-weight="600" fill="var(--ink, #f0f6fc)" font-family="ui-sans-serif, system-ui, sans-serif">${html(title)}</text>` +
    `<text x="${x + Math.round(w * 0.58) + 8}" y="${y + 35}" font-size="7.5" font-weight="600" fill="var(--ink-dim, #8b949e)" font-family="ui-monospace, monospace" letter-spacing="0.05em">DATE</text>` +
    `<text x="${x + Math.round(w * 0.58) + 8}" y="${y + 46}" font-size="9.5" fill="var(--ink, #f0f6fc)" font-family="ui-monospace, monospace">${html(date)}</text>` +
    `<text x="${x + 10}" y="${y + 60}" font-size="7.5" font-weight="600" fill="var(--ink-dim, #8b949e)" font-family="ui-monospace, monospace" letter-spacing="0.05em">AUTHOR</text>` +
    `<text x="${x + 10}" y="${y + 70}" font-size="9.5" fill="var(--ink, #f0f6fc)" font-family="ui-sans-serif, system-ui, sans-serif">${html(author)}</text>` +
    `<text x="${x + Math.round(w * 0.58) + 8}" y="${y + 60}" font-size="7.5" font-weight="600" fill="var(--ink-dim, #8b949e)" font-family="ui-monospace, monospace" letter-spacing="0.05em">REV</text>` +
    `<text x="${x + Math.round(w * 0.58) + 8}" y="${y + 70}" font-size="9.5" font-weight="700" fill="var(--m-accent, #f43f5e)" font-family="ui-monospace, monospace">${html(revision)}</text>` +
    `</g>`
  );
}

function renderAutoLegend(
  links: DataLink[],
  x: number,
  y: number,
  maxW: number,
): { svg: string; width: number; height: number } {
  if (!links.length) return { svg: '', width: 0, height: 0 };

  interface LegendEntry {
    label: string;
    mode?: string;
    kind?: string;
    speed?: string;
    status: string;
  }
  const seen = new Set<string>();
  const entries: LegendEntry[] = [];

  for (const l of links) {
    const mode = l.mode ?? (l.encap !== undefined ? 'tunnel' : undefined);
    const key = `${mode ?? 'default'}:${l.kind ?? ''}:${l.speed ?? ''}:${l.status}`;
    if (!seen.has(key)) {
      seen.add(key);
      const parts = [
        mode ? (mode.charAt(0).toUpperCase() + mode.slice(1)) : undefined,
        l.speed,
        l.kind ? (l.kind.charAt(0).toUpperCase() + l.kind.slice(1)) : undefined,
      ].filter(Boolean);
      entries.push({
        label: parts.length > 0 ? parts.join(' · ') : 'Standard Link',
        mode,
        kind: l.kind,
        speed: l.speed,
        status: l.status,
      });
    }
  }

  const displayEntries = entries.slice(0, 6);
  const cols = displayEntries.length > 3 ? 2 : 1;
  const colW = Math.min(220, Math.floor((maxW - 30) / cols));
  const rowH = 18;
  const rows = Math.ceil(displayEntries.length / cols);
  const legendW = cols * colW + 24;
  const legendH = 26 + rows * rowH + 8;

  let content =
    `<g class="m-blueprint-legend">` +
    `<rect x="${x}" y="${y}" width="${legendW}" height="${legendH}" rx="6" fill="var(--bg-raise, #161a22)" stroke="var(--line-strong, #30363d)" stroke-width="1.25"/>` +
    `<text x="${x + 10}" y="${y + 16}" font-size="9" font-weight="700" fill="var(--ink-dim, #8b949e)" font-family="ui-monospace, monospace" letter-spacing="0.06em">TOPOLOGY LEGEND</text>`;

  displayEntries.forEach((entry, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const ex = x + 12 + col * colW;
    const ey = y + 26 + row * rowH + 8;

    const mode = entry.mode;
    const cls = edgeClasses({
      status: entry.status,
      ...(entry.speed !== undefined ? { speed: entry.speed } : {}),
      ...(mode !== undefined ? { mode } : {}),
    });
    const lineX1 = ex;
    const lineX2 = ex + 32;

    const baseLine = `<line x1="${lineX1}" y1="${ey}" x2="${lineX2}" y2="${ey}" class="${cls}"/>`;
    const railLine = mode === 'trunk' ? `<line x1="${lineX1}" y1="${ey}" x2="${lineX2}" y2="${ey}" class="m-edge-rail"/>` : '';

    content +=
      baseLine +
      railLine +
      `<text x="${lineX2 + 8}" y="${ey + 3.5}" font-size="9.5" fill="var(--ink, #c9d1d9)" font-family="ui-sans-serif, system-ui, sans-serif">${html(entry.label)}</text>`;
  });

  content += `</g>`;
  return { svg: content, width: legendW, height: legendH };
}

/** Rebuild the diagram as a self-contained SVG document with modular blueprint chrome. */
function standaloneSvg(ctx: Ctx, options?: ExportOptions): string {
  const svg = ctx.svg!;
  const { w: origW, h: origH } = sceneSizeOf(svg, 100);
  const theme = readRoot(rootEl(), 'theme') ?? 'dark';

  const modular = parseModularParams(location.search, location.hash);
  const showTitle = options?.titleBlock ?? (modular.exportTitle !== 'off');
  const showLegend = options?.legend ?? (modular.exportLegend !== 'off');
  const forcePorts = options?.forcePorts ?? (modular.exportPorts !== 'off');

  const hasBlueprint = showTitle || (showLegend && ctx.data.links.length > 0);
  const blueprintMargin = hasBlueprint ? 110 : 0;
  const totalW = Math.max(origW, hasBlueprint ? 720 : origW);
  const totalH = origH + blueprintMargin;

  let css = '';
  try {
    css = [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((r) => r.cssText);
        } catch {
          return [];
        }
      })
      .join('\n');
  } catch {
    /* stylesheet unavailable — export still renders with UA defaults */
  }

  if (forcePorts) {
    css += '\n.m-portlabel { opacity: 1 !important; }\n';
  }

  // Clone and neutralize the live camera transform — export shows the WHOLE
  // scene at world coordinates (0..w, 0..h), not the current pan/zoom viewport.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelector(STAGE_HOOKS.camera)?.removeAttribute('transform');
  // drop transient interaction state so the export is a clean, settled frame
  for (const el of clone.querySelectorAll('.is-selected, .is-focus, .is-adj, .is-path')) {
    el.classList.remove('is-selected', 'is-focus', 'is-adj', 'is-path');
  }

  let blueprintOverlays = '';
  if (hasBlueprint) {
    // Dividing hairline
    blueprintOverlays += `<line x1="20" y1="${origH + 8}" x2="${totalW - 20}" y2="${origH + 8}" stroke="var(--line-strong, #30363d)" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>`;

    // Title Block on right
    if (showTitle) {
      const tb: DataTitleBlock = ctx.data.titleBlock ?? {
        title: ctx.data.name,
      };
      blueprintOverlays += renderTitleBlock(tb, totalW - 340, origH + 18, 320, 76);
    }

    // Auto-Legend on left
    if (showLegend && ctx.data.links.length > 0) {
      const legendRes = renderAutoLegend(ctx.data.links, 20, origH + 18, totalW - 380);
      blueprintOverlays += legendRes.svg;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" data-theme="${theme}" class="settled">` +
    `<style>${css}</style><rect width="${totalW}" height="${totalH}" style="fill: var(--bg)"/>` +
    clone.innerHTML +
    blueprintOverlays +
    `</svg>`
  );
}

async function exportPng(ctx: Ctx, options?: ExportOptions): Promise<void> {
  if (ctx.mode === 'canvas') {
    ctx.engine!.exportBitmap().toBlob((blob) => {
      if (blob) download(blob, `${fileStem(ctx)}.png`);
    }, 'image/png');
    return;
  }
  const svgText = standaloneSvg(ctx, options);
  const modular = parseModularParams(location.search, location.hash);
  const showTitle = options?.titleBlock ?? (modular.exportTitle !== 'off');
  const showLegend = options?.legend ?? (modular.exportLegend !== 'off');
  const hasBlueprint = showTitle || (showLegend && ctx.data.links.length > 0);
  const { w: origW, h: origH } = sceneSizeOf(ctx.svg!, 100);
  const totalW = Math.max(origW, hasBlueprint ? 720 : origW);
  const totalH = origH + (hasBlueprint ? 110 : 0);
  const w = totalW * 2;
  const h = totalH * 2;
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg rasterize failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    g.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) download(blob, `${fileStem(ctx)}.png`);
    }, 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Re-apply URL options after a `hashchange` (a host toggling an embedded diagram). */
function syncModularParams(ctx: Ctx): void {
  const opts = parseModularParams(location.search, location.hash);
  applyModularParams(rootEl(), opts);
  if (opts.inspector === 'off') find(document, 'inspector.panel').hidden = true;
  const minimap = find(document, 'minimap.root');
  if (opts.minimap === 'off') minimap.hidden = true;
  else if (opts.minimap === 'on' && ctx.data.devices.length >= 2) minimap.hidden = false;
}

function setupTheme(): void {
  const root = rootEl();
  const mql = matchMedia('(prefers-color-scheme: dark)');

  // `theme: auto` follows the viewer's OS scheme — unless they made an explicit
  // in-diagram choice, which is remembered for standalone viewing.
  const applyAuto = (): void => {
    if (readRoot(root, 'themeMode') === 'auto' && !localStorage.getItem(storageKey('theme'))) {
      writeRoot(root, 'theme', mql.matches ? 'dark' : 'light');
    }
  };
  // a URL theme wins (applied before paint by the pre-boot script; again here
  // in case the runtime was loaded without it), then the viewer's choice
  const url = parseModularParams(location.search, location.hash);
  applyModularParams(root, url);
  if (url.theme === undefined) {
    const choice = localStorage.getItem(storageKey('theme'));
    if (choice === 'dark' || choice === 'light') writeRoot(root, 'theme', choice);
    else applyAuto();
  }
  mql.addEventListener('change', applyAuto);

  // Embed API: a host page (docs site, blog, app) owns the surrounding UI, so
  // it can drive the diagram's theme. A diagram in an iframe is otherwise an
  // isolated document that can't see the host's light/dark toggle.
  //   host → iframe:  postMessage({ type: 'marrow:theme', theme: 'dark'|'light'|'auto' })
  //   iframe → host:  postMessage({ type: 'marrow:ready' })  (once, on load)
  // A host-driven theme is not persisted — it must not leak into standalone use.
  addEventListener('message', (e: MessageEvent) => {
    const d: unknown = e.data;
    if (!isEmbedMessage(d) || d.type !== EMBED.theme) return;
    if (d.theme === 'auto') {
      writeRoot(root, 'themeMode', 'auto');
      applyAuto();
    } else {
      writeRoot(root, 'themeMode', undefined);
      writeRoot(root, 'theme', d.theme);
    }
  });
  if (window.parent !== window) {
    try {
      window.parent.postMessage({ type: EMBED.ready }, '*');
    } catch {
      /* cross-origin parent — the host can still post in, we just can't ping out */
    }
  }

  // the static chrome ships "Ctrl K"; swap for the platform's own key on Macs
  if (/Mac|iP(hone|ad|od)/.test(navigator.platform)) {
    for (const btn of findAll(document, 'search.open')) {
      const kbd = btn.querySelector('kbd');
      if (kbd) kbd.textContent = '⌘ K';
    }
  }

  for (const btn of findAll(document, 'theme.toggle')) {
    btn.addEventListener('click', (ev) => {
      const opt = closestHook(ev.target, 'theme.option');
      const val = opt ? param(opt, 'themeVal') : undefined;
      const next = val === 'dark' || val === 'light' ? val : readRoot(root, 'theme') === 'light' ? 'dark' : 'light';
      writeRoot(root, 'theme', next);
      writeRoot(root, 'themeMode', undefined);
      localStorage.setItem(storageKey('theme'), next);
    });
  }
}

// ─── sidebar ────────────────────────────────────────────────────────────────

function setupSidebar(ctx: Ctx | undefined): void {
  const sidebar = find(document, 'sidebar.panel');
  const toggles = findAll(document, 'sidebar.toggle');
  const root = rootEl();

  const setOpen = (open: boolean): void => {
    sidebar.classList.toggle('open', open);
    sidebar.classList.toggle('is-collapsed', !open);
    for (const btn of toggles) btn.classList.toggle('on', open);
    localStorage.setItem(storageKey('sidebar'), open ? 'open' : 'closed');
  };
  const defaultOpen = !sidebar.classList.contains('is-collapsed');
  const remembered = localStorage.getItem(storageKey('sidebar'));
  setOpen(remembered !== null ? remembered === 'open' : defaultOpen);

  for (const btn of toggles) {
    btn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  }
  find(sidebar, 'sidebar.close').addEventListener('click', () => setOpen(false));
  document.addEventListener('pointerdown', (ev) => {
    if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
      const target = ev.target as Node;
      // the menubar popover is runtime-created (setupMenubar), not a page hook
      const menupop = document.querySelector<HTMLElement>('.m-menupop');
      if (menupop && !menupop.hidden && menupop.contains(target)) return;
      if (!sidebar.contains(target) && !toggles[0]?.contains(target)) {
        setOpen(false);
      }
    }
  });
  // collapsible nav groups (Branch, Building, …); in strip mode the head is
  // the group's single icon — clicking it expands the sidebar with it open
  sidebar.addEventListener('click', (ev) => {
    const head = closestHook(ev.target, 'sidebar.groupHead');
    if (!head) return;
    const group = head.parentElement!;
    if (!sidebar.classList.contains('open')) {
      setOpen(true);
      group.classList.remove('collapsed');
    } else {
      group.classList.toggle('collapsed');
    }
    head.setAttribute('aria-expanded', String(!group.classList.contains('collapsed')));
  });
  // shadcn SIDEBAR_KEYBOARD_SHORTCUT: ⌘B / Ctrl+B toggles the sidebar
  addEventListener('keydown', (ev) => {
    if (ev.key === 'b' && (ev.metaKey || ev.ctrlKey) && !isTyping()) {
      ev.preventDefault();
      setOpen(!sidebar.classList.contains('open'));
    }
  });

  // segmented controls (theme, labels)
  for (const seg of findAll(sidebar, 'settings.seg')) {
    const setting = param(seg, 'setting') as StorageName;
    const current = setting === 'theme' ? (readRoot(root, 'theme') ?? 'dark') : stored(setting, 'auto');
    syncSeg(seg, current);
    applySetting(ctx, setting, current);
    seg.addEventListener('click', (ev) => {
      const btn = (ev.target as Element).closest<HTMLButtonElement>(`button[${ATTR.value}]`);
      if (!btn) return;
      const value = param(btn, 'value')!;
      syncSeg(seg, value);
      localStorage.setItem(storageKey(setting), value);
      applySetting(ctx, setting, value);
    });
  }
}

/** Mark the segmented-control button for `value` active. */
function syncSeg(seg: HTMLElement, value: string): void {
  for (const b of seg.querySelectorAll('button')) b.classList.toggle('active', param(b, 'value') === value);

}

function setupMobileNav(): void {
  // the topology selector in the mobile bar opens the page navigation
  find(document, 'mobile.selector').addEventListener('click', () => {
    const sidebar = find(document, 'sidebar.panel');
    const isOpen = sidebar.classList.contains('open');
    sidebar.classList.toggle('open', !isOpen);
    if (!isOpen) setParam(find(document, 'inspector.panel'), 'sheet', 'closed');
  });
}

/** Persist + apply a view setting and keep any sidebar segmented control in step. */
function setViewSetting(ctx: Ctx | undefined, key: StorageName, value: string): void {
  localStorage.setItem(storageKey(key), value);
  applySetting(ctx, key, value);
  for (const seg of findAll(document, 'settings.seg')) if (param(seg, 'setting') === key) syncSeg(seg, value);
}

function applySetting(ctx: Ctx | undefined, setting: StorageName, value: string): void {
  const root = rootEl();
  switch (setting) {
    case 'theme':
      writeRoot(root, 'theme', value === 'light' ? 'light' : 'dark');
      break;
    case 'labels':
      writeRoot(root, 'labels', value);
      ctx?.engine?.setLabelMode(value as 'auto' | 'on' | 'off');
      break;
    case 'ports':
      writeRoot(root, 'ports', value);
      ctx?.engine?.setPortMode(value as 'auto' | 'on' | 'off');
      break;
    case 'motion':
      writeRoot(root, 'motion', value);
      ctx?.engine?.setMotion(value !== 'off');
      break;
    case 'minimap': {
      const wrap = maybe(document, 'minimap.root');
      if (wrap && (ctx?.data.devices.length ?? 0) >= 2) wrap.hidden = value === 'off';
      break;
    }
  }
}

/**
 * Inventory row details: a left-edge Drawer with the full device dossier
 * (no diagram round-trip), plus a row context menu — "See on diagram",
 * details, copy actions. Row click (outside links) opens the drawer too.
 */
function setupInventoryDetails(data: EmbeddedData): void {
  const panel = find(document, 'inspector.panel');
  if (data.devices.length === 0) return;

  registerYamlTabs(data);
  exposePublicApi(undefined);

  const deviceById = new Map(data.devices.map((d) => [d.id, d]));
  const linksByDevice = new Map<string, DataLink[]>();
  for (const l of data.links) {
    for (const key of [l.from.device, l.to.device]) {
      (linksByDevice.get(key) ?? linksByDevice.set(key, []).get(key)!).push(l);
    }
  }
  const maps: DeviceMaps = { deviceById, linksByDevice, devicePages: devicePageIds(data) };
  bindInspectorTabs(panel);

  const show = (id: string): void => {
    const d = deviceById.get(id);
    if (d) fillInspector(maps, d, show); // neighbor links navigate inside the drawer
  };
  find(panel, 'inspector.close').addEventListener('click', () => {
    panel.hidden = true;
  });
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !panel.hidden) panel.hidden = true;
  });

  const rowOf = (target: EventTarget | null): HTMLElement | null => closestHook(target, 'inventory.row');

  // click a row (not its link) → drawer
  document.addEventListener('click', (ev) => {
    if ((ev.target as Element).closest('a')) return;
    const row = rowOf(ev.target);
    if (row) show(param(row, 'id')!);
  });

  // ── row context menu (shadcn ContextMenu) ──
  const menu = document.createElement('div');
  menu.className = 'm-ctxmenu';
  menu.hidden = true;
  document.body.append(menu);
  let menuFor: string | undefined;
  const closeMenu = (): void => {
    menu.hidden = true;
    menuFor = undefined;
  };
  document.addEventListener('contextmenu', (ev) => {
    const row = rowOf(ev.target);
    if (!row) return;
    ev.preventDefault();
    menuFor = param(row, 'id')!;
    const d = deviceById.get(menuFor);
    if (!d) return;
    const item = (act: string, label: string): string =>
      `<button class="m-ctx-item" data-act="${act}"><span class="m-ctx-check"></span><span class="m-ctx-label">${html(label)}</span></button>`;
    menu.innerHTML =
      `<div class="m-ctx-title">${html(d.name)}<small>${html([d.mgmtIp, d.tier].filter(Boolean).join(' · ') || d.id)}</small></div>` +
      '<div class="m-ctx-sep"></div>' +
      item('details', 'View details') +
      item('diagram', 'See on diagram') +
      '<div class="m-ctx-sep"></div>' +
      item('copy-id', 'Copy device ID') +
      (d.mgmtIp !== undefined ? item('copy-ip', 'Copy mgmt IP') : '');
    menu.hidden = false;
    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.left = `${Math.min(ev.clientX, innerWidth - menu.offsetWidth - 8)}px`;
    menu.style.top = `${Math.min(ev.clientY, innerHeight - menu.offsetHeight - 8)}px`;
  });
  menu.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('.m-ctx-item');
    const id = menuFor;
    if (!btn || id === undefined) return;
    closeMenu();
    switch (btn.dataset['act']) {
      case 'details': show(id); break;
      case 'diagram': {
        // the row's name link already points at the device's canonical diagram
        const link = findAll(document, 'inventory.row')
          .find((r) => param(r, 'id') === id)
          ?.querySelector<HTMLAnchorElement>('a');
        if (link) location.href = link.href;
        break;
      }
      case 'copy-id': void navigator.clipboard?.writeText(id); break;
      case 'copy-ip': void navigator.clipboard?.writeText(deviceById.get(id)?.mgmtIp ?? ''); break;
    }
  });
  addEventListener('pointerdown', (ev) => {
    const t = ev.target as Node;
    if (!menu.hidden && !menu.contains(t)) closeMenu();
    if (!panel.hidden && !panel.contains(t) && !rowOf(ev.target) && !menu.contains(t)) panel.hidden = true;
  }, true);
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !menu.hidden) closeMenu();
  });
}

/** Inventory page: tabs (by-zone / flat), group-aware filter, per-bucket sort. */
function setupInventory(): void {
  const tables = findAll(document, 'inventory.table') as HTMLTableElement[];
  if (tables.length === 0) return;

  // shadcn Tabs: switch the hierarchy and flat views
  const tabs = findAll(document, 'inventory.tab');
  const views = findAll(document, 'inventory.view');
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const t of tabs) t.classList.toggle('active', t === tab);
      for (const v of views) v.hidden = param(v, 'view') !== param(tab, 'tab');
    });
  }

  const filter = find(document, 'inventory.filter');
  const rowsOf = (root: Element): HTMLTableRowElement[] => findAll(root, 'inventory.row') as HTMLTableRowElement[];
  const query = (): string => filter.value.trim().toLowerCase();
  const matchesQuery = (row: HTMLTableRowElement): boolean =>
    query() === '' || (param(row, 'search') ?? '').includes(query());

  // ── shadcn Pagination, once per table (each zone card AND the flat view) ──
  const PAGE_SIZE = 50;
  const pagerHtml = (pages: number, pageNo: number): string => {
    const num = (p: number): string => `<button type="button" class="m-page${p === pageNo ? ' active' : ''}" data-p="${p}">${p + 1}</button>`;
    const ell = '<span class="m-page-ell">…</span>';
    let nums = '';
    if (pages <= 7) {
      for (let p = 0; p < pages; p++) nums += num(p);
    } else {
      nums += num(0);
      if (pageNo > 2) nums += ell;
      for (let p = Math.max(1, pageNo - 1); p <= Math.min(pages - 2, pageNo + 1); p++) nums += num(p);
      if (pageNo < pages - 3) nums += ell;
      nums += num(pages - 1);
    }
    return (
      `<button type="button" class="m-page m-page-nav" data-p="${pageNo - 1}" ${pageNo === 0 ? 'disabled' : ''}>‹ Previous</button>` +
      nums +
      `<button type="button" class="m-page m-page-nav" data-p="${pageNo + 1}" ${pageNo === pages - 1 ? 'disabled' : ''}>Next ›</button>`
    );
  };
  interface Pager {
    refresh: () => void;
    reset: () => void;
  }
  const byTable = new Map<HTMLTableElement, Pager>();
  for (const table of tables) {
    const card = closestHook(table, 'inventory.group');
    const pagerEl = findAll(card ?? closestHook(table, 'inventory.view') ?? table, 'inventory.pager')[0];
    let pageNo = 0;
    const refresh = (): void => {
      const all = rowsOf(table);
      const matched = all.filter(matchesQuery);
      for (const row of all) row.hidden = true;
      const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
      pageNo = Math.min(pageNo, pages - 1);
      for (const row of matched.slice(pageNo * PAGE_SIZE, (pageNo + 1) * PAGE_SIZE)) row.hidden = false;
      for (const tb of table.tBodies) {
        // a nested-zone header hides when none of its rows are on this page
        const sub = findAll(tb, 'inventory.sub')[0];
        if (sub) sub.hidden = !rowsOf(tb).some((row) => !row.hidden);
      }
      if (card) card.hidden = matched.length === 0; // filter emptied the zone
      if (pagerEl) pagerEl.innerHTML = pages <= 1 ? '' : pagerHtml(pages, pageNo);
    };
    pagerEl?.addEventListener('click', (ev) => {
      const btn = (ev.target as Element).closest<HTMLButtonElement>('.m-page');
      if (!btn || btn.disabled) return;
      pageNo = Number(btn.dataset['p']);
      refresh();
    });
    byTable.set(table, { refresh, reset: () => { pageNo = 0; } });
    refresh();
  }
  filter.addEventListener('input', () => {
    for (const pager of byTable.values()) {
      pager.reset();
      pager.refresh();
    }
  });

  // column sort — within each tbody, so zone buckets keep their hierarchy;
  // every table re-paginates after sorting
  for (const table of tables) {
    const dirs = new Map<number, 1 | -1>();
    findAll(table, 'inventory.sort').forEach((th, col) => {
      th.addEventListener('click', () => {
        const dir = (dirs.get(col) ?? 1) as 1 | -1;
        dirs.set(col, dir === 1 ? -1 : 1);
        for (const tb of table.tBodies) {
          const rows = rowsOf(tb);
          rows.sort(
            (a, b) =>
              dir * (a.cells[col]?.textContent ?? '').localeCompare(b.cells[col]?.textContent ?? '', undefined, {
                numeric: true,
              }),
          );
          for (const row of rows) tb.append(row); // sub-header stays first
        }
        byTable.get(table)?.refresh();
      });
    });
  }

  // ── shadcn Resizable: handles BETWEEN zone panels — dragging trades height
  // between the section above and the section below, like a panel group ──
  const handles = findAll(document, 'inventory.resizeRow');
  const syncHandles = (): void => {
    for (const handle of handles) {
      const prev = handle.previousElementSibling as HTMLElement | null;
      const next = handle.nextElementSibling as HTMLElement | null;
      handle.hidden = !prev || !next || prev.hidden || next.hidden;
    }
  };
  syncHandles();
  filter.addEventListener('input', syncHandles);
  for (const handle of handles) {
    handle.addEventListener('pointerdown', (ev) => {
      const scrollIn = (el: Element | null): HTMLElement | undefined => (el ? findAll(el, 'inventory.scroll')[0] : undefined);
      const prev = scrollIn(handle.previousElementSibling);
      const next = scrollIn(handle.nextElementSibling);
      if (!prev || !next) return;
      ev.preventDefault();
      handle.setPointerCapture(ev.pointerId);
      const startY = ev.clientY;
      const prevH = prev.getBoundingClientRect().height;
      const nextH = next.getBoundingClientRect().height;
      const MIN = 96;
      const move = (e: PointerEvent): void => {
        const d = Math.max(-(prevH - MIN), Math.min(nextH - MIN, e.clientY - startY));
        prev.style.maxHeight = `${prevH + d}px`;
        next.style.maxHeight = `${nextH - d}px`;
      };
      const stop = (): void => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
    });
  }

  // vertical handles between columns: dragging trades WIDTH with the neighbor
  for (const handle of findAll(document, 'inventory.resizeCol')) {
    handle.addEventListener('pointerdown', (ev) => {
      const prev = handle.previousElementSibling as HTMLElement | null;
      const next = handle.nextElementSibling as HTMLElement | null;
      if (!prev || !next) return;
      ev.preventDefault();
      handle.setPointerCapture(ev.pointerId);
      const startX = ev.clientX;
      const prevW = prev.getBoundingClientRect().width;
      const nextW = next.getBoundingClientRect().width;
      const MIN_W = 250;
      const move = (e: PointerEvent): void => {
        const d = Math.max(-(prevW - MIN_W), Math.min(nextW - MIN_W, e.clientX - startX));
        prev.style.flex = `0 0 ${prevW + d}px`;
        next.style.flex = `0 0 ${nextW - d}px`;
      };
      const stop = (): void => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
    });
  }
}

function zoomCenter(ctx: Ctx, factor: number): void {
  const r = ctx.stage.getBoundingClientRect();
  ctx.camera.zoomAt(r.width / 2, r.height / 2, factor);
}

function setupKeyboard(ctx: Ctx): void {
  addEventListener('keydown', (ev) => {
    if (isTyping()) return;
    // Ctrl/⌘ zoom acts on the diagram, not the page
    if ((ev.metaKey || ev.ctrlKey) && (ev.key === '=' || ev.key === '+')) {
      ev.preventDefault();
      zoomCenter(ctx, 1.35);
      return;
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key === '-') {
      ev.preventDefault();
      zoomCenter(ctx, 1 / 1.35);
      return;
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key === '0') {
      ev.preventDefault();
      ctx.camera.fit(true);
      return;
    }
    if (ev.key === 'f') ctx.camera.fit(true);
    else if (ev.key === 'Escape') {
      const overlay = find(document, 'spotlight.root');
      if (!overlay.hidden) overlay.hidden = true;
      else deselect(ctx);
    } else if (ev.key === '+' || ev.key === '=') zoomCenter(ctx, 1.35);
    else if (ev.key === '-') zoomCenter(ctx, 1 / 1.35);
    else if (ev.key.startsWith('Arrow') && ctx.selected !== undefined) {
      const next = neighborInDirection(ctx, ctx.selected, ev.key);
      if (next !== undefined) {
        ev.preventDefault();
        selectDevice(ctx, next);
      }
    } else if ((ev.key === 'Enter' || ev.key === ' ') && ctx.mode === 'svg') {
      // keyboard focus on a node (tab order) opens it
      const el = document.activeElement;
      if (el instanceof SVGElement) {
        const nodeEl = el.closest<SVGGElement>(STAGE_HOOKS.nodeBound);
        if (nodeEl) {
          ev.preventDefault();
          const href = nodeEl.getAttribute(STAGE_ATTR.href);
          if (href !== null) location.href = rootPrefix() + href;
          else selectDevice(ctx, nodeEl.getAttribute(STAGE_ATTR.node)!, false);
        }
      }
    }
  });
}

/** Arrow-key traversal: the connected neighbor best matching the direction. */
function neighborInDirection(ctx: Ctx, from: string, key: string): string | undefined {
  const dir =
    key === 'ArrowUp' ? { x: 0, y: -1 } : key === 'ArrowDown' ? { x: 0, y: 1 } : key === 'ArrowLeft' ? { x: -1, y: 0 } : { x: 1, y: 0 };
  const origin = nodeWorldBox(ctx, from);
  if (!origin) return undefined;
  const ox = origin.x + origin.w / 2;
  const oy = origin.y + origin.h / 2;
  let best: string | undefined;
  let bestScore = 0.25; // require a meaningful directional component
  for (const nb of ctx.neighborIds.get(from) ?? []) {
    const box = nodeWorldBox(ctx, nb);
    if (!box) continue;
    const dx = box.x + box.w / 2 - ox;
    const dy = box.y + box.h / 2 - oy;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) continue;
    const score = (dx / dist) * dir.x + (dy / dist) * dir.y;
    if (score > bestScore) {
      bestScore = score;
      best = nb;
    }
  }
  return best;
}

// ─── minimap ────────────────────────────────────────────────────────────────

interface MiniGeometry {
  sceneW: number;
  sceneH: number;
  zones: Array<{ box: { x: number; y: number; w: number; h: number }; accent?: string }>;
  nodes: Array<{ box: { x: number; y: number; w: number; h: number }; status: string }>;
}

function miniGeometry(ctx: Ctx): MiniGeometry {
  if (ctx.mode === 'canvas') {
    const scene = ctx.engine!.scene;
    return {
      sceneW: scene.size.w,
      sceneH: scene.size.h,
      zones: scene.zones.map((z) => (z.accent !== undefined ? { box: z.box, accent: z.accent } : { box: z.box })),
      nodes: scene.nodes.map((n) => ({ box: n.box, status: n.status })),
    };
  }
  const svg = ctx.svg!;
  const zones: MiniGeometry['zones'] = [];
  for (const zoneEl of svg.querySelectorAll<SVGGElement>(STAGE_HOOKS.zone)) {
    const panel = zoneEl.querySelector<SVGRectElement>(STAGE_HOOKS.zonePanel);
    if (!panel) continue;
    const accent = /--m-zone-accent:\s*([^;"]+)/.exec(zoneEl.getAttribute('style') ?? '')?.[1];
    const box = {
      x: Number(panel.getAttribute('x')),
      y: Number(panel.getAttribute('y')),
      w: Number(panel.getAttribute('width')),
      h: Number(panel.getAttribute('height')),
    };
    zones.push(accent !== undefined ? { box, accent } : { box });
  }
  const nodes: MiniGeometry['nodes'] = [];
  for (const [, el] of ctx.nodeEls) {
    const b = (el as SVGGraphicsElement).getBBox();
    const status = [...el.classList].find((c) => c.startsWith('m-status-'))?.slice('m-status-'.length) ?? '';
    nodes.push({ box: { x: b.x, y: b.y, w: b.width, h: b.height }, status });
  }
  const size = sceneSizeOf(svg);
  return { sceneW: size.w, sceneH: size.h, zones, nodes };
}

function setupMinimap(ctx: Ctx): () => void {
  const wrap = find(document, 'minimap.root');
  if (ctx.data.devices.length < 2) return () => {};
  wrap.hidden = false;
  const geo = miniGeometry(ctx);
  const CW = 184;
  const CHMAX = 130;
  const PAD = 7;
  const k = Math.min((CW - PAD * 2) / geo.sceneW, (CHMAX - PAD * 2) / geo.sceneH);
  if (!(k > 0)) return () => {};
  const W = Math.round(geo.sceneW * k + PAD * 2);
  const H = Math.round(geo.sceneH * k + PAD * 2);

  let content = `<rect class="m-mini-world" x="${PAD}" y="${PAD}" width="${(geo.sceneW * k).toFixed(1)}" height="${(geo.sceneH * k).toFixed(1)}" rx="5"/>`;
  for (const z of geo.zones) {
    content += `<rect class="m-mini-zone" x="${(PAD + z.box.x * k).toFixed(1)}" y="${(PAD + z.box.y * k).toFixed(1)}" width="${(z.box.w * k).toFixed(1)}" height="${(z.box.h * k).toFixed(1)}" rx="3"${z.accent !== undefined ? ` style="--m-zone-accent:${z.accent}"` : ''}/>`;
  }
  const r = Math.max(1.4, Math.min(2.6, 3.4 - geo.nodes.length / 90));
  for (const n of geo.nodes) {
    content += `<circle class="m-mini-dot m-status-${n.status}" cx="${(PAD + (n.box.x + n.box.w / 2) * k).toFixed(1)}" cy="${(PAD + (n.box.y + n.box.h / 2) * k).toFixed(1)}" r="${r}"/>`;
  }

  const GLYPH_MAP =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>';
  const GLYPH_CHEVRON =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  const initiallyCollapsed = localStorage.getItem(storageKey('minimap')) === 'closed';

  wrap.innerHTML =
    `<button class="m-mini-toggle" type="button" aria-label="${initiallyCollapsed ? 'Show minimap' : 'Hide minimap'}">${initiallyCollapsed ? GLYPH_MAP : GLYPH_CHEVRON}</button>` +
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${content}<rect class="m-mini-view" x="0" y="0" width="10" height="10" rx="2"/></svg>`;

  if (initiallyCollapsed) {
    wrap.classList.add('collapsed');
  }

  // by position, not `querySelector('svg')`: the toggle's glyph is an <svg>
  // too, comes first, and is replaced whenever the toggle flips
  const mini = wrap.lastElementChild as SVGSVGElement;
  const view = mini.lastElementChild as SVGRectElement;
  const frame: MiniFrame = { pad: PAD, scale: k, sceneW: geo.sceneW, sceneH: geo.sceneH };
  const world = worldInMap(frame);
  let drawn: DrawnView = { rect: world, covers: true };

  const sync = (): void => {
    const cam = ctx.camera.get();
    if (!(cam.k > 0)) return; // never write invalid geometry mid-animation
    drawn = drawnView(viewInMap(cam, ctx.camera.visibleArea(), frame), world);
    view.setAttribute('x', drawn.rect.x.toFixed(1));
    view.setAttribute('y', drawn.rect.y.toFixed(1));
    view.setAttribute('width', drawn.rect.w.toFixed(1));
    view.setAttribute('height', drawn.rect.h.toFixed(1));
    view.classList.toggle('m-mini-whole', drawn.covers);
  };

  /** client px → map units (the svg may be scaled by CSS) */
  const toMap = (ev: PointerEvent): { x: number; y: number } => {
    const box = mini.getBoundingClientRect();
    return {
      x: box.width > 0 ? ((ev.clientX - box.left) * W) / box.width : 0,
      y: box.height > 0 ? ((ev.clientY - box.top) * H) / box.height : 0,
    };
  };
  /** the world point at the centre of the visible area */
  const viewCentre = (): { x: number; y: number } => {
    const cam = ctx.camera.get();
    const vis = ctx.camera.visibleArea();
    return { x: (vis.x + vis.w / 2 - cam.x) / cam.k, y: (vis.y + vis.h / 2 - cam.y) / cam.k };
  };

  // one pointer at a time (mouse, pen or a single finger); the minimap sits
  // outside the stage, so the stage's pan handler never sees these events
  let active: { id: number; map: { x: number; y: number }; centre: { x: number; y: number } } | undefined;

  const onPointerDown = (ev: PointerEvent): void => {
    if (active || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const m = toMap(ev);
    // inside the drawn viewport: grab it. Elsewhere (or when the view shows
    // the whole world, so the outline is not a handle): jump there, then
    // keep dragging from the new position.
    if (drawn.covers || !containsPoint(drawn.rect, m.x, m.y)) {
      const target = mapToWorld(m.x, m.y, frame);
      ctx.camera.centerOn(target.x, target.y, false);
    }
    active = { id: ev.pointerId, map: m, centre: viewCentre() };
    wrap.classList.add('m-dragging');
    try {
      mini.setPointerCapture(ev.pointerId);
    } catch {}
  };

  const onPointerMove = (ev: PointerEvent): void => {
    if (!active || ev.pointerId !== active.id) return;
    ev.preventDefault();
    ev.stopPropagation();
    const m = toMap(ev);
    // the viewport follows the pointer 1:1 in map units; its centre stays
    // on the world (or no further off than where the drag began)
    const { centre } = active;
    const x = clampTo(centre.x + (m.x - active.map.x) / k, Math.min(0, centre.x), Math.max(geo.sceneW, centre.x));
    const y = clampTo(centre.y + (m.y - active.map.y) / k, Math.min(0, centre.y), Math.max(geo.sceneH, centre.y));
    ctx.camera.centerOn(x, y, false);
  };

  const onPointerUp = (ev: PointerEvent): void => {
    if (!active || ev.pointerId !== active.id) return;
    active = undefined;
    wrap.classList.remove('m-dragging');
    try {
      mini.releasePointerCapture(ev.pointerId);
    } catch {}
  };

  mini.addEventListener('pointerdown', onPointerDown);
  mini.addEventListener('pointermove', onPointerMove);
  mini.addEventListener('pointerup', onPointerUp);
  mini.addEventListener('pointercancel', onPointerUp);
  mini.addEventListener('lostpointercapture', onPointerUp);

  const toggle = wrap.firstElementChild as HTMLButtonElement;
  toggle.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  const applyCollapsed = (collapsed: boolean): void => {
    wrap.classList.toggle('collapsed', collapsed);
    toggle.innerHTML = collapsed ? GLYPH_MAP : GLYPH_CHEVRON;
    toggle.setAttribute('aria-label', collapsed ? 'Show minimap' : 'Hide minimap');
  };
  applyCollapsed(initiallyCollapsed);
  toggle.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const collapsed = !wrap.classList.contains('collapsed');
    applyCollapsed(collapsed);
    localStorage.setItem(storageKey('minimap'), collapsed ? 'closed' : 'open');
  });

  sync();
  return sync;
}


// ─── deep links ─────────────────────────────────────────────────────────────

function setupHash(ctx: Ctx): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => syncHash(ctx), 250);
  };
}

function syncHash(ctx: Ctx): void {
  const state: { device?: string } = {};
  if (ctx.selected !== undefined) state.device = ctx.selected;
  history.replaceState(null, '', serializeHash(state) || location.pathname + location.search);
}

// ─── utils ──────────────────────────────────────────────────────────────────

function html(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A miniature of the link exactly as the diagram draws it.
 *
 * It carries the real edge classes from @marrow/visual (`edgeClasses`), so
 * the swatch inherits width from speed, colour/dash from status and mode, and
 * the flowing-dash animation — and can never drift out of sync with the
 * diagram. Dashes are px, so a plain 56px line shows them as drawn.
 */
function linkSwatch(l: DataLink): string {
  return `<svg class="m-swatch" viewBox="0 0 56 10" aria-hidden="true"><path class="${edgeClasses(l)}" d="M1 5H55"/></svg>`;
}

function cssSafe(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function isTyping(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

