import { Camera } from './camera.js';
import { CanvasEngine, type CScene } from './canvas-engine.js';
import { globalSearchDocs, loadData, type DataDevice, type DataLink, type EmbeddedData } from './data.js';
import { parseHash, serializeHash } from '../shared/hash.js';
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
    setupInventory();
    setupInventoryDetails(data);
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
  document.querySelector('.m-inspector-close')?.addEventListener('click', () => deselect(ctx));
  setupSpotlight(ctx, data);
  setupControls(ctx);
  setupTheme();
  setupKeyboard(ctx);
  setupContextMenu(ctx);
  setupMenubar(ctx);
  setupShortcutsDialog();
  const minimapSync = setupMinimap(ctx, stage);
  setupSidebar(ctx);
  setupClickAway(ctx);
  const hashSyncSoon = setupHash(ctx);

  // re-apply persisted view settings — the ⌘K palette reads AND writes these,
  // so what it displays must be what the page is actually doing
  for (const key of ['labels', 'ports', 'motion', 'minimap']) {
    const storedValue = localStorage.getItem(`marrow-${key}`);
    if (storedValue !== null) applySetting(ctx, key, storedValue);
  }

  // Entrance: restore deep link if present, else fit-and-settle.
  const initial = parseHash(location.hash);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (initial.camera) {
    camera.set(initial.camera);
  } else {
    camera.set(camera.fitState(1.08));
    if (reduced) camera.fit();
    else setTimeout(() => camera.fit(true), 120);
  }
  const wanted = initial.device ?? (data as { hero?: string }).hero;
  if (wanted !== undefined) {
    const resolved = resolveNodeFor(ctx, wanted);
    if (resolved !== undefined) selectDevice(ctx, resolved, false);
  }
  const settle = (): void => document.documentElement.classList.add('settled');
  // restoring a deep link (incl. live-reload) skips the entrance choreography
  setTimeout(settle, reduced || initial.camera ? 0 : 1900);
  addEventListener('pointerdown', settle, { once: true });
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
  let dragging = false;
  let moved = false;
  let last = { x: 0, y: 0 };
  stage.addEventListener('pointerdown', (ev) => {
    if (ctx.mode === 'svg' && (ev.target as Element).closest('[data-node]')) return;
    if (ctx.mode === 'canvas' && hitNode(ctx, ev)) return;
    dragging = true;
    moved = false;
    last = { x: ev.clientX, y: ev.clientY };
    stage.setPointerCapture(ev.pointerId);
    stage.classList.add('m-grabbing');
  });
  stage.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    if (Math.abs(ev.clientX - last.x) + Math.abs(ev.clientY - last.y) > 2) moved = true;
    ctx.camera.panBy(ev.clientX - last.x, ev.clientY - last.y);
    last = { x: ev.clientX, y: ev.clientY };
  });
  const stop = (ev: PointerEvent): void => {
    if (dragging && !moved && ctx.mode === 'canvas' && !hitNode(ctx, ev)) deselect(ctx);
    dragging = false;
    stage.classList.remove('m-grabbing');
  };
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', () => {
    dragging = false;
    stage.classList.remove('m-grabbing');
  });
}

// ─── pointer wiring per backend ─────────────────────────────────────────────

