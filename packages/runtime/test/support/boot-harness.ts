/**
 * Harness for the boot tests: build real pages through the one compile entry
 * (site shape, so assets are external and no inline runtime runs), load one
 * into the happy-dom document, boot the runtime while recording every
 * selector it uses, and check the page contract afterwards.
 *
 * One page kind per test file: vitest gives each file a fresh window, so
 * listeners and timers from one boot never touch another page's document.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import type { Topology } from '@marrow/model';
import { validateSource } from '@marrow/schema';
import { createSiteBuilder } from '@marrow/site';
import {
  applyModularParams,
  EMBED,
  HOOKS,
  hookSelector,
  READY_FLAG,
  STAGE_HOOKS,
  type HookId,
  type PageKind,
} from '../../src/shared/page-contract.js';
import { parseModularParams } from '../../src/shared/hash.js';

// (a string, not new URL(): under happy-dom the global URL is the DOM's)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** small-office plus a trunk, a tunnel and custom fields, so the link
 *  inspector, swatches and the metadata tab all have something to show */
function fixture(): Topology {
  const icons = loadCatalog(join(repoRoot, 'icon-packs'));
  const t = validateSource(readFileSync(join(repoRoot, 'fixtures/valid/small-office.yaml'), 'utf8'), {
    icons,
  }).topology!;
  t.links[0] = { ...t.links[0]!, mode: 'trunk', vlans: '10,20', nativeVlan: 10 };
  t.links[1] = { ...t.links[1]!, mode: 'tunnel', encap: 'ipsec', animated: true };
  t.devices[0] = { ...t.devices[0]!, customFields: { rack: 'R1' }, config: 'hostname edge' };
  return t;
}

let pages: Record<PageKind, string>;

/** Build the pages once per file (call at module level). */
export function buildPagesOnce(): void {
  beforeAll(async () => {
    const icons = loadCatalog(join(repoRoot, 'icon-packs'));
    const builder = createSiteBuilder(fixture(), { icons, shape: 'site' });
    const build = async (p: string): Promise<string> => (await builder.buildPage(p))!.content;
    // a zone page: the site overview shows zones as link stand-ins, a zone
    // page shows the devices themselves
    const zonePage = builder.pages().find((p) => p.startsWith('zones/'));
    expect(zonePage).toBeDefined();
    pages = { stage: await build(zonePage!), inventory: await build('inventory.html') };
  }, 60_000);
}

// ── recording every selector the runtime uses ───────────────────────────────

const recorded = new Set<string>();
let recording = false;
const restore: Array<() => void> = [];

function wrap<T extends object>(proto: T, name: keyof T & string): void {
  const original = proto[name] as unknown as (this: unknown, sel: string, ...rest: unknown[]) => unknown;
  (proto as Record<string, unknown>)[name] = function (this: unknown, sel: string, ...rest: unknown[]) {
    if (recording) recorded.add(name === 'getElementById' ? `#${sel}` : sel);
    return original.call(this, sel, ...rest);
  };
  restore.push(() => ((proto as Record<string, unknown>)[name] = original));
}

/** The test's own lookups, kept out of the record. */
export function q<E extends Element = HTMLElement>(sel: string, root: ParentNode = document): E {
  const was = recording;
  recording = false;
  try {
    const el = root.querySelector<E>(sel);
    if (!el) throw new Error(`test: no ${sel}`);
    return el;
  } finally {
    recording = was;
  }
}
export const hook = <E extends Element = HTMLElement>(id: HookId, root: ParentNode = document): E =>
  q<E>(hookSelector(id), root);

function load(html: string): void {
  // nothing executes or loads: the test applies the pre-boot step and boots by hand
  const parsed = new DOMParser().parseFromString(html.replace(/<link rel="stylesheet"[^>]*>/g, ''), 'text/html');
  for (const s of parsed.querySelectorAll('script:not([type="application/json"])')) s.remove();
  document.documentElement.remove();
  document.appendChild(document.importNode(parsed.documentElement, true));
}

const posted: unknown[] = [];

