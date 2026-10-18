import { describe, expect, test } from 'vitest';
import type { Scene } from '@marrow/scene';
import { extractSvg, namespaceSvgInner, renderScene } from '../src/index.js';

describe('SVG Namespacing Stress & Adversarial Tests', () => {
  test('handles mixed quotes, single quotes, and url variations', () => {
    const raw = `<svg viewBox="0 0 100 100">
      <defs>
        <linearGradient id='grad-1'><stop offset="0%" stop-color="#f00"/></linearGradient>
        <clipPath id="clip.0"><rect width="10" height="10"/></clipPath>
      </defs>
      <rect fill="url('#grad-1')" clip-path='url(#clip.0)'/>
      <circle fill='url("#grad-1")'/>
      <use href="#clip.0" xlink:href='#clip.0'/>
    </svg>`;

    const extracted = extractSvg(raw, 'ic-test-device');
    expect(extracted).toBeDefined();
    const inner = extracted!.inner;

    // Both single and double quote IDs must be namespaced
    expect(inner).toContain("id='ic-test-device-grad-1'");
    expect(inner).toContain('id="ic-test-device-clip.0"');

    // url references with quotes or without quotes must be properly rewritten
    expect(inner).toContain("url('#ic-test-device-grad-1')");
    expect(inner).toContain('url(#ic-test-device-clip.0)');
    expect(inner).toContain('url("#ic-test-device-grad-1")');

    // href and xlink:href must be rewritten
    expect(inner).toContain('href="#ic-test-device-clip.0"');
    expect(inner).toContain("xlink:href='#ic-test-device-clip.0'");
  });

  test('namespaces complex multi-class <style> blocks and multi-class element attributes', () => {
    const raw = `<svg viewBox="0 0 64 64">
      <style>
        .cls-1 { fill: #ff0000; stroke-width: 2px; }
        .cls-2, .special-border { stroke: #00ff00; }
        #local-elem { opacity: 0.8; }
      </style>
      <g id="local-elem">
        <path class="cls-1 special-border" d="M0 0h10v10H0z"/>
        <circle class="cls-2" r="5"/>
      </g>
    </svg>`;

    const extracted = extractSvg(raw, 'ic-complex');
    expect(extracted).toBeDefined();
    const inner = extracted!.inner;

    expect(inner).toContain('.ic-complex-cls-1');
    expect(inner).toContain('.ic-complex-cls-2');
    expect(inner).toContain('.ic-complex-special-border');
    expect(inner).toContain('#ic-complex-local-elem');

    expect(inner).toContain('class="ic-complex-cls-1 ic-complex-special-border"');
    expect(inner).toContain('class="ic-complex-cls-2"');
    expect(inner).toContain('id="ic-complex-local-elem"');
  });

  test('calculates viewBox from width and height when viewBox is missing', () => {
    const rawWithPx = '<svg width="240px" height="120px"><circle cx="10" cy="10" r="5"/></svg>';
    expect(extractSvg(rawWithPx)?.viewBox).toBe('0 0 240 120');

    const rawUnitless = '<svg width="48" height="32"><rect width="48" height="32"/></svg>';
    expect(extractSvg(rawUnitless)?.viewBox).toBe('0 0 48 32');

    const rawNoDims = '<svg><g/></svg>';
    expect(extractSvg(rawNoDims)?.viewBox).toBe('0 0 100 100');
  });

  test('renders multiple icons with IDENTICAL internal IDs without collision in output sprite', () => {
    // Two completely different devices that both declare id="paint0_linear" and class="cls-1"
    const iconASvg = `<svg viewBox="0 0 50 50">
      <defs><linearGradient id="paint0_linear"><stop stop-color="#ff0000"/></linearGradient></defs>
      <style>.cls-1 { fill: url(#paint0_linear); }</style>
      <rect class="cls-1" width="50" height="50"/>
    </svg>`;

    const iconBSvg = `<svg viewBox="0 0 50 50">
      <defs><linearGradient id="paint0_linear"><stop stop-color="#0000ff"/></linearGradient></defs>
      <style>.cls-1 { fill: url(#paint0_linear); }</style>
      <circle class="cls-1" r="25"/>
    </svg>`;

    const scene: Scene = {
      size: { w: 300, h: 200 },
      nodes: [
        {
          id: 'dev-1',
          chip: { x: 20, y: 20, w: 64, h: 64 },
          labelBox: { x: 20, y: 90, w: 64, h: 16 },
          box: { x: 20, y: 20, w: 64, h: 86 },
          label: 'Device 1',
          icon: 'vendor-a/net/switch',
          status: 'up',
          hero: false,
        },
        {
          id: 'dev-2',
          chip: { x: 120, y: 20, w: 64, h: 64 },
          labelBox: { x: 120, y: 90, w: 64, h: 16 },
          box: { x: 120, y: 20, w: 64, h: 86 },
          label: 'Device 2',
          icon: 'vendor-b/net/router',
          status: 'up',
          hero: false,
        },
      ],
      edges: [],
      zones: [],
    };

    const icons = {
      svg: (id: string) => {
        if (id === 'vendor-a/net/switch') return iconASvg;
        if (id === 'vendor-b/net/router') return iconBSvg;
        return undefined;
      },
    };

    const { svg } = renderScene(scene, { icons });

    // Symbol A must have its own isolated gradient
    expect(svg).toContain('id="ic-vendor-a-net-switch-paint0_linear"');
    expect(svg).toContain('url(#ic-vendor-a-net-switch-paint0_linear)');
    expect(svg).toContain('class="ic-vendor-a-net-switch-cls-1"');

    // Symbol B must have its own isolated gradient
    expect(svg).toContain('id="ic-vendor-b-net-router-paint0_linear"');
    expect(svg).toContain('url(#ic-vendor-b-net-router-paint0_linear)');
    expect(svg).toContain('class="ic-vendor-b-net-router-cls-1"');

    // Raw unnamespaced "paint0_linear" must not exist in any id or url
    expect(svg).not.toMatch(/\bid=["']paint0_linear["']/);
    expect(svg).not.toMatch(/url\(#paint0_linear\)/);
  });
});
