<template>
  <main class="marrow-landing not-prose">
    <!-- View Switcher -->
    <nav class="ml-toolbar" aria-label="Diagram display selector">
      <div class="ml-segmented" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="currentView === 'side-by-side'"
          class="ml-seg-btn"
          :class="{ 'ml-seg-active': currentView === 'side-by-side' }"
          @click="currentView = 'side-by-side'"
        >
          Side by side
        </button>

        <button
          v-for="d in diagrams"
          :key="d.id"
          type="button"
          role="tab"
          :aria-selected="currentView === d.id"
          class="ml-seg-btn"
          :class="{ 'ml-seg-active': currentView === d.id }"
          @click="currentView = d.id as any"
        >
          {{ d.title }}
        </button>
      </div>

      <span class="ml-toolbar-meta">Compiled with Marrow · pan and zoom directly</span>
    </nav>

    <!-- Topologies Workbench -->
    <section
      class="ml-workbench"
      :class="{
        'ml-workbench-duo': currentView === 'side-by-side',
        'ml-workbench-solo': currentView !== 'side-by-side',
      }"
      aria-label="Compiled interactive network topologies"
    >
      <template v-for="d in diagrams" :key="d.id">
        <article
          v-show="currentView === 'side-by-side' || currentView === d.id"
          class="ml-viewport"
        >
          <header class="ml-viewport-bar">
            <div class="ml-viewport-meta">
              <h2 class="ml-viewport-title">{{ d.title }}</h2>
              <span class="ml-viewport-sub">{{ d.summary }}</span>
            </div>

            <a
              :href="`/demo/${d.id}.html`"
              target="_blank"
              rel="noopener"
              class="ml-viewport-link"
              :aria-label="`Open ${d.title} in full screen`"
            >
              <span>Open full size</span>
              <SmartIcon name="lucide:arrow-up-right" :size="13" aria-hidden="true" />
            </a>
          </header>

          <div class="ml-frame-shell">
            <iframe
              :src="`/demo/${d.id}-embed.html`"
              :title="`${d.title} interactive network diagram`"
              loading="eager"
              class="ml-frame"
              @load="onFrameLoad"
            />
            <div class="ml-frame-hint" aria-hidden="true">
              <span>Drag to pan · Scroll to zoom · Click to inspect</span>
            </div>
          </div>
        </article>
      </template>
    </section>

    <!-- Founder's Note / Why This Exists -->
    <article class="ml-essay" aria-labelledby="ml-essay-heading">
      <h2 id="ml-essay-heading" class="ml-essay-title">Why this exists</h2>

      <div class="ml-essay-prose">
        <p>
          I got tired of spending hours dragging boxes and fixing bent lines by hand every time I built a new network lab.
        </p>

        <p>
          There are plenty of diagramming tools out there if you want to draw everything manually, and plenty of AI tools that spit out messy flowcharts—but nothing where I could just drop my configs or talk through a lab with an agent and get a diagram I actually wanted to look at.
        </p>

        <p>
          So I built Marrow. You describe the topology (or hand your agent the configs), the compiler figures out the layout and routing, and it outputs a single offline <code>.html</code> file. It holds the actual interface, VLAN, and config details inside it, looks clean in docs, and you can send the file to anyone without needing a server or an account.
        </p>

        <p class="ml-essay-closing">
          I built it for my own labs and documentation. Putting it out there in case it saves you some time too.
        </p>
      </div>

      <!-- Action -->
      <div class="ml-action">
        <NuxtLink to="/getting-started/quickstart" class="ml-cta">
          Get started
        </NuxtLink>
      </div>
    </article>
  </main>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

interface TopologySpec {
  id: string;
  title: string;
  summary: string;
}

// The two most complementary showcase diagrams for the landing page:
// 1. Zoned Multi-Site: spatial containers, cross-site links, HA pairs
// 2. Trunking & 802.1Q VLANs: double-rail trunks, VLAN tags, access chips
const diagrams: TopologySpec[] = [
  {
    id: 'zoned',
    title: 'Zoned Multi-Site',
    summary: 'Spatial zones · HA pairs · Cross-site links',
  },
  {
    id: 'trunk-vlans',
    title: 'Trunking & 802.1Q VLANs',
    summary: '802.1Q double rails · VLAN chips · Port access',
  },
];

const currentView = ref<'side-by-side' | 'zoned' | 'trunk-vlans'>('side-by-side');
const colorMode = useColorMode();

