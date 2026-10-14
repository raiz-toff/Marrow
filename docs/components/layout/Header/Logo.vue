<!--
  Overrides shadcn-docs-nuxt's header logo.

  The theme renders the wordmark through <NuxtImg>, which routes it via the
  @nuxt/image IPX pipeline (`/_ipx/_/wordmark.svg`). That path only exists if
  the deploy emits or serves the IPX assets — it does in `nuxt dev`, and it is
  the thing that breaks in production, leaving a broken-image icon in the header.
  The wordmark is a hand-written SVG that needs no resizing or reformatting, so
  a plain <img> against the file in public/ is both correct and unbreakable.
-->
<template>
  <div>
    <NuxtLinkLocale v-if="logo.light && logo.dark" :to="localePath('/')" class="flex">
      <img :src="logo.light" alt="Marrow" class="h-7 dark:hidden">
      <img :src="logo.dark" alt="Marrow" class="hidden h-7 dark:block">
      <span v-if="showTitle && title" class="ml-3 self-center font-bold">
        {{ $t(title) }}
      </span>
    </NuxtLinkLocale>
  </div>
</template>

<script setup lang="ts">
const { logo, title, showTitle } = useConfig().value.header;
const { localePath } = useI18nDocs();
</script>
