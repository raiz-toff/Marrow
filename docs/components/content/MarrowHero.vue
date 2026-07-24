<template>
  <section class="mh not-prose" aria-labelledby="mh-title">
    <div class="mh-grid">
      <!-- ── left: the pitch ─────────────────────────────────────────────── -->
      <div class="mh-pitch">
        <!-- the eyebrow is a live compile line: it "runs" while the diagram on
             the right assembles, then flips to a green built-state. -->
        <p class="mh-run" :data-built="built" aria-hidden="true">
          <span class="mh-run-glyph">
            <svg v-if="!built" class="mh-spin" viewBox="0 0 16 16" width="13" height="13">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.25" />
              <path d="M8 2 a6 6 0 0 1 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <svg v-else viewBox="0 0 16 16" width="13" height="13">
              <path d="M3.5 8.5 l3 3 l6 -7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="mh-run-text">{{ built ? builtLine : buildLine }}</span>
        </p>

        <h1 id="mh-title" class="mh-title">
          <span class="mh-title-line mh-r" style="--d: 0.05s">Describe a network.</span>
          <span class="mh-title-line mh-r" style="--d: 0.14s">
            Get a diagram
            <span class="mh-own">you own<svg class="mh-ul" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 8 C 24 3, 52 3, 74 6 S 108 9, 118 4" /></svg></span>.
          </span>
        </h1>

        <p class="mh-lede mh-r" style="--d: 0.24s">
          Marrow compiles topology YAML into one interactive HTML file that works
          offline, embeds anywhere, and belongs to you. You declare structure —
          the engine computes the layout.
        </p>

        <div class="mh-cta mh-r" style="--d: 0.34s">
          <NuxtLinkLocale to="/getting-started/installation">
            <UiButton size="lg">
              Get started
              <SmartIcon name="lucide:arrow-right" class="ml-1" />
            </UiButton>
          </NuxtLinkLocale>
          <NuxtLinkLocale to="/showcase">
            <UiButton size="lg" variant="outline">
              <SmartIcon name="lucide:layout-grid" class="mr-1" />
              Showcase
            </UiButton>
          </NuxtLinkLocale>
          <NuxtLinkLocale to="/why">
            <UiButton size="lg" variant="outline">Why Marrow</UiButton>
          </NuxtLinkLocale>
          <NuxtLinkLocale to="https://github.com/raiz-toff/Marrow" target="_blank">
            <UiButton size="lg" variant="outline">
              <SmartIcon name="lucide:github" class="mr-1" />
              GitHub
            </UiButton>
          </NuxtLinkLocale>
        </div>

        <p class="mh-fine mh-r" style="--d: 0.42s">
          MIT-licensed · no account, no server · the compiler is the whole product.
        </p>
      </div>

      <!-- ── right: a topology that lays itself out ───────────────────────── -->
      <figure class="mh-stage" @mouseleave="active = 'core-a'">
        <figcaption class="mh-stage-bar">
          <SmartIcon name="lucide:box" :size="13" />
          <span>branch-hq.html</span>
          <span class="mh-stage-badge">laid out by the engine</span>
        </figcaption>

        <div class="mh-canvas">
          <!-- a diagram's own zoom cluster, echoed as an ambient motif -->
          <div class="mh-zoom" aria-hidden="true">
            <span>+</span><span>−</span><span class="mh-zoom-fit">⛶</span>
          </div>

          <svg class="mh-svg" :viewBox="`0 0 ${W} ${H}`" role="img"
               :aria-label="ariaSummary">
            <!-- tier rail: the row a device lands in IS its declared tier -->
            <g class="mh-rail" aria-hidden="true">
              <template v-for="(t, i) in tiers" :key="t.key">
                <line class="mh-rail-tick" :x1="6" :x2="46" :y1="t.y" :y2="t.y" />
                <text class="mh-rail-label" :x="6" :y="t.y - 7">{{ t.key }}</text>
              </template>
            </g>

            <!-- edges, drawn under the nodes -->
            <g class="mh-edges" fill="none">
              <line
                v-for="(e, i) in resolvedEdges"
                :key="e.id"
                class="mh-edge"
                :class="`is-${e.kind}`"
                :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
                pathLength="1"
                :style="`--d: ${1.15 + e.order * 0.06}s`"
              />
            </g>

            <!-- ambient traffic on two healthy uplinks -->
            <g v-if="!reduced" class="mh-flow" aria-hidden="true">
              <circle
                v-for="p in packets"
                :key="p.id"
                class="mh-packet"
                r="2.4"
                :style="packetStyle(p)"
              />
            </g>

            <!-- nodes -->
            <g
              v-for="n in nodes"
              :key="n.id"
              class="mh-node"
              :class="{ 'is-active': active === n.id, 'is-hero': n.hero }"
              :style="`--d: ${0.55 + n.order * 0.11}s`"
              :transform="`translate(${n.cx} ${n.cy})`"
              tabindex="0"
              role="button"
              :aria-label="`${n.name}, ${n.role}, ${statusWord(n.status)}`"
              @mouseenter="active = n.id"
              @focus="active = n.id"
            >
              <!-- selection halo for the hero device -->
              <rect
                v-if="n.hero"
                class="mh-halo"
                x="-30" y="-21" width="60" height="42" rx="9"
              />

              <rect class="mh-tile" :class="`st-${n.status}`"
                    x="-26" y="-17" width="52" height="34" rx="7" />

              <!-- device glyphs, monochrome so the LEDs carry the colour -->
              <g class="mh-glyph" :transform="`translate(0 -1)`">
                <template v-if="n.glyph === 'router'">
                  <circle r="7" fill="none" stroke-width="1.6" />
                  <line x1="0" y1="-11" x2="0" y2="-8" />
                  <line x1="0" y1="8" x2="0" y2="11" />
                  <line x1="-11" y1="0" x2="-8" y2="0" />
                  <line x1="8" y1="0" x2="11" y2="0" />
                </template>
                <template v-else-if="n.glyph === 'firewall'">
                  <rect x="-11" y="-8" width="22" height="16" rx="2" fill="none" stroke-width="1.4" />
                  <line x1="-11" y1="-2.5" x2="11" y2="-2.5" />
                  <line x1="-11" y1="2.5" x2="11" y2="2.5" />
                  <line x1="-3.5" y1="-8" x2="-3.5" y2="-2.5" />
                  <line x1="3.5" y1="-8" x2="3.5" y2="-2.5" />
                  <line x1="0" y1="-2.5" x2="0" y2="2.5" />
                  <line x1="-7" y1="2.5" x2="-7" y2="8" />
                  <line x1="7" y1="2.5" x2="7" y2="8" />
                </template>
                <template v-else-if="n.glyph === 'core'">
                  <rect x="-10" y="-2" width="20" height="9" rx="2" fill="none" stroke-width="1.4" />
                  <rect x="-10" y="-8" width="20" height="9" rx="2" fill="none" stroke-width="1.4" />
                  <path d="M-5 -3.5 l3 0 m-1.4 -1.4 l1.4 1.4 l-1.4 1.4" stroke-width="1.2" fill="none" />
                  <path d="M5 -3.5 l-3 0 m1.4 -1.4 l-1.4 1.4 l1.4 1.4" stroke-width="1.2" fill="none" />
                </template>
                <template v-else>
                  <rect x="-11" y="-6" width="22" height="12" rx="2" fill="none" stroke-width="1.4" />
                  <rect v-for="px in [-7.5, -2.5, 2.5, 7.5]" :key="px" :x="px - 1.4" y="2.5" width="2.8" height="2.8" rx="0.6" />
                </template>
              </g>

              <!-- corner-anchored status LED -->
              <circle class="mh-led" :class="`st-${n.status}`" cx="19" cy="-11" r="3" />

              <text class="mh-label" x="0" y="30">{{ n.label }}</text>
            </g>

            <!-- inspector: follows the active node, in the same coordinate space -->
            <g class="mh-inspector" :transform="inspector.transform" aria-hidden="true">
              <rect class="mh-ins-card" x="0" y="0" :width="INS_W" :height="INS_H" rx="8" />
              <text class="mh-ins-name" x="11" y="17">{{ activeNode.name }}</text>
              <text class="mh-ins-role" x="11" y="31">{{ activeNode.role }}</text>
              <text class="mh-ins-ip" x="11" y="47">mgmt {{ activeNode.ip }}</text>
              <g :transform="`translate(${INS_W - 11} 41)`">
                <rect class="mh-ins-pill" :class="`st-${activeNode.status}`"
                      :x="-pillW(activeNode.status)" y="-9" :width="pillW(activeNode.status)" height="14" rx="7" />
                <circle class="mh-ins-dot" :class="`st-${activeNode.status}`"
                        :cx="-pillW(activeNode.status) + 8" cy="-2" r="2.6" />
                <text class="mh-ins-status" :x="-pillW(activeNode.status) + 14" y="1.5">{{ statusWord(activeNode.status) }}</text>
              </g>
            </g>
          </svg>
        </div>

        <figcaption class="mh-stage-foot">
          <span class="mh-count">{{ nodes.length }} devices</span>
          <span class="mh-dot">·</span>
          <span class="mh-count">{{ resolvedEdges.length }} links</span>
          <span class="mh-dot">·</span>
          <span>ordered by <code>tier</code>, positioned by nobody</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The landing-page hero. Below it, ::marrow-demo and ::marrow-scale show *real*
 * compiled diagrams; this is the promise as motion — an abstract topology that
 * assembles itself on Marrow's own dot-grid stage, tier by tier, to perform the
 * one claim the whole tool rests on: you declare structure, the engine computes
 * the layout. Nothing here is positioned by hand, in the copy or the code — the
 * node rows come straight from each device's `tier`.
 *
 * It is deliberately NOT a real compiled file (that proof is the demo below).
 * Everything is inline SVG + CSS; the only script is the build/idle state and
 * the inspector that follows the active node. Reduced motion renders the settled
 * diagram with no intro animation.
 */
