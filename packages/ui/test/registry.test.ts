import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
// Plain .mjs build script (untyped); vitest runs it directly.
import { buildRegistryItems } from '../../../scripts/build-registry.mjs';

type RegistryFile = { path: string; target: string; content: string };
type RegistryItem = { name: string; dependencies: string[]; files: RegistryFile[] };

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const items = buildRegistryItems(ROOT) as RegistryItem[];

const specifiers = (source: string) =>
  [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2]);

describe('shadcn registry assembly', () => {
  test('ships the three public components', () => {
    expect(items.map((i) => i.name)).toEqual(['topology-canvas', 'cable-badge', 'device-link']);
  });

  test.each(items.map((i) => [i.name, i] as const))('%s is self-contained', (_name, item) => {
    const shipped = new Set(item.files.map((f) => './' + f.path.replace(/^ui\//, '').replace(/\.tsx?$/, '.js')));
    for (const file of item.files) {
      for (const spec of specifiers(file.content)) {
        expect(spec, `${file.path} imports ${spec}`).not.toMatch(/^@marrow\//);
        expect(spec, `${file.path} imports ${spec}`).not.toMatch(/^\.\.\//);
        if (spec.startsWith('./')) expect(shipped.has(spec), `${file.path} imports unshipped ${spec}`).toBe(true);
        else expect(['react', ...item.dependencies]).toContain(spec);
      }
      expect(file.target).toMatch(/^components\/marrow\//);
    }
  });

  test('topology-types.ts carries only the shared helpers, not mock topology data', () => {
    const types = items[0]!.files.find((f) => f.path === 'ui/topology-types.ts')!;
    expect(types.content).not.toContain('DEFAULT_TOPOLOGY_DATA');
    expect(types.content).not.toContain('TopologyData');
    expect(types.content).toContain('export function cn');
    expect(types.content).toContain('export type DeviceStatus');
    expect(types.content).toContain('export type LinkMode');
  });

  test('device-link ships the cable-badge it composes', () => {
    const deviceLink = items.find((i) => i.name === 'device-link')!;
    expect(deviceLink.files.map((f) => f.path)).toEqual([
      'ui/topology-types.ts',
      'ui/cable-badge.tsx',
      'ui/device-link.tsx',
    ]);
  });

  describe('rejects sources a copied file could not resolve', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'marrow-registry-'));
    afterAll(() => rmSync(tmp, { recursive: true, force: true }));
    cpSync(join(ROOT, 'packages', 'ui', 'src'), join(tmp, 'packages', 'ui', 'src'), { recursive: true });
    const badge = join(tmp, 'packages', 'ui', 'src', 'components', 'cable-badge.tsx');

    test.each([
      ["import { DEVICE_STATUSES } from '@marrow/model';", /self-contained/],
      ["import { x } from '../../model/index.js';", /self-contained/],
      ["import { z } from 'zod';", /not in the item's dependencies/],
    ])('%s', (line, error) => {
      writeFileSync(badge, `${line}\nexport const CableBadge = () => null;\n`);
      expect(() => buildRegistryItems(tmp)).toThrow(error);
    });
  });
});