function setupSvgPointer(ctx: Ctx): void {
  const root = document.documentElement;
  ctx.svg!.addEventListener('pointerover', (ev) => {
    const nodeEl = (ev.target as Element).closest<SVGGElement>('[data-node]');
    if (!nodeEl) return;
    applyFocus(ctx, nodeEl.dataset['node']!);
    root.classList.add('focus-mode');
  });
  ctx.svg!.addEventListener('pointerout', (ev) => {
    if (!(ev.target as Element).closest('[data-node]')) return;
    root.classList.remove('focus-mode');
    clearFocus(ctx);
    if (ctx.selected) applyFocus(ctx, ctx.selected);
  });
  ctx.svg!.addEventListener('click', (ev) => {
    const nodeEl = (ev.target as Element).closest<SVGGElement>('[data-node]');
    if (nodeEl) {
      const href = nodeEl.dataset['href'];
      if (href !== undefined) {
        location.href = rootPrefix() + href;
        return;
      }
      selectDevice(ctx, nodeEl.dataset['node']!, false);
    } else deselect(ctx);
  });
  // hovering an edge reveals its port chips even when the toggle is off
  ctx.svg!.addEventListener('pointerover', (ev) => {
    const edgeEl = (ev.target as Element).closest<SVGElement>('.m-edge[data-edge]');
    if (edgeEl) setChipsHot(ctx, edgeEl.getAttribute('data-edge')!, true);
  });
  ctx.svg!.addEventListener('pointerout', (ev) => {
    const edgeEl = (ev.target as Element).closest<SVGElement>('.m-edge[data-edge]');
    if (!edgeEl || edgeEl.classList.contains('is-path')) return;
    setChipsHot(ctx, edgeEl.getAttribute('data-edge')!, false);
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
        const meta = [edge.from.port, edge.to.port, edge.speed, edge.kind].filter(Boolean).join(' · ');
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
    if (!node) return;
    if (node.href !== undefined) {
      location.href = rootPrefix() + node.href;
      return;
    }
    selectDevice(ctx, node.id, false);
  });
  ctx.stage.addEventListener('pointerleave', () => {
    if (tip) tip.hidden = true;
  });
}

// ─── selection + inspector ──────────────────────────────────────────────────

export function selectDevice(ctx: Ctx, id: string, fly = true): void {
  const device = ctx.deviceById.get(id);
  if (!device || !hasNode(ctx, id)) return;
  ctx.selected = id;
  markSelected(ctx, id);
  document.documentElement.classList.add('has-selection');
  applyFocus(ctx, id);
  renderInspector(ctx, device);
  if (fly) {
    const b = nodeWorldBox(ctx, id);
    if (b) ctx.camera.flyTo(b);
  }
  syncHash(ctx);
}

function deselect(ctx: Ctx): void {
  ctx.selected = undefined;
  markSelected(ctx, undefined);
  document.documentElement.classList.remove('has-selection');
  clearFocus(ctx);
  const panel = document.querySelector<HTMLElement>('.m-inspector');
  if (panel) panel.hidden = true;
  syncHash(ctx);
}

/**
 * Click-away: with a device open, a click on any section OTHER than the
 * inspector dismisses it. Nodes stay live (they re-select), and pure
 * navigation aids (zoom controls, minimap) are exempt so you can move around
 * while reading a device.
 */
