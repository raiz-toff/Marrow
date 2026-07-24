<template>
  <div class="mshow not-prose my-8">
    <ul class="mshow-list">
      <li v-for="d in demos" :key="d.id">
        <button class="mshow-card" type="button" @click="open(d)">
          <span class="mshow-thumb">
            <img :src="`/demo/${d.id}.png`" :alt="`${d.title} — compiled Marrow diagram`" loading="lazy" />
            <span class="mshow-play"><SmartIcon name="lucide:maximize-2" :size="16" /></span>
          </span>
          <span class="mshow-body">
            <span class="mshow-head">
              <span class="mshow-title">{{ d.title }}</span>
              <span class="mshow-tag" :data-tag="d.tag">{{ d.tag }}</span>
            </span>
            <span class="mshow-desc">{{ d.desc }}</span>
            <span class="mshow-meta">
              <span class="mshow-stat"><SmartIcon name="lucide:box" :size="12" /> {{ d.nodes }} devices</span>
              <span class="mshow-stat"><SmartIcon name="lucide:spline" :size="12" /> {{ d.links }} links</span>
              <span class="mshow-cta">Explore <SmartIcon name="lucide:arrow-right" :size="13" /></span>
            </span>
          </span>
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <Transition name="mshow-fade">
        <div v-if="active" class="mshow-modal" @click.self="close">
          <div class="mshow-dialog" role="dialog" aria-modal="true" :aria-label="active.title">
            <header class="mshow-dialog-bar">
              <span class="mshow-dialog-title">
                {{ active.title }}
                <span class="mshow-tag" :data-tag="active.tag">{{ active.tag }}</span>
              </span>
              <span class="mshow-dialog-sub">{{ active.desc }}</span>
              <a class="mshow-dialog-open" :href="`/demo/${active.id}.html`" target="_blank" rel="noopener">
                Full size <SmartIcon name="lucide:arrow-up-right" :size="13" />
              </a>
              <button class="mshow-dialog-x" type="button" aria-label="Close" @click="close">
                <SmartIcon name="lucide:x" :size="17" />
              </button>
            </header>
            <iframe
              ref="frame"
              :src="`/demo/${active.id}.html`"
              :title="`${active.title} — compiled Marrow diagram`"
              class="mshow-dialog-frame"
              @load="pushTheme"
            />
            <p class="mshow-dialog-foot">
              This is the real file <code>marrow build</code> produced — drag to pan, scroll to zoom,
              click a device for its inspector. Nothing is fetched from a server.
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * The Showcase: a blog-style list of compiled example diagrams. Each card is a
 * thumbnail + a little detail; clicking one opens the actual interactive diagram
 * in a lightbox (the iframe loads on demand, so the page stays light even with a
 * 1.4 MB scale demo in the list).
 *
 * Sources: docs/demos/*.yaml → docs/public/demo/*.html (+ *.png thumbnails),
 * both produced by `npm run demos` / the snapshot CLI. Committed and
 * deterministic, so the docs host needs no compiler.
 */
interface Demo {
  id: string;
  title: string;
  desc: string;
  tag: 'Link semantics' | 'Layout' | 'At scale';
  nodes: number;
  links: number;
}

const demos: Demo[] = [
  {
    id: 'trunk-vlans',
    title: 'Trunking & VLANs',
    desc: '802.1Q trunks render as a double rail carrying their VLAN set; access ports get a single-VLAN chip.',
    tag: 'Link semantics',
    nodes: 6,
    links: 5,
  },
  {
    id: 'lacp-portchannel',
    title: 'LACP port-channels',
    desc: 'Aggregated members ride one strand chipped with the Po id — an inter-core bundle plus dual-homed uplinks.',
    tag: 'Link semantics',
    nodes: 3,
    links: 6,
  },
  {
    id: 'vpn-tunnels',
    title: 'VPN & tunnels',
    desc: 'Site-to-site IPsec, a GRE tunnel and a VXLAN overlay — each a dashed link with a padlock and its encap.',
    tag: 'Link semantics',
    nodes: 5,
    links: 4,
  },
  {
    id: 'tiered',
    title: 'Tiered campus',
    desc: 'A core → distribution → access hierarchy. Every device declares a tier; the engine lays it out top-down.',
    tag: 'Layout',
    nodes: 7,
    links: 6,
  },
  {
    id: 'zoned',
    title: 'Zoned multi-site',
    desc: 'Two sites side by side. Zones become the containers; tiers order the devices inside each one.',
    tag: 'Layout',
    nodes: 8,
    links: 7,
  },
  {
    id: 'hub-spoke',
    title: 'WAN hub & spoke',
    desc: 'Branch spokes that touch only the hub — declare that shape and the engine picks a radial layout.',
    tag: 'Layout',
    nodes: 7,
    links: 6,
  },
  {
    id: 'scale',
    title: 'One datacenter at scale',
    desc: 'A slice of a 15,591-device topology: 382 devices and 808 links placed entirely by the engine — no coordinates in the source.',
    tag: 'At scale',
    nodes: 382,
    links: 808,
  },
];

