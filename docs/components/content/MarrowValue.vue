<template>
  <section class="mv not-prose">
    <p class="mv-eyebrow"># what you get</p>
    <h2 class="mv-title">Everything compiles into the one file.</h2>

    <dl class="mv-list">
      <div v-for="f in features" :key="f.key" class="mv-row">
        <dt class="mv-key">{{ f.key }}</dt>
        <dd class="mv-def">
          <NuxtLinkLocale :to="f.to" class="mv-lead">
            {{ f.lead }}
            <SmartIcon name="lucide:arrow-up-right" :size="13" class="mv-lead-icon" />
          </NuxtLinkLocale>
          <span class="mv-body">{{ f.body }}</span>
        </dd>
      </div>
    </dl>

    <div class="mv-cta">
      <NuxtLinkLocale to="/showcase">
        <UiButton size="lg">
          Open the Showcase
          <SmartIcon name="lucide:arrow-right" class="ml-1" />
        </UiButton>
      </NuxtLinkLocale>
      <p class="mv-cta-note">Seven interactive diagrams — trunks, VPNs, 15,591 devices — one command behind each.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The value section: four facets of a compiled diagram, set as a YAML-style
 * key → value spec rather than a grid of cards. The mono key column echoes the
 * format the reader actually authors in; the hero already spends the page's
 * one bold moment, so this stays deliberately quiet.
 */
const features = [
  {
    key: 'output',
    lead: 'Interactive, not a screenshot',
    to: '/guides/output',
    body: 'Pan, zoom, open a device for its interfaces and config, trace a path, search across pages, export to PNG or SVG.',
  },
  {
    key: 'offline',
    lead: 'Self-contained, works offline',
    to: '/decisions/0004-self-contained-output',
    body: 'Icons, styles and the ~20 KB runtime are inlined — no CDN, no fonts to fetch, no telemetry. Open it on a plane.',
  },
  {
    key: 'diagnostics',
    lead: 'Errors built for machines',
    to: '/reference/diagnostics',
    body: 'A stable code, a line and column, a snippet, a fix hint and did-you-mean suggestions on every one.',
  },
  {
    key: 'icons',
    lead: '~2,850 real vendor icons',
    to: '/reference/icon-packs',
    body: 'Cisco, AWS, Azure, GCP, Kubernetes and vendor-neutral packs — searchable, never guessable.',
  },
];
</script>

<style scoped>
.mv {
  margin: 4.5rem 0 1rem;
}
.mv-eyebrow {
  margin: 0 0 0.6rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12.5px;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--m-accent, hsl(var(--primary))) 78%, hsl(var(--muted-foreground)));
}
.mv-title {
  margin: 0 0 1.9rem;
  font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2rem);
  line-height: 1.12;
  font-weight: 640;
  letter-spacing: -0.015em;
  color: hsl(var(--foreground));
  max-width: 20ch;
}

.mv-list {
  margin: 0;
  border-top: 1px solid hsl(var(--border));
}
.mv-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px 28px;
  padding: 20px 0;
  border-bottom: 1px solid hsl(var(--border));
}
@media (min-width: 720px) {
  .mv-row {
    grid-template-columns: minmax(120px, 168px) minmax(0, 1fr);
    align-items: baseline;
    gap: 0 28px;
  }
}

/* the key column reads as a YAML key — the format you author in */
.mv-key {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
.mv-key::after {
  content: ':';
  color: var(--m-accent, hsl(var(--primary)));
  margin-left: 1px;
}

.mv-def {
  margin: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.mv-lead {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  font-size: 16.5px;
  font-weight: 600;
  line-height: 1.25;
  color: hsl(var(--foreground));
  transition: color 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.mv-lead-icon {
  opacity: 0;
  transform: translate(-3px, 2px);
  transition: opacity 0.15s, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  color: var(--m-accent, hsl(var(--primary)));
}
.mv-lead:hover {
  color: var(--m-accent, hsl(var(--primary)));
}
.mv-lead:hover .mv-lead-icon,
.mv-lead:focus-visible .mv-lead-icon {
  opacity: 1;
  transform: translate(0, 0);
}
.mv-body {
  font-size: 14px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  max-width: 62ch;
}

.mv-cta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 2.4rem;
}
.mv-cta-note {
  margin: 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

@media (prefers-reduced-motion: reduce) {
  .mv-lead,
  .mv-lead-icon {
    transition: none;
  }
}
</style>
