/**
 * Typed lookups of page-contract hooks. A missing, duplicated or misplaced
 * hook is a contract breach between the compiler and the runtime, so it
 * throws a `HookError` naming the hook instead of silently disabling a
 * feature. `maybe` is for hooks that are genuinely optional where it is called.
 */
import { HOOK_ATTR, HOOKS, hookSelector, ATTR, type HookId, type OneHook, type ParamKey } from '../shared/page-contract.js';

interface TagElements {
  element: HTMLElement;
  input: HTMLInputElement;
  select: HTMLSelectElement;
  ul: HTMLUListElement;
  canvas: HTMLCanvasElement;
  svg: SVGSVGElement;
  g: SVGGElement;
}

/** The element type a hook resolves to. */
export type El<K extends HookId> = TagElements[(typeof HOOKS)[K]['tag']];

class HookError extends Error {
  constructor(
    readonly kind: 'missing' | 'duplicate' | 'wrong-element',
    readonly hook: HookId,
  ) {
    super(`marrow: page hook "${hook}" ${kind === 'missing' ? 'is missing' : kind === 'duplicate' ? 'occurs more than once' : 'sits on the wrong element'}`);
    this.name = 'HookError';
  }
}

function checked<K extends HookId>(el: Element, id: K): El<K> {
  const tag = HOOKS[id].tag;
  // by localName, not instanceof, so it holds across windows and documents
  if (tag !== 'element' && el.localName !== tag) throw new HookError('wrong-element', id);
  return el as El<K>;
}

/** The one element carrying hook `id` under `root`; throws when absent or duplicated. */
export function find<K extends OneHook>(root: ParentNode, id: K): El<K> {
  const el = maybe(root, id);
  if (el === undefined) throw new HookError('missing', id);
  return el;
}

/** Like `find`, but `undefined` when the hook is absent. */
export function maybe<K extends OneHook>(root: ParentNode, id: K): El<K> | undefined {
  const all = root.querySelectorAll(hookSelector(id));
  if (all.length > 1) throw new HookError('duplicate', id);
  return all[0] !== undefined ? checked(all[0], id) : undefined;
}

/** Every element carrying hook `id` under `root`, in document order. */
export function findAll<K extends HookId>(root: ParentNode, id: K): El<K>[] {
  return [...root.querySelectorAll(hookSelector(id))].map((el) => checked(el, id));
}

/** The nearest ancestor-or-self of `target` carrying any of `ids`. */
export function closestHook(target: EventTarget | null, ...ids: HookId[]): HTMLElement | null {
  const el = target as Element | null;
  return el?.closest?.<HTMLElement>(ids.map(hookSelector).join(', ')) ?? null;
}

/** Mark an element the runtime creates itself as a hook (e.g. an added inspector pane). */
export function markHook(el: Element, id: HookId): void {
  el.setAttribute(HOOK_ATTR, id);
}

/** A page-contract element parameter (`data-tab`, `data-setting`, …). */
export function param(el: Element, key: ParamKey): string | undefined {
  return el.getAttribute(ATTR[key]) ?? undefined;
}

export function setParam(el: Element, key: ParamKey, value: string): void {
  el.setAttribute(ATTR[key], value);
}
