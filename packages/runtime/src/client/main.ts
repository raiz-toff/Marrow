import { Camera } from './camera.js';
import { CanvasEngine, type CScene } from './canvas-engine.js';
import { linkSemanticsWords } from './link.js';
import { devicePageIds, globalSearchDocs, loadData, type DataDevice, type DataLink, type DataTitleBlock, type EmbeddedData } from './data.js';
import { parseHash, parseModularParams, serializeHash } from '../shared/hash.js';
import { searchDocs, type SearchDoc } from '../shared/search.js';

/** The interactive shell. One chrome (inspector, spotlight, minimap, tooltip,
 *  themes, deep links, keyboard) over two render backends: the SVG DOM for
 *  hero-tier pages, the canvas engine for scale-tier pages. */

const rootPrefix = (): string => document.documentElement.dataset['root'] ?? '';
const currentPage = (): string => document.documentElement.dataset['page'] ?? 'index.html';

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

function boot(): void {
  const data = loadData();
  const stage = document.querySelector<HTMLElement>('.m-stage');
  const svg = document.querySelector<SVGSVGElement>('.m-svg');
  const canvas = document.querySelector<HTMLCanvasElement>('.m-canvas');

  if (!stage || (!svg && !canvas)) {
    // document pages (inventory): chrome only
    setupTheme();
    setupSidebar(undefined);
    setupSpotlight(undefined, data);
    setupMenubar(undefined);
    setupShortcutsDialog();
    setupAboutDialog(undefined);
    setupInventory();
    setupInventoryDetails(data);
    setupMobileNav(undefined);
    (window as any).__MARROW_READY__ = true;
    window.dispatchEvent(new CustomEvent('marrow:ready'));
    return;
  }

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
    sceneSize = { w: Number(svg.dataset['w']) || 1, h: Number(svg.dataset['h']) || 1 };
    // class-qualified: port chips also carry data-node/data-edge and must
    // not shadow the real node groups / edge paths in these maps
    for (const el of svg.querySelectorAll<SVGGElement>('.m-node[data-node]')) nodeEls.set(el.dataset['node']!, el);
    for (const el of svg.querySelectorAll<SVGPathElement>('.m-edge[data-edge]')) edgeEls.set(el.dataset['edge']!, el);
  }
  if (canvas) {
    const scene = (data as { scene?: CScene }).scene;
    if (!scene) throw new Error('marrow: canvas page without embedded scene');
    engine = new CanvasEngine(canvas, stage, scene);
    sceneSize = scene.size;
  }

  const cameraTarget = svg?.querySelector<SVGGElement>('.m-camera') ?? undefined;
  const camera = new Camera(
    cameraTarget ?? (document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement),
    () => {
      const r = stage.getBoundingClientRect();
      return { w: r.width, h: r.height };
    },
    sceneSize,
    (s) => {
      document.documentElement.dataset['zoom'] = s.k < 0.55 ? 'far' : s.k > 1.5 ? 'near' : 'mid';
      engine?.applyCamera(s);
      minimapSync();
      hashSyncSoon();
      const zoomPct = `${Math.round(s.k * 100)}%`;
      for (const el of document.querySelectorAll('.m-zoom-readout')) {
        el.textContent = zoomPct;
      }
    },
    () => {
      const insets = { top: 0, right: 0, bottom: 0, left: 0 };
      const inspector = document.querySelector<HTMLElement>('.m-inspector');
      if (inspector && !inspector.hidden && inspector.dataset['sheet'] !== 'closed') {
        if (window.innerWidth < 768) {
          const snap = inspector.dataset['sheet'] || inspector.dataset['sheetSnap'] || 'half';
          const sheetH =
            snap === 'full'
              ? Math.round(window.innerHeight * 0.90)
              : snap === 'peek'
                ? 84
                : Math.round(window.innerHeight * 0.50);
          insets.bottom = Math.max(0, sheetH - 6);
        } else {
          insets.right = inspector.offsetWidth || 380;
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
  setupAboutDialog(ctx);
  const minimapSync = setupMinimap(ctx, stage);
  setupSidebar(ctx);
  setupClickAway(ctx);
  setupMobileNav(ctx);
  const hashSyncSoon = setupHash(ctx);
  syncModularParams(ctx);
  addEventListener('hashchange', () => syncModularParams(ctx));

  // re-apply persisted view settings — the ⌘K palette reads AND writes these,
  // so what it displays must be what the page is actually doing
  for (const key of ['labels', 'ports', 'motion', 'minimap']) {
    if (key === 'minimap' && document.documentElement.dataset['minimap'] === 'off') continue;
    const storedValue = localStorage.getItem(`marrow-${key}`);
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
  const wanted = !isReload ? (initial.device ?? (data as { hero?: string }).hero) : undefined;
  if (wanted !== undefined) {
    const resolved = resolveNodeFor(ctx, wanted);
    if (resolved !== undefined) selectDevice(ctx, resolved, false);
  }
  const settle = (): void => document.documentElement.classList.add('settled');
  setTimeout(settle, reduced ? 0 : 1900);
  addEventListener('pointerdown', settle, { once: true });

  const markReady = (): void => {
    (window as any).__MARROW_READY__ = true;
    window.dispatchEvent(new CustomEvent('marrow:ready'));
  };

  if (document.fonts?.ready) {
    document.fonts.ready
      .then(() => requestAnimationFrame(() => markReady()))
      .catch(() => markReady());
  } else {
    requestAnimationFrame(() => markReady());
  }
}

// ─── backend-neutral node operations ────────────────────────────────────────

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
  const sel = `.m-portlabel[data-edge="${CSS.escape(edgeId)}"]`;
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
    if (ctx.mode === 'svg' && (ev.target as Element).closest('.m-node[data-node], [data-edge]')) return;
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
  const root = document.documentElement;
  ctx.svg!.addEventListener('pointerover', (ev) => {
    const nodeEl = (ev.target as Element).closest<SVGGElement>('.m-node[data-node]');
    if (!nodeEl) return;
    applyFocus(ctx, nodeEl.dataset['node']!);
    root.classList.add('focus-mode');
  });
  ctx.svg!.addEventListener('pointerout', (ev) => {
    if (!(ev.target as Element).closest('.m-node[data-node]')) return;
    root.classList.remove('focus-mode');
    clearFocus(ctx);
    if (ctx.selected) applyFocus(ctx, ctx.selected);
  });
  ctx.svg!.addEventListener('click', (ev) => {
    const nodeEl = (ev.target as Element).closest<SVGGElement>('.m-node[data-node]');
    if (nodeEl) {
      const href = nodeEl.dataset['href'];
      if (href !== undefined) {
        location.href = rootPrefix() + href;
        return;
      }
      selectDevice(ctx, nodeEl.dataset['node']!, true);
      return;
    }
    const edgeEl = (ev.target as Element).closest<SVGElement>('[data-edge]');
    if (edgeEl && document.documentElement.dataset['inspector'] !== 'off') {
      const edgeId = edgeEl.getAttribute('data-edge');
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
    const edgeEl = (ev.target as Element).closest<SVGElement>('[data-edge]');
    if (edgeEl) setChipsHot(ctx, edgeEl.getAttribute('data-edge')!, true);
  });
  ctx.svg!.addEventListener('pointerout', (ev) => {
    const edgeEl = (ev.target as Element).closest<SVGElement>('[data-edge]');
    if (!edgeEl) return;
    const edgeId = edgeEl.getAttribute('data-edge')!;
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
  const root = document.documentElement;
  const tip = document.querySelector<HTMLElement>('.m-tooltip');
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
    if (!tip) return;
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
    if (edge && document.documentElement.dataset['inspector'] !== 'off') {
      const link = ctx.data.links.find((l) => l.id === edge.id);
      if (link) {
        selectLink(ctx, link);
        return;
      }
    }
    deselect(ctx);
  });
  ctx.stage.addEventListener('pointerleave', () => {
    if (tip) tip.hidden = true;
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
        const panel = document.querySelector<HTMLElement>('.m-inspector');
        if (panel) activateInspectorTab(panel, tabId);
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
  document.documentElement.classList.add('has-selection');
  applyFocus(ctx, id);
  renderInspector(ctx, device);
  if (fly) {
    const b = nodeWorldBox(ctx, id);
    if (b) ctx.camera.flyTo(b);
  }
  syncHash(ctx);
  const statusNode = document.querySelector('.m-status-node');
  if (statusNode) {
    const sub = [device.mgmtIp, device.role, device.tier].filter(Boolean).join(' · ');
    statusNode.textContent = sub ? `${device.name} · ${sub}` : device.name;
  }
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
  document.documentElement.classList.remove('has-selection');
  if (currentActiveCleanup) {
    try {
      currentActiveCleanup();
    } catch (e) {
      console.error(e);
    }
    currentActiveCleanup = undefined;
  }
  currentInspectedItem = null;
  const panel = document.querySelector<HTMLElement>('.m-inspector');
  if (panel) {
    panel.hidden = true;
    panel.dataset['sheet'] = 'closed';
  }
  const shell = document.getElementById('marrow-shell');
  if (shell) {
    shell.style.setProperty('--inspector-offset', '0px');
  }
  const statusNode = document.querySelector('.m-status-node');
  if (statusNode) statusNode.textContent = 'Ready';
  emitEvent('deselect');
}

export function selectLink(ctx: Ctx, link: DataLink, fly = true): void {
  activeCtx = ctx;
  currentInspectedItem = { type: 'edge', item: link };
  clearFocus(ctx);
  ctx.selected = undefined;
  document.documentElement.classList.add('has-selection');
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
      target.closest(
        '.m-inspector, .m-controls, .m-minimap, .m-spotlight, .m-rail-wrap, .m-dock, .m-sidebar, .m-command-bar, .m-status-bar, .m-mobile-nav, [data-node], [data-edge]',
      )
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
  if (document.documentElement.dataset['inspector'] === 'off') return;
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

  const tabs = panel.querySelectorAll<HTMLButtonElement>('.m-tab-btn');
  const panes = panel.querySelectorAll<HTMLElement>('.m-tab-pane, .m-inspector-pane');
  for (const tab of tabs) {
    const active = tab.dataset['tab'] === currentTab.id;
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

  const pane = panel.querySelector<HTMLElement>(`#m-pane-${currentTab.id}`);
  if (pane && currentTab.render) {
    const cleanup = currentTab.render(pane);
    if (typeof cleanup === 'function') {
      currentActiveCleanup = cleanup;
    }
  }

  if (window.innerWidth < 768 && (currentTab.id === 'interfaces' || currentTab.id === 'config')) {
    panel.dataset['sheet'] = 'full';
  }

  emitEvent('tabchange', currentTab.id);
}

function bindInspectorTabs(panel: HTMLElement): void {
  const tabsBar = panel.querySelector('.m-inspector-tabs');
  tabsBar?.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('.m-tab-btn');
    if (!btn || !btn.dataset['tab']) return;
    activateInspectorTab(panel, btn.dataset['tab']);
  });
}

function setupInspector(ctx: Ctx): void {
  const panel = document.querySelector<HTMLElement>('.m-inspector');
  if (!panel) return;

  panel.querySelector('.m-inspector-close')?.addEventListener('click', () => deselect(ctx));
  bindInspectorTabs(panel);

  const handle = panel.querySelector<HTMLElement>('.m-sheet-drag-handle');
  if (handle) {
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
      const current = panel.dataset['sheet'] || 'half';
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
      panel.dataset['sheet'] = next;
      panel.dataset['sheetSnap'] = next;
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
  }

  window.addEventListener('resize', () => {
    const shell = document.getElementById('marrow-shell');
    if (shell) {
      if (window.innerWidth < 768 || panel.hidden) {
        shell.style.setProperty('--inspector-offset', '0px');
      } else {
        shell.style.setProperty('--inspector-offset', '380px');
      }
    }
  });
}

function renderInspectorTabsAndPanes(panel: HTMLElement, tabs: TabInstance[]): void {
  currentTabsList = tabs;
  const tabsBar = panel.querySelector<HTMLElement>('.m-inspector-tabs');
  const body = panel.querySelector<HTMLElement>('.m-inspector-body');
  if (!tabsBar || !body) return;

  tabsBar.innerHTML = tabs
    .map(
      (t) =>
        `<button class="m-tab-btn" data-tab="${html(t.id)}" type="button" role="tab" aria-selected="false">${html(t.label)}</button>`,
    )
    .join('');

  const existingPanes = new Set<string>();
  for (const pane of body.querySelectorAll<HTMLElement>('.m-tab-pane, .m-inspector-pane')) {
    const id = pane.id.replace('m-pane-', '');
    existingPanes.add(id);
  }
  for (const t of tabs) {
    if (!existingPanes.has(t.id)) {
      const pane = document.createElement('div');
      pane.id = `m-pane-${t.id}`;
      pane.className = 'm-inspector-pane m-tab-pane';
      pane.setAttribute('role', 'tabpanel');
      pane.hidden = true;
      body.appendChild(pane);
    }
  }

  const activeBtn = panel.querySelector<HTMLButtonElement>('.m-tab-btn.is-active, .m-tab-btn.active');
  const wantedTabId = activeBtn?.dataset['tab'];
  const nextTabId = tabs.some((t) => t.id === wantedTabId) ? wantedTabId! : tabs[0]?.id;
  if (nextTabId) {
    activateInspectorTab(panel, nextTabId);
  }
}

function fillInspector(maps: DeviceMaps, d: DataDevice, onGoto: (id: string) => void): void {
  if (document.documentElement.dataset['inspector'] === 'off') return;
  const panel = document.querySelector<HTMLElement>('.m-inspector');
  const body = document.querySelector<HTMLElement>('.m-inspector-body');
  const title = document.querySelector<HTMLElement>('.m-inspector-title');
  if (!panel || !body || !title) return;

  activeMaps = maps;
  activeGoto = onGoto;
  currentInspectedItem = { type: 'device', item: d };

  title.textContent = d.name;
  const desc = document.querySelector<HTMLElement>('.m-inspector-desc');
  if (desc) desc.textContent = [d.role ?? d.tier, d.zone].filter(Boolean).join(' · ');

  const h = html;
  const facts: Array<[string, string | undefined]> = [
    ['ID', d.id],
    ['Tier', d.tier],
    ['Zone', d.zone],
    ['Role', d.role],
    ['Status', d.status],
    ['Mgmt IP', d.mgmtIp],
    ['HA pair', d.haPairWith],
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
          `<div class="m-icon-badge"><svg viewBox="0 0 48 48"><use href="#ic-${cssSafe(d.icon)}" width="48" height="48"/></svg><span class="m-status-pill m-status-${cssSafe(d.status)}">${h(d.status)}</span>${fullPage}</div>`,
          `<dl class="m-facts">${facts
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v!)}</dd>`)
            .join('')}</dl>`,
          d.stack
            ? `<h3>Members (${d.stack.members.length})</h3><ul class="m-members">${d.stack.members
                .map((m) => `<li>${h(m)}</li>`)
                .join('')}</ul>`
            : '',
          d.note ? `<h3>Note</h3><div class="m-note">${h(d.note)}</div>` : '',
        ].join('');
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
  panel.dataset['sheet'] = panel.dataset['sheet'] && panel.dataset['sheet'] !== 'closed' ? panel.dataset['sheet'] : 'half';
  const shell = document.getElementById('marrow-shell');
  if (shell && window.innerWidth >= 768) {
    shell.style.setProperty('--inspector-offset', '380px');
  }
}

function fillLinkInspector(maps: DeviceMaps, l: DataLink, onGoto: (id: string) => void): void {
  if (document.documentElement.dataset['inspector'] === 'off') return;
  const panel = document.querySelector<HTMLElement>('.m-inspector');
  const body = document.querySelector<HTMLElement>('.m-inspector-body');
  const title = document.querySelector<HTMLElement>('.m-inspector-title');
  if (!panel || !body || !title) return;

  activeMaps = maps;
  activeGoto = onGoto;
  currentInspectedItem = { type: 'edge', item: l };

  const fromName = maps.deviceById.get(l.from.device)?.name ?? l.from.device;
  const toName = maps.deviceById.get(l.to.device)?.name ?? l.to.device;
  title.textContent = `${fromName} ⟷ ${toName}`;
  const desc = document.querySelector<HTMLElement>('.m-inspector-desc');
  if (desc) desc.textContent = [l.kind, l.speed, l.mode].filter(Boolean).join(' · ');

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
  panel.dataset['sheet'] = 'half';
  const shell = document.getElementById('marrow-shell');
  if (shell && window.innerWidth >= 768) {
    shell.style.setProperty('--inspector-offset', '380px');
  }

  const statusNode = document.querySelector('.m-status-node');
  if (statusNode) statusNode.textContent = `${fromName} ⟷ ${toName}`;
}

// ─── spotlight ──────────────────────────────────────────────────────────────

function setupSpotlight(ctx: Ctx | undefined, data: EmbeddedData): void {
  const overlay = document.querySelector<HTMLElement>('.m-spotlight');
  const input = document.querySelector<HTMLInputElement>('.m-spotlight input');
  const list = document.querySelector<HTMLElement>('.m-spotlight ul');
  if (!overlay || !input || !list) return;

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
    const root = document.documentElement;
    const stored = (key: string, dflt: string): string => localStorage.getItem(`marrow-${key}`) ?? dflt;
    const cycle3 = (key: string): string => {
      const order = ['auto', 'on', 'off'];
      return order[(order.indexOf(stored(key, 'auto')) + 1) % order.length]!;
    };
    const set = (key: string, value: string): void => setViewSetting(ctx, key, value);
    const cmds: Command[] = [
      {
        label: 'Toggle theme',
        icon: CMD_IC.moon,
        shortcut: root.dataset['theme'] ?? 'dark',
        keywords: 'dark light mode appearance',
        run: () => set('theme', root.dataset['theme'] === 'light' ? 'dark' : 'light'),
      },
    ];
    if (ctx !== undefined) {
      cmds.push(
        {
          label: 'Device labels',
          icon: CMD_IC.tag,
          shortcut: stored('labels', 'auto'),
          keywords: 'names show hide cycle',
          run: () => set('labels', cycle3('labels')),
        },
        {
          label: 'Port labels',
          icon: CMD_IC.plug,
          shortcut: stored('ports', 'auto'),
          keywords: 'interfaces chips cycle',
          run: () => set('ports', cycle3('ports')),
        },
        {
          label: 'Link motion',
          icon: CMD_IC.pulse,
          shortcut: stored('motion', 'on') !== 'off' ? 'on' : 'off',
          keywords: 'animation flow dashes',
          run: () => set('motion', stored('motion', 'on') !== 'off' ? 'off' : 'on'),
        },
        {
          label: 'Minimap',
          icon: CMD_IC.map,
          shortcut: stored('minimap', 'on') !== 'off' ? 'on' : 'off',
          keywords: 'overview map corner',
          run: () => set('minimap', stored('minimap', 'on') !== 'off' ? 'off' : 'on'),
        },
      );
    }
    return cmds;
  };

  const collectCommands = (): { nav: Command[]; actions: Command[]; view: Command[] } => {
    const nav: Command[] = [];
    for (const a of document.querySelectorAll<HTMLAnchorElement>('.m-side-nav a.m-side-row')) {
      if (a.href === '') continue;
      nav.push({
        label: a.dataset['label'] ?? a.querySelector('span')?.textContent ?? a.href,
        icon: a.querySelector('i')?.innerHTML ?? '',
        keywords: 'go to open page',
        run: () => {
          location.href = a.href;
        },
      });
    }
    const mac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
    const actions: Command[] = [];
    const add = (selector: string, label: string, opts: { shortcut?: string; keywords?: string } = {}): void => {
      const btn = document.querySelector<HTMLElement>(selector);
      if (!btn) return;
      const cmd: Command = { label, icon: btn.querySelector('svg')?.outerHTML ?? '', run: () => btn.click() };
      if (opts.shortcut !== undefined) cmd.shortcut = opts.shortcut;
      if (opts.keywords !== undefined) cmd.keywords = opts.keywords;
      actions.push(cmd);
    };
    add('.m-ctl-fit', 'Fit view', { shortcut: 'F', keywords: 'zoom reset center' });
    add('.m-ctl-in', 'Zoom in', { shortcut: '+' });
    add('.m-ctl-out', 'Zoom out', { shortcut: '−' });
    add('.m-sidebar-btn', 'Toggle sidebar', { shortcut: mac ? '⌘B' : 'Ctrl B', keywords: 'panel browse' });
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
  const open = (): void => {
    overlay.hidden = false;
    input.value = '';
    render('');
    input.focus();
  };
  const close = (): void => {
    overlay.hidden = true;
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
  // the dock pill, command bar search pill, and peek tab all open search
  for (const btn of document.querySelectorAll('.m-search-btn, .m-cmd-search-btn')) btn.addEventListener('click', open);
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
  const rawScript = document.getElementById('marrow-data')?.textContent;
  const data: EmbeddedData | undefined = ctx?.data ?? (rawScript ? JSON.parse(rawScript) : undefined);
  if (!data) return;

  const titleEl = dlg.querySelector<HTMLElement>('.m-about-title');
  const descEl = dlg.querySelector<HTMLElement>('.m-about-desc');
  const bodyEl = dlg.querySelector<HTMLElement>('.m-about-body');

  if (titleEl) titleEl.textContent = data.name || 'Topology Diagram';
  if (descEl) {
    descEl.textContent = data.description || '';
    descEl.hidden = !data.description;
  }

  if (!bodyEl) return;

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
  const dlg = document.querySelector<HTMLElement>('.m-about-dialog');
  if (!dlg) return;
  fillAboutDialog(dlg, ctx);
  dlg.hidden = false;
}

function setupAboutDialog(ctx?: Ctx): void {
  const dlg = document.querySelector<HTMLElement>('.m-about-dialog');
  if (!dlg) return;
  dlg.querySelector('.m-about-close')?.addEventListener('click', () => {
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
  const dlg = document.querySelector<HTMLElement>('.m-shortcuts');
  if (dlg) dlg.hidden = false;
}

function setupShortcutsDialog(): void {
  const dlg = document.querySelector<HTMLElement>('.m-shortcuts');
  if (!dlg) return;
  dlg.querySelector('.m-shortcuts-close')?.addEventListener('click', () => {
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
  const bar = document.querySelector<HTMLElement>('.m-menubar');
  if (!bar) return;
  const pop = document.createElement('div');
  pop.className = 'm-ctxmenu m-menupop';
  pop.hidden = true;
  document.body.append(pop);
  let openMenu: string | undefined;

  const CHECK =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const stored = (k: string, d: string): string => localStorage.getItem(`marrow-${k}`) ?? d;
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

  const content = (menu: string): string => {
    if (menu === 'view') {
      const stage = ctx !== undefined;
      return (
        (stage
          ? item('fit', 'Fit view', { shortcut: 'F' }) +
            item('zoom-in', 'Zoom in', { shortcut: `${mod}+` }) +
            item('zoom-out', 'Zoom out', { shortcut: `${mod}−` }) +
            sep() +
            item('t-labels', 'Device labels', { check: stored('labels', 'auto') }) +
            item('t-ports', 'Port labels', { check: stored('ports', 'auto') }) +
            item('t-motion', 'Link motion', { check: stored('motion', 'on') !== 'off' }) +
            item('t-minimap', 'Minimap', { check: stored('minimap', 'on') !== 'off' }) +
            sep()
          : '') +
        item('t-theme', 'Theme', { check: document.documentElement.dataset['theme'] ?? 'dark' })
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

  const syncTriggers = (): void => {
    for (const b of bar.querySelectorAll<HTMLButtonElement>('[data-menu]')) {
      b.classList.toggle('open', b.dataset['menu'] === openMenu);
    }
  };
  const close = (): void => {
    pop.hidden = true;
    openMenu = undefined;
    syncTriggers();
  };
  const openFor = (btn: HTMLButtonElement): void => {
    openMenu = btn.dataset['menu']!;
    pop.innerHTML = content(openMenu);
    pop.hidden = false;
    const r = btn.getBoundingClientRect();
    pop.style.left = '0px';
    pop.style.top = '0px';
    pop.style.left = `${Math.min(r.left, innerWidth - pop.offsetWidth - 8)}px`;
    pop.style.top = `${Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8)}px`;
    syncTriggers();
  };

  for (const btn of bar.querySelectorAll<HTMLButtonElement>('[data-menu]')) {
    btn.addEventListener('click', () => {
      if (openMenu === btn.dataset['menu']) close();
      else openFor(btn);
    });
    // Menubar behavior: with a menu open, hovering a sibling trigger switches
    btn.addEventListener('mouseenter', () => {
      if (openMenu !== undefined && openMenu !== btn.dataset['menu']) openFor(btn);
    });
  }

  pop.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('.m-ctx-item');
    if (!btn) return;
    const rerender = (): void => {
      if (openMenu !== undefined) pop.innerHTML = content(openMenu);
    };
    const cycle3 = (key: string): void => {
      const order = ['auto', 'on', 'off'];
      setViewSetting(ctx, key, order[(order.indexOf(stored(key, 'auto')) + 1) % order.length]!);
      rerender();
    };
    const flip = (key: string): void => {
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
        setViewSetting(ctx, 'theme', document.documentElement.dataset['theme'] === 'light' ? 'dark' : 'light');
        rerender();
        break;
      case 'png': close(); if (ctx) void exportPng(ctx); break;
      case 'svg': close(); if (ctx) download(new Blob([standaloneSvg(ctx)], { type: 'image/svg+xml' }), `${fileStem(ctx)}.svg`); break;
      case 'print': close(); window.print(); break;
      case 'guide': close(); openShortcutsGuide(); break;
      case 'palette': close(); document.querySelector<HTMLButtonElement>('.m-search-btn')?.click(); break;
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
  const stored = (k: string, d: string): string => localStorage.getItem(`marrow-${k}`) ?? d;
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
      menu.innerHTML =
        item('fit', 'Fit view', { shortcut: 'F' }) +
        item('zoom-in', 'Zoom in', { shortcut: `${mod}+` }) +
        item('zoom-out', 'Zoom out', { shortcut: `${mod}−` }) +
        sep() +
        item('t-labels', 'Device labels', { check: stored('labels', 'auto') }) +
        item('t-ports', 'Port labels', { check: stored('ports', 'auto') }) +
        item('t-motion', 'Link motion', { check: stored('motion', 'on') !== 'off' }) +
        item('t-minimap', 'Minimap', { check: stored('minimap', 'on') !== 'off' }) +
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
      const nodeEl = (ev.target as Element).closest<SVGGElement>('.m-node[data-node]');
      forNode = nodeEl?.dataset['node'];
    } else {
      forNode = hitNode(ctx, ev)?.id;
    }
    openAt(ev.clientX, ev.clientY);
  });

  menu.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('.m-ctx-item');
    if (!btn || btn.disabled) return;
    const id = forNode;
    const cycle3 = (key: string): void => {
      const order = ['auto', 'on', 'off'];
      setViewSetting(ctx, key, order[(order.indexOf(stored(key, 'auto')) + 1) % order.length]!);
      render(); // toggles keep the menu open
    };
    const flip = (key: string): void => {
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
      case 'palette': close(); document.querySelector<HTMLButtonElement>('.m-search-btn')?.click(); break;
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
  const tip = document.querySelector<HTMLElement>('.m-tooltip');
  if (!tip) return;
  ctx.svg!.addEventListener('pointermove', (ev) => {
    const edge = (ev.target as Element).closest<SVGElement>('[data-edge]');
    if (!edge) {
      tip.hidden = true;
      return;
    }
    const edgeId = edge.getAttribute('data-edge');
    const link = ctx.data.links.find((l) => l.id === edgeId);
    const from = (link ? ctx.deviceById.get(link.from.device)?.name ?? link.from.device : edge.dataset['from']) ?? '';
    const to = (link ? ctx.deviceById.get(link.to.device)?.name ?? link.to.device : edge.dataset['to']) ?? '';
    const meta = link
      ? [link.from.port, link.to.port, link.speed, link.kind, link.mode].filter(Boolean).join(' · ')
      : edge.dataset['meta'] ?? '';
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
  for (const btn of document.querySelectorAll('.m-ctl-fit')) {
    btn.addEventListener('click', () => ctx.camera.fit(true));
  }
  for (const btn of document.querySelectorAll('.m-ctl-in')) {
    btn.addEventListener('click', () => zoomCenter(ctx, 1.35));
  }
  for (const btn of document.querySelectorAll('.m-ctl-out')) {
    btn.addEventListener('click', () => zoomCenter(ctx, 1 / 1.35));
  }
  for (const btn of document.querySelectorAll('.m-minimap-btn')) {
    btn.addEventListener('click', () => {
      const mini = document.querySelector<HTMLButtonElement>('.m-minimap .m-mini-toggle');
      if (mini) mini.click();
    });
  }
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
    `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="22" rx="5" fill="var(--surface, #0d1117)" opacity="0.6"/>` +
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
    const speedClass = entry.speed ? ` m-speed-${cssSafe(entry.speed)}` : '';
    const modeClass = mode ? ` m-mode-${cssSafe(mode)}` : '';
    const statusClass = ` m-status-${cssSafe(entry.status)}`;
    const lineX1 = ex;
    const lineX2 = ex + 32;

    const baseLine = `<line x1="${lineX1}" y1="${ey}" x2="${lineX2}" y2="${ey}" class="m-edge${speedClass}${modeClass}${statusClass}"/>`;
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
  const origW = Number(svg.dataset['w']) || 100;
  const origH = Number(svg.dataset['h']) || 100;
  const theme = document.documentElement.dataset['theme'] ?? 'dark';

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
  clone.querySelector('.m-camera')?.removeAttribute('transform');
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
  const origW = Number(ctx.svg!.dataset['w']) || 100;
  const origH = Number(ctx.svg!.dataset['h']) || 100;
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

function syncModularParams(ctx?: Ctx): void {
  const root = document.documentElement;
  const opts = parseModularParams(location.search, location.hash);

  if (opts.chrome === 'minimal') {
    root.dataset['chrome'] = 'minimal';
  } else if (opts.chrome === 'full') {
    delete root.dataset['chrome'];
  }

  if (opts.inspector === 'off') {
    root.dataset['inspector'] = 'off';
    const panel = document.querySelector<HTMLElement>('.m-inspector');
    if (panel) panel.hidden = true;
  } else if (opts.inspector === 'on') {
    delete root.dataset['inspector'];
  }

  if (opts.minimap === 'off') {
    root.dataset['minimap'] = 'off';
    const wrap = document.querySelector<HTMLElement>('.m-minimap');
    if (wrap) wrap.hidden = true;
  } else if (opts.minimap === 'on') {
    delete root.dataset['minimap'];
    const wrap = document.querySelector<HTMLElement>('.m-minimap');
    if (wrap && (ctx?.data.devices.length ?? 0) >= 2) wrap.hidden = false;
  }

  if (opts.theme) {
    root.dataset['theme'] = opts.theme;
  }
}

function setupTheme(): void {
  const root = document.documentElement;
  const mql = matchMedia('(prefers-color-scheme: dark)');

  // `theme: auto` follows the viewer's OS scheme — unless they made an explicit
  // in-diagram choice, which is remembered for standalone viewing.
  const applyAuto = (): void => {
    if (root.dataset['themeMode'] === 'auto' && !localStorage.getItem('marrow-theme')) {
      root.dataset['theme'] = mql.matches ? 'dark' : 'light';
    }
  };
  const q = new URLSearchParams(location.search);
  const h = location.hash.slice(1);
  const hp = new URLSearchParams(h.includes(';') ? h.replace(/;/g, '&') : h);
  const urlTheme = q.get('theme') || hp.get('theme');
  if (urlTheme === 'dark' || urlTheme === 'light') {
    root.dataset['theme'] = urlTheme;
  } else {
    const stored = localStorage.getItem('marrow-theme');
    if (stored === 'dark' || stored === 'light') root.dataset['theme'] = stored;
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
    const d = e.data as { type?: string; theme?: string } | null;
    if (!d || d.type !== 'marrow:theme') return;
    if (d.theme === 'auto') {
      root.dataset['themeMode'] = 'auto';
      applyAuto();
    } else if (d.theme === 'dark' || d.theme === 'light') {
      delete root.dataset['themeMode'];
      root.dataset['theme'] = d.theme;
    }
  });
  if (window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'marrow:ready' }, '*');
    } catch {
      /* cross-origin parent — the host can still post in, we just can't ping out */
    }
  }

  // the static shell ships "Ctrl K"; swap for the platform's own key on Macs
  if (/Mac|iP(hone|ad|od)/.test(navigator.platform)) {
    for (const kbd of document.querySelectorAll('.m-searchpill kbd, .m-dock-hint kbd')) kbd.textContent = '⌘ K';
  }

  for (const btn of document.querySelectorAll('.m-theme-btn')) {
    btn.addEventListener('click', () => {
      const next = root.dataset['theme'] === 'light' ? 'dark' : 'light';
      root.dataset['theme'] = next;
      delete root.dataset['themeMode'];
      localStorage.setItem('marrow-theme', next);
    });
  }
}

// ─── sidebar ────────────────────────────────────────────────────────────────

function setupSidebar(ctx: Ctx | undefined): void {
  const sidebar = document.querySelector<HTMLElement>('.m-sidebar');
  if (!sidebar) return;
  const root = document.documentElement;

  const setOpen = (open: boolean): void => {
    sidebar.classList.toggle('open', open);
    sidebar.classList.toggle('is-collapsed', !open);
    for (const btn of document.querySelectorAll('.m-sidebar-btn')) {
      btn.classList.toggle('on', open);
    }
    localStorage.setItem('marrow-sidebar', open ? 'open' : 'closed');
  };
  const defaultOpen = !sidebar.classList.contains('is-collapsed');
  const stored = localStorage.getItem('marrow-sidebar');
  setOpen(stored !== null ? stored === 'open' : defaultOpen);

  for (const btn of document.querySelectorAll('.m-sidebar-btn')) {
    btn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  }
  for (const closeBtn of sidebar.querySelectorAll<HTMLButtonElement>('.m-sidebar-close')) {
    closeBtn.addEventListener('click', () => setOpen(false));
  }
  document.addEventListener('pointerdown', (ev) => {
    if (window.innerWidth < 768 && sidebar.classList.contains('open')) {
      const target = ev.target as Node;
      if (!sidebar.contains(target) && !document.querySelector('.m-sidebar-btn')?.contains(target)) {
        setOpen(false);
      }
    }
  });
  // collapsible nav groups (Branch, Building, …); in strip mode the head is
  // the group's single icon — clicking it expands the sidebar with it open
  sidebar.addEventListener('click', (ev) => {
    const head = (ev.target as Element).closest<HTMLButtonElement>('.m-side-group-head');
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

  setupRail(ctx, sidebar);

  // segmented controls (theme, labels)
  const applySeg = (seg: HTMLElement, value: string): void => {
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('active', b.dataset['value'] === value);
  };
  for (const seg of sidebar.querySelectorAll<HTMLElement>('.m-seg')) {
    const setting = seg.dataset['setting']!;
    const current =
      setting === 'theme'
        ? (root.dataset['theme'] ?? 'dark')
        : localStorage.getItem(`marrow-${setting}`) ?? 'auto';
    applySeg(seg, current);
    applySetting(ctx, setting, current);
    seg.addEventListener('click', (ev) => {
      const btn = (ev.target as Element).closest<HTMLButtonElement>('button[data-value]');
      if (!btn) return;
      const value = btn.dataset['value']!;
      applySeg(seg, value);
      localStorage.setItem(`marrow-${setting}`, value);
      applySetting(ctx, setting, value);
    });
  }

  // switches (motion, minimap)
  for (const sw of sidebar.querySelectorAll<HTMLButtonElement>('.m-switch')) {
    const setting = sw.dataset['setting']!;
    let on = localStorage.getItem(`marrow-${setting}`) !== 'off';
    const apply = (): void => {
      sw.setAttribute('aria-checked', String(on));
      applySetting(ctx, setting, on ? 'on' : 'off');
    };
    apply();
    sw.addEventListener('click', () => {
      on = !on;
      localStorage.setItem(`marrow-${setting}`, on ? 'on' : 'off');
      apply();
    });
  }
}

function setupMobileNav(ctx: Ctx | undefined): void {
  const nav = document.querySelector<HTMLElement>('.m-mobile-nav');
  if (!nav) return;

  const setActive = (action: string): void => {
    for (const b of nav.querySelectorAll<HTMLButtonElement>('.m-mob-btn, .m-mobile-btn')) {
      const match = b.dataset['action'] === action;
      b.classList.toggle('is-active', match);
      b.classList.toggle('active', match);
    }
  };

  nav.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('.m-mob-btn, .m-mobile-btn');
    if (!btn || !btn.dataset['action']) return;
    const action = btn.dataset['action'];
    setActive(action);

    const sidebar = document.querySelector<HTMLElement>('.m-sidebar');
    const inspector = document.querySelector<HTMLElement>('.m-inspector');

    if (action === 'canvas') {
      sidebar?.classList.remove('open');
      if (inspector) inspector.dataset['sheet'] = 'closed';
    } else if (action === 'search') {
      const searchBtn = document.querySelector<HTMLButtonElement>('.m-cmd-search-btn, .m-search-btn');
      searchBtn?.click();
    } else if (action === 'pages') {
      if (sidebar) {
        const isOpen = sidebar.classList.contains('open');
        sidebar.classList.toggle('open', !isOpen);
        if (!isOpen && inspector) inspector.dataset['sheet'] = 'closed';
      }
    } else if (action === 'details') {
      if (inspector) {
        sidebar?.classList.remove('open');
        inspector.hidden = false;
        inspector.dataset['sheet'] = 'half';
      }
    }
  });
}

/** The v1-style icon rail: quick toggles kept in sync with the panel controls. */
function setupRail(ctx: Ctx | undefined, sidebar: HTMLElement): void {
  const rail = document.querySelector<HTMLElement>('.m-rail');
  if (!rail) return;

  setupRailPin(rail);

  const syncRailButton = (btn: HTMLButtonElement, setting: string, value: string): void => {
    const base = (btn.dataset['title'] ?? '').split(':')[0]!;
    if (btn.dataset['cycle'] !== undefined) {
      btn.dataset['title'] = `${base}: ${value}`;
      btn.classList.toggle('on', value === 'on');
      btn.classList.toggle('off', value === 'off');
    } else {
      const on = setting === 'theme' ? value === 'light' : value !== 'off';
      btn.classList.toggle('on', setting === 'theme' ? on : false);
      btn.classList.toggle('off', setting !== 'theme' && !on);
    }
  };

  const syncPanel = (setting: string, value: string): void => {
    const seg = sidebar.querySelector<HTMLElement>(`.m-seg[data-setting="${setting}"]`);
    if (seg) {
      for (const b of seg.querySelectorAll('button')) b.classList.toggle('active', b.dataset['value'] === value);
    }
    const sw = sidebar.querySelector<HTMLButtonElement>(`.m-switch[data-setting="${setting}"]`);
    if (sw) sw.setAttribute('aria-checked', String(value !== 'off'));
  };

  for (const btn of rail.querySelectorAll<HTMLButtonElement>('[data-cycle]')) {
    const setting = btn.dataset['cycle']!;
    const order = ['auto', 'on', 'off'];
    syncRailButton(btn, setting, localStorage.getItem(`marrow-${setting}`) ?? 'auto');
    btn.addEventListener('click', () => {
      const current = localStorage.getItem(`marrow-${setting}`) ?? 'auto';
      const next = order[(order.indexOf(current) + 1) % order.length]!;
      localStorage.setItem(`marrow-${setting}`, next);
      applySetting(ctx, setting, next);
      syncRailButton(btn, setting, next);
      syncPanel(setting, next);
    });
  }

  for (const btn of rail.querySelectorAll<HTMLButtonElement>('[data-action]')) {
    const setting = btn.dataset['action']!;
    const current = setting === 'theme'
      ? (document.documentElement.dataset['theme'] ?? 'dark')
      : localStorage.getItem(`marrow-${setting}`) !== 'off' ? 'on' : 'off';
    syncRailButton(btn, setting, current);
    btn.addEventListener('click', () => {
      let next: string;
      if (setting === 'theme') {
        next = document.documentElement.dataset['theme'] === 'light' ? 'dark' : 'light';
        localStorage.setItem('marrow-theme', next);
      } else {
        next = localStorage.getItem(`marrow-${setting}`) !== 'off' ? 'off' : 'on';
        localStorage.setItem(`marrow-${setting}`, next);
      }
      applySetting(ctx, setting, next);
      syncRailButton(btn, setting, next);
      syncPanel(setting, next);
    });
  }
}

/** Pinned (default), the rail card stays put. Unpinned, it tucks away and the
 *  menu chip becomes the hover/focus handle that slides it back out. */
function setupRailPin(rail: HTMLElement): void {
  const pin = rail.querySelector<HTMLButtonElement>('[data-pin]');
  const wrap = rail.parentElement;
  if (!pin || !wrap) return;

  const apply = (pinned: boolean): void => {
    pin.classList.toggle('on', pinned);
    pin.setAttribute('aria-pressed', String(pinned));
    pin.dataset['title'] = pinned ? 'Unpin dock' : 'Pin dock';
    rail.classList.toggle('unpinned', !pinned);
    if (pinned) rail.classList.remove('reveal');
  };
  apply(localStorage.getItem('marrow-rail-pin') !== 'off');
  pin.addEventListener('click', () => {
    const pinned = !pin.classList.contains('on');
    localStorage.setItem('marrow-rail-pin', pinned ? 'on' : 'off');
    apply(pinned);
  });

  let hideTimer: number | undefined;
  const show = (): void => {
    clearTimeout(hideTimer);
    rail.classList.add('reveal');
  };
  const scheduleHide = (): void => {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => rail.classList.remove('reveal'), 350);
  };
  for (const el of [wrap.querySelector('.m-chip-btn'), document.querySelector('.m-rail-trigger'), rail]) {
    el?.addEventListener('mouseenter', show);
    el?.addEventListener('mouseleave', scheduleHide);
  }
  wrap.addEventListener('focusin', show);
  wrap.addEventListener('focusout', (ev) => {
    if (!wrap.contains(ev.relatedTarget as Node)) scheduleHide();
  });
}

/** Persist + apply a view setting and keep any sidebar segmented control in step. */
function setViewSetting(ctx: Ctx | undefined, key: string, value: string): void {
  localStorage.setItem(`marrow-${key}`, value);
  applySetting(ctx, key, value);
  for (const b of document.querySelectorAll<HTMLButtonElement>(`.m-seg[data-setting="${key}"] button`)) {
    b.classList.toggle('active', b.dataset['value'] === value);
  }
}

function applySetting(ctx: Ctx | undefined, setting: string, value: string): void {
  const root = document.documentElement;
  switch (setting) {
    case 'theme':
      root.dataset['theme'] = value;
      break;
    case 'labels':
      root.dataset['labels'] = value;
      ctx?.engine?.setLabelMode(value as 'auto' | 'on' | 'off');
      break;
    case 'ports':
      root.dataset['ports'] = value;
      ctx?.engine?.setPortMode(value as 'auto' | 'on' | 'off');
      break;
    case 'motion':
      root.dataset['motion'] = value;
      ctx?.engine?.setMotion(value !== 'off');
      break;
    case 'minimap': {
      const wrap = document.querySelector<HTMLElement>('.m-minimap');
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
  if (!document.querySelector('.m-inventory')) return;
  const panel = document.querySelector<HTMLElement>('.m-inspector');
  if (!panel || data.devices.length === 0) return;

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
  panel.querySelector('.m-inspector-close')?.addEventListener('click', () => {
    panel.hidden = true;
  });
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !panel.hidden) panel.hidden = true;
  });

  const rowOf = (target: EventTarget | null): HTMLTableRowElement | null =>
    (target as Element | null)?.closest?.('tr.m-inv-row[data-id]') ?? null;

  // click a row (not its link) → drawer
  document.addEventListener('click', (ev) => {
    if ((ev.target as Element).closest('a')) return;
    const row = rowOf(ev.target);
    if (row) show(row.dataset['id']!);
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
    menuFor = row.dataset['id']!;
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
        const link = document.querySelector<HTMLAnchorElement>(`tr.m-inv-row[data-id="${CSS.escape(id)}"] a`);
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
  const tables = [...document.querySelectorAll<HTMLTableElement>('.m-inventory')];
  if (tables.length === 0) return;

  // shadcn Tabs: switch the hierarchy and flat views
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.m-inv-tabs .m-tab')];
  const views = [...document.querySelectorAll<HTMLElement>('.m-inv-view')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const t of tabs) t.classList.toggle('active', t === tab);
      for (const v of views) v.hidden = v.dataset['view'] !== tab.dataset['tab'];
    });
  }

  const filter = document.querySelector<HTMLInputElement>('.m-inv-filter');
  const rowsOf = (root: Element): HTMLTableRowElement[] => [...root.querySelectorAll<HTMLTableRowElement>('tr.m-inv-row, tbody > tr[data-search]')];
  const query = (): string => (filter?.value ?? '').trim().toLowerCase();
  const matchesQuery = (row: HTMLTableRowElement): boolean =>
    query() === '' || (row.dataset['search'] ?? '').includes(query());

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
    const card = table.closest<HTMLElement>('.m-inv-group');
    const pagerEl =
      card?.querySelector<HTMLElement>('.m-pagination') ??
      table.closest<HTMLElement>('.m-inv-view')?.querySelector<HTMLElement>('.m-pagination') ??
      null;
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
        const sub = tb.querySelector<HTMLTableRowElement>('tr.m-inv-sub');
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
  filter?.addEventListener('input', () => {
    for (const pager of byTable.values()) {
      pager.reset();
      pager.refresh();
    }
  });

  // column sort — within each tbody, so zone buckets keep their hierarchy;
  // every table re-paginates after sorting
  for (const table of tables) {
    const dirs = new Map<number, 1 | -1>();
    table.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach((th, col) => {
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
  const handles = [...document.querySelectorAll<HTMLElement>('.m-rsz-handle')];
  const syncHandles = (): void => {
    for (const handle of handles) {
      const prev = handle.previousElementSibling as HTMLElement | null;
      const next = handle.nextElementSibling as HTMLElement | null;
      handle.hidden = !prev || !next || prev.hidden || next.hidden;
    }
  };
  syncHandles();
  filter?.addEventListener('input', syncHandles);
  for (const handle of handles) {
    handle.addEventListener('pointerdown', (ev) => {
      const prev = handle.previousElementSibling?.querySelector<HTMLElement>('.m-inv-scroll');
      const next = handle.nextElementSibling?.querySelector<HTMLElement>('.m-inv-scroll');
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
  for (const handle of document.querySelectorAll<HTMLElement>('.m-rsz-v')) {
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
      const overlay = document.querySelector<HTMLElement>('.m-spotlight');
      if (overlay && !overlay.hidden) overlay.hidden = true;
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
        const nodeEl = el.closest<SVGGElement>('[data-node]');
        if (nodeEl) {
          ev.preventDefault();
          const href = nodeEl.dataset['href'];
          if (href !== undefined) location.href = rootPrefix() + href;
          else selectDevice(ctx, nodeEl.dataset['node']!, false);
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
  for (const zoneEl of svg.querySelectorAll<SVGGElement>('.m-zone[data-zone]')) {
    const panel = zoneEl.querySelector<SVGRectElement>('.m-zone-panel');
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
  return { sceneW: Number(svg.dataset['w']) || 1, sceneH: Number(svg.dataset['h']) || 1, zones, nodes };
}

function setupMinimap(ctx: Ctx, stage: HTMLElement): () => void {
  const wrap = document.querySelector<HTMLElement>('.m-minimap');
  if (!wrap || ctx.data.devices.length < 2) return () => {};
  wrap.hidden = false;
  const geo = miniGeometry(ctx);
  const CW = 184;
  const CHMAX = 130;
  const PAD = 7;
  const k = Math.min((CW - PAD * 2) / geo.sceneW, (CHMAX - PAD * 2) / geo.sceneH);
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

  const initiallyCollapsed = localStorage.getItem('marrow-minimap') === 'closed';

  wrap.innerHTML =
    `<button class="m-mini-toggle" type="button" aria-label="${initiallyCollapsed ? 'Show minimap' : 'Hide minimap'}">${initiallyCollapsed ? GLYPH_MAP : GLYPH_CHEVRON}</button>` +
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${content}<rect class="m-mini-view" x="0" y="0" width="10" height="10" rx="2"/></svg>`;

  if (initiallyCollapsed) {
    wrap.classList.add('collapsed');
  }

  const mini = wrap.querySelector('svg')!;
  const view = wrap.querySelector<SVGRectElement>('.m-mini-view')!;
  const sync = (): void => {
    const cam = ctx.camera.get();
    if (!(cam.k > 0)) return; // never write invalid geometry mid-animation
    const rect = stage.getBoundingClientRect();
    view.setAttribute('x', String(PAD + (-cam.x / cam.k) * k));
    view.setAttribute('y', String(PAD + (-cam.y / cam.k) * k));
    view.setAttribute('width', String(Math.max(0, (rect.width / cam.k) * k)));
    view.setAttribute('height', String(Math.max(0, (rect.height / cam.k) * k)));
  };

  let dragging = false;
  const moveTo = (ev: PointerEvent, animate: boolean): void => {
    const box = mini.getBoundingClientRect();
    const wx = (ev.clientX - box.left - PAD) / k;
    const wy = (ev.clientY - box.top - PAD) / k;
    const cam = ctx.camera.get();
    const rect = stage.getBoundingClientRect();
    ctx.camera.set({ x: rect.width / 2 - wx * cam.k, y: rect.height / 2 - wy * cam.k }, animate);
  };
  mini.addEventListener('pointerdown', (ev) => {
    dragging = true;
    mini.setPointerCapture(ev.pointerId);
    moveTo(ev, true);
  });
  mini.addEventListener('pointermove', (ev) => {
    if (dragging) moveTo(ev, false);
  });
  mini.addEventListener('pointerup', () => {
    dragging = false;
  });

  const toggle = wrap.querySelector<HTMLButtonElement>('.m-mini-toggle')!;
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
    localStorage.setItem('marrow-minimap', collapsed ? 'closed' : 'open');
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
 * A miniature of the link exactly as the canvas draws it.
 *
 * It reuses the real edge classes (`m-edge`, `m-speed-*`, `m-status-*`,
 * `m-flow`) rather than restating them, so the swatch inherits stroke width
 * from speed, colour/dash from status, and the flowing-dash animation — and
 * can never drift out of sync with the diagram.
 */
function linkSwatch(l: DataLink): string {
  const mode = l.mode ?? (l.encap !== undefined ? 'tunnel' : undefined);
  const cls =
    'm-edge' +
    ` m-status-${cssSafe(l.status)}` +
    (l.speed ? ` m-speed-${cssSafe(l.speed)}` : '') +
    (mode ? ` m-mode-${cssSafe(mode)}` : '') +
    (l.animated ? ' m-flow' : '');
  return (
    // no pathLength here: the swatch is a real 56px line, so the px dash
    // patterns render as drawn (a normalised path would swallow them whole)
    `<svg class="m-swatch" viewBox="0 0 56 10" aria-hidden="true">` +
    `<path class="${cls}" d="M1 5H55"/></svg>`
  );
}

function cssSafe(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function isTyping(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

document.addEventListener('DOMContentLoaded', boot);
