<template>
  <div class="marrow-demo not-prose my-8">
    <UiTabs v-model="current" class="w-full">
      <div class="marrow-demo-bar">
        <UiTabsList>
          <UiTabsTrigger v-for="d in demos" :key="d.id" :value="d.id">
            {{ d.label }}
          </UiTabsTrigger>
        </UiTabsList>
        <p class="marrow-demo-hint">{{ active.hint }}</p>
      </div>

      <UiTabsContent v-for="d in demos" :key="d.id" :value="d.id" class="mt-3">
        <div class="marrow-demo-split">
          <!-- source -->
          <figure class="marrow-demo-pane">
            <figcaption class="marrow-demo-cap">
              <SmartIcon name="lucide:file-code" :size="13" />
              <span>{{ d.id }}.yaml</span>
              <button class="marrow-demo-copy" type="button" @click="copy(d)">
                <SmartIcon :name="copied === d.id ? 'lucide:check' : 'lucide:copy'" :size="13" />
                <span class="sr-only">Copy YAML</span>
              </button>
            </figcaption>
            <pre class="marrow-demo-code"><code v-html="highlight(d.yaml)" /></pre>
          </figure>

          <!-- the real compiled diagram -->
          <figure class="marrow-demo-pane">
            <figcaption class="marrow-demo-cap">
              <SmartIcon name="lucide:box" :size="13" />
              <span>{{ d.id }}.html</span>
              <a class="marrow-demo-open" :href="`/demo/${d.id}.html`" target="_blank" rel="noopener">
                Open full size
                <SmartIcon name="lucide:arrow-up-right" :size="12" />
              </a>
            </figcaption>
            <iframe
              :src="`/demo/${d.id}.html`"
              :title="`${d.label} — compiled Marrow diagram`"
              class="marrow-demo-frame"
              loading="lazy"
            />
          </figure>
        </div>
      </UiTabsContent>
    </UiTabs>

    <p class="marrow-demo-foot">
      Both panes are real: the diagram on the right is the actual file
      <code>marrow build</code> produced from the YAML on the left — drag to pan,
      scroll to zoom, click a device for its inspector. Nothing here is a
      screenshot, and nothing is fetched from a server.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The landing-page demo: declared structure on the left, the compiled diagram on
 * the right. Three topologies, one per archetype, so the page demonstrates the
 * "structure drives layout" claim instead of merely asserting it.
 *
 * Sources live in docs/demos/*.yaml and are compiled to docs/public/demo/*.html
 * by `npm run demos` (see docs/scripts/build-demos.mjs). They are committed —
 * Marrow output is deterministic, so the diff is empty unless a demo changed,
 * and Vercel doesn't need the compiler to build this site.
 */
import tieredYaml from '~/demos/tiered.yaml?raw';
import zonedYaml from '~/demos/zoned.yaml?raw';
import hubSpokeYaml from '~/demos/hub-spoke.yaml?raw';

const demos = [
  {
    id: 'tiered',
    label: 'Tiered',
    yaml: tieredYaml,
    hint: 'Every device declares a tier → layered top-down.',
  },
  {
    id: 'zoned',
    label: 'Zoned',
    yaml: zonedYaml,
    hint: 'Two zones hold devices → a packed mosaic, tiers ordering each one.',
  },
  {
    id: 'hub-spoke',
    label: 'Hub & spoke',
    yaml: hubSpokeYaml,
    hint: 'Spokes touch only the hub → a radial layout.',
  },
];

const current = ref('tiered');
const active = computed(() => demos.find(d => d.id === current.value) ?? demos[0]);

const copied = ref<string | null>(null);
async function copy(d: { id: string; yaml: string }) {
  await navigator.clipboard.writeText(d.yaml);
  copied.value = d.id;
  setTimeout(() => (copied.value = null), 1500);
}

/**
 * Minimal YAML colouring in the diagram's own token palette.
 *
 * Two traps here, both learned the hard way:
 *   1. This markup is injected with v-html, which Vue's scoped CSS cannot reach
 *      — hence inline styles rather than classes.
 *   2. The theme re-scopes --primary and --foreground *inside code blocks*, so
 *      those tokens resolve to the wrong colour here. The --m-* namespace is
 *      ours alone (assets/css/tailwind.css) and carries the diagram's literals.
 */
const TONE = {
  key: 'color:var(--m-accent)',
  val: 'color:var(--m-ink)',
  com: 'color:var(--m-ink-dim);font-style:italic',
};

function highlight(src: string) {
  const escaped = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/(^|\n)(\s*#.*)/g, `$1<span style="${TONE.com}">$2</span>`)
    .replace(/(^|\n)(\s*-?\s*)([\w.-]+)(:)/g, `$1$2<span style="${TONE.key}">$3</span>$4`)
    .replace(/(:\s)("[^"]*"|[^\s#][^\n#]*?)(?=\s*(?:#|$|\n))/g, `$1<span style="${TONE.val}">$2</span>`);
}
</script>

<style scoped>
.marrow-demo-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.marrow-demo-hint {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  margin: 0;
}

.marrow-demo-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}
@media (min-width: 1024px) {
  .marrow-demo-split {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  }
}

/* both panes are the diagram's framed viewport: 1px line, radius-lg, panel fill */
.marrow-demo-pane {
  display: flex;
  flex-direction: column;
  margin: 0;
  min-width: 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  overflow: hidden;
}
.marrow-demo-cap {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--secondary));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-mono, ui-monospace, monospace);
}
.marrow-demo-copy,
.marrow-demo-open {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  transition: color 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.marrow-demo-copy:hover,
.marrow-demo-open:hover {
  color: hsl(var(--foreground));
}

.marrow-demo-code {
  margin: 0;
  padding: 14px 16px;
  height: 460px;
  overflow: auto;
  font-size: 12.5px;
  line-height: 1.65;
  background: transparent;
  font-variant-ligatures: none;
}
.marrow-demo-frame {
  width: 100%;
  height: 460px;
  border: 0;
  display: block;
  background: #09090b;
}

.marrow-demo-foot {
  margin-top: 0.75rem;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}
.marrow-demo-foot code {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: hsl(var(--secondary));
}
</style>