const active = ref<Demo | null>(null);
const frame = ref<HTMLIFrameElement | null>(null);
const colorMode = useColorMode();

function open(d: Demo) {
  active.value = d;
  if (import.meta.client) document.body.style.overflow = 'hidden';
}
function close() {
  active.value = null;
  if (import.meta.client) document.body.style.overflow = '';
}

// Drive the embedded diagram's theme to match the docs (light/dark toggle). The
// diagram is an isolated iframe, so it can only learn the host theme this way.
function pushTheme() {
  const theme = colorMode.value === 'light' ? 'light' : 'dark';
  frame.value?.contentWindow?.postMessage({ type: 'marrow:theme', theme }, '*');
}
function onMessage(e: MessageEvent) {
  // the diagram pings when its runtime is ready — answer with the current theme
  if ((e.data as { type?: string } | null)?.type === 'marrow:ready') pushTheme();
}
watch(() => colorMode.value, () => active.value && pushTheme());

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && active.value) close();
}
onMounted(() => {
  window.addEventListener('keydown', onKey);
  window.addEventListener('message', onMessage);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('message', onMessage);
  if (import.meta.client) document.body.style.overflow = '';
});
</script>

<style scoped>
.mshow-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

/* blog-style row card: thumbnail + detail, clickable */
.mshow-card {
  width: 100%;
  text-align: left;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.16s cubic-bezier(0.16, 1, 0.3, 1), transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}
@media (min-width: 720px) {
  .mshow-card {
    grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
  }
}
.mshow-card:hover,
.mshow-card:focus-visible {
  border-color: hsl(var(--foreground) / 0.32);
  transform: translateY(-1px);
  outline: none;
}

.mshow-thumb {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #09090b;
  border-bottom: 1px solid hsl(var(--border));
}
@media (min-width: 720px) {
  .mshow-thumb {
    aspect-ratio: auto;
    border-bottom: 0;
    border-right: 1px solid hsl(var(--border));
  }
}
.mshow-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.mshow-card:hover .mshow-thumb img {
  transform: scale(1.03);
}
.mshow-play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
  background: radial-gradient(circle at center, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0) 60%);
  opacity: 0;
  transition: opacity 0.16s ease;
}
.mshow-play > :deep(svg) {
  padding: 9px;
  border-radius: 999px;
  background: rgba(9, 9, 11, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.28);
}
.mshow-card:hover .mshow-play,
.mshow-card:focus-visible .mshow-play {
  opacity: 1;
}

.mshow-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  min-width: 0;
}
.mshow-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mshow-title {
  font-size: 16px;
  font-weight: 620;
  color: hsl(var(--foreground));
  line-height: 1.2;
}
.mshow-tag {
  font-size: 10.5px;
  font-weight: 550;
  letter-spacing: 0.02em;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
.mshow-tag[data-tag='Link semantics'] {
  color: var(--m-accent, hsl(var(--primary)));
  border-color: color-mix(in srgb, var(--m-accent, hsl(var(--primary))) 45%, transparent);
}
.mshow-desc {
  font-size: 13.5px;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
  margin: 0;
}
.mshow-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 2px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
.mshow-stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-variant-numeric: tabular-nums;
}
.mshow-cta {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 550;
  color: hsl(var(--foreground));
}

/* lightbox */
.mshow-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: clamp(12px, 3vw, 40px);
  background: rgba(9, 9, 11, 0.66);
  backdrop-filter: blur(3px);
}
.mshow-dialog {
  width: min(1120px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.55);
}
.mshow-dialog-bar {
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-template-areas: 'title open close' 'sub open close';
  align-items: center;
  gap: 2px 14px;
  padding: 11px 14px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--secondary));
}
.mshow-dialog-title {
  grid-area: title;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  font-weight: 620;
  color: hsl(var(--foreground));
}
.mshow-dialog-sub {
  grid-area: sub;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
.mshow-dialog-open {
  grid-area: open;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  transition: color 0.15s;
}
.mshow-dialog-open:hover {
  color: hsl(var(--foreground));
}
.mshow-dialog-x {
  grid-area: close;
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: hsl(var(--muted-foreground));
  transition: background 0.15s, color 0.15s;
}
.mshow-dialog-x:hover {
  background: hsl(var(--muted) / 0.6);
  color: hsl(var(--foreground));
}
.mshow-dialog-frame {
  width: 100%;
  height: min(72vh, 680px);
  border: 0;
  display: block;
  background: #09090b;
}
.mshow-dialog-foot {
  margin: 0;
  padding: 9px 14px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
.mshow-dialog-foot code {
  font-size: 11.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: hsl(var(--secondary));
}

.mshow-fade-enter-active,
.mshow-fade-leave-active {
  transition: opacity 0.18s ease;
}
.mshow-fade-enter-from,
.mshow-fade-leave-to {
  opacity: 0;
}
</style>
