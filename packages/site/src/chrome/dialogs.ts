/** Overlays the runtime opens: the About dialog, the keyboard-shortcuts
 *  guide and the ⌘K command center (spotlight). */
import { hookAttr } from '@marrow/runtime';
import { I } from './icons.js';
import { fibreLockup, fibreMark } from './fibre.js';

export function aboutDialog(): string {
  return `<div class="m-about-dialog" ${hookAttr('about.dialog')} hidden>
  <div class="m-about-box" role="dialog" aria-modal="true" aria-labelledby="m-about-title">
    <div class="m-about-watermark" aria-hidden="true">
      ${fibreLockup(54)}
    </div>
    <div class="m-about-head">
      <div class="m-about-title-wrap">
        <h3 class="m-about-title" ${hookAttr('about.title')} id="m-about-title"></h3>
        <p class="m-about-desc" ${hookAttr('about.desc')}></p>
      </div>
      <button class="m-about-close" ${hookAttr('about.close')} type="button" aria-label="Close dialog">${I.x}</button>
    </div>
    <div class="m-about-body" ${hookAttr('about.body')}></div>
    <div class="m-about-foot">
      <div class="m-about-credit">
        <a class="m-about-credit-link" href="https://marrowdiagram.vercel.app" target="_blank" rel="noopener noreferrer">
          <span class="m-about-credit-mark">${fibreMark()}</span>
          <span>Engineered with <strong>Marrow</strong> · Declarative Network Topology Compiler</span>
        </a>
        <a class="m-about-credit-gh" href="https://github.com/raiz-toff/Marrow" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="GitHub repository">${I.github}</a>
      </div>
    </div>
  </div>
</div>`;
}

export function shortcutsDialog(): string {
  return `<div class="m-shortcuts" ${hookAttr('shortcuts.dialog')} hidden>
  <div class="m-shortcuts-box">
    <div class="m-shortcuts-head">
      <div><strong>Keyboard shortcuts</strong><small>Driving the diagram from the keys</small></div>
      <button class="m-shortcuts-close" ${hookAttr('shortcuts.close')} type="button" aria-label="Close">${I.x}</button>
    </div>
    <div class="m-shortcuts-body">
      <h5>Search &amp; commands</h5>
      <div class="m-sc-row"><span>Command center</span><span class="m-sc-keys"><kbd>Ctrl K</kbd><kbd>/</kbd></span></div>
      <div class="m-sc-row"><span>Navigate results · open</span><span class="m-sc-keys"><kbd>↑</kbd><kbd>↓</kbd><kbd>↵</kbd></span></div>
      <h5>Camera</h5>
      <div class="m-sc-row"><span>Fit view</span><span class="m-sc-keys"><kbd>F</kbd><kbd>Ctrl 0</kbd></span></div>
      <div class="m-sc-row"><span>Zoom in / out</span><span class="m-sc-keys"><kbd>+</kbd><kbd>−</kbd><kbd>Ctrl +</kbd><kbd>Ctrl −</kbd></span></div>
      <div class="m-sc-row"><span>Pan · zoom</span><span class="m-sc-keys"><kbd>drag</kbd><kbd>scroll</kbd></span></div>
      <h5>Devices</h5>
      <div class="m-sc-row"><span>Open focused device</span><span class="m-sc-keys"><kbd>↵</kbd><kbd>Space</kbd></span></div>
      <div class="m-sc-row"><span>Walk connected neighbors</span><span class="m-sc-keys"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd></span></div>
      <div class="m-sc-row"><span>Device / view options</span><span class="m-sc-keys"><kbd>right-click</kbd></span></div>
      <div class="m-sc-row"><span>Deselect · close</span><span class="m-sc-keys"><kbd>Esc</kbd></span></div>
      <h5>Panels</h5>
      <div class="m-sc-row"><span>Toggle sidebar</span><span class="m-sc-keys"><kbd>Ctrl B</kbd></span></div>
    </div>
  </div>
</div>`;
}

export function spotlight(): string {
  return `<div class="m-spotlight" ${hookAttr('spotlight.root')} hidden>
  <div class="m-spotlight-box">
    <div class="m-spotlight-head">${I.magnifier}<input ${hookAttr('spotlight.input')} type="text" placeholder="Search devices, IPs, interfaces…" aria-label="Search"></div>
    <ul ${hookAttr('spotlight.list')}></ul>
    <div class="m-spotlight-foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
      <span><kbd>↵</kbd> open</span>
      <span><kbd>esc</kbd> close</span>
    </div>
  </div>
</div>`;
}
