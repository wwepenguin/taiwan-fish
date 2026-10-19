<script setup lang="ts">
import type { Fish } from '../types'
import FishImage from './FishImage.vue'
import PriceStars from './PriceStars.vue'

defineProps<{ fish: Fish; active?: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <button
    type="button"
    :class="['card', { active }]"
    :aria-label="`${fish.name_zh} ${fish.scientific}，查看詳細資料`"
    @click="emit('select', fish.id)"
  >
    <span class="thumb">
      <FishImage :src="fish.photo_thumb" :alt="fish.name_zh" />
    </span>
    <span class="body">
      <span class="row top">
        <span class="name">{{ fish.name_zh }}</span>
        <PriceStars :price="fish.price" />
      </span>
      <span class="sci">{{ fish.scientific }}</span>
      <span class="row meta">
        <span class="family">{{ fish.family_zh }}</span>
        <span v-if="fish.season" class="season" :title="`產期：${fish.season}`">
          <span aria-hidden="true">◷</span> {{ fish.season }}
        </span>
      </span>
      <span v-if="fish.common_names.length" class="aka">
        俗名：{{ fish.common_names.slice(0, 3).join('、') }}<template v-if="fish.common_names.length > 3">…</template>
      </span>
    </span>
  </button>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}
.card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow);
}
.thumb {
  display: block;
  aspect-ratio: 16 / 9;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px 12px;
  min-width: 0;
}
.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.top {
  flex-wrap: wrap;
  row-gap: 0;
}
.name {
  font-size: 16px;
  font-weight: 650;
  line-height: 1.35;
}
.sci {
  color: var(--text-muted);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 12.5px;
}
.family {
  padding: 0 7px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}
.season {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.aka {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
