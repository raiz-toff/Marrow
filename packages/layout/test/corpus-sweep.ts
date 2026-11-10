import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validateSource } from '@marrow/schema';
import { layoutTopology, resolveLayoutMetrics } from '@marrow/layout';
import { lintScene } from '@marrow/lint';
import type { Density } from '@marrow/model';

/** Shared by the corpus gate and its density shards (not itself a test file). */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
export const corpusDir = join(repoRoot, 'fixtures', 'corpus');
export const corpusFiles = readdirSync(corpusDir)
  .filter((f) => f.endsWith('.yaml'))
  .sort();

export const SWEEP_SCALES = [0.4, 0.8, 1, 1.5, 2.5] as const;

/**
 * ADR-0014 promises an overlap-free layout at every density preset and
 * scale. Every corpus fixture is laid out at `density` under each sweep scale
 * and must stay L1-clean — the gate that caught ring/mesh placement using a
 * fixed gap where the density-scaled one belonged. One call per density, each
 * from its own test file, so the three shards run in parallel workers.
 */
export function sweepDensity(density: Density): void {
  describe(`layout corpus gate — ${density} × scale sweep`, () => {
    for (const file of corpusFiles) {
      test(`${file}: L1-clean at ${density} for scales ${SWEEP_SCALES.join(', ')}`, async () => {
        const topology = validateSource(readFileSync(join(corpusDir, file), 'utf8')).topology!;
        const failures: string[] = [];
        for (const scale of SWEEP_SCALES) {
          const scene = await layoutTopology(topology, { metrics: resolveLayoutMetrics(density, scale) });
          const report = lintScene(scene);
          if (!report.clean) failures.push(`${density}@${scale}: ${report.l1.map((i) => i.message).join('; ')}`);
        }
        expect(failures).toEqual([]);
      }, 60_000);
    }
  });
}