const W = 460;
const H = 340;

const tiers = [
  { key: 'edge', y: 56 },
  { key: 'core', y: 170 },
  { key: 'access', y: 286 },
];

type Node = {
  id: string; cx: number; cy: number; order: number;
  glyph: 'router' | 'firewall' | 'core' | 'switch';
  label: string; name: string; role: string; ip: string;
  status: 'up' | 'degraded' | 'planned'; hero?: boolean;
};

// Declared once, in tier order — the same order the intro reveals them in.
const nodes: Node[] = [
  { id: 'edge',   cx: 150, cy: 56,  order: 0, glyph: 'router',   label: 'EDGE',   name: 'Edge Router',   role: 'WAN edge',            ip: '192.0.2.1', status: 'up' },
  { id: 'fw',     cx: 310, cy: 56,  order: 1, glyph: 'firewall', label: 'FW',     name: 'Perimeter FW',  role: 'Stateful firewall',   ip: '192.0.2.2', status: 'degraded' },
  { id: 'core-a', cx: 170, cy: 170, order: 2, glyph: 'core',     label: 'CORE·A', name: 'Core Switch A', role: 'L3 core · HA pair',   ip: '10.0.0.1',  status: 'up', hero: true },
  { id: 'core-b', cx: 300, cy: 170, order: 3, glyph: 'core',     label: 'CORE·B', name: 'Core Switch B', role: 'L3 core · HA pair',   ip: '10.0.0.2',  status: 'up' },
  { id: 'acc-1',  cx: 95,  cy: 286, order: 4, glyph: 'switch',   label: 'ACC·1',  name: 'Access 1',      role: 'Floor 1 · 48-port',   ip: '10.0.1.1',  status: 'up' },
  { id: 'acc-2',  cx: 230, cy: 286, order: 5, glyph: 'switch',   label: 'ACC·2',  name: 'Access 2',      role: 'Floor 2 · dual-homed', ip: '10.0.1.2', status: 'up' },
  { id: 'acc-3',  cx: 365, cy: 286, order: 6, glyph: 'switch',   label: 'ACC·3',  name: 'Access 3',      role: 'Floor 3 · planned',   ip: '10.0.1.3',  status: 'planned' },
];