/** Stubs and selector recording around each test (call at module level). */
export function installHarness(): void {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    recorded.clear();
    posted.length = 0;
    delete (window as unknown as Record<string, unknown>)[READY_FLAG];
    // happy-dom has no SVG layout: give every element a box
    (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () => new DOMRect(0, 0, 40, 40);
    // embedded in a host frame, so the runtime announces itself
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: (m: unknown) => posted.push(m) },
    });
    for (const [proto, names] of [
      [Element.prototype, ['querySelector', 'querySelectorAll', 'closest']],
      [Document.prototype, ['querySelector', 'querySelectorAll', 'getElementById']],
      [DocumentFragment.prototype, ['querySelector', 'querySelectorAll']],
    ] as const) {
      for (const n of names) wrap(proto as object, n as never);
    }
  });

  afterEach(() => {
    recording = false;
    while (restore.length) restore.pop()!();
  });
}

/** Boot a page; `prepare` runs on the loaded document just before the runtime starts (stubs that need its elements). */
export async function boot(kind: PageKind, prepare?: () => void): Promise<void> {
  load(pages[kind]);
  prepare?.();
  applyModularParams(document.documentElement, parseModularParams(location.search, location.hash)); // the pre-boot step
  const { boot: run } = await import('../../src/client/main.js');
  recording = true;
  run();
  await vi.waitFor(() => expect((window as unknown as Record<string, unknown>)[READY_FLAG]).toBe(true));
}

/** One animation frame (the camera writes its transform, and the minimap follows, on the next frame). */
export const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
/** A pointer event as a mouse delivers it. */
export const pointer = (el: Element, type: string, x: number, y: number): void =>
  void el.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: 'mouse' }),
  );
export const click = (el: Element): void => void el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
/** A key press as a browser delivers it: at the focused element, bubbling to window. */
export const key = (k: string, mods: KeyboardEventInit = {}): void =>
  void (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, ...mods }),
  );

// ── contract assertions shared by both page kinds ───────────────────────────

export function expectContractHolds(kind: PageKind): void {
  recording = false;
  // every hook this page kind must carry resolves; single hooks exactly once
  for (const [id, spec] of Object.entries(HOOKS) as [HookId, (typeof HOOKS)[HookId]][]) {
    if (!(spec.on as readonly PageKind[]).includes(kind)) continue;
    const n = document.querySelectorAll(hookSelector(id)).length;
    if (spec.count === 'one') expect(n, `${kind}: ${id}`).toBe(1);
    else expect(n, `${kind}: ${id}`).toBeGreaterThan(0);
  }
  // every hook the runtime asked for exists in the contract, and those this
  // kind always carries matched (conditional hooks may legitimately miss)
  const asked = new Set([...recorded].flatMap((sel) => [...sel.matchAll(/data-m="([^"]+)"/g)].map((m) => m[1]!)));
  expect(asked.size).toBeGreaterThan(10);
  for (const id of asked) {
    expect(Object.keys(HOOKS), `unknown hook ${id}`).toContain(id);
    if ((HOOKS[id as HookId].on as readonly PageKind[]).includes(kind)) {
      expect(document.querySelectorAll(hookSelector(id as HookId)).length, `${kind}: ${id}`).toBeGreaterThan(0);
    }
  }
  // no recorded lookup spells a chrome class: only hooks, stage hooks, or
  // markup the runtime creates itself (see hooks-guard.test.ts)
  const stage = new Set<string>(Object.values(STAGE_HOOKS));
  const runtimeOwned = /^(\.m-(ctx-item|menupop|ip-chip|page)|\[data-goto\]|li\[data-idx\])$/;
  for (const sel of recorded) {
    for (const part of sel.split(',').map((p) => p.trim())) {
      if (!/\.m-|\[data-(?!m=)/.test(part)) continue;
      const ok = stage.has(part) || runtimeOwned.test(part) || part.startsWith(`${STAGE_HOOKS.portChip}[data-edge=`);
      expect(ok, `${kind}: lookup "${part}" names page markup outside the contract`).toBe(true);
    }
  }
  // announced readiness to the page and to an embedding host
  expect(posted).toContainEqual({ type: EMBED.ready });
}
