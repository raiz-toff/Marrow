import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validateSource } from '@marrow/schema';
import { layoutTopology } from '@marrow/layout';
import { lintScene } from '@marrow/lint';

/**
 * The P1 exit gate: the full fixture corpus — tiered, zoned, hub-spoke,
 * mesh, edge cases — lays out with ZERO build-failing geometry defects.
 */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const corpusDir = join(repoRoot, 'fixtures', 'corpus');
const files = readdirSync(corpusDir)
  .filter((f) => f.endsWith('.yaml'))
  .sort();

describe('layout corpus gate', () => {
  test('corpus is complete', () => {
    expect(files.length).toBeGreaterThanOrEqual(40);
  });

  for (const file of files) {
    test(`${file}: linter-clean layout`, async () => {
      const source = readFileSync(join(corpusDir, file), 'utf8');
      const validated = validateSource(source);
      expect(validated.topology, `fixture must validate: ${JSON.stringify(validated.diagnostics)}`).toBeDefined();
      const scene = await layoutTopology(validated.topology!);
      expect(scene.nodes.length).toBe(validated.topology!.devices.length);
      const report = lintScene(scene);
      expect(report.l1, report.l1.map((i) => i.message).join('; ')).toEqual([]);
    });
  }

  test('determinism across the corpus (sampled)', async () => {
    for (const file of [files[0]!, files[Math.floor(files.length / 2)]!, files.at(-1)!]) {
      const source = readFileSync(join(corpusDir, file), 'utf8');
      const t1 = validateSource(source).topology!;
      const t2 = validateSource(source).topology!;
      expect(JSON.stringify(await layoutTopology(t1))).toBe(JSON.stringify(await layoutTopology(t2)));
    }
  });
});