const byId = Object.fromEntries(nodes.map(n => [n.id, n])) as Record<string, Node>;

type EdgeSpec = { from: string; to: string; kind?: 'wan' | 'ha' | 'planned' };
const edges: EdgeSpec[] = [
  { from: 'edge', to: 'core-a' },
  { from: 'edge', to: 'core-b' },
  { from: 'fw',   to: 'core-a' },
  { from: 'fw',   to: 'core-b' },
  { from: 'core-a', to: 'core-b', kind: 'ha' },
  { from: 'core-a', to: 'acc-1' },
  { from: 'core-a', to: 'acc-2' },
  { from: 'core-b', to: 'acc-2' },
  { from: 'core-b', to: 'acc-3', kind: 'planned' },
];

const resolvedEdges = edges.map((e, i) => {
  const a = byId[e.from], b = byId[e.to];
  return {
    id: `${e.from}-${e.to}`,
    kind: e.kind ?? 'link',
    order: Math.max(a.order, b.order),
    x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy,
  };
});

// ── inspector ──────────────────────────────────────────────────────────────
const INS_W = 134;
const INS_H = 58;
const active = ref('core-a');
const activeNode = computed(() => byId[active.value]);

// Place the card in the first spot that collides with no other node — right,
// then above, below, left — the same collision-free rule the diagrams follow.
const inspector = computed(() => {
  const n = activeNode.value;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const candidates = [
    { x: n.cx + 34,           y: n.cy - INS_H / 2 },        // right
    { x: n.cx - INS_W / 2,    y: n.cy - 24 - INS_H - 6 },   // above
    { x: n.cx - INS_W / 2,    y: n.cy + 34 + 6 },           // below
    { x: n.cx - 34 - INS_W,   y: n.cy - INS_H / 2 },        // left
  ].map(c => ({ x: clamp(c.x, 6, W - INS_W - 6), y: clamp(c.y, 6, H - INS_H - 6) }));

  const hits = (c: { x: number; y: number }) =>
    nodes.some(m =>
      m.id !== n.id &&
      c.x < m.cx + 32 && c.x + INS_W > m.cx - 32 &&
      c.y < m.cy + 32 && c.y + INS_H > m.cy - 22);

  const spot = candidates.find(c => !hits(c)) ?? candidates[0];
  return { transform: `translate(${spot.x} ${spot.y})` };
});

