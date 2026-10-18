import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const cli = join(repoRoot, 'packages', 'cli', 'dist', 'index.js');

function run(args: string[], cwd = repoRoot) {
  const res = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe('Adversarial CLI & Multi-Query Stress Tests', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'marrow-adv-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  test('multi-query search with 20 queries, special characters, and regex tokens', () => {
    const queries = [
      'switch',
      'firewall',
      'router',
      'server',
      'database',
      'storage',
      '.*[a-z]+',
      '???***',
      'switch+router',
      'nonexistent-device-12345',
      'cisco',
      'vpn',
      'gateway',
      'access point',
      'load balancer',
      'internet',
      'cloud',
      'client',
      'printer',
      'monitor'
    ];

    const res = run(['icons', 'search', ...queries, '--json']);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);

    // Verify every query exists as a key in the returned dictionary
    for (const q of queries) {
      expect(parsed).toHaveProperty(q);
      expect(Array.isArray(parsed[q])).toBe(true);
    }

    // Known terms should have hits
    expect(parsed.switch.length).toBeGreaterThan(0);
    expect(parsed.firewall.length).toBeGreaterThan(0);

    // Impossible/regex terms should be safely treated as literal text and return empty without crashing
    expect(parsed['nonexistent-device-12345']).toEqual([]);
    expect(parsed['???***']).toEqual([]);
  });

  test('plain text multi-query search renders section headers for all terms', () => {
    const res = run(['icons', 'search', 'layer 3 switch', 'firewall']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('# Results for "layer 3 switch"');
    expect(res.stdout).toContain('# Results for "firewall"');
  });

  test('marrow icons index CLI handles multi-level directories, collisions, and empty packs', () => {
    const packsDir = join(tmp, 'packs');
    const packDir = join(packsDir, 'custom-vendor');
    mkdirSync(join(packDir, 'svg', 'deep', 'nested', 'layer'), { recursive: true });
    mkdirSync(join(packDir, 'svg', 'other'), { recursive: true });
    mkdirSync(join(packsDir, 'empty-vendor', 'svg'), { recursive: true });

    // Colliding base filenames in the same directory (e.g. Device.svg vs device.svg)
    writeFileSync(
      join(packDir, 'svg', 'deep', 'nested', 'layer', 'device.svg'),
      '<svg viewBox="0 0 50 50"><rect/></svg>'
    );
    writeFileSync(
      join(packDir, 'svg', 'other', 'device.svg'),
      '<svg viewBox="0 0 50 50"><circle/></svg>'
    );
    writeFileSync(
      join(packDir, 'svg', 'other', 'Device.svg'),
      '<svg viewBox="0 0 50 50"><path d="M0 0h10v10z"/></svg>'
    );

    // Run marrow icons index on custom-vendor
    const res1 = run(['icons', 'index', 'custom-vendor', '--packs', packsDir]);
    expect(res1.status).toBe(0);
    expect(res1.stdout).toContain('indexed pack "custom-vendor" (3 icons)');

    // Run marrow icons index on empty-vendor
    const res2 = run(['icons', 'index', 'empty-vendor', '--packs', packsDir]);
    expect(res2.status).toBe(0);
    expect(res2.stdout).toContain('indexed pack "empty-vendor" (0 icons)');

    // Verify manifest contents and collision resolution
    const manifestPath = join(packDir, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(spawnSync('cat', [manifestPath], { encoding: 'utf8' }).stdout);
    expect(manifest.icons).toHaveLength(3);
    const ids = manifest.icons.map((i: any) => i.id);
    expect(ids).toContain('custom-vendor/deep/nested/layer/device');
    expect(ids).toContain('custom-vendor/other/device');
    expect(ids).toContain('custom-vendor/other/device-2');
  });

  test('validates topology referencing unfetched cloud pack emitting MRW-W106 warning with exit code 0', () => {
    // Setup a mock packs root where 'aws' has a valid manifest but no svg/ folder
    const mockPacks = join(tmp, 'cloud-packs');
    const awsDir = join(mockPacks, 'aws');
    mkdirSync(awsDir, { recursive: true });
    writeFileSync(
      join(awsDir, 'manifest.json'),
      JSON.stringify({
        pack: 'aws',
        title: 'AWS',
        version: '1.0.0',
        icons: [
          {
            id: 'aws/compute/ec2',
            title: 'EC2',
            category: 'compute',
            keywords: ['compute', 'ec2', 'server'],
            file: 'svg/compute/ec2.svg'
          }
        ]
      })
    );

    // Create a topology referencing aws/compute/ec2
    const topoFile = join(tmp, 'aws-topo.yaml');
    writeFileSync(
      topoFile,
      `marrow: 2
name: AWS Cloud Topology
devices:
  - id: app-server
    name: App Server
    icon: aws/compute/ec2
`
    );

    // Validate with mockPacks
    const res = run(['validate', topoFile, '--packs', mockPacks, '--json']);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.valid).toBe(true);
    expect(parsed.diagnostics.some((d: any) => d.code === 'MRW-W106')).toBe(true);
    const diag = parsed.diagnostics.find((d: any) => d.code === 'MRW-W106');
    expect(diag.hint).toContain('marrow icons fetch aws');
  });
});
