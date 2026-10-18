<template>
  <span class="inline-flex items-center gap-2 not-prose">
    <!-- LED mode -->
    <svg
      v-if="kind === 'device' || kind === 'led'"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      class="overflow-visible inline-block align-middle"
    >
      <!-- Outer glow ring for active up state -->
      <circle
        v-if="status === 'up'"
        cx="11"
        cy="11"
        r="8"
        fill="none"
        :stroke="color"
        stroke-width="1.2"
        opacity="0.35"
      />
      <!-- LED main bulb -->
      <circle
        cx="11"
        cy="11"
        r="5.5"
        :fill="color"
        stroke="var(--bg, #090d16)"
        stroke-width="1.5"
      />
      <!-- Specular highlight -->
      <circle
        cx="9.5"
        cy="9.5"
        r="1.5"
        fill="#ffffff"
        opacity="0.55"
      />
    </svg>

    <!-- Link stroke mode -->
    <svg
      v-else-if="kind === 'link'"
      width="64"
      height="18"
      viewBox="0 0 64 18"
      class="overflow-visible inline-block align-middle"
    >
      <line
        x1="2"
        y1="9"
        x2="62"
        y2="9"
        :stroke="color"
        stroke-width="2.5"
        :stroke-dasharray="dashArray"
        stroke-linecap="round"
      />
    </svg>

    <span v-if="label" class="text-xs font-medium text-foreground">
      {{ label }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    status?: 'up' | 'down' | 'degraded' | 'planned' | 'unknown';
    kind?: 'device' | 'link' | 'led';
    label?: string;
  }>(),
  {
    status: 'up',
    kind: 'device',
  },
);

const color = computed(() => {
  switch (props.status) {
    case 'up':
      return '#22c55e';
    case 'down':
      return '#ef4444';
    case 'degraded':
      return '#f59e0b';
    case 'planned':
      return '#64748b';
    case 'unknown':
      return '#71717a';
    default:
      return '#22c55e';
  }
});

const dashArray = computed(() => {
  if (props.status === 'degraded') return '7 3.5';
  if (props.status === 'planned') return '2 4.5';
  return undefined;
});
</script>