const STATUS_WORD = { up: 'up', degraded: 'degraded', planned: 'planned' } as const;
function statusWord(s: Node['status']) { return STATUS_WORD[s]; }
function pillW(s: Node['status']) { return 26 + statusWord(s).length * 5; }

// ── ambient traffic ──────────────────────────────────────────────────────────
const packets = [
  { id: 'p1', from: 'edge', to: 'core-a', delay: 0 },
  { id: 'p2', from: 'core-a', to: 'acc-2', delay: 1.4 },
  { id: 'p3', from: 'core-b', to: 'core-a', delay: 2.6 },
].map(p => ({ ...p, a: byId[p.from], b: byId[p.to] }));

function packetStyle(p: (typeof packets)[number]) {
  return {
    '--x1': `${p.a.cx}px`, '--y1': `${p.a.cy}px`,
    '--x2': `${p.b.cx}px`, '--y2': `${p.b.cy}px`,
    animationDelay: `${2.1 + p.delay}s`,
  } as Record<string, string>;
}

// ── build / idle state ───────────────────────────────────────────────────────
const buildLine = 'marrow build input/branch-hq.yaml';
const builtLine = 'built branch-hq.html · 1 file · works offline';
const built = ref(false);
const reduced = ref(false);

const ariaSummary =
  'A branch topology: two edge devices over redundant uplinks to an HA core pair, fanning out to three access switches. Laid out by tier.';

let timer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
  reduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced.value) { built.value = true; return; }
  timer = setTimeout(() => (built.value = true), 2000);
});
onBeforeUnmount(() => timer && clearTimeout(timer));
</script>

<style scoped>
.mh {
  max-width: 1120px;
  margin: 1.5rem auto 2.5rem;
  padding: 0 0.25rem;
}
.mh-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
  align-items: center;
}
@media (min-width: 1024px) {
  .mh-grid {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 2.75rem;
  }
}

