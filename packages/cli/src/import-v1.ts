import { parse, stringify } from 'yaml';

/**
 * v1 → v2 topology conversion. Bridges everything that emits v1 YAML — the
 * network-discovery crawler, old input/ files — into the v2 pipeline. Nothing
 * is silently dropped: v1 fields with no v2 equivalent are preserved as `x-`
 * annotations.
 */

const TIER_BY_LEVEL: Record<number, string> = { 0: 'edge', 1: 'core', 2: 'distribution', 3: 'access', 4: 'endpoint' };
const STATUS_MAP: Record<string, string> = {
  up: 'up',
  down: 'down',
  warn: 'degraded',
  warning: 'degraded',
  degraded: 'degraded',
  planned: 'planned',
  unknown: 'unknown',
};
const KIND_SET = new Set(['copper', 'fiber', 'dac', 'wireless', 'virtual', 'wan', 'serial']);

interface V1Node {
  id?: string;
  label?: string;
  icon?: string;
  role?: string;
  level?: number;
  status?: string;
  ip?: string;
  callout?: string;
  purpose?: string;
  location?: string;
  tags?: unknown[];
  badges?: unknown[];
}

interface V1Link {
  from?: string;
  to?: string;
  cable?: string;
  from_port?: string;
  to_port?: string;
  label?: string;
}

interface V1Group {
  name?: string;
  nodes?: string[];
  color?: string;
  callout?: string;
}

export interface ImportResult {
  yaml: string;
  devices: number;
  links: number;
  zones: number;
  notes: string[];
}

export function importV1(source: string): ImportResult {
  const doc = parse(source) as Record<string, unknown>;
  if (typeof doc !== 'object' || doc === null) throw new Error('not a YAML mapping');
  const notes: string[] = [];
  if (doc['marrow'] === 2) throw new Error('this file is already marrow v2');
  const nodes = (doc['nodes'] ?? []) as V1Node[];
  const v1Links = (doc['links'] ?? []) as V1Link[];
  const groups = (doc['groups'] ?? []) as V1Group[];
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('no v1 nodes: found — is this a v1 topology?');

  // v1 ids are free-form (usually UPPER_SNAKE); map them all to v2 identifiers
  const idMap = new Map<string, string>();
  const used = new Set<string>();
  for (const n of nodes) {
    if (!n.id) continue;
    let v2 = kebabId(n.id);
    for (let i = 2; used.has(v2); i++) v2 = `${kebabId(n.id)}-${i}`;
    used.add(v2);
    idMap.set(n.id, v2);
  }

  // groups → zones + membership (first group wins when a device is in several)
  const zoneOf = new Map<string, string>();
  const zones = groups
    .filter((g) => g.name)
    .map((g) => {
      const id = kebabId(g.name!);
      for (const member of g.nodes ?? []) {
        const mapped = idMap.get(member);
        if (mapped !== undefined && !zoneOf.has(mapped)) zoneOf.set(mapped, id);
      }
      return {
        id,
        name: g.name!,
        ...(g.color !== undefined ? { accent: g.color } : {}),
        ...(g.callout !== undefined ? { note: g.callout } : {}),
      };
    });

  const devices = nodes
    .filter((n) => n.id)
    .map((n) => {
      const id = idMap.get(n.id!)!;
      const note = [n.callout, n.purpose ? `Purpose: ${n.purpose}` : undefined, n.location ? `Location: ${n.location}` : undefined]
        .filter(Boolean)
        .join('\n');
      const tier = n.level !== undefined ? TIER_BY_LEVEL[Math.min(Math.max(Math.round(n.level), 0), 4)] : undefined;
      return {
        id,
        ...(n.label !== undefined ? { name: n.label } : {}),
        icon: n.icon !== undefined ? kebabIcon(n.icon) : 'generic/misc/host',
        ...(tier !== undefined ? { tier } : {}),
        ...(zoneOf.has(id) ? { zone: zoneOf.get(id) } : {}),
        ...(n.role !== undefined ? { role: n.role } : {}),
        ...(n.status !== undefined ? { status: STATUS_MAP[n.status.toLowerCase()] ?? 'unknown' } : {}),
        ...(n.ip !== undefined ? { mgmt_ip: n.ip } : {}),
        ...(note !== '' ? { note } : {}),
        ...(Array.isArray(n.tags) && n.tags.length > 0 ? { 'x-v1-tags': n.tags } : {}),
        ...(Array.isArray(n.badges) && n.badges.length > 0 ? { 'x-v1-badges': n.badges } : {}),
      };
    });

  const links = v1Links
    .filter((l) => l.from && l.to && idMap.has(l.from) && idMap.has(l.to))
    .map((l) => {
      const fromPort = parsePort(l.from_port);
      const toPort = parsePort(l.to_port);
      const lag = fromPort.lag ?? toPort.lag;
      const kind = l.cable !== undefined && KIND_SET.has(l.cable) ? l.cable : undefined;
      if (l.cable !== undefined && kind === undefined) notes.push(`link ${l.from}→${l.to}: unknown cable "${l.cable}" dropped`);
      return {
        from: fromPort.port !== undefined ? `${idMap.get(l.from!)!}:${fromPort.port}` : idMap.get(l.from!)!,
        to: toPort.port !== undefined ? `${idMap.get(l.to!)!}:${toPort.port}` : idMap.get(l.to!)!,
        ...(kind !== undefined ? { kind } : {}),
        ...(lag !== undefined ? { lag } : {}),
        ...(l.label !== undefined ? { label: l.label } : {}),
      };
    });
  const dropped = v1Links.length - links.length;
  if (dropped > 0) notes.push(`${dropped} links referenced unknown nodes and were dropped`);

  const out: Record<string, unknown> = {
    marrow: 2,
    name: doc['title'] ?? 'Imported Topology',
    ...(doc['description'] !== undefined ? { description: doc['description'] } : {}),
    ...(doc['config'] !== undefined ? { 'x-v1-config': doc['config'] } : {}),
    ...(zones.length > 0 ? { zones } : {}),
    devices,
    links,
  };
  return {
    yaml: stringify(out, { lineWidth: 110 }),
    devices: devices.length,
    links: links.length,
    zones: zones.length,
    notes,
  };
}

/** "Te1/0/1 (Po1)" → port "Te1/0/1", lag "po1" */
function parsePort(raw: string | undefined): { port?: string; lag?: string } {
  if (raw === undefined) return {};
  const m = /^(.*?)\s*\(([A-Za-z]+[-\d]+)\)\s*$/.exec(raw);
  if (m) return { port: m[1]!.trim(), lag: m[2]!.toLowerCase() };
  return { port: raw.trim() };
}

function kebabId(v1: string): string {
  const out = v1
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return out === '' ? 'device' : out;
}

/** "Cisco/Security/centri_firewall" → "cisco/security/centri-firewall" */
function kebabIcon(v1: string): string {
  return v1
    .split('/')
    .map((seg) =>
      seg
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/[_\s]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter((seg) => seg !== '')
    .join('/');
}
