import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import * as ui from '@marrow/ui';
import { CableBadge, DeviceLink, MarrowEmbed } from '@marrow/ui';
import { buildEmbedUrl, withRootFlags } from '../src/components/topology-canvas.js';

describe('@marrow/ui interface', () => {
  test('exports exactly the ADR-0019 components plus cn', () => {
    expect(Object.keys(ui).sort()).toEqual(['CableBadge', 'DeviceLink', 'MarrowEmbed', 'cn']);
  });

  test('cn drops falsy class names', () => {
    expect(ui.cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });

  test('cn lets later Tailwind classes win (clsx + tailwind-merge)', () => {
    expect(ui.cn('p-2', 'p-4')).toBe('p-4');
    expect(ui.cn('h-[600px] bg-card/30', { 'h-full': true })).toBe('bg-card/30 h-full');
  });
});

describe('MarrowEmbed (server render)', () => {
  test('defers the frame URL to the client and renders the loading status', () => {
    const html = renderToStaticMarkup(
      <MarrowEmbed src="/diagrams/dc.html" title="DC Fabric" minimap="off" theme="dark" height={480} />,
    );
    expect(html).toContain('<iframe');
    expect(html).not.toContain('src="/diagrams/dc.html'); // no load before the ready listener exists
    expect(html).toContain('title="DC Fabric"');
    expect(html).toContain('height:480px');
    expect(html).not.toContain('h-[600px]');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Loading diagram…');
    expect(html).toContain('title="Fullscreen"');
    expect(html).toContain('href="/diagrams/dc.html"');
  });

  test('defaults to 600px via a class className can override; aspectRatio replaces it', () => {
    expect(renderToStaticMarkup(<MarrowEmbed src="/a.html" />)).toContain('h-[600px]');
    const custom = renderToStaticMarkup(<MarrowEmbed src="/a.html" className="h-full min-h-0" />);
    expect(custom).not.toContain('h-[600px]');
    expect(custom).not.toContain('min-h-[320px]');
    expect(custom).not.toContain('style="height');
    const ratio = renderToStaticMarkup(<MarrowEmbed src="/a.html" aspectRatio="16 / 9" minHeight={200} />);
    expect(ratio).toContain('aspect-ratio:16 / 9');
    expect(ratio).toContain('min-height:200px');
    expect(ratio).not.toContain('h-[600px]');
  });

  test('hides floating actions on request', () => {
    const html = renderToStaticMarkup(<MarrowEmbed html="<p>diagram</p>" floatingActions={false} />);
    expect(html).not.toContain('title="Fullscreen"');
    expect(html).not.toContain('<a ');
  });

  test('presets: the first is the source without src, buttons expose aria-pressed', () => {
    const html = renderToStaticMarkup(
      <MarrowEmbed
        presets={[
          { label: 'Core', src: '/a.html' },
          { label: 'Edge', src: '/b.html' },
        ]}
      />,
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Core<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Edge<\/button>/);
    expect(html).toContain('href="/a.html"');
  });

  test('uses shadcn tokens, not Fumadocs-only ones', () => {
    const html = renderToStaticMarkup(<MarrowEmbed src="/a.html" />);
    expect(html).not.toContain('fd-');
    expect(html).toContain('border-border/70');
  });

  test('the source is required by the type', () => {
    // @ts-expect-error — src, html or presets is required
    void (<MarrowEmbed title="nothing" />);
    // @ts-expect-error — src and html are exclusive
    void (<MarrowEmbed src="/a.html" html="<p/>" />);
  });
});

describe('buildEmbedUrl / withRootFlags', () => {
  test('merges flags into the hash, keeping the author hash', () => {
    expect(buildEmbedUrl('/d.html', { chrome: 'minimal', inspector: 'on', minimap: 'off', theme: 'dark' })).toBe(
      '/d.html#chrome=minimal;minimap=off;theme=dark',
    );
    expect(buildEmbedUrl('/d.html#embed=true;inspector=off', { chrome: 'full', inspector: 'on', minimap: 'on' })).toBe(
      '/d.html',
    );
    // Marrow's own deep-link pairs stay raw: `;`-joined, commas unescaped
    expect(buildEmbedUrl('/d.html#d=core-01;c=10,-20,1.5', { chrome: 'minimal', inspector: 'on', minimap: 'on', theme: 'light' })).toBe(
      '/d.html#d=core-01;c=10,-20,1.5;chrome=minimal;theme=light',
    );
  });

  test('writes the flags onto <html> and drops theme-mode', () => {
    const doc = '<!doctype html><html lang="en" data-theme="light" data-theme-mode="auto" data-chrome=minimal><head></head></html>';
    const out = withRootFlags(doc, { chrome: 'full', inspector: 'off', minimap: 'off', theme: 'dark' });
    expect(out).toBe(
      '<!doctype html><html lang="en" data-inspector="off" data-minimap="off" data-theme="dark"><head></head></html>',
    );
    expect(withRootFlags('<p>x</p>', { chrome: 'minimal', inspector: 'on', minimap: 'on', theme: 'light' })).toBe(
      '<html data-chrome="minimal" data-theme="light"><p>x</p>',
    );
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