/* ── pitch ──────────────────────────────────────────────────────────────── */
.mh-run {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 1.25rem;
  padding: 5px 11px 5px 9px;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--card));
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  transition: color 0.4s ease, border-color 0.4s ease;
}
.mh-run[data-built='true'] { color: var(--m-up); border-color: color-mix(in oklab, var(--m-up) 40%, hsl(var(--border))); }
.mh-run-glyph { display: inline-flex; color: currentColor; }
.mh-run[data-built='false'] .mh-run-glyph { color: var(--m-accent); }
.mh-spin { animation: mh-spin 0.9s linear infinite; }
@keyframes mh-spin { to { transform: rotate(360deg); } }

.mh-title {
  margin: 0;
  font-weight: 640;
  letter-spacing: -0.03em;
  line-height: 1.03;
  font-size: clamp(2.15rem, 5vw, 3.5rem);
}
.mh-title-line { display: block; }
.mh-own { position: relative; white-space: nowrap; }
.mh-ul {
  position: absolute;
  left: -1%;
  bottom: -0.16em;
  width: 102%;
  height: 0.34em;
  overflow: visible;
  fill: none;
  stroke: var(--m-accent);
  stroke-width: 3.5;
  stroke-linecap: round;
}
.mh-ul path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: mh-ul-draw 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards;
}
@keyframes mh-ul-draw { to { stroke-dashoffset: 0; } }

.mh-lede {
  margin: 1.15rem 0 0;
  max-width: 34rem;
  font-size: clamp(1rem, 1.4vw, 1.14rem);
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}
.mh-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 1.75rem;
}
.mh-fine {
  margin: 1.1rem 0 0;
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 11.5px;
  letter-spacing: 0.01em;
  color: hsl(var(--muted-foreground));
  opacity: 0.85;
}

/* staggered rise for the pitch column */
.mh-r { animation: mh-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: var(--d, 0s); }
@keyframes mh-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* ── stage ──────────────────────────────────────────────────────────────── */
.mh-stage {
  margin: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  background: hsl(var(--card));
  overflow: hidden;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04), 0 12px 40px -12px rgb(0 0 0 / 0.12);
}
.mh-stage-bar,
.mh-stage-foot {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--secondary));
}
.mh-stage-bar { border-bottom: 1px solid hsl(var(--border)); }
.mh-stage-foot { border-top: 1px solid hsl(var(--border)); }
.mh-stage-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  font-size: 10.5px;
}
.mh-stage-foot code {
  padding: 1px 5px;
  border-radius: 4px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  font-size: 11px;
}
.mh-count { color: hsl(var(--foreground)); }
.mh-dot { opacity: 0.5; }

.mh-canvas {
  position: relative;
  background:
    radial-gradient(circle at 1px 1px, var(--m-grid-dot) 1px, transparent 0);
  background-size: 22px 22px;
  background-color: hsl(var(--background));
}
.mh-svg { display: block; width: 100%; height: auto; }

/* the diagram's own zoom cluster — a knowing, ambient detail */
.mh-zoom {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
  background: hsl(var(--card));
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 13px;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  z-index: 2;
  opacity: 0.85;
}
.mh-zoom span {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
}
.mh-zoom span + span { border-top: 1px solid hsl(var(--border)); }
.mh-zoom-fit { color: var(--m-accent); }

/* tier rail */
.mh-rail-tick { stroke: hsl(var(--border)); stroke-width: 1; }
.mh-rail-label {
  fill: hsl(var(--muted-foreground));
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.7;
}

/* edges */
.mh-edge {
  stroke: var(--m-line-strong);
  stroke-width: 1.5;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: mh-draw 0.6s ease-out both;
  animation-delay: var(--d, 1s);
}
.mh-edge.is-ha { stroke: var(--m-accent); stroke-dasharray: 4 3; stroke-opacity: 0.75; animation-name: mh-fade; }
.mh-edge.is-planned { stroke: var(--m-planned); stroke-dasharray: 3 4; stroke-opacity: 0.7; animation-name: mh-fade; }
@keyframes mh-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes mh-fade { from { opacity: 0; } to { opacity: 1; } }