function pushTheme() {
  const theme = colorMode.value === 'light' ? 'light' : 'dark';
  if (import.meta.client) {
    const frames = document.querySelectorAll<HTMLIFrameElement>('.ml-frame');
    for (const frame of frames) {
      frame.contentWindow?.postMessage({ type: 'marrow:theme', theme }, '*');
    }
  }
}

function onFrameLoad(event: Event) {
  const target = event.target as HTMLIFrameElement;
  const theme = colorMode.value === 'light' ? 'light' : 'dark';
  target.contentWindow?.postMessage({ type: 'marrow:theme', theme }, '*');
}

function onWindowMessage(e: MessageEvent) {
  if ((e.data as { type?: string } | null)?.type === 'marrow:ready') {
    pushTheme();
  }
}

watch(() => colorMode.value, () => pushTheme());

onMounted(() => {
  window.addEventListener('message', onWindowMessage);
  // On mobile/tablet screens, default to single view to preserve diagram aspect ratio
  if (import.meta.client && window.innerWidth < 1024) {
    currentView.value = 'zoned';
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onWindowMessage);
});
</script>

<style scoped>
.marrow-landing {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem 1rem 6rem;
}

/* ── Viewport Navigation Bar ── */
.ml-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.ml-segmented {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  border-radius: 8px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  gap: 2px;
}

.ml-seg-btn {
  padding: 5px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.ml-seg-btn:hover {
  color: hsl(var(--foreground));
}

.ml-seg-active {
  background: hsl(var(--secondary));
  color: hsl(var(--foreground));
  font-weight: 600;
}

.ml-toolbar-meta {
  font-size: 12.5px;
  color: hsl(var(--muted-foreground));
  letter-spacing: -0.01em;
}

/* ── Topologies Workbench ── */
.ml-workbench {
  display: grid;
  gap: 1.25rem;
  width: 100%;
}

.ml-workbench-duo {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ml-workbench-solo {
  grid-template-columns: 1fr;
}

@media (max-width: 1023px) {
  .ml-workbench-duo {
    grid-template-columns: 1fr;
  }
}

.ml-viewport {
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.18s ease;
}

.ml-viewport:hover {
  border-color: color-mix(in srgb, hsl(var(--border)) 60%, hsl(var(--foreground)));
}

.ml-viewport-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: hsl(var(--muted) / 0.35);
  border-bottom: 1px solid hsl(var(--border));
}

.ml-viewport-meta {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.ml-viewport-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: hsl(var(--foreground));
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.ml-viewport-sub {
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ml-viewport-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-decoration: none !important;
  transition: color 0.15s ease;
  white-space: nowrap;
}

.ml-viewport-link:hover {
  color: hsl(var(--foreground));
}

.ml-frame-shell {
  position: relative;
  width: 100%;
  background: #09090b;
}

.ml-frame {
  display: block;
  width: 100%;
  height: 440px;
  border: none;
}

.ml-workbench-solo .ml-frame {
  height: 520px;
}

.ml-frame-hint {
  position: absolute;
  bottom: 10px;
  right: 12px;
  padding: 3px 9px;
  background: rgba(9, 9, 11, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  font-size: 11px;
  color: #a1a1aa;
  pointer-events: none;
  user-select: none;
}

/* ── Authentic Essay / Why This Exists ── */
.ml-essay {
  max-width: 660px;
  margin: 5rem auto 0;
  padding: 0 0.5rem;
}

.ml-essay-title {
  margin: 0 0 1.75rem;
  font-size: clamp(1.6rem, 2.5vw, 2.1rem);
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: -0.025em;
  color: hsl(var(--foreground));
}

.ml-essay-prose {
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
  font-size: 16.5px;
  line-height: 1.75;
  color: hsl(var(--muted-foreground));
}

.ml-essay-prose p {
  margin: 0;
}

.ml-essay-prose code {
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 14px;
  padding: 2px 5px;
  border-radius: 4px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}

.ml-essay-closing {
  color: hsl(var(--foreground)) !important;
  font-style: italic;
  padding-top: 0.5rem;
}

/* ── Clean Get Started CTA ── */
.ml-action {
  margin-top: 3rem;
}

.ml-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  padding: 0 2rem;
  border-radius: 8px;
  background: var(--m-accent, #3b82f6);
  color: #ffffff !important;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none !important;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ml-cta:hover {
  filter: brightness(1.08);
}

@media (max-width: 640px) {
  .marrow-landing {
    padding: 1.25rem 0.5rem 4rem;
  }
  .ml-frame {
    height: 350px;
  }
  .ml-workbench-solo .ml-frame {
    height: 380px;
  }
  .ml-essay {
    margin-top: 3.5rem;
  }
  .ml-viewport-sub {
    display: none;
  }
}
</style>
