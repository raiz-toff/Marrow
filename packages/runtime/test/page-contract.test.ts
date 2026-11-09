import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import { validateSource } from '@marrow/schema';
import {
  ATTR,
  decodePageData,
  DEVICE_KEYS,
  encodePageData,
  HOOK_ATTR,
  hookAttr,
  HOOKS,
  hookSelector,
  isEmbedMessage,
  LINK_KEYS,
  PAGE_DATA_KEYS,
  PageContractError,
  pickDefined,
  ROOT_ATTR,
  TOPOLOGY_KEYS,
  ZONE_KEYS,
  type EmbeddedData,
} from '../src/shared/page-contract.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

const data: EmbeddedData = {
  name: 'T',
  theme: 'dark',
  kind: 'stage',
  page: 'index.html',
  zonesCount: 0,
  devices: [
    { id: 'a', name: 'A', icon: 'x', status: 'up', interfaces: [], note: '</script><script>alert(1)</script>' },
  ],
  links: [],
  zones: [],
};

describe('payload encoding', () => {
  test('round-trips through encode/decode', () => {
    expect(decodePageData(encodePageData(data))).toEqual(data);
  });

  test('escapes < so the payload cannot close its <script>', () => {
    const text = encodePageData(data);
    expect(text).not.toContain('<');
    expect(decodePageData(text).devices[0]!.note).toBe('</script><script>alert(1)</script>');
  });

  test('missing or malformed payloads throw typed errors', () => {
    const kind = (text: string | null | undefined): string | undefined => {
      try {
        decodePageData(text);
      } catch (err) {
        return err instanceof PageContractError ? err.kind : 'untyped';
      }
      return undefined;
    };
    expect(kind(undefined)).toBe('data-missing');
    expect(kind('')).toBe('data-missing');
    expect(kind('{not json')).toBe('data-malformed');
    expect(kind('{"name":"x"}')).toBe('data-malformed'); // no kind / arrays
    expect(kind(JSON.stringify({ ...data, kind: 'other' }))).toBe('data-malformed');
  });
});

describe('pickDefined', () => {
  test('drops undefined and false, keeps other falsy values, follows the key order', () => {
    const src = { c: 0, a: undefined, b: false, d: '', e: true, f: [] as string[] };
    const picked = pickDefined(src, ['f', 'e', 'd', 'c', 'b', 'a']);
    expect(picked).toEqual({ f: [], e: true, d: '', c: 0 });
    expect(Object.keys(picked)).toEqual(['f', 'e', 'd', 'c']);
  });
});

describe('payload key lists', () => {
  // `satisfies readonly (keyof Device)[]` in the contract is the type-level
  // check; this is the runtime one: every listed key is a field the schema
  // actually produces on a fully-populated topology.
  const icons = loadCatalog(join(repoRoot, 'icon-packs'));
  const source = [
    'marrow: 2',
    'name: Full',
    'description: every field',
    'author: me',
    'revision: r1',
    'date: 2026-01-01',
    'about: some text',
    'title_block: { title: T }',
    'inspector: { tabs: [{ id: rack, label: Rack, field: rack }] }',
    'zones:',
    '  - { id: z1, name: Zone 1 }',
    'devices:',
    '  - id: a',
    '    icon: cisco/switches/layer-3-switch',
    '    tier: core',
    '    zone: z1',
    '    role: core switch',
    '    mgmt_ip: 10.0.0.1',
    '    ha_pair_with: b',
    '    note: hi',
    '    config: hostname a',
    '    interfaces: [{ name: Gi0/1 }]',
    '    custom_fields: { rack: R1 }',
    '    sections: { bgp: peers }',
    '  - { id: b, icon: cisco/switches/layer-3-switch, zone: z1 }',
    'links:',
    '  - from: a:Gi0/1',
    '    to: b:Gi0/1',
    '    kind: fiber',
    '    speed: 10G',
    '    lag: po1',
    '    mode: trunk',
    '    vlans: "10,20"',
    '    native_vlan: 1',
    '    encap: vxlan',
    '    protocol: ospf',
    '    lacp: active',
    '    status: degraded',
    '    animated: true',
    '    label: uplink',
    '    note: n',
    '    custom_fields: { circuit: C1 }',
    '    sections: { stats: ok }',
  ].join('\n');
  const t = validateSource(source, { icons }).topology!;

  test('the fixture validates', () => {
    expect(t).toBeDefined();
  });

  test('topology, device, link and zone keys exist on the model', () => {
    for (const k of TOPOLOGY_KEYS) expect(t, k).toHaveProperty(k);
    // `stack` is synthetic (collapse stand-ins only), never authored
    for (const k of DEVICE_KEYS.filter((k) => k !== 'stack')) expect(t.devices[0], k).toHaveProperty(k);
    for (const k of LINK_KEYS) expect(t.links[0], k).toHaveProperty(k);
    for (const k of ZONE_KEYS) expect(t.zones[0], k).toHaveProperty(k);
  });

  test('lists have no duplicates and every payload key has a serialization slot', () => {
    for (const list of [TOPOLOGY_KEYS, DEVICE_KEYS, LINK_KEYS, ZONE_KEYS, PAGE_DATA_KEYS]) {
      expect(new Set<string>(list).size).toBe(list.length);
    }
    for (const k of TOPOLOGY_KEYS) expect(PAGE_DATA_KEYS as readonly string[]).toContain(k);
  });
});

describe('hooks and attributes', () => {
  test('hook ids are unique, feature-scoped and selector-safe', () => {
    const ids = Object.keys(HOOKS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
  });

  test('hookAttr and hookSelector agree', () => {
    expect(hookAttr('inspector.panel')).toBe(`${HOOK_ATTR}="inspector.panel"`);
    expect(hookSelector('inspector.panel')).toBe(`[${HOOK_ATTR}="inspector.panel"]`);
  });

  test('root attributes are the data-* spelling of their dataset keys', () => {
    for (const [key, attr] of Object.entries(ROOT_ATTR)) {
      expect(attr).toBe(`data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
    }
    for (const attr of Object.values(ATTR)) expect(attr).toMatch(/^data-[a-z-]+$/);
  });

  test('isEmbedMessage accepts exactly the protocol', () => {
    expect(isEmbedMessage({ type: 'marrow:ready' })).toBe(true);
    expect(isEmbedMessage({ type: 'marrow:theme', theme: 'auto' })).toBe(true);
    expect(isEmbedMessage({ type: 'marrow:theme', theme: 'sepia' })).toBe(false);
    expect(isEmbedMessage({ type: 'other' })).toBe(false);
    expect(isEmbedMessage(null)).toBe(false);
    expect(isEmbedMessage('marrow:ready')).toBe(false);
  });
});