function setupClickAway(ctx: Ctx): void {
  document.addEventListener('pointerdown', (ev) => {
    if (ctx.selected === undefined) return;
    const target = ev.target as Element;
    if (target.closest('.m-inspector, .m-controls, .m-minimap, .m-spotlight, .m-rail-wrap, .m-dock, .m-sidebar, [data-node]')) return;
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
  fillInspector(
    { deviceById: ctx.deviceById, linksByDevice: ctx.linksByDevice, devicePages: ctx.data.devicePages ?? [] },
    d,
    (id) => {
      const resolved = resolveNodeFor(ctx, id);
      if (resolved !== undefined) selectDevice(ctx, resolved);
    },
  );
}

function fillInspector(maps: DeviceMaps, d: DataDevice, onGoto: (id: string) => void): void {
  const panel = document.querySelector<HTMLElement>('.m-inspector');
  const body = document.querySelector<HTMLElement>('.m-inspector-body');
  const title = document.querySelector<HTMLElement>('.m-inspector-title');
  if (!panel || !body || !title) return;
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
  body.innerHTML = [
    `<div class="m-icon-badge"><svg viewBox="0 0 48 48"><use href="#ic-${cssSafe(d.icon)}" width="48" height="48"/></svg><span class="m-status-pill m-status-${cssSafe(d.status)}">${h(d.status)}</span>${fullPage}</div>`,
    `<dl class="m-facts">${facts
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v!)}</dd>`)
      .join('')}</dl>`,
    links.length
      ? `<h3>Links (${links.length})</h3><ul class="m-links">${links
          .map((l) => {
            const mine = l.from.device === d.id ? l.from : l.to;
            const other = l.from.device === d.id ? l.to : l.from;
            const otherName = maps.deviceById.get(other.device)?.name ?? other.device;
            // the line itself, drawn as the canvas draws it, then the words
            const words = [l.kind, l.speed, l.lag].filter(Boolean).join(' · ');
            const meta = `<span class="m-link-meta">${linkSwatch(l)}${words ? `<span>${h(words)}</span>` : ''}</span>`;
            return `<li><button data-goto="${h(other.device)}"><span class="m-link-other">${h(otherName)}</span><span class="m-link-ports">${h(mine.port ?? '—')} → ${h(other.port ?? '—')}</span>${meta}</button></li>`;
          })
          .join('')}</ul>`
      : '',
    d.interfaces.length
      ? `<h3>Interfaces (${d.interfaces.length})</h3><table class="m-table"><thead><tr><th>Name</th><th>VLAN</th><th>IP</th><th>Description</th></tr></thead><tbody>${d.interfaces
          .map(
            (i) =>
              `<tr><td>${h(i.name)}</td><td>${i.vlan ?? ''}</td><td>${h(i.ip ?? '')}</td><td>${h(i.description ?? '')}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '',
    d.stack
      ? `<h3>Members (${d.stack.members.length})</h3><ul class="m-members">${d.stack.members
          .map((m) => `<li>${h(m)}</li>`)
          .join('')}</ul>`
      : '',
    d.note ? `<h3>Note</h3><div class="m-note">${h(d.note)}</div>` : '',
    d.config ? `<h3>Config</h3><pre class="m-config">${h(d.config)}</pre>` : '',
  ].join('');
  panel.hidden = false;
  for (const btn of body.querySelectorAll<HTMLButtonElement>('[data-goto]')) {
    btn.addEventListener('click', () => onGoto(btn.dataset['goto']!));
  }
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
  // the dock pill AND its peek tab both open search
  for (const btn of document.querySelectorAll('.m-search-btn')) btn.addEventListener('click', open);
  addEventListener('keydown', (ev) => {
    if ((ev.key === 'k' && (ev.metaKey || ev.ctrlKey)) || (ev.key === '/' && !isTyping())) {
      ev.preventDefault();
      if (overlay.hidden) open();
      else close();
    }
  });
}

// ─── menubar (shadcn Menubar; popovers share the DropdownMenu spec) ─────────

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
      case 'about': close(); document.querySelector<HTMLElement>('.m-sidebar')?.classList.add('open'); break;
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
      const hasPage = (ctx.data.devicePages ?? []).includes(d.id) && currentPage() !== `devices/${d.id}.html`;
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
    const edge = (ev.target as Element).closest<SVGPathElement>('[data-edge]');
    if (!edge) {
      tip.hidden = true;
      return;
    }
    const from = ctx.deviceById.get(edge.dataset['from'] ?? '')?.name ?? edge.dataset['from'];
    const to = ctx.deviceById.get(edge.dataset['to'] ?? '')?.name ?? edge.dataset['to'];
    const meta = edge.dataset['meta'] ?? '';
    tip.innerHTML = `<strong>${html(from ?? '')} ⟷ ${html(to ?? '')}</strong>${meta ? `<span>${html(meta)}</span>` : ''}`;
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
  document.querySelector('.m-ctl-fit')?.addEventListener('click', () => ctx.camera.fit(true));
  document.querySelector('.m-ctl-in')?.addEventListener('click', () => zoomCenter(ctx, 1.35));
  document.querySelector('.m-ctl-out')?.addEventListener('click', () => zoomCenter(ctx, 1 / 1.35));
}

// ─── export (reached via the ⌘K command center) ─────────────────────────────

function fileStem(ctx: Ctx): string {
  return ctx.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topology';
}

/** Rebuild the diagram as a self-contained SVG document (styles inlined). */
function standaloneSvg(ctx: Ctx): string {
  const svg = ctx.svg!;
  const w = Number(svg.dataset['w']) || 100;
  const h = Number(svg.dataset['h']) || 100;
  const theme = document.documentElement.dataset['theme'] ?? 'dark';
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
  // Clone and neutralize the live camera transform — export shows the WHOLE
  // scene at world coordinates (0..w, 0..h), not the current pan/zoom viewport.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelector('.m-camera')?.removeAttribute('transform');
  // drop transient interaction state so the export is a clean, settled frame
  for (const el of clone.querySelectorAll('.is-selected, .is-focus, .is-adj, .is-path')) {
    el.classList.remove('is-selected', 'is-focus', 'is-adj', 'is-path');
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-theme="${theme}" class="settled">` +
    `<style>${css}</style><rect width="${w}" height="${h}" style="fill: var(--bg)"/>` +
    clone.innerHTML +
    `</svg>`
  );
}

async function exportPng(ctx: Ctx): Promise<void> {
  if (ctx.mode === 'canvas') {
    ctx.engine!.exportBitmap().toBlob((blob) => {
      if (blob) download(blob, `${fileStem(ctx)}.png`);
    }, 'image/png');
    return;
  }
  const svgText = standaloneSvg(ctx);
  const w = (Number(ctx.svg!.dataset['w']) || 100) * 2;
  const h = (Number(ctx.svg!.dataset['h']) || 100) * 2;
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

function setupTheme(): void {
  const stored = localStorage.getItem('marrow-theme');
  if (stored === 'dark' || stored === 'light') document.documentElement.dataset['theme'] = stored;
  // the static shell ships "Ctrl K"; swap for the platform's own key on Macs
  if (/Mac|iP(hone|ad|od)/.test(navigator.platform)) {
    for (const kbd of document.querySelectorAll('.m-searchpill kbd, .m-dock-hint kbd')) kbd.textContent = '⌘ K';
  }
}

// ─── sidebar ────────────────────────────────────────────────────────────────

function setupSidebar(ctx: Ctx | undefined): void {
  const sidebar = document.querySelector<HTMLElement>('.m-sidebar');
  const toggle = document.querySelector<HTMLButtonElement>('.m-sidebar-btn');
  if (!sidebar || !toggle) return;
  const root = document.documentElement;

  const setOpen = (open: boolean): void => {
    sidebar.classList.toggle('open', open);
    toggle.classList.toggle('on', open);
    localStorage.setItem('marrow-sidebar', open ? 'open' : 'closed');
  };
  setOpen(localStorage.getItem('marrow-sidebar') === 'open');
  toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
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

  const deviceById = new Map(data.devices.map((d) => [d.id, d]));
  const linksByDevice = new Map<string, DataLink[]>();
  for (const l of data.links) {
    for (const key of [l.from.device, l.to.device]) {
      (linksByDevice.get(key) ?? linksByDevice.set(key, []).get(key)!).push(l);
    }
  }
  const maps: DeviceMaps = { deviceById, linksByDevice, devicePages: data.devicePages ?? [] };

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

  wrap.innerHTML =
    `<button class="m-mini-toggle" type="button" aria-label="Toggle minimap"></button>` +
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${content}<rect class="m-mini-view" x="0" y="0" width="10" height="10" rx="2"/></svg>`;

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

  const GLYPH_MAP =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>';
  const GLYPH_CHEVRON =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const toggle = wrap.querySelector<HTMLButtonElement>('.m-mini-toggle')!;
  const applyCollapsed = (collapsed: boolean): void => {
    wrap.classList.toggle('collapsed', collapsed);
    toggle.innerHTML = collapsed ? GLYPH_MAP : GLYPH_CHEVRON;
    toggle.setAttribute('aria-label', collapsed ? 'Show minimap' : 'Hide minimap');
  };
  applyCollapsed(localStorage.getItem('marrow-minimap') === 'closed');
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
  const state: { device?: string; camera?: { x: number; y: number; k: number } } = { camera: ctx.camera.get() };
  if (ctx.selected !== undefined) state.device = ctx.selected;
  history.replaceState(null, '', serializeHash(state) || location.pathname);
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
  const cls =
    'm-edge' +
    ` m-status-${cssSafe(l.status)}` +
    (l.speed ? ` m-speed-${cssSafe(l.speed)}` : '') +
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
