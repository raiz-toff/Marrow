import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { hasErrors } from '@marrow/diagnostics';
import { validateSource } from '@marrow/schema';
import { ciscoCatalog, fixtureSource, invalidFixtureNames, repoRoot } from './helpers.js';

/**
 * The P0 exit gate: an agent must be able to repair any broken topology using
 * ONLY the diagnostics. Concretely, for every invalid fixture:
 *   1. validation produces at least one diagnostic — never a crash;
 *   2. every diagnostic is machine-readable (stable code, path, message);
 *   3. every ERROR carries repair guidance (hint and/or did-you-mean) and a
 *      source location with snippet;
 *   4. the documented fix (`<name>.fixed.yaml`) validates with zero errors.
 */
describe('agent-repair eval', () => {
  const names = invalidFixtureNames();

  test('corpus is present', () => {
    expect(names.length).toBeGreaterThanOrEqual(9);
  });

  for (const name of names) {
    describe(name, () => {
      const result = validateSource(fixtureSource(join('invalid', name)), { icons: ciscoCatalog() });

      test('produces diagnostics, never a crash', () => {
        expect(result.diagnostics.length).toBeGreaterThan(0);
      });

      test('every diagnostic is machine-readable', () => {
        for (const d of result.diagnostics) {
          expect(d.code).toMatch(/^MRW-[EW]\d{3}$/);
          expect(d.message.length).toBeGreaterThan(0);
          expect(typeof d.path).toBe('string');
          expect(['error', 'warning', 'info']).toContain(d.severity);
        }
      });

      test('every error carries location + repair guidance', () => {
        for (const d of result.diagnostics.filter((x) => x.severity === 'error')) {
          expect(d.loc, `${d.code} at ${d.path} should have loc`).toBeDefined();
          expect(d.loc!.line).toBeGreaterThan(0);
          expect(d.snippet, `${d.code} at ${d.path} should have snippet`).toBeTruthy();
          const guided = Boolean(d.hint) || (d.didYouMean?.length ?? 0) > 0;
          expect(guided, `${d.code} at ${d.path} should have hint or didYouMean`).toBe(true);
        }
      });

      test('the documented fix validates clean', () => {
        const fixedPath = join(repoRoot, 'fixtures', 'invalid', name.replace(/\.yaml$/, '.fixed.yaml'));
        expect(existsSync(fixedPath), `${name} needs a .fixed.yaml`).toBe(true);
        const fixed = validateSource(fixtureSource(join('invalid', name.replace(/\.yaml$/, '.fixed.yaml'))), {
          icons: ciscoCatalog(),
        });
        expect(hasErrors(fixed.diagnostics)).toBe(false);
        expect(fixed.valid).toBe(true);
      });
    });
  }
});
