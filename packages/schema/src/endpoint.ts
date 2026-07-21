import type { Endpoint } from '@marrow/model';

export type EndpointParse =
  | { ok: true; endpoint: Endpoint }
  | { ok: false; reason: string };

/**
 * Endpoints are written `"device-id:PortName"` (port optional — `"device-id"`
 * alone is fine) or as `{ device, port }`. Only the FIRST colon separates the
 * device from the port, so port names may themselves contain colons.
 */
export function parseEndpoint(raw: string | { device: string; port?: string | undefined }): EndpointParse {
  if (typeof raw !== 'string') {
    const device = raw.device.trim();
    if (device === '') return { ok: false, reason: 'device id is empty' };
    const port = raw.port?.trim();
    return { ok: true, endpoint: port ? { device, port } : { device } };
  }
  const text = raw.trim();
  if (text === '') return { ok: false, reason: 'endpoint is empty' };
  const idx = text.indexOf(':');
  if (idx === -1) return { ok: true, endpoint: { device: text } };
  const device = text.slice(0, idx).trim();
  const port = text.slice(idx + 1).trim();
  if (device === '') return { ok: false, reason: `missing device id before ":" in "${raw}"` };
  if (port === '') {
    return { ok: false, reason: `empty port after ":" in "${raw}" — drop the colon or add the port name` };
  }
  return { ok: true, endpoint: { device, port } };
}
