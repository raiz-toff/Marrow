<template>
  <UiAlert
    class="marrow-alert transition-all [&:not(:first-child)]:mt-5"
    :class="[toneClass[type], to && 'hover:bg-muted/50 cursor-pointer']"
  >
    <SmartIcon :name="icon ?? defaultIcon[type]" :size="16" class="marrow-alert-icon" />
    <UiAlertTitle v-if="title" class="font-semibold">
      {{ title }}
    </UiAlertTitle>
    <UiAlertDescription>
      <slot />
    </UiAlertDescription>
  </UiAlert>
</template>

<script setup lang="ts">
/**
 * Marrow's callout treatment, overriding the theme default.
 *
 * The stock component fills the whole block with a saturated colour. Marrow's
 * design language reserves colour for meaning — a status LED, a selected node —
 * and keeps chrome on the neutral zinc surface. So: the panel surface, a 1px
 * border, and a 2px left rule plus the icon carrying the tone. Colours are the
 * diagram's own status vocabulary (up / degraded / down).
 */
const {
  type = 'default',
  to,
} = defineProps<{
  title?: string;
  icon?: string;
  type?: 'default' | 'info' | 'warning' | 'success' | 'danger';
  to?: string;
  target?: string;
}>();

const toneClass = {
  default: 'marrow-alert-default',
  info: 'marrow-alert-info',
  warning: 'marrow-alert-warning',
  success: 'marrow-alert-success',
  danger: 'marrow-alert-danger',
};

const defaultIcon = {
  default: 'lucide:info',
  info: 'lucide:info',
  warning: 'lucide:triangle-alert',
  success: 'lucide:circle-check',
  danger: 'lucide:octagon-alert',
};
</script>
