import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import { validateSource } from '@marrow/schema';
import { importV1 } from '../src/import-v1.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const source = readFileSync(join(repoRoot, 'fixtures', 'v1', 'showcase.yaml'), 'utf8');

describe('importV1', () => {
  const result = importV1(source);

  test('maps ids, icons, tiers, statuses, groups', () => {
    expect(result.devices).toBe(5);
    expect(result.zones).toBe(2);
    const v2 = validateSource(result.yaml, { icons: loadCatalog(join(repoRoot, 'icon-packs')) });
    expect(v2.valid, JSON.stringify(v2.diagnostics, null, 2)).toBe(true);
    const t = v2.topology!;
    const fw = t.devices.find((d) => d.id === 'edge-fw')!;
    expect(fw.name).toBe('Edge Firewall');
    expect(fw.icon).toBe('cisco/security/firewall');
    expect(fw.tier).toBe('core'); // v1 level 1
    expect(fw.mgmtIp).toBe('203.0.113.1');
    expect(fw.note).toContain('Purpose: Perimeter security');
    expect(fw.zone).toBe('edge');
    const coreB = t.devices.find((d) => d.id === 'core-b')!;
    expect(coreB.status).toBe('degraded'); // v1 "warn"
  });

  test('(PoN) port markers become lag groups; ports survive', () => {
    const v2 = validateSource(result.yaml);
    const lag = v2.topology!.links.filter((l) => l.lag === 'po1');
    expect(lag).toHaveLength(2);
    expect(lag[0]!.from.port).toBe('Te1/0/1');
  });

  test('unknown cable types and dangling links are reported, not fatal', () => {
    expect(result.links).toBe(6); // the GHOST_NODE link dropped
    expect(result.notes.some((n) => n.includes('cat6'))).toBe(true);
    expect(result.notes.some((n) => n.includes('1 links referenced unknown'))).toBe(true);
  });

  test('v1 extras survive as x- annotations', () => {
    expect(result.yaml).toContain('x-v1-config');
    expect(result.yaml).toContain('x-v1-tags');
  });

  test('refuses v2 input', () => {
    expect(() => importV1('marrow: 2\nname: X\n')).toThrow(/already marrow v2/);
  });
});
