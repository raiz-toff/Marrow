import { describe, expect, test } from 'vitest';
import type { Scene } from '@marrow/scene';
import { extractSvg, renderScene } from '@marrow/render-svg';

const scene: Scene = {
  size: { w: 400, h: 300 },
  nodes: [
    {
      id: 'a',
      chip: { x: 20, y: 20, w: 64, h: 64 },
      labelBox: { x: 10, y: 90, w: 84, h: 17 },
      box: { x: 10, y: 20, w: 84, h: 87 },
      label: 'Node <A> & "co"',
      icon: 'test/misc/thing',
      status: 'up',
      hero: true,
      tier: 'core',
    },
    {
      id: 'b',
      chip: { x: 220, y: 20, w: 64, h: 64 },
      labelBox: { x: 220, y: 90, w: 64, h: 17 },
      box: { x: 220, y: 20, w: 64, h: 87 },
      label: 'b',
      icon: 'test/misc/missing',
      status: 'down',
      hero: false,
    },
  ],
  edges: [
    {
      id: 'a--b#1',
      from: { node: 'a', port: 'p1' },
      to: { node: 'b', port: 'p2' },
      points: [
        { x: 94, y: 52 },
        { x: 160, y: 52 },
        { x: 160, y: 52 },
        { x: 220, y: 52 },
      ],
      status: 'up',
      animated: true,
      speed: '10G',
    },
  ],
  zones: [{ id: 'z1', name: 'Zone One', box: { x: 5, y: 5, w: 390, h: 290 }, depth: 0 }],
};

const icons = {
  svg: (id: string) =>
    id === 'test/misc/thing'
      ? '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="50" height="50"/></svg>'
      : undefined,
};

describe('renderScene', () => {
  const { svg, usedIcons } = renderScene(scene, { icons });

  test('sprite contains only resolvable icons; missing icons fall back', () => {
    expect(usedIcons).toEqual(['test/misc/thing']);
    expect(svg).toContain('<symbol id="ic-test-misc-thing" viewBox="0 0 50 50">');
    expect(svg).toContain('use href="#ic-test-misc-thing"');
    expect(svg).toContain('m-icon-fallback');
  });

  test('escapes labels and carries data attributes', () => {
    expect(svg).toContain('Node &lt;A&gt; &amp; &quot;co&quot;');
    expect(svg).toContain('data-node="a"');
    expect(svg).toContain('data-edge="a--b#1"');
    expect(svg).toContain('data-from-port="p1"');
    expect(svg).toContain('pathLength="1"');
  });

  test('status/speed/animated become classes; hero gets its class', () => {
    expect(svg).toContain('m-status-down');
    expect(svg).toContain('m-speed-10g');
    expect(svg).toContain('m-flow');
    expect(svg).toContain('m-hero');
  });

  test('entrance delays are staged by tier', () => {
    expect(svg).toMatch(/--d:0\.2\ds/); // core rank 1 → ~0.28s
  });
});

describe('extractSvg', () => {
  test('pulls viewBox and inner content, strips xml prolog', () => {
    const out = extractSvg('<?xml version="1.0"?><!-- c --><svg viewBox="0 0 10 10"><g id="x"/></svg>');
    expect(out).toEqual({ viewBox: '0 0 10 10', inner: '<g id="x"/>' });
  });

  test('defaults missing viewBox; rejects non-svg', () => {
    expect(extractSvg('<svg><rect/></svg>')?.viewBox).toBe('0 0 100 100');
    expect(extractSvg('not svg at all')).toBeUndefined();
  });
});
