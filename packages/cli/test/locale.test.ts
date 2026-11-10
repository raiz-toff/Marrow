import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';

/**
 * ADR-0007 determinism across machines: the same YAML must compile to the
 * same bytes whatever the process locale. The probe's ids sort differently
 * under da_DK ("aa" after "z") and lt_LT ("y" before "j") collation, so any
 * locale-sensitive sort that reaches layout or output shows up as a diff.
 */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const cli = join(repoRoot, 'packages', 'cli', 'dist', 'index.js');
const probe = join(repoRoot, 'fixtures', 'valid', 'locale-probe-flat.yaml');
const LOCALES = ['C', 'da_DK.UTF-8', 'lt_LT.UTF-8'] as const;

const envFor = (locale: string): NodeJS.ProcessEnv => ({ ...process.env, LANG: locale, LC_ALL: locale });

/** Node's full ICU honours LANG/LC_ALL even when the OS has no such locale
 *  installed — but a small-ICU build would not. Probe before relying on it. */
function collationProbe(locale: string): string {
  const res = spawnSync(process.execPath, ['-e', "process.stdout.write(String(['aaa'.localeCompare('ab'), 'ya'.localeCompare('ja')]))"], {
    env: envFor(locale),
    encoding: 'utf8',
  });
  return res.stdout;
}
const localesDiffer = LOCALES.slice(1).every((l) => collationProbe(l) !== collationProbe('C'));

describe('locale-independent output', () => {
  const out = mkdtempSync(join(tmpdir(), 'marrow-locale-'));
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  test.skipIf(!localesDiffer)('the probe builds byte-identical under C, da_DK and lt_LT', () => {
    expect(existsSync(cli), 'CLI not built — run npm run compile first').toBe(true);
    const builds = LOCALES.map((locale) => {
      const file = join(out, `${locale}.html`);
      // empty cwd: no marrow.config.yaml leaks in
      const res = spawnSync(process.execPath, [cli, 'build', probe, '--single', '-o', file], {
        cwd: out,
        env: envFor(locale),
        encoding: 'utf8',
      });
      expect(res.status, `${locale}: ${res.stderr}`).toBe(0);
      return readFileSync(file);
    });
    expect(builds[1]!.equals(builds[0]!), 'da_DK build differs from C').toBe(true);
    expect(builds[2]!.equals(builds[0]!), 'lt_LT build differs from C').toBe(true);
  }, 60_000);
});
