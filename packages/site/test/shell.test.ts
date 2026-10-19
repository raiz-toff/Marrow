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

  test('renders about diagram document dialog with Marrow watermark and attribution credit', () => {
    const html = renderShell(baseOptions);
    expect(html).toContain('class="m-about-dialog"');
    expect(html).toContain('class="m-about-watermark"');
    expect(html).toContain('MARROW');
    expect(html).toContain('class="m-about-credit"');
    expect(html).toContain('Engineered with <strong>Marrow</strong>');
  });
});
