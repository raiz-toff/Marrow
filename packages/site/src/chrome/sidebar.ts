/** Sidebar: page navigation (grouped by zone-name prefix), menubar, legend or
 *  view settings, about rows and the brand footer. */
import { ATTR, hookAttr, MENUS, type Menu } from '@marrow/runtime';
import type { ChromeOptions, NavLink } from '../chrome.js';
import { escapeHtml as esc } from '@marrow/visual';
import { brandFoot } from './brand-mark.js';
import { I, NAV_ICON } from './icons.js';

const MENU_LABEL: Record<Menu, string> = { view: 'View', export: 'Export', help: 'Help' };

/** "Branch — Amsterdam" → ["Branch", "Amsterdam"]; null when there is no prefix. */
function navPrefix(label: string): [string, string] | null {
  for (const sepChar of [' — ', ' - ']) {
    const at = label.indexOf(sepChar);
    if (at > 0) return [label.slice(0, at), label.slice(at + sepChar.length)];
  }
  return null;
}

/**
 * Zone nav as a tree: zones sharing a name prefix ("Branch — X", "Building A
 * - Y") fold into a collapsible group (shadcn SidebarMenuSub) once there are
 * 3+ of them. The group holding the current page starts open; the rest start
 * collapsed. Purely presentational — layout semantics stay declared in YAML.
 */
function groupedNav(links: NavLink[], o: ChromeOptions): string {
  const row = (l: NavLink, label: string): string =>
    `<a class="m-side-row${l.href === o.page ? ' active' : ''}" ${hookAttr('sidebar.navLink')} href="${o.rootPrefix}${esc(l.href)}" ${ATTR.label}="${esc(l.label)}">` +
    `<i>${NAV_ICON[l.kind ?? 'zone'] ?? I.building}</i><span>${esc(label)}</span>` +
    `${l.count !== undefined ? `<em>${l.count}</em>` : ''}</a>`;

  const sizeOf = new Map<string, number>();
  for (const l of links) {
    if (l.kind !== 'zone') continue;
    const p = navPrefix(l.label);
    if (p) sizeOf.set(p[0], (sizeOf.get(p[0]) ?? 0) + 1);
  }

  const emitted = new Set<string>();
  let out = '';
  for (const l of links) {
    const p = l.kind === 'zone' ? navPrefix(l.label) : null;
    if (!p || (sizeOf.get(p[0]) ?? 0) < 3) {
      out += row(l, l.label);
      continue;
    }
    const [prefix] = p;
    if (emitted.has(prefix)) continue;
    emitted.add(prefix);
    const members = links.filter((m) => m.kind === 'zone' && navPrefix(m.label)?.[0] === prefix);
    const open = members.some((m) => m.href === o.page);
    const total = members.reduce((sum, m) => sum + (m.count ?? 0), 0);
    out +=
      `<div class="m-side-group${open ? '' : ' collapsed'}">` +
      `<button class="m-side-row m-side-group-head" ${hookAttr('sidebar.groupHead')} type="button" aria-expanded="${open}">` +
      `<i>${NAV_ICON['zone']}</i><span>${esc(prefix)}</span><em>${total}</em><b class="m-chev">${I.chevronRight}</b>` +
      `</button>` +
      `<div class="m-side-nav m-side-sub">${members.map((m) => row(m, navPrefix(m.label)?.[1] ?? m.label)).join('')}</div>` +
      `</div>`;
  }
  return out;
}

export function sidebar(o: ChromeOptions): string {
  /* no brand mark here on purpose: the sidebar footer already carries one, and
     two logos in one panel reads as clutter */
  const header = `<div class="m-side-header">
  <div class="m-side-id"><strong class="m-side-title">Lab Overview</strong>${o.stats ? `<small class="m-side-stats">${esc(o.stats)}</small>` : ''}</div>
  <button class="m-icon-btn m-sidebar-close m-mob-only" ${hookAttr('sidebar.close')} type="button" aria-label="Close sidebar">${I.x}</button>
</div>`;
  const pages =
    o.navLinks && o.navLinks.length > 0
      ? `<section class="m-side-section"><h4>Browse</h4><nav class="m-side-nav">${groupedNav(o.navLinks, o)}</nav></section>`
      : '';
  // quick settings live ONLY on the rail (stage pages); doc pages get a
  // theme control here since they have no rail
  const view = o.stage
    ? `<section class="m-side-section"><h4>Legend</h4>
  <ul class="m-legend">
    <li><i class="m-dot" style="background:var(--up)"></i>up</li>
    <li><i class="m-dot" style="background:var(--degraded)"></i>degraded</li>
    <li><i class="m-dot" style="background:var(--down)"></i>down</li>
    <li><i class="m-dot" style="background:var(--planned)"></i>planned</li>
    <li><i class="m-line"></i>link</li>
    <li><i class="m-line m-line-dash"></i>degraded / planned</li>
  </ul>
</section>`
    : `<section class="m-side-section"><h4>View</h4>
  <div class="m-field"><span>Theme</span><div class="m-seg" ${hookAttr('settings.seg')} ${ATTR.setting}="theme"><button ${ATTR.value}="dark" type="button">Dark</button><button ${ATTR.value}="light" type="button">Light</button></div></div>
</section>`;
  const aboutRows = [
    ...(o.about?.layout !== undefined ? [['Layout', o.about.layout] as const] : []),
    ...(o.about?.renderer !== undefined ? [['Renderer', o.about.renderer] as const] : []),
  ];
  const about =
    aboutRows.length > 0
      ? `<section class="m-side-section"><h4>About</h4><div class="m-side-nav">${aboutRows
          .map(
            ([k, v]) =>
              `<div class="m-side-row m-side-static"><span>${esc(String(k))}</span><em>${esc(String(v))}</em></div>`,
          )
          .join('')}</div></section>`
      : '';
  const hasNav = o.navLinks !== undefined && o.navLinks.length > 0;
  const isSingle = !hasNav;
  const menubar = `<nav class="m-menubar" ${hookAttr('menubar.root')} role="menubar" aria-label="Application menu">
${MENUS.map((m) => `  <button class="m-tab-btn" ${hookAttr('menubar.trigger')} type="button" ${ATTR.menu}="${m}" role="menuitem">${MENU_LABEL[m]}</button>`).join('\n')}
</nav>`;
  return `<aside class="m-sidebar${hasNav ? ' m-nav' : ''}${isSingle ? ' is-collapsed' : ''}" ${hookAttr('sidebar.panel')} id="m-sidebar">
<div class="m-sidebar-inner">
${header}
${menubar}
${pages}
${view}
${about}
<div class="m-side-foot">${brandFoot(o)}</div>
</div>
</aside>`;
}
