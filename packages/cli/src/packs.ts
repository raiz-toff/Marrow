import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IconCatalog, loadCatalog } from '@marrow/icons';

export interface PacksResolution {
  catalog: IconCatalog;
  root?: string;
  /** Set when an EXPLICITLY requested packs path does not exist — a hard error. */
  error?: string;
}

/**
 * Locate and load icon packs: explicit flag → MARROW_ICON_PACKS env → nearest
 * `icon-packs/` directory walking up from the cwd, then from this package.
 * An explicit path that doesn't exist is an error, never a silent skip.
 */
export function loadIconCatalog(explicit?: string): PacksResolution {
  const requested = explicit ?? process.env['MARROW_ICON_PACKS'];
  if (requested) {
    if (!existsSync(requested)) {
      return { catalog: new IconCatalog(), error: `icon packs directory not found: ${requested}` };
    }
    return { catalog: loadCatalog(requested), root: requested };
  }
  const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    let dir = start;
    for (;;) {
      const candidate = join(dir, 'icon-packs');
      if (existsSync(candidate)) return { catalog: loadCatalog(candidate), root: candidate };
      const up = dirname(dir);
      if (up === dir || dir === parse(dir).root) break;
      dir = up;
    }
  }
  return { catalog: new IconCatalog() };
}
