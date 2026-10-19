<script setup lang="ts">
import { computed } from 'vue'
import {
  INSET_BOX,
  ISLAND_PATH,
  MAP_REGIONS,
  MOUNTAIN_PATH,
  RIDGE_PATHS,
  VIEW_H,
  VIEW_W,
  type MapRegion,
} from './taiwanMapGeometry'

export interface MapRegionCount {
  name: string
  count: number
}

const props = withDefaults(
  defineProps<{
    regions: MapRegionCount[]
    selected?: string[]
    mode?: 'interactive' | 'readonly'
    /** readonly：要標示的分區（該魚種的台灣分布） */
    highlight?: string[]
  }>(),
  { selected: () => [], mode: 'interactive', highlight: undefined },
)

const emit = defineEmits<{ toggle: [name: string] }>()

const interactive = computed(() => props.mode === 'interactive')

const countMap = computed(() => new Map(props.regions.map((r) => [r.name, r.count])))

const activeSet = computed(
  () => new Set(interactive.value ? props.selected : (props.highlight ?? props.selected)),
)

interface RegionView {
  geo: MapRegion
  name: string
  count: number
  active: boolean
  zero: boolean
  tooltip: string
}

const items = computed<RegionView[]>(() =>
  MAP_REGIONS.map((geo) => {
    const count = countMap.value.get(geo.name) ?? 0
    const active = activeSet.value.has(geo.name)
    return {
      geo,
      name: geo.name,
      count,
      active,
      zero: interactive.value && count === 0 && !active,
      tooltip: interactive.value
        ? `${geo.name} · ${count} 種`
        : `${geo.name}${active ? ' · 有分布紀錄' : ''}`,
    }
  }),
)

const readonlyLabel = computed(() => {
  const names = items.value.filter((r) => r.active).map((r) => r.name)
  return `台灣分布地圖：${names.length ? names.join('、') : '無資料'}`
})

function toggle(name: string) {
  if (interactive.value) emit('toggle', name)
}

function onKeydown(e: KeyboardEvent, name: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggle(name)
  }
}
</script>

<template>
  <figure :class="['tw-map', mode]">
    <svg
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      preserveAspectRatio="xMidYMid meet"
      :role="interactive ? 'group' : 'img'"
      :aria-label="interactive ? '台灣分布地圖（點選區域篩選）' : readonlyLabel"
    >
      <g aria-hidden="true">
        <path class="land" :d="ISLAND_PATH" />
        <path class="range" :d="MOUNTAIN_PATH" />
        <path v-for="(d, i) in RIDGE_PATHS" :key="i" class="ridge" :d="d" />
        <rect
          class="inset"
          :x="INSET_BOX.x"
          :y="INSET_BOX.y"
          :width="INSET_BOX.w"
          :height="INSET_BOX.h"
          rx="6"
        />
        <text class="inset-title" :x="INSET_BOX.title.x" :y="INSET_BOX.title.y" text-anchor="middle">非等比例</text>
      </g>

      <g
        v-for="r in items"
        :key="r.name"
        :class="['region', r.geo.kind, { active: r.active, zero: r.zero }]"
        :role="interactive ? 'button' : undefined"
        :tabindex="interactive ? 0 : undefined"
        :aria-pressed="interactive ? r.active : undefined"
        :aria-label="interactive ? `${r.name}，${r.count} 種` : undefined"
        :aria-hidden="interactive ? undefined : 'true'"
        @click="toggle(r.name)"
        @keydown="onKeydown($event, r.name)"
      >
        <title>{{ r.tooltip }}</title>
        <template v-if="r.geo.kind === 'coast'">
          <path class="hit" :d="r.geo.d" />
          <path class="halo" :d="r.geo.d" />
          <path class="mark" :d="r.geo.d" />
        </template>
        <template v-else>
          <circle class="hit" :cx="r.geo.cx" :cy="r.geo.cy" :r="r.geo.r + 7" />
          <circle class="halo" :cx="r.geo.cx" :cy="r.geo.cy" :r="r.geo.r + 3.5" />
          <circle class="mark" :cx="r.geo.cx" :cy="r.geo.cy" :r="r.geo.r" />
        </template>
        <text class="label" :x="r.geo.label.x" :y="r.geo.label.y" :text-anchor="r.geo.label.anchor">
          {{ r.name }}<tspan v-if="interactive" class="count" dx="3">{{ r.count }}</tspan>
        </text>
      </g>
    </svg>
    <figcaption v-if="interactive" class="legend">點選區域篩選台灣分布，可複選</figcaption>
  </figure>
