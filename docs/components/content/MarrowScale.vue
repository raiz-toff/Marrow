<template>
  <div class="marrow-scale not-prose my-8">
    <div class="marrow-scale-split">
      <!-- the real compiled slice -->
      <figure class="marrow-scale-pane">
        <figcaption class="marrow-scale-cap">
          <SmartIcon name="lucide:box" :size="13" />
          <span>demo/scale.html</span>
          <span class="marrow-scale-badge">1 of 194 sites</span>
          <a class="marrow-scale-open" href="/demo/scale.html" target="_blank" rel="noopener">
            Open full size
            <SmartIcon name="lucide:arrow-up-right" :size="12" />
          </a>
        </figcaption>
        <iframe
          src="/demo/scale.html"
          title="Meridian Group DC1 — a compiled Marrow diagram"
          class="marrow-scale-frame"
          loading="lazy"
        />
      </figure>

      <!-- the numbers for the whole topology this slice belongs to -->
      <aside class="marrow-scale-stats">
        <p class="marrow-scale-kicker">The whole topology</p>
        <dl class="marrow-scale-grid">
          <div v-for="s in stats" :key="s.label" class="marrow-scale-stat">
            <dt>{{ s.value }}<span v-if="s.unit" class="marrow-scale-unit">{{ s.unit }}</span></dt>
            <dd>{{ s.label }}</dd>
          </div>
        </dl>
        <p class="marrow-scale-note">
          The diagram on the left is <strong>one datacenter</strong> — Ashburn
          US-East — compiled to a single 1.4&nbsp;MB file. The full Meridian
          Group topology is 40× larger and compiles the same way, to a
          multi-page site.
        </p>
      </aside>
    </div>

    <p class="marrow-scale-foot">
      Real, not a screenshot: drag to pan, scroll to zoom, click a device for its
      interfaces. 382 nodes and 808 links, laid out entirely by the engine — no
      coordinates in the source.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The "at scale" panel: one compiled datacenter beside the numbers for the
 * 15,591-device topology it was sliced from. The three archetype demos above
 * prove "structure drives layout"; this proves the same compiler holds up when
 * the input is a real global enterprise.
 *
 * Source: docs/demos/scale.yaml → docs/public/demo/scale.html (npm run demos).
 * The full-topology figures come from input/global-enterprise.yaml, counted
 * with Marrow's own parser — keep them in sync if that file is regenerated.
 */
const stats = [
  { value: '15,591', label: 'devices' },
  { value: '18,812', label: 'links' },
  { value: '1,017', label: 'zones' },
  { value: '194', label: 'sites worldwide' },
  { value: '15,775', label: 'HTML pages built' },
  { value: '2.4', unit: ' GB', label: 'self-contained output' },
];
</script>

<style scoped>
.marrow-scale-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}
@media (min-width: 1024px) {
  .marrow-scale-split {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }
}

.marrow-scale-pane {
  display: flex;
  flex-direction: column;
  margin: 0;
  min-width: 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  overflow: hidden;
}
.marrow-scale-cap {
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
.marrow-scale-badge {
  font-size: 10.5px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid hsl(var(--border));
  color: var(--m-accent, hsl(var(--primary)));
}
.marrow-scale-open {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  transition: color 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.marrow-scale-open:hover {
  color: hsl(var(--foreground));
}
.marrow-scale-frame {
  width: 100%;
  height: 520px;
  border: 0;
  display: block;
  background: #09090b;
}

/* stats card mirrors the pane framing */
.marrow-scale-stats {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 18px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}
.marrow-scale-kicker {
  margin: 0 0 14px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.marrow-scale-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px;
  margin: 0;
  background: hsl(var(--border));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
}
.marrow-scale-stat {
  padding: 14px 14px 12px;
  background: hsl(var(--card));
}
.marrow-scale-stat dt {
  font-size: 26px;
  line-height: 1.05;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}
.marrow-scale-unit {
  font-size: 15px;
  font-weight: 550;
  color: hsl(var(--muted-foreground));
}
.marrow-scale-stat dd {
  margin: 5px 0 0;
  font-size: 12.5px;
  color: hsl(var(--muted-foreground));
}
.marrow-scale-note {
  margin: 16px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}
.marrow-scale-note strong {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.marrow-scale-foot {
  margin-top: 0.75rem;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}
</style>
