<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{ src: string | null; alt: string; eager?: boolean }>(),
  { eager: false },
)

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <img
    v-if="src && !failed"
    class="fish-img"
    :src="src"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    referrerpolicy="no-referrer"
    @error="failed = true"
  />
  <span v-else class="fish-img placeholder" role="img" :aria-label="`${alt}（無照片）`">
    <svg viewBox="0 0 120 64" aria-hidden="true">
      <path
        d="M12 32c14-17 42-22 62-8l14-12v40L74 40c-20 14-48 9-62-8z"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <circle cx="30" cy="29" r="3.5" fill="currentColor" />
      <path d="M50 22c3 6 3 14 0 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </svg>
  </span>
</template>

<style scoped>
.fish-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--border-strong);
  background: var(--surface-2);
}
.placeholder svg {
  width: min(55%, 120px);
  height: auto;
}
</style>
