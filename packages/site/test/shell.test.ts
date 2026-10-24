import { describe, expect, test } from 'vitest';
import { renderShell } from '../src/shell.js';

describe('renderShell layout and controls', () => {
  const baseOptions = {
    title: 'Test Topology',
    stats: '12 devices · 16 links',
    crumbs: [{ label: 'Network', href: 'index.html' }, { label: 'Core DC' }],
    rootPrefix: '',
    page: 'index.html',
    theme: 'dark',
    stage: '<svg class="m-svg" data-w="1200" data-h="800"></svg>',
    dataJson: '{}',
    assets: { mode: 'external' as const },
    navLinks: [{ label: 'Core DC', href: 'index.html', count: 12 }],
  };

  test('renders authentic CAD/NOC command bar with clean square icon buttons', () => {
    const html = renderShell(baseOptions);

    expect(html).toContain('class="m-command-bar"');
    expect(html).toContain('class="m-icon-btn m-sidebar-btn"');
    expect(html).toContain('class="m-breadcrumbs"');

    // Desktop controls
    expect(html).toContain('class="m-icon-btn m-search-btn m-desk-only"');
    expect(html).toContain('class="m-icon-btn m-theme-btn m-desk-only"');
    expect(html).not.toContain('class="m-icon-btn m-export-btn m-desk-only"');

    // Mobile controls
    expect(html).toContain('class="m-icon-btn m-search-btn m-mob-only"');
    expect(html).toContain('class="m-icon-btn m-theme-btn m-mob-only"');

    // Clean sidebar button without text clutter
    const sidebarBtnMatch = html.match(/<button class="m-icon-btn m-sidebar-btn"[^>]*>([\s\S]*?)<\/button>/);
    expect(sidebarBtnMatch).toBeTruthy();
    expect(sidebarBtnMatch![1]).not.toContain('Navigation');
    expect(sidebarBtnMatch![1]).not.toContain('Ctrl B');
  });

  test('renders single floating vertical zoom controls dock (shadcn CAD design)', () => {
    const html = renderShell(baseOptions);

    expect(html).toContain('class="m-controls"');
    expect(html).toContain('class="m-btn m-ctl-in"');
    expect(html).toContain('class="m-btn m-ctl-out"');
    expect(html).toContain('class="m-btn m-ctl-fit"');
    expect(html).toContain('class="m-btn m-ctl-cmd m-search-btn"');

    // No duplicate horizontal status bar
    expect(html).not.toContain('class="m-status-bar"');
  });

  test('renders inspector with tabs and corresponding panels', () => {
    const html = renderShell(baseOptions);

    expect(html).toContain('class="m-inspector"');
    expect(html).toContain('class="m-sheet-drag-handle"');
    expect(html).toContain('class="m-inspector-tabs"');

    // Tab buttons
    expect(html).toContain('data-tab="overview"');
    expect(html).toContain('data-tab="interfaces"');
    expect(html).toContain('data-tab="neighbors"');
    expect(html).toContain('data-tab="metadata"');
    expect(html).toContain('data-tab="config"');

    // Inspector panels
    expect(html).toContain('id="m-pane-overview" class="m-inspector-pane active"');
    expect(html).toContain('id="m-pane-interfaces" class="m-inspector-pane"');
    expect(html).toContain('id="m-pane-neighbors" class="m-inspector-pane"');
    expect(html).toContain('id="m-pane-metadata" class="m-inspector-pane"');
    expect(html).toContain('id="m-pane-config" class="m-inspector-pane"');
  });

  test('renders framed stage and minimap container for diagram pages', () => {
    const html = renderShell(baseOptions);
    expect(html).toContain('<main class="m-stage">');
    expect(html).toContain('<div class="m-minimap" hidden></div>');
  });

  test('renders about diagram document dialog with Marrow watermark and clickable attribution credit', () => {
    const html = renderShell(baseOptions);
    expect(html).toContain('class="m-about-dialog"');
    expect(html).toContain('class="m-about-watermark"');
    expect(html).toContain('MARROW');
    expect(html).toContain('class="m-about-credit"');
    expect(html).toContain('class="m-about-credit-link"');
    expect(html).toContain('href="https://marrowdiagram.vercel.app"');
    expect(html).toContain('class="m-about-credit-gh"');
    expect(html).toContain('href="https://github.com/raiz-toff/Marrow"');
    expect(html).toContain('Engineered with <strong>Marrow</strong>');
  });

  test('watermark respects modular modes (minimal, blueprint, off)', () => {
    const minHtml = renderShell({
      ...baseOptions,
      watermark: { mode: 'minimal', font: 'mono' },
    });
    expect(minHtml).toContain('data-mode="minimal"');
    expect(minHtml).toContain('fig. 01 — Test Topology');

    const offHtml = renderShell({
      ...baseOptions,
      watermark: { mode: 'off' },
    });
    expect(offHtml).toContain('data-watermark="off"');
    expect(offHtml).not.toContain('<div class="m-watermark"');
  });

  test('locks layout to spacious on html and shell', () => {
    const html = renderShell(baseOptions);
    expect(html).toContain('data-layout="spacious"');
    expect(html).toContain('<html lang="en" data-theme="dark" data-layout="spacious"');
    expect(html).toContain('<div id="marrow-shell" data-layout="spacious"');
  });

  test('renders single bottom navigation bar for mobile Flux layout', () => {
    const html = renderShell(baseOptions);
    expect(html).toContain('class="m-mobile-bar"');
    expect(html).toContain('class="m-mob-left"');
    expect(html).not.toContain('class="m-icon-btn m-mob-inspector-btn"');
    expect(html).toContain('class="m-icon-btn m-sidebar-btn"');
  });

  test('renders top header breadcrumb hierarchy and functional Lab Overview sidebar header', () => {
    const html = renderShell(baseOptions);
    expect(html).toContain('class="m-brand-mark"');
    expect(html).toContain('class="m-header-sep"');
    expect(html).toContain('class="m-breadcrumbs"');
    expect(html).toContain('Lab Overview');
    expect(html).toContain('class="m-side-stats"');
  });
});