</template>

<style scoped>
.tw-map {
  width: 100%;
  max-width: 300px;
  margin: 0;
}
svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  -webkit-tap-highlight-color: transparent;
}

/* ---- 底圖 */
.land {
  fill: var(--map-land);
  stroke: var(--map-coast);
  stroke-width: 1.2;
  stroke-linejoin: round;
}
.range {
  fill: var(--map-range);
}
.ridge {
  fill: none;
  stroke: var(--map-ridge);
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.inset {
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
.inset-title {
  fill: var(--text-faint);
  font-size: 10px;
  letter-spacing: 0.08em;
}

/* ---- 分區 */
.region {
  outline: none;
}
.interactive .region {
  cursor: pointer;
}
.hit {
  fill: none;
  stroke: transparent;
  stroke-width: 20;
  stroke-linecap: round;
  pointer-events: stroke;
}
.island .hit {
  fill: transparent;
  stroke: none;
  pointer-events: fill;
}
.mark,
.halo {
  transition:
    stroke 0.15s,
    fill 0.15s,
    opacity 0.15s;
}
.coast .mark {
  fill: none;
  stroke: var(--map-region);
  stroke-width: 7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.island .mark {
  fill: var(--map-land);
  stroke: var(--map-region);
  stroke-width: 2.5;
}
.halo {
  fill: none;
  stroke: var(--accent);
  stroke-width: 13;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
}
.island .halo {
  stroke-width: 2.5;
}
.label {
  fill: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  paint-order: stroke;
  stroke: var(--map-halo, var(--surface));
  stroke-width: 3px;
  stroke-linejoin: round;
  transition: fill 0.15s;
}
.count {
  fill: var(--text-faint);
  font-size: 10px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

/* hover（僅互動模式） */
@media (hover: hover) {
  .interactive .region:hover .mark {
    stroke: var(--map-region-hover);
  }
  .interactive .region:hover .label {
    fill: var(--text);
  }
}

/* 鍵盤焦點 */
.interactive .region:focus-visible .halo {
  opacity: 0.35;
}
.interactive .region:focus-visible .label {
  fill: var(--text);
  text-decoration: underline;
}

/* 選取 / 標示 */
.region.active .mark,
.interactive .region.active:hover .mark {
  stroke: var(--accent);
}
.region.active.island .mark {
  fill: var(--accent);
  stroke: var(--accent-strong);
}
.region.active .label,
.interactive .region.active:hover .label {
  fill: var(--accent-strong);
  font-weight: 700;
}
.region.active .count {
  fill: var(--accent);
}

/* 互動模式：目前條件下 0 筆（仍可點選） */
.region.zero .mark {
  opacity: 0.4;
}
.region.zero .label {
  fill: var(--text-faint);
}

/* 唯讀：不顯示筆數，標籤可以大一點；未標示的分區淡化 */
.readonly .label {
  font-size: 15px;
}
.readonly .region:not(.active) .label {
  fill: var(--text-faint);
  font-weight: 400;
}
.readonly .region:not(.active) .mark {
  opacity: 0.55;
}

.legend {
  margin: 4px 0 0;
  color: var(--text-faint);
  font-size: 12px;
  text-align: center;
}
</style>
