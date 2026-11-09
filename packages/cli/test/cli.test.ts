import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const cli = join(repoRoot, 'packages', 'cli', 'dist', 'index.js');
const validFixture = join(repoRoot, 'fixtures', 'valid', 'small-office.yaml');
const invalidFixture = join(repoRoot, 'fixtures', 'invalid', 'bad-icon.yaml');

function run(args: string[], cwd = repoRoot) {
  const res = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

beforeAll(() => {
  if (!existsSync(cli)) {
    throw new Error('CLI not built — run npm run compile first');
  }
});

describe('exit codes and arg handling', () => {
  test('valid file → 0, invalid file → 1, missing file → 2', () => {
    expect(run(['validate', validFixture]).status).toBe(0);
    expect(run(['validate', invalidFixture]).status).toBe(1);
    expect(run(['validate', '/no/such/file.yaml']).status).toBe(2);
  });

  test('mistyped flag → usage error with exit 2, never a stack trace', () => {
    const res = run(['validate', validFixture, '--jsn']);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('usage:');
    expect(res.stderr).not.toMatch(/\n\s+at .*\(/); // no stack frames
  });

  test('no command / unknown command → 2', () => {
    expect(run([]).status).toBe(2);
    expect(run(['frobnicate']).status).toBe(2);
  });
});

describe('marrow build (end to end)', () => {
  let out: string;
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'marrow-build-'));
  });
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  // run from an empty cwd so no marrow.config.yaml leaks in
  test('a small topology builds a Single file', () => {
    const file = join(out, 'office.html');
    const res = run(['build', validFixture, '-o', file], out);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/^built .*office\.html — 10 nodes/);
    expect(existsSync(file)).toBe(true);
  });

  test('a large topology builds a Site; --single forces one file', () => {
    const xl = join(repoRoot, 'fixtures', 'corpus', 'xl-campus-01.yaml');
    const site = join(out, 'campus-site');
    const res = run(['build', xl, '-o', site], out);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('built site');
    for (const rel of ['index.html', 'inventory.html', 'zones/building-a.html', 'assets/runtime.js', 'assets/search-data.js']) {
      expect(existsSync(join(site, rel)), rel).toBe(true);
    }

    const single = join(out, 'campus.html');
    const forced = run(['build', xl, '--single', '-o', single], out);
    expect(forced.status, forced.stderr).toBe(0);
    expect(existsSync(single)).toBe(true);
    expect(existsSync(join(out, 'assets'))).toBe(false);
  }, 30_000);
});

describe('multi-file validation', () => {
  test('validates every positional and fails if ANY file is invalid', () => {
    const res = run(['validate', validFixture, invalidFixture]);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('small-office.yaml');
    expect(res.stdout).toContain('bad-icon.yaml');
  });

  test('--json emits one object for one file (with file field), an array for many', () => {
    const single = JSON.parse(run(['validate', validFixture, '--json']).stdout);
    expect(Array.isArray(single)).toBe(false);
    expect(single.file).toContain('small-office.yaml');
    const multi = JSON.parse(run(['validate', validFixture, invalidFixture, '--json']).stdout);
    expect(Array.isArray(multi)).toBe(true);
    expect(multi).toHaveLength(2);
    expect(multi[1].valid).toBe(false);
    expect(multi[1].file).toContain('bad-icon.yaml');
  });
});

describe('icon pack resolution', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'marrow-cli-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  test('explicit --packs pointing nowhere → exit 2, not a silent pass', () => {
    const res = run(['validate', validFixture, '--packs', '/no/such/packs']);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('not found');
  });

  test('empty packs root → loud warning that icons were not checked', () => {
    const emptyRoot = join(tmp, 'empty-packs');
    mkdirSync(emptyRoot, { recursive: true });
    const res = run(['validate', validFixture, '--packs', emptyRoot]);
    expect(res.status).toBe(0);
    expect(res.stderr).toContain('NOT checked');
  });

  test('corrupt manifest in one pack → warning naming the file, validation still runs', () => {
    const root = join(tmp, 'mixed-packs');
    mkdirSync(join(root, 'broken'), { recursive: true });
    writeFileSync(join(root, 'broken', 'manifest.json'), '{ not json');
    const res = run(['validate', validFixture, '--packs', root]);
    expect(res.status).toBe(0);
    expect(res.stderr).toContain('manifest.json');
    expect(res.stderr).not.toContain('SyntaxError:');
  });

  test('works from an unrelated cwd (falls back to the package tree walk-up)', () => {
    const res = run(['validate', validFixture], tmpdir());
    expect(res.status).toBe(0);
  });
});

describe('schema export', () => {
  test('emits the INPUT contract: defaulted fields are not required', () => {
    const res = run(['schema']);
    expect(res.status).toBe(0);
    const schema = JSON.parse(res.stdout);
    expect(schema.required).toContain('marrow');
    expect(schema.required).toContain('name');
    expect(schema.required).not.toContain('theme');
    expect(schema.required).not.toContain('zones');
    // density/scale stay undeclared unless written, so config defaults can apply
    for (const key of ['density', 'scale']) {
      expect(schema.required).not.toContain(key);
      expect(schema.properties[key].default, key).toBeUndefined();
    }
    const device = schema.properties.devices.items;
    expect(device.required).toContain('id');
    expect(device.required).toContain('icon');
    expect(device.required).not.toContain('status');
    expect(device.required).not.toContain('hero');
  });
});

describe('marrow icons CLI commands', () => {
  test('multi-query search returns dictionary with matches and empty arrays for misses', () => {
    const res = run(['icons', 'search', 'switch', 'firewall', 'totallyunknowndevicexyz', '--json']);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed).toHaveProperty('switch');
    expect(parsed).toHaveProperty('firewall');
    expect(parsed).toHaveProperty('totallyunknowndevicexyz');
    expect(Array.isArray(parsed.switch)).toBe(true);
    expect(parsed.switch.length).toBeGreaterThan(0);
    expect(parsed.totallyunknowndevicexyz).toEqual([]);
  });

  test('single-query search returns array for backward compatibility', () => {
    const res = run(['icons', 'search', 'firewall', '--json']);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });
});

describe('marrow add registry scaffolding', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'marrow-add-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  test('marrow add without component arguments exits with code 2', () => {
    const res = run(['add']);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('usage:');
  });

  test('marrow add unknown-item exits with code 1', () => {
    const res = run(['add', 'non-existent-component-xyz', '--out', tmp]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('unknown component');
  });

  test('marrow add copies an item with every file it needs from the root registry.json', () => {
    const out = join(tmp, 'device-link');
    const res = run(['add', 'device-link', '--out', out]);
    expect(res.status).toBe(0);
    expect(readdirSync(out).sort()).toEqual(['cable-badge.tsx', 'device-link.tsx', 'topology-types.ts']);
    expect(readFileSync(join(out, 'device-link.tsx'), 'utf8')).toContain("from './topology-types.js'");
  });

  test('marrow add outside a registry checkout exits with code 2', () => {
    const res = run(['add', 'cable-badge', '--out', join(tmp, 'x')], tmp);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('registry catalog not found');
  });
});