/* traffic */
.mh-packet {
  fill: var(--m-accent);
  filter: drop-shadow(0 0 3px color-mix(in oklab, var(--m-accent) 70%, transparent));
  transform: translate(var(--x1), var(--y1));
  animation: mh-packet 2.6s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  opacity: 0;
}
@keyframes mh-packet {
  0% { transform: translate(var(--x1), var(--y1)); opacity: 0; }
  12% { opacity: 0.9; }
  80% { opacity: 0.9; }
  100% { transform: translate(var(--x2), var(--y2)); opacity: 0; }
}

/* nodes */
.mh-node { cursor: default; outline: none; }
.mh-node > * { transform-box: fill-box; }
.mh-node .mh-glyph,
.mh-node .mh-tile,
.mh-node .mh-halo,
.mh-node .mh-led,
.mh-node .mh-label {
  animation: mh-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: var(--d, 0.5s);
  transform-origin: center;
}
@keyframes mh-pop { from { opacity: 0; transform: scale(0.62); } to { opacity: 1; transform: scale(1); } }

.mh-tile {
  fill: hsl(var(--card));
  stroke: var(--m-line-strong);
  stroke-width: 1.4;
  transition: stroke 0.15s ease, filter 0.15s ease;
}
.mh-node.is-active .mh-tile { stroke: var(--m-accent); filter: drop-shadow(0 2px 6px rgb(0 0 0 / 0.18)); }
.mh-node:focus-visible .mh-tile { stroke: var(--m-accent); }
.mh-glyph { stroke: var(--m-ink-dim); fill: var(--m-ink-dim); }
.mh-glyph line, .mh-glyph path, .mh-glyph circle, .mh-glyph rect[fill='none'] { stroke: var(--m-ink-dim); }
.mh-node.is-active .mh-glyph { stroke: var(--m-ink); fill: var(--m-ink); }

.mh-label {
  fill: hsl(var(--muted-foreground));
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 8.5px;
  letter-spacing: 0.1em;
  text-anchor: middle;
}
.mh-node.is-active .mh-label { fill: hsl(var(--foreground)); }

/* status LEDs + tile tint by status */
.mh-led { stroke: hsl(var(--card)); stroke-width: 1.4; }
.mh-led.st-up { fill: var(--m-up); }
.mh-led.st-degraded { fill: var(--m-degraded); animation: mh-pop 0.5s both, mh-blink 1.6s ease-in-out 2s infinite; }
.mh-led.st-planned { fill: var(--m-planned); }
.mh-tile.st-planned { stroke-dasharray: 4 3; stroke: var(--m-planned); }
@keyframes mh-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* hero selection halo */
.mh-halo {
  fill: none;
  stroke: var(--m-accent);
  stroke-width: 1.5;
  opacity: 0.55;
  animation: mh-pop 0.5s both, mh-breathe 3.4s ease-in-out 2s infinite;
}
@keyframes mh-breathe {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

/* inspector */
.mh-inspector { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: none; }
.mh-ins-card {
  fill: hsl(var(--popover));
  stroke: hsl(var(--border));
  stroke-width: 1;
  filter: drop-shadow(0 8px 20px rgb(0 0 0 / 0.22));
}
.mh-ins-name { fill: hsl(var(--foreground)); font-size: 11px; font-weight: 600; }
.mh-ins-role { fill: hsl(var(--muted-foreground)); font-size: 9px; }
.mh-ins-ip {
  fill: hsl(var(--muted-foreground));
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 9px;
}
.mh-ins-pill { fill: hsl(var(--card)); stroke: hsl(var(--border)); stroke-width: 1; }
.mh-ins-dot.st-up { fill: var(--m-up); }
.mh-ins-dot.st-degraded { fill: var(--m-degraded); }
.mh-ins-dot.st-planned { fill: var(--m-planned); }
.mh-ins-status {
  fill: hsl(var(--muted-foreground));
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 8.5px;
}

@media (prefers-reduced-motion: reduce) {
  .mh-r,
  .mh-node .mh-glyph, .mh-node .mh-tile, .mh-node .mh-halo, .mh-node .mh-led, .mh-node .mh-label,
  .mh-edge, .mh-ul path, .mh-halo, .mh-led.st-degraded, .mh-spin {
    animation: none !important;
  }
  .mh-edge { stroke-dashoffset: 0; }
  .mh-ul path { stroke-dashoffset: 0; }
}
</style>
