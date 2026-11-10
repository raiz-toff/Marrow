#!/usr/bin/env node
// Minimap behaviour probe (dev only, not part of `npm test`): drives a built
// single-file page in headless Chromium and prints the minimap's viewport
// rectangle against the camera through fit, zoom, pan, click-to-pan, drag,
// an open inspector and a resize. Works on both tiers (hero SVG and scale
// canvas; the canvas tier has no camera transform in the DOM, so camera
// figures read n/a there).
//
//   npm run build -- input/net.yaml --single -o /tmp/net.html
//   node scripts/probe-minimap.mjs /tmp/net.html [width] [height]
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const file = resolve(process.argv[2] ?? '');
const vw = Number(process.argv[3] ?? 1400);
const vh = Number(process.argv[4] ?? 900);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('file://' + file);
await page.waitForFunction('window.__MARROW_READY__ === true', { timeout: 15000 });
await page.waitForTimeout(2200); // entrance fit animation

const state = () =>
  page.evaluate(() => {
    const t = document.querySelector('.m-camera')?.getAttribute('transform') ?? '';
    const scene = document.querySelector('[data-m="stage.root"] svg[data-w]');
    const stage = document.querySelector('[data-m="stage.root"]').getBoundingClientRect();
    const worldEl = document.querySelector('[data-m="minimap.root"] .m-mini-world');
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)\s*scale\(([-\d.]+)/.exec(t);
    const mini = document.querySelector('[data-m="minimap.root"] > svg');
    const view = mini?.querySelector('.m-mini-view');
    const b = mini?.getBoundingClientRect();
    const n = (a) => Number(view?.getAttribute(a));
    return {
      cam: m ? { x: +m[1], y: +m[2], k: +m[3] } : null,
      // the world → map frame and the stage size, to recover the TRUE (undrawn) view centre
      frame: worldEl && scene
        ? { pad: Number(worldEl.getAttribute('x')), scale: Number(worldEl.getAttribute('width')) / Number(scene.getAttribute('data-w')),
            sceneW: Number(scene.getAttribute('data-w')), sceneH: Number(scene.getAttribute('data-h')), stageW: stage.width, stageH: stage.height }
        : null,
      view: view ? { x: n('x'), y: n('y'), w: n('width'), h: n('height') } : null,
      whole: view?.classList.contains('m-mini-whole') ?? false,
      viewBox: mini?.getAttribute('viewBox')?.split(' ').map(Number),
      box: b ? { left: b.left, top: b.top, width: b.width, height: b.height } : null,
    };
  });
const r1 = (n) => n.toFixed(1);
const inside = (s) =>
  s.view && s.viewBox && s.view.x >= 0 && s.view.y >= 0 && s.view.x + s.view.w <= s.viewBox[2] && s.view.y + s.view.h <= s.viewBox[3];
const scaleOf = (s) => s.box.width / s.viewBox[2];
/** client point of a map point */
const client = (s, mx, my) => ({ x: s.box.left + mx * scaleOf(s), y: s.box.top + my * scaleOf(s) });
const centre = (s) => client(s, s.view.x + s.view.w / 2, s.view.y + s.view.h / 2);
/** the camera's true view centre in map units (hero tier, no inspector open) */
const trueCentre = (s) =>
  s.cam && s.frame
    ? { x: s.frame.pad + ((s.frame.stageW / 2 - s.cam.x) / s.cam.k) * s.frame.scale, y: s.frame.pad + ((s.frame.stageH / 2 - s.cam.y) / s.cam.k) * s.frame.scale }
    : null;
/** a map point as the minimap aims it: clamped to the world box */
const aimed = (s, mx, my) => {
  const f = s.frame;
  if (!f) return { x: mx, y: my };
  const w = f.sceneW * f.scale, h = f.sceneH * f.scale;
  return { x: Math.max(f.pad, Math.min(f.pad + w, mx)), y: Math.max(f.pad, Math.min(f.pad + h, my)) };
};
const log = (label, s) => console.log(label, JSON.stringify({ cam: s.cam, view: s.view, whole: s.whole, inside: inside(s) }));

const s0 = await state();
if (!s0.view) {
  console.log('NO MINIMAP (hidden, collapsed or fewer than two devices)');
  await browser.close();
  process.exit(1);
}
console.log('INITIAL', JSON.stringify({ ...s0, inside: inside(s0) }));

// 0) at fit zoom, a click on the map pans the camera to that point
const p0 = client(s0, s0.viewBox[2] * 0.25, s0.viewBox[3] * 0.25);
await page.mouse.click(p0.x, p0.y);
await page.waitForTimeout(300);
const s0b = await state();
log('AFTER_FIT_CLICK', s0b);
console.log('CHECK fit-click: camera moved', s0.cam && s0b.cam ? `${r1(s0b.cam.x - s0.cam.x)} ${r1(s0b.cam.y - s0.cam.y)}` : 'n/a (canvas)',
  '| drawn view changed', JSON.stringify(s0.view) !== JSON.stringify(s0b.view), '| view drawn inside', inside(s0b));
