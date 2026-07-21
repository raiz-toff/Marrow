/**
 * The single source of truth for "what keys exist where" — used for
 * did-you-mean suggestions on unknown keys and for per-field fix hints.
 * Kept explicit (rather than introspected from Zod) so suggestions stay
 * stable even if the Zod internals change.
 */

export type DataPath = ReadonlyArray<string | number>;

export const ROOT_KEYS = ['marrow', 'name', 'description', 'theme', 'hero', 'backdrop', 'zones', 'devices', 'links'] as const;
export const BACKDROP_KEYS = ['text', 'note'] as const;
export const ZONE_KEYS = ['id', 'name', 'parent', 'collapse', 'accent', 'note'] as const;
export const DEVICE_KEYS = [
  'id',
  'name',
  'icon',
  'tier',
  'zone',
  'role',
  'status',
  'mgmt_ip',
  'ha_pair_with',
  'hero',
  'pin',
  'accent',
  'note',
  'config',
  'interfaces',
] as const;
export const LINK_KEYS = ['from', 'to', 'kind', 'speed', 'lag', 'status', 'animated', 'label', 'note'] as const;
export const INTERFACE_KEYS = ['name', 'description', 'vlan', 'ip'] as const;
export const PIN_KEYS = ['x', 'y'] as const;
export const ENDPOINT_KEYS = ['device', 'port'] as const;

/** Known keys of the object at `path` (the path of the object itself). */
export function knownKeysAt(path: DataPath): readonly string[] {
  const [a, b, c, d] = [path[0], path[1], path[2], path[3]];
  if (path.length === 0) return ROOT_KEYS;
  if (a === 'backdrop' && path.length === 1) return BACKDROP_KEYS;
  if (a === 'zones' && typeof b === 'number' && path.length === 2) return ZONE_KEYS;
  if (a === 'devices' && typeof b === 'number') {
    if (path.length === 2) return DEVICE_KEYS;
    if (c === 'pin' && path.length === 3) return PIN_KEYS;
    if (c === 'interfaces' && typeof d === 'number' && path.length === 4) return INTERFACE_KEYS;
  }
  if (a === 'links' && typeof b === 'number') {
    if (path.length === 2) return LINK_KEYS;
    if ((c === 'from' || c === 'to') && path.length === 3) return ENDPOINT_KEYS;
  }
  return [];
}

/** Normalize `devices[3].icon` → `devices[].icon` for hint lookup. */
export function normalizePath(pathStr: string): string {
  return pathStr.replace(/\[\d+\]/g, '[]');
}

const FIELD_HINTS: Record<string, string> = {
  'name': 'give the topology a name, e.g. name: Acme HQ',
  'zones[].id': 'every zone needs a short id, e.g. id: campus-a',
  'devices[].id': 'every device needs a short id, e.g. id: core-sw-01',
  'devices[].icon':
    'every device needs an icon id like "cisco/switches/workgroup-switch" — find one with `marrow icons search <keyword>`',
  'links[].from': 'write endpoints as "device-id:PortName" (port optional), e.g. from: core-sw-01:Gi1/0/1',
  'links[].to': 'write endpoints as "device-id:PortName" (port optional), e.g. to: dist-sw-01:Te1/1',
  'devices[].interfaces[].name': 'each interface needs a name, e.g. name: Gi1/0/1',
  'devices[].pin.x': 'pin needs both x and y numbers, e.g. pin: { x: 120, y: 400 }',
  'devices[].pin.y': 'pin needs both x and y numbers, e.g. pin: { x: 120, y: 400 }',
};

export function hintForMissing(normalizedPath: string): string | undefined {
  return FIELD_HINTS[normalizedPath];
}
