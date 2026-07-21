import {
  containsPoint,
  inflate,
  rectsOverlap,
  segmentIntersectsRect,
  segmentsCross,
  type Scene,
  type SceneEdge,
} from '@marrow/scene';

/**
 * @marrow/lint — the geometry linter, the "production-grade" enforcement
 * from the v2 plan:
 *   L1 — defects that FAIL a build: node overlap (label-inclusive boxes),
 *        an edge passing through a node it isn't attached to, an edge not
 *        reaching its endpoint node.
 *   L3 — advisory: excessive crossings, extreme aspect ratio.
 * (L2 auto-repair hooks arrive with the router integration.)
 */

export interface LintIssue {
  level: 1 | 3;
  kind: 'node-overlap' | 'edge-through-node' | 'detached-endpoint' | 'port-chip-overlap' | 'crossings' | 'aspect-ratio';
  message: string;
  ids: string[];
}

export interface LintReport {
  issues: LintIssue[];
  l1: LintIssue[];
  l3: LintIssue[];
  /** True when the scene has zero build-failing (L1) defects. */
  clean: boolean;
}

const EPS = 0.5;

export function lintScene(scene: Scene): LintReport {
  const issues: LintIssue[] = [];

  // L1: node overlap on label-inclusive boxes (shrunk by EPS so exactly
  // adjacent boxes are legal)
  for (let i = 0; i < scene.nodes.length; i++) {
    for (let j = i + 1; j < scene.nodes.length; j++) {
      const a = scene.nodes[i]!;
      const b = scene.nodes[j]!;
      if (rectsOverlap(inflate(a.box, -EPS), inflate(b.box, -EPS))) {
        issues.push({
          level: 1,
          kind: 'node-overlap',
          message: `Nodes "${a.id}" and "${b.id}" overlap`,
          ids: [a.id, b.id],
        });
      }
    }
  }

  // L1: edge segments through foreign node interiors; terminal segments are
  // exempt only against their own endpoint node
  for (const e of scene.edges) {
    for (const n of scene.nodes) {
      const interior = inflate(n.box, -EPS);
      for (let s = 0; s < e.points.length - 1; s++) {
        const isFirst = s === 0;
        const isLast = s === e.points.length - 2;
        if ((n.id === e.from.node && isFirst) || (n.id === e.to.node && isLast)) continue;
        if (n.id === e.from.node && isLast && e.from.node === e.to.node) continue;
        if (segmentIntersectsRect(e.points[s]!, e.points[s + 1]!, interior)) {
          issues.push({
            level: 1,
            kind: 'edge-through-node',
            message: `Edge "${e.id}" passes through node "${n.id}"`,
            ids: [e.id, n.id],
          });
          break; // one report per edge/node pair
        }
      }
    }
  }

  // L1: endpoints must touch their node's (slightly inflated) box
  const nodeById = new Map(scene.nodes.map((n) => [n.id, n]));
  for (const e of scene.edges) {
    const from = nodeById.get(e.from.node);
    const to = nodeById.get(e.to.node);
    const first = e.points[0];
    const last = e.points.at(-1);
    if (from && first && !containsPoint(inflate(from.box, 2), first)) {
      issues.push({
        level: 1,
        kind: 'detached-endpoint',
        message: `Edge "${e.id}" does not reach its source node "${from.id}"`,
        ids: [e.id, from.id],
      });
    }
    if (to && last && !containsPoint(inflate(to.box, 2), last)) {
      issues.push({
        level: 1,
        kind: 'detached-endpoint',
        message: `Edge "${e.id}" does not reach its target node "${to.id}"`,
        ids: [e.id, to.id],
      });
    }
  }

  // L1: port chips are placed collision-free by layout — any chip overlapping
  // another chip or a node box means the placement solver regressed
  const chips = scene.portChips ?? [];
  for (let i = 0; i < chips.length; i++) {
    const a = chips[i]!;
    for (let j = i + 1; j < chips.length; j++) {
      const b = chips[j]!;
      if (rectsOverlap(inflate(a.box, -EPS), inflate(b.box, -EPS))) {
        issues.push({
          level: 1,
          kind: 'port-chip-overlap',
          message: `Port chips "${a.label}" (${a.node}) and "${b.label}" (${b.node}) overlap`,
          ids: [a.edge ?? a.node, b.edge ?? b.node],
        });
      }
    }
    for (const n of scene.nodes) {
      if (rectsOverlap(inflate(a.box, -EPS), inflate(n.box, -EPS))) {
        issues.push({
          level: 1,
          kind: 'port-chip-overlap',
          message: `Port chip "${a.label}" overlaps node "${n.id}"`,
          ids: [a.edge ?? a.node, n.id],
        });
      }
    }
  }

  // L3: crossings
  const crossings = countCrossings(scene.edges);
  if (crossings > Math.max(4, scene.edges.length)) {
    issues.push({
      level: 3,
      kind: 'crossings',
      message: `${crossings} edge crossings (${scene.edges.length} edges) — consider restructuring zones/tiers`,
      ids: [],
    });
  }

  // L3: aspect ratio
  if (scene.size.h > 0 && scene.size.w > 0) {
    const ratio = scene.size.w / scene.size.h;
    if (ratio > 4 || ratio < 0.25) {
      issues.push({
        level: 3,
        kind: 'aspect-ratio',
        message: `Extreme aspect ratio ${ratio.toFixed(2)} (${scene.size.w}×${scene.size.h})`,
        ids: [],
      });
    }
  }

  const l1 = issues.filter((i) => i.level === 1);
  const l3 = issues.filter((i) => i.level === 3);
  return { issues, l1, l3, clean: l1.length === 0 };
}

export function countCrossings(edges: readonly SceneEdge[]): number {
  let count = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i]!;
      const b = edges[j]!;
      for (let s = 0; s < a.points.length - 1; s++) {
        for (let u = 0; u < b.points.length - 1; u++) {
          if (segmentsCross(a.points[s]!, a.points[s + 1]!, b.points[u]!, b.points[u + 1]!)) count++;
        }
      }
    }
  }
  return count;
}
