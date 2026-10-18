<template>
  <span class="inline-flex items-center not-prose" :title="`Link mode: ${mode}`">
    <svg
      :width="width"
      height="26"
      :viewBox="`0 0 ${width} 26`"
      class="overflow-visible select-none inline-block align-middle"
    >
      <!-- Base casing / stroke -->
      <line
        x1="2"
        y1="13"
        :x2="width - 2"
        y2="13"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :stroke-dasharray="dashArray"
        stroke-linecap="round"
      />

      <!-- Trunk slot carving the double rail -->
      <line
        v-if="mode === 'trunk'"
        x1="2"
        y1="13"
        :x2="width - 2"
        y2="13"
        stroke="var(--bg, #090d16)"
        stroke-width="1.8"
        stroke-linecap="round"
      />

      <!-- Routed protocol chip -->
      <g v-if="mode === 'routed'" transform="translate(0, 0)">
        <rect
          :x="width / 2 - 20"
          y="4.5"
          width="40"
          height="17"
          rx="8.5"
          fill="var(--bg-raise, #161b22)"
          :stroke="strokeColor"
          stroke-width="1"
          stroke-opacity="0.6"
        />
        <text
          :x="width / 2"
          y="16.5"
          text-anchor="middle"
          font-size="9"
          font-weight="700"
          :fill="textColor"
          font-family="ui-monospace, monospace"
        >
          {{ label || 'OSPF' }}
        </text>
      </g>

      <!-- Tunnel lock chip -->
      <g v-if="mode === 'tunnel'" transform="translate(0, 0)">
        <rect
          :x="width / 2 - 22"
          y="4.5"
          width="44"
          height="17"
          rx="8.5"
          fill="var(--bg-raise, #161b22)"
          stroke="#3b82f6"
          stroke-width="1"
        />
        <!-- Padlock body -->
        <rect
          :x="width / 2 - 16"
          y="10"
          width="7"
          height="6"
          rx="1.2"
          fill="#60a5fa"
        />
        <!-- Padlock shackle -->
        <path
          :d="`M${width / 2 - 14.5} 10 V8.5 a2 2 0 0 1 4 0 V10`"
          fill="none"
          stroke="#60a5fa"
          stroke-width="1.2"
        />
        <text
          :x="width / 2 + 5"
          y="16.5"
          text-anchor="middle"
          font-size="8.5"
          font-weight="700"
          fill="#60a5fa"
          font-family="ui-sans-serif, system-ui, sans-serif"
        >
          {{ label || 'VPN' }}
        </text>
      </g>
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    mode?: 'access' | 'trunk' | 'routed' | 'peering' | 'tunnel' | 'stack';
    speed?: string;
    status?: 'up' | 'down' | 'degraded' | 'planned';
    label?: string;
    width?: number;
  }>(),
  {
    mode: 'access',
    status: 'up',
    width: 100,
  },
);

const strokeColor = computed(() => {
  switch (props.status) {
    case 'down':
      return '#ef4444';
    case 'degraded':
      return '#f59e0b';
    case 'planned':
      return '#64748b';
    default:
      return '#94a3b8';
  }
});

const textColor = computed(() => {
  return '#f1f5f9';
});

const strokeWidth = computed(() => {
  if (props.mode === 'stack') return 6;
  if (props.mode === 'trunk') return 5;
  if (props.speed === '10G' || props.speed === '25G') return 3.5;
  if (props.speed === '40G' || props.speed === '100G' || props.speed === '400G') return 4.5;
  if (props.mode === 'peering') return 3;
  return 2.5;
});

const dashArray = computed(() => {
  if (props.status === 'degraded') return '8 4';
  if (props.status === 'planned') return '2 5';
  if (props.mode === 'peering') return '2 6';
  if (props.mode === 'tunnel') return '6 4.5';
  return undefined;
});
</script>
