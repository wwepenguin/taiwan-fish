<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ price: number | null; showEmpty?: boolean }>(), {
  showEmpty: true,
})

const label = computed(() => (props.price ? `價格等級 ${props.price}（滿分 5）` : '價格未標示'))
</script>

<template>
  <span v-if="price" class="stars" role="img" :aria-label="label" :title="label">
    <span v-for="n in 5" :key="n" :class="n <= price ? 'on' : 'off'" aria-hidden="true">★</span>
  </span>
  <span v-else-if="showEmpty" class="stars none" role="img" :aria-label="label">未標示</span>
</template>

<style scoped>
.stars {
  display: inline-flex;
  letter-spacing: 1px;
  font-size: 0.95em;
  line-height: 1;
  white-space: nowrap;
}
.on {
  color: var(--star);
}
.off {
  color: var(--star-empty);
}
.none {
  color: var(--text-faint);
  font-size: 12px;
  letter-spacing: 0;
}
</style>
