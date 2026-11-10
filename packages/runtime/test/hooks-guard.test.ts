import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { HOOKS } from '../src/shared/page-contract.js';

/**
 * Static guard for the page contract: the runtime finds chrome elements by
 * hook (`find(root, 'inspector.panel')`) and diagram elements by the stage
 * hooks from @marrow/visual — never by spelling a class or data attribute
 * the compiler happens to emit. The only selector literals left are for
 * markup the runtime creates itself (one producer, one consumer).
 */
const RUNTIME_OWNED: Record<string, string> = {
  '.m-ctx-item': 'menubar / context-menu rows (setupMenubar, setupContextMenu, setupInventoryDetails)',
  '.m-menupop': 'the menubar popover (setupMenubar)',
  '.m-ip-chip': 'copyable IP chips in the inspector overview (fillInspector)',
  '[data-goto]': 'neighbour / HA-pair buttons in the inspector (fillInspector)',
  'li[data-idx]': 'command-center result rows (setupSpotlight)',
  '.m-page': 'inventory pagination buttons (setupInventory)',
};

const clientDir = fileURLToPath(new URL('../src/client', import.meta.url));
const sources = readdirSync(clientDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ file: f, text: readFileSync(join(clientDir, f), 'utf8') }));
const all = sources.map((s) => s.text).join('\n');

/** Every string/template literal passed straight to querySelector(All) or closest. */
function selectorLiterals(text: string): string[] {
  const re = /\b(?:querySelectorAll|querySelector|closest)\s*(?:<[^>()]*>)?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  return [...text.matchAll(re)].map((m) => m[2]!);
}

describe('runtime selector discipline', () => {
  test('no page class or data attribute is spelled in a lookup', () => {
    const offenders: string[] = [];
    for (const { file, text } of sources) {
      for (const lit of selectorLiterals(text)) {
        if (!/\.m-|\[data-/.test(lit)) continue;
        if (lit in RUNTIME_OWNED) continue;
        offenders.push(`${file}: ${lit}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every allowlisted selector is markup the runtime itself creates', () => {
    for (const sel of Object.keys(RUNTIME_OWNED)) {
      const cls = /\.(m-[a-z-]+)/.exec(sel)?.[1];
      const attr = /\[(data-[a-z-]+)\]/.exec(sel)?.[1];
      // produced: in a class="…"/className string, or as an attribute, the runtime writes
      const produced =
        cls !== undefined
          ? new RegExp(`(class="|className = ')[^"']*\\b${cls}\\b`).test(all)
          : all.includes(`${attr}="`);
      expect(produced, sel).toBe(true);
      // and actually consumed — a stale allowlist entry hides nothing
      expect(selectorLiterals(all), sel).toContain(sel);
    }
  });

  test('every hook in the contract is used by the runtime', () => {
    const unused = Object.keys(HOOKS).filter((id) => !all.includes(`'${id}'`));
    expect(unused).toEqual([]);
  });
});
