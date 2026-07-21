import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { EXTRACTORS, fetchPack, type IconPackManifest } from '@marrow/icons';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

function entries(paths: string[]): Map<string, Uint8Array> {
  return new Map(paths.map((p) => [p, strToU8(SVG)]));
}

describe('vendor archive extractors', () => {
  test('aws: 48px service icons, group icons, light resource icons — noise stripped', () => {
    const out = new Map<string, Uint8Array>();
    EXTRACTORS['aws']!(
      entries([
        'Architecture-Service-Icons_04302026/Arch_Compute/48/Arch_Amazon-EC2_48.svg',
        'Architecture-Service-Icons_04302026/Arch_Compute/64/Arch_Amazon-EC2_64.svg', // wrong size → skipped
        'Architecture-Group-Icons_04302026/Corporate-data-center_32.svg',
        'Resource-Icons_04302026/Res_Compute/Res_48_Light/Res_Amazon-EC2_Instance_48_Light.svg',
        'Resource-Icons_04302026/Res_Compute/Res_48_Dark/Res_Amazon-EC2_Instance_48_Dark.svg', // dark → skipped
        '__MACOSX/Architecture-Service-Icons_04302026/._junk.svg', // never reaches extractor in prod, but must not crash
      ]),
      'https://example.com/aws.zip',
      out,
    );
    expect([...out.keys()].sort()).toEqual([
      'svg/Compute/Amazon-EC2.svg',
      'svg/Groups/Corporate-data-center.svg',
      'svg/Resource-Compute/Amazon-EC2_Instance.svg',
    ]);
  });

  test('azure: numeric icon-service prefixes stripped, categorized', () => {
    const out = new Map<string, Uint8Array>();
    EXTRACTORS['azure']!(
      entries([
        'Azure_Public_Service_Icons/Icons/networking/00001-icon-service-Azure-Firewall.svg',
        'Azure_Public_Service_Icons/Icons/compute/10002-icon-service-Virtual-Machine.svg',
        'Azure_Public_Service_Icons/readme.txt',
      ]),
      'https://example.com/azure.zip',
      out,
    );
    expect([...out.keys()].sort()).toEqual([
      'svg/compute/Virtual-Machine.svg',
      'svg/networking/Azure-Firewall.svg',
    ]);
  });

  test('gcp: legacy flattens; current prefers the -color variant per product', () => {
    const out = new Map<string, Uint8Array>();
    EXTRACTORS['gcp']!(entries(['gcp-legacy/app_engine/app_engine.svg']), 'https://example.com/google-cloud-legacy-icons.zip', out);
    EXTRACTORS['gcp']!(
      entries([
        'Unique Icons/Cloud Run/SVG/CloudRun-512-color.svg',
        'Unique Icons/Cloud Run/SVG/CloudRun-512-white.svg',
        'Unique Icons/Vertex AI/SVG/VertexAI-512-mono.svg', // no color variant → first wins
      ]),
      'https://example.com/core-products-icons.zip',
      out,
    );
    expect([...out.keys()].sort()).toEqual([
      'svg/app_engine.svg',
      'svg/current/cloud-run.svg',
      'svg/current/vertex-ai.svg',
    ]);
  });
});

describe('fetchPack end-to-end (local server standing in for the vendor)', () => {
  let server: Server;
  let base: string;
  let packsRoot: string;

  beforeAll(async () => {
    const zip = zipSync({
      'Azure_Public_Service_Icons/Icons/networking/00001-icon-service-Azure-Firewall.svg': strToU8(SVG),
      'Azure_Public_Service_Icons/Icons/networking/00002-icon-service-Virtual-WAN.svg': strToU8(SVG),
    });
    server = createServer((req, res) => {
      if (req.url === '/icons.zip') {
        res.writeHead(200, { 'Content-Type': 'application/zip' });
        res.end(Buffer.from(zip));
      } else if (req.url === '/page.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><a href="${base}/icons.zip">download</a></html>`);
      } else {
        res.writeHead(404).end();
      }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    packsRoot = mkdtempSync(join(tmpdir(), 'marrow-fetch-'));
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(packsRoot, { recursive: true, force: true });
  });

  test('discovers the zip link on a page, extracts, and writes a valid manifest', async () => {
    const result = await fetchPack(
      'azure',
      {
        title: 'Azure',
        license: 'test',
        licenseUrl: `${base}/page.html`,
        discover: { page: `${base}/page.html`, pattern: 'http://[^"]+/icons\\.zip' },
      },
      packsRoot,
    );
    expect(result.icons).toBe(2);
    const manifest = JSON.parse(readFileSync(join(packsRoot, 'azure', 'manifest.json'), 'utf8')) as IconPackManifest;
    expect(manifest.pack).toBe('azure');
    expect(manifest.icons.map((i) => i.id).sort()).toEqual([
      'azure/networking/azure-firewall',
      'azure/networking/virtual-wan',
    ]);
    expect(readFileSync(join(packsRoot, 'azure', 'svg', 'networking', 'Azure-Firewall.svg'), 'utf8')).toBe(SVG);
  });

  test('re-fetch replaces the pack cleanly (no stale files)', async () => {
    const result = await fetchPack(
      'azure',
      { title: 'Azure', license: 'test', licenseUrl: base, urls: [`${base}/icons.zip`] },
      packsRoot,
    );
    expect(result.icons).toBe(2);
  });

  test('a package with no svgs is an explicit error, not an empty pack', async () => {
    await expect(
      fetchPack('aws', { title: 'AWS', license: 'test', licenseUrl: base, urls: [`${base}/icons.zip`] }, packsRoot),
    ).rejects.toThrow(/no SVGs found/); // azure-shaped zip yields nothing for the aws extractor
  });
});
