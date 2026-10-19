<script setup lang="ts">
import { computed } from 'vue'
import type { FilterState, MultiFacet, Tri, TriFacet } from '../types'
import type { FacetCounts } from '../composables/filterLogic'
import FacetGroup, { type FacetItem } from './FacetGroup.vue'
import PriceStars from './PriceStars.vue'
import TaiwanMap from './TaiwanMap.vue'
import TriState from './TriState.vue'

const props = defineProps<{
  state: FilterState
  counts: FacetCounts
  options: Record<MultiFacet, FacetItem[]>
  active: boolean
  resultCount: number
}>()

const emit = defineEmits<{
  toggle: [key: MultiFacet, value: string]
  setValues: [key: MultiFacet, values: string[]]
  setTri: [key: TriFacet, value: Tri]
  clearAll: []
  close: []
}>()

/** 地圖使用與「台灣分布」清單相同的選項與動態筆數 */
const mapRegions = computed(() =>
  props.options.region.map((o) => ({ name: o.value, count: props.counts.multi.region.get(o.value) ?? 0 })),
)

const triFacets: { key: TriFacet; label: string }[] = [
  { key: 'edible', label: '食用魚類' },
  { key: 'toxic', label: '有毒魚類' },
  { key: 'ornamental', label: '觀賞魚類' },
]

interface GroupDef {
  key: MultiFacet
  title: string
  searchable?: boolean
  limit?: number
  inline?: boolean
  sortByCount?: boolean
}

const groups: GroupDef[] = [
  { key: 'family', title: '科', searchable: true, sortByCount: true },
  { key: 'price', title: '價格等級' },
  { key: 'season', title: '產期', inline: true },
  { key: 'region', title: '台灣分布', limit: 6, sortByCount: true },
  { key: 'habitat', title: '棲息環境', limit: 10, sortByCount: true },
  { key: 'iucn', title: 'IUCN 瀕危狀態' },
]
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <h2>篩選條件</h2>
      <button type="button" class="link" :disabled="!active" @click="emit('clearAll')">清除全部</button>
      <button type="button" class="btn btn-ghost btn-icon close" aria-label="關閉篩選面板" @click="emit('close')">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <template v-for="g in groups" :key="g.key">
      <!-- 台灣分布：地圖放在清單正上方，兩者共用同一組選取狀態與筆數 -->
      <section v-if="g.key === 'region' && mapRegions.length" class="map-group" aria-label="台灣分布地圖">
        <TaiwanMap
          mode="interactive"
          :regions="mapRegions"
          :selected="state.region"
          @toggle="emit('toggle', 'region', $event)"
        />
      </section>
      <FacetGroup
        v-if="options[g.key].length"
        :title="g.title"
        :options="options[g.key]"
        :selected="state[g.key]"
        :counts="counts.multi[g.key]"
        :searchable="g.searchable"
        :limit="g.limit"
        :inline="g.inline"
        :sort-by-count="g.sortByCount"
        @toggle="emit('toggle', g.key, $event)"
        @clear="emit('setValues', g.key, [])"
      >
        <template v-if="g.key === 'price'" #label="{ option }">
          <PriceStars :price="option.value === 'none' ? null : Number(option.value)" />
        </template>
      </FacetGroup>

      <!-- 三態篩選放在產期之後 -->
      <section v-if="g.key === 'season'" class="tri-group" aria-label="用途與特性">
        <h3>用途與特性</h3>
        <TriState
          v-for="t in triFacets"
          :key="t.key"
          :name="`tri-${t.key}`"
          :label="t.label"
          :counts="counts.tri[t.key]"
          :model-value="state[t.key]"
          @update:model-value="emit('setTri', t.key, $event)"
        />
        <p class="note">未抓取詳細資料的魚種僅在「不限」時列出。</p>
      </section>
    </template>

    <div class="panel-foot">
      <button type="button" class="btn btn-primary" @click="emit('close')">顯示 {{ resultCount }} 筆結果</button>
    </div>
  </div>
</template>

<style scoped>
.panel {
  padding: 0 2px;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 0 12px;
}
h2 {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 13px;
}
.link:disabled {
  color: var(--text-faint);
  cursor: default;
}
.link:not(:disabled):hover {
  text-decoration: underline;
}
.close,
.panel-foot {
  display: none;
}
.map-group {
  display: flex;
  justify-content: center;
  padding: 14px 0 6px;
  border-top: 1px solid var(--border);
  --map-halo: var(--bg);
}
.map-group + .facet {
  border-top: 0;
  padding-top: 6px;
}
.tri-group {
  display: grid;
  gap: 8px;
  padding: 14px 0;
  border-top: 1px solid var(--border);
}
.tri-group h3 {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 600;
}
.note {
  margin: 0;
  color: var(--text-faint);
  font-size: 12px;
}
@media (max-width: 899px) {
  .map-group {
    --map-halo: var(--surface);
  }
  .close {
    display: inline-flex;
  }
  .panel-foot {
    position: sticky;
    bottom: 0;
    display: block;
    margin: 0 -16px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .panel-foot .btn {
    width: 100%;
  }
}
</style>