await page.keyboard.press('f');
await page.waitForTimeout(900);
const sFit = await state();

// 1) wheel zoom in at stage centre
const sb = await (await page.$('[data-m="stage.root"]')).boundingBox();
await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
await page.mouse.wheel(0, -600);
await page.waitForTimeout(700);
const s1 = await state();
log('AFTER_ZOOM', s1);
if (s1.cam) console.log('CHECK zoom: view.w*k (stage width in map units; 131.1 on the homelab page at 1400px)', r1(s1.view.w * s1.cam.k));

// 2) pan by dragging the stage 200px right, 100px down (from near the left
//    edge: on the canvas tier a press on a node selects instead of panning)
const px = sb.x + 24, py = sb.y + sb.height / 2;
await page.mouse.move(px, py);
await page.mouse.down();
await page.mouse.move(px + 200, py + 100, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(500);
const s2 = await state();
log('AFTER_PAN', s2);
// the drawn rect is clipped to the world: measure an edge that is clear of the world box in both states
const clear = (a, b, lo) => Math.min(a, b) > lo + 1.01;
const panDx = clear(s1.view.x, s2.view.x, s2.frame?.pad ?? 7) ? s2.view.x - s1.view.x : s2.view.x + s2.view.w - (s1.view.x + s1.view.w);
const panDy = clear(s1.view.y, s2.view.y, s2.frame?.pad ?? 7) ? s2.view.y - s1.view.y : s2.view.y + s2.view.h - (s1.view.y + s1.view.h);
// zoomed in, the view is unclipped: its width is the stage width in map units
const expectDx = (-200 * s1.view.w) / sb.width;
const expectDy = (-100 * s1.view.w) / sb.width;
console.log('CHECK pan: view dx,dy', r1(panDx), r1(panDy), '| expected', r1(expectDx), r1(expectDy));

// 3) click outside the view rect near a corner, then mid-map: the view centres there
//    (the minimap aims only at world points, so a click in the padding clamps to the edge)
for (const [label, fx, fy] of [['corner', 0.2, 0.8], ['mid', 0.5, 0.5]]) {
  const s = await state();
  const target = client(s, s.viewBox[2] * fx, s.viewBox[3] * fy);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(400);
  const after = await state();
  const c = centre(after);
  const tc = trueCentre(after);
  const want = aimed(after, s.viewBox[2] * fx, s.viewBox[3] * fy);
  console.log(`CHECK click(${label}): clicked`, r1(target.x), r1(target.y), '| drawn view centre', r1(c.x), r1(c.y),
    '| true centre − aimed point (map units)', tc ? `${r1(tc.x - want.x)} ${r1(tc.y - want.y)}` : 'n/a (canvas)');
}

// 4) drag the view rect by (+30,+20) px
const s3 = await state();
const v = centre(s3);
await page.mouse.move(v.x, v.y);
await page.mouse.down();
await page.mouse.move(v.x + 30, v.y + 20, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(400);
const s4 = await state();
const t3 = trueCentre(s3), t4 = trueCentre(s4);
console.log('CHECK drag (camera): true view centre moved', t3 && t4 ? `${r1((t4.x - t3.x) * scaleOf(s4))} ${r1((t4.y - t3.y) * scaleOf(s4))}` : 'n/a (canvas)', 'px (expected 30, 20)');
console.log('CHECK drag: view moved', r1((s4.view.x - s3.view.x) * scaleOf(s4)), r1((s4.view.y - s3.view.y) * scaleOf(s4)), 'px (expected 30, 20)');

// 5) open the inspector (insets change), then resize the viewport
const selected = await page.evaluate(() => {
  let id = document.querySelector('[data-node]')?.getAttribute('data-node');
  if (!id) for (const el of document.querySelectorAll('script[type="application/json"]')) {
    try { id = JSON.parse(el.textContent).devices?.[0]?.id ?? id; } catch {}
  }
  if (id) window.marrow?.selectDevice(id, false);
  return id ?? null;
});
await page.waitForTimeout(600);
const s5 = await state();
log('AFTER_INSPECTOR', s5);
console.log('CHECK inspector: device', selected ?? 'n/a', '| view drawn inside', inside(s5));
await page.setViewportSize({ width: Math.round(vw * 0.6), height: vh });
await page.waitForTimeout(600);
const s6 = await state();
log('AFTER_RESIZE', s6);
console.log('CHECK resize: view drawn inside', inside(s6));
await browser.close();
