import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import * as ui from '@marrow/ui';
import { CableBadge, DeviceLink, MarrowEmbed } from '@marrow/ui';

describe('@marrow/ui interface', () => {
  test('exports exactly the ADR-0019 components plus cn', () => {
    expect(Object.keys(ui).sort()).toEqual(['CableBadge', 'DeviceLink', 'MarrowEmbed', 'cn']);
  });

  test('cn drops falsy class names', () => {
    expect(ui.cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });
});

describe('MarrowEmbed', () => {
  test('renders an iframe with minimal-chrome hash flags and the loading overlay', () => {
    const html = renderToStaticMarkup(
      <MarrowEmbed src="/diagrams/dc.html" title="DC Fabric" minimap="off" theme="dark" height={480} />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('src="/diagrams/dc.html#chrome=minimal&amp;minimap=off&amp;theme=dark"');
    expect(html).toContain('title="DC Fabric"');
    expect(html).toContain('height:480px');
    expect(html).toContain('Loading diagram…');
    expect(html).toContain('title="Fullscreen"');
    expect(html).toContain('href="/diagrams/dc.html"');
  });

  test('renders in-memory html via srcDoc and hides floating actions on request', () => {
    const html = renderToStaticMarkup(
      <MarrowEmbed html="<p>diagram</p>" floatingActions={false} />,
    );
    expect(html).toContain('srcDoc="&lt;p&gt;diagram&lt;/p&gt;"');
    expect(html).not.toContain('title="Fullscreen"');
    expect(html).not.toContain('<a ');
  });

  test('renders preset switcher buttons', () => {
    const html = renderToStaticMarkup(
      <MarrowEmbed
        presets={[
          { label: 'Core', src: '/a.html' },
          { label: 'Edge', src: '/b.html' },
        ]}
      />,
    );
    expect(html).toContain('>Core</button>');
    expect(html).toContain('>Edge</button>');
  });
});

describe('CableBadge', () => {
  test('badge variant shows the mode label and speed chip', () => {
    const html = renderToStaticMarkup(<CableBadge mode="trunk" speed="100G" />);
    expect(html).toContain('Trunk (802.1Q)');
    expect(html).toContain('>100G</span>');
    expect(html).toContain('border-y border-emerald-500');
  });

  test('wire variant colours non-styled modes by status and shows an animated pulse', () => {
    const html = renderToStaticMarkup(
      <CableBadge variant="wire" mode="routed" status="down" speed="25G" animated />,
    );
    expect(html).toContain('bg-rose-500');
    expect(html).toContain('animate-ping');
    expect(html).toContain('>25G</span>');
  });

  test('pill variant renders a dashed tunnel line', () => {
    const html = renderToStaticMarkup(<CableBadge variant="pill" mode="tunnel" speed="1G" />);
    expect(html).toContain('border-dashed border-sky-500');
    expect(html).toContain('>1G</span>');
  });
});

describe('DeviceLink', () => {
  const from = { name: 'core-01', role: 'switch', port: 'Te1/0/1', ip: '10.0.0.1', status: 'up' as const };
  const to = { name: 'fw-01', role: 'firewall', port: 'eth1', status: 'degraded' as const };

  test('card variant renders both devices, ports, status LEDs and a wire cable', () => {
    const html = renderToStaticMarkup(
      <DeviceLink from={from} to={to} cable={{ mode: 'routed', speed: '10G' }} />,
    );
    expect(html).toContain('>core-01</span>');
    expect(html).toContain('>fw-01</span>');
    expect(html).toContain('>Te1/0/1</span>');
    expect(html).toContain('>10.0.0.1</span>');
    expect(html).toContain('title="Status: degraded"');
    expect(html).toContain('bg-amber-500');
    expect(html).toContain('>10G</span>');
    expect(html).toContain('<svg');
  });

  test('inline variant renders a pill cable and image icons from URLs', () => {
    const html = renderToStaticMarkup(
      <DeviceLink variant="inline" from={{ ...from, icon: '/icons/router.svg' }} to={to} />,
    );
    expect(html).toContain('<span class="inline-flex items-center gap-2 px-2.5');
    expect(html).toContain('src="/icons/router.svg"');
    expect(html).toContain('w-8 transition-all');
  });
});
