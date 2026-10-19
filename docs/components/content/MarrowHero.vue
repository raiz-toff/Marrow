<template>
  <section class="mh not-prose" aria-labelledby="mh-title">
    <div class="mh-content">
      <div class="mh-eyebrow">
        <span class="mh-eyebrow-dot" aria-hidden="true"></span>
        <span>Marrow 2.0 · Local Agentic Network Diagram Compiler</span>
      </div>

      <h1 id="mh-title" class="mh-title">
        <span class="mh-title-line">Use any vertical AI agent</span>
        <span class="mh-title-line">
          to get your own
          <span class="mh-own">interactive HTML, SVG and PNG<svg class="mh-ul" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 8 C 24 3, 52 3, 74 6 S 108 9, 118 4" /></svg></span>.
        </span>
      </h1>

      <p class="mh-lede">
        I got tired of designing SVGs and PNGs in Visio and other manual tools, so I made Marrow to compile interactive HTML diagrams, SVGs, and PNGs using vertical AI agents.
      </p>

      <div class="mh-cta">
        <NuxtLinkLocale to="/getting-started/quickstart">
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

      <p class="mh-fine">
        MIT-licensed · 100% offline HTML, SVG &amp; PNG · Zero runtime servers · The compiler is the whole product.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
// Exact headline requested by user: 'Use an agentic AI locally and get your own interactive HTML, SVG and PNG.'
</script>

<style scoped>
.mh {
  width: 100%;
  margin: 3.5rem 0 3.5rem;
  padding: 0;
  text-align: center;
}

.mh-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 980px;
  margin: 0 auto;
}

.mh-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 1.5rem;
  padding: 5px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--secondary) / 0.6);
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 12.5px;
  color: hsl(var(--foreground));
}

.mh-eyebrow-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--m-accent, #3b82f6);
}

.mh-title {
  margin: 0;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.1;
  font-size: clamp(2.15rem, 4.5vw, 3.5rem);
  color: hsl(var(--foreground));
}

.mh-title-line {
  display: block;
}

.mh-own {
  position: relative;
  white-space: nowrap;
}

.mh-ul {
  position: absolute;
  left: -1%;
  bottom: -0.15em;
  width: 102%;
  height: 0.35em;
  overflow: visible;
  fill: none;
  stroke: var(--m-accent, #3b82f6);
  stroke-width: 3.5;
  stroke-linecap: round;
}

.mh-ul path {
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
}

.mh-lede {
  margin: 1.35rem auto 0;
  max-width: 38rem;
  font-size: clamp(1.05rem, 1.4vw, 1.2rem);
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.mh-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2rem;
}

.mh-fine {
  margin: 1.5rem 0 0;
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: 12px;
  letter-spacing: 0.01em;
  color: hsl(var(--muted-foreground));
  opacity: 0.85;
}
</style>
