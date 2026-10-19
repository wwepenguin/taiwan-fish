<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { MultiFacet, SortDir, SortField } from './types'
import { useFishData } from './composables/useFishData'
import { useFilters } from './composables/useFilters'
import { MULTI_FACETS, NONE, TRI_FACETS, facetOptions } from './composables/filterLogic'
import SearchBar from './components/SearchBar.vue'
import FilterPanel from './components/FilterPanel.vue'
import type { FacetItem } from './components/FacetGroup.vue'
import StatsBar from './components/StatsBar.vue'
import FishCard from './components/FishCard.vue'
import FishTable from './components/FishTable.vue'
import FishDetail from './components/FishDetail.vue'
import SiteFooter from './components/SiteFooter.vue'

const { items, meta, byId, loading, error, load } = useFishData()
const { state, queryInput, filtered, results, facetCounts, active, toggleValue, setValues, setTri, setSort, clearAll } =
  useFilters(items)

onMounted(load)

// ---------------------------------------------------------------- 分面選項（含顯示標籤）
const familyInfo = computed(() => {
  const m = new Map<string, { zh: string; latin: string | null }>()
  for (const f of items.value) if (!m.has(f.family_id)) m.set(f.family_id, { zh: f.family_zh, latin: f.family_latin })
  return m
})

const iucnText = computed(() => {
  const m = new Map<string, string>()
  for (const f of items.value) if (f.iucn_code && f.iucn_text && !m.has(f.iucn_code)) m.set(f.iucn_code, f.iucn_text)
  return m
})

function labelFor(key: MultiFacet, value: string): string {
  switch (key) {
    case 'family':
      return familyInfo.value.get(value)?.zh ?? value
    case 'price':
      return value === NONE ? '價格未標示' : `價格 ★${value}`
    case 'iucn': {
      if (value === NONE) return '未標示'
      const t = iucnText.value.get(value)
      return t ? `${value}・${t}` : value
    }
    default:
      return value
  }
}

const options = computed(() => {
  const out = {} as Record<MultiFacet, FacetItem[]>
  for (const key of MULTI_FACETS) {
    out[key] = facetOptions(items.value, key)
      .filter((o) => o.count > 0 || key === 'price' || key === 'season')
      .map((o) => {
        const item: FacetItem = { value: o.value, label: labelFor(key, o.value) }
        if (key === 'family') {
          const latin = familyInfo.value.get(o.value)?.latin
          item.keywords = `${latin ?? ''} ${o.value}`
          item.title = latin ? `${item.label} ${latin}（共 ${o.count} 種）` : `${item.label}（共 ${o.count} 種）`
        }
        return item
      })
  }
  return out
})

// ---------------------------------------------------------------- 統計
const priceCounts = computed(() => {
  const m = new Map<string, number>()
  for (const f of filtered.value) {
    const k = f.price == null ? NONE : String(f.price)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
})

const detailFetchedCount = computed(
  () => meta.value?.detail_fetched ?? items.value.filter((f) => f.detail_fetched).length,
)

// ---------------------------------------------------------------- 已套用條件 chips
const TRI_LABEL = { toxic: '有毒', edible: '食用', ornamental: '觀賞' } as const
const FACET_LABEL: Record<MultiFacet, string> = {
  family: '科',
  price: '價格',
  season: '產期',
  region: '分布',
  habitat: '棲地',
  iucn: 'IUCN',
}

interface Chip {
  id: string
  text: string
  remove: () => void
}

const chips = computed<Chip[]>(() => {
  const out: Chip[] = []
  if (state.q.trim()) out.push({ id: 'q', text: `「${state.q.trim()}」`, remove: () => (queryInput.value = '') })
  for (const key of MULTI_FACETS) {
    for (const v of state[key]) {
      const text = key === 'price' ? labelFor(key, v) : `${FACET_LABEL[key]}：${labelFor(key, v)}`
      out.push({ id: `${key}:${v}`, text, remove: () => toggleValue(key, v) })
    }
  }
  for (const key of TRI_FACETS) {
    if (state[key] !== 'any')
      out.push({
        id: key,
        text: `${state[key] === 'yes' ? '' : '非'}${TRI_LABEL[key]}`,
        remove: () => setTri(key, 'any'),
      })
  }
  return out
})

// ---------------------------------------------------------------- 排序選單
const SORT_OPTIONS: { value: `${SortField}-${SortDir}`; label: string }[] = [
  { value: 'default-asc', label: '預設順序' },
  { value: 'name-asc', label: '中文名' },
  { value: 'scientific-asc', label: '學名 A→Z' },
  { value: 'family-asc', label: '科名' },
  { value: 'price-desc', label: '價格 高→低' },
  { value: 'price-asc', label: '價格 低→高' },
  { value: 'length-desc', label: '最大體長 大→小' },
  { value: 'length-asc', label: '最大體長 小→大' },
  { value: 'depth-asc', label: '棲息深度 淺→深' },
  { value: 'depth-desc', label: '棲息深度 深→淺' },
]
const sortValue = computed({
  get: () => `${state.sort}-${state.dir}`,
  set: (v: string) => {
    const [field, dir] = v.split('-') as [SortField, SortDir]
    setSort(field, dir)
  },
})
const sortOptions = computed(() => {
  if (SORT_OPTIONS.some((o) => o.value === sortValue.value)) return SORT_OPTIONS
  const base = SORT_OPTIONS.find((o) => o.value.startsWith(`${state.sort}-`))?.label.split(' ')[0] ?? state.sort
  return [...SORT_OPTIONS, { value: sortValue.value, label: `${base}（${state.dir === 'asc' ? '遞增' : '遞減'}）` }]
})

// ---------------------------------------------------------------- 詳細面板
const selected = computed(() => (state.id ? (byId.value.get(state.id) ?? null) : null))
const selectedIndex = computed(() => (state.id ? results.value.findIndex((f) => f.id === state.id) : -1))

// 網址中的 id 不存在於資料時清除
watch(items, (list) => {
  if (list.length && state.id && !byId.value.has(state.id)) state.id = null
})

function openDetail(id: string) {
  state.id = id
}
function step(delta: number) {
  const next = results.value[selectedIndex.value + delta]
  if (next) state.id = next.id
}

// ---------------------------------------------------------------- 手機篩選抽屜
const filtersOpen = ref(false)
watch(filtersOpen, (open) => {
  document.body.classList.toggle('scroll-locked', open)
})
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && filtersOpen.value && !state.id) filtersOpen.value = false
}

// 量測頂部列高度，供側欄 sticky 定位
const header = useTemplateRef<HTMLElement>('header')
let ro: ResizeObserver | undefined
onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (header.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(([entry]) => {
      if (entry) document.documentElement.style.setProperty('--header-h', `${Math.ceil(entry.target.getBoundingClientRect().height)}px`)
    })
    ro.observe(header.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  ro?.disconnect()
})

const activeFilterCount = computed(
  () => MULTI_FACETS.reduce((n, k) => n + state[k].length, 0) + TRI_FACETS.filter((k) => state[k] !== 'any').length,
)
</script>

<template>
  <header ref="header" class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="./" @click.prevent="clearAll(); state.id = null">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M6 32c10-14 30-18 44-6l8-8v28l-8-8C36 50 16 46 6 32z" fill="currentColor" />
          <circle cx="18" cy="29" r="3" fill="var(--surface)" />
        </svg>
        <span>
          <strong>臺灣經濟性魚種查詢</strong>
          <small>中研院臺灣魚類資料庫・經濟性魚種名錄</small>
        </span>
      </a>
      <div class="search-slot">
        <SearchBar v-model="queryInput" />
      </div>
    </div>
  </header>

  <div class="page">
    <div v-if="loading" class="state-box" role="status">
      <span class="spinner" aria-hidden="true" />
      <p>資料載入中…</p>
    </div>

    <div v-else-if="error" class="state-box error" role="alert">
      <h2>無法載入魚種資料</h2>
      <p>錯誤訊息：<code>{{ error }}</code></p>
      <p class="hint">請確認 <code>data/fish.json</code> 已產生（見 README 的資料更新步驟），或稍後再試。</p>
      <button type="button" class="btn btn-primary" @click="load">重新載入</button>
    </div>

    <div v-else class="layout">
      <div v-if="filtersOpen" class="filter-overlay" aria-hidden="true" @click="filtersOpen = false" />
      <aside id="filter-panel" :class="['sidebar', { open: filtersOpen }]" aria-label="篩選條件">
        <FilterPanel
          :state="state"
          :counts="facetCounts"
          :options="options"
          :active="active"
          :result-count="results.length"
          @toggle="toggleValue"
          @set-values="setValues"
          @set-tri="setTri"
          @clear-all="clearAll"
          @close="filtersOpen = false"
        />
      </aside>

      <main class="main">
        <StatsBar
          :matched="results.length"
          :total="items.length"
          :price-counts="priceCounts"
          :selected-prices="state.price"
          @toggle-price="toggleValue('price', $event)"
        />

        <div class="toolbar">
          <button
            type="button"
            class="btn filter-toggle"
            aria-controls="filter-panel"
            :aria-expanded="filtersOpen"
            @click="filtersOpen = true"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            篩選<span v-if="activeFilterCount" class="count-badge">{{ activeFilterCount }}</span>
          </button>

          <label class="sort">
            <span class="visually-hidden">排序方式</span>
            <span aria-hidden="true" class="sort-label">排序</span>
            <select v-model="sortValue" class="select">
              <option v-for="o in sortOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>

          <div class="view-toggle" role="group" aria-label="檢視方式">
            <button type="button" class="btn" :aria-pressed="state.view === 'card'" @click="state.view = 'card'">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <rect x="3" y="3" width="6" height="6" rx="1.2" fill="currentColor" />
                <rect x="11" y="3" width="6" height="6" rx="1.2" fill="currentColor" />
                <rect x="3" y="11" width="6" height="6" rx="1.2" fill="currentColor" />
                <rect x="11" y="11" width="6" height="6" rx="1.2" fill="currentColor" />
              </svg>
              <span class="vt-text">卡片</span>
            </button>
            <button type="button" class="btn" :aria-pressed="state.view === 'table'" @click="state.view = 'table'">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
              <span class="vt-text">表格</span>
            </button>
          </div>
        </div>

        <ul v-if="chips.length" class="chips" aria-label="已套用的條件">
          <li v-for="c in chips" :key="c.id">
            <button type="button" class="chip" :aria-label="`移除條件 ${c.text}`" @click="c.remove()">
              {{ c.text }} <span aria-hidden="true">×</span>
            </button>
          </li>
          <li>
            <button type="button" class="chip-clear" @click="clearAll">清除全部</button>
          </li>
        </ul>

        <div v-if="!results.length" class="empty">
          <p>沒有符合條件的魚種。</p>
          <button v-if="active" type="button" class="btn" @click="clearAll">清除全部條件</button>
        </div>

        <ul v-else-if="state.view === 'card'" class="cards">
          <li v-for="f in results" :key="f.id">
            <FishCard :fish="f" :active="f.id === state.id" @select="openDetail" />
          </li>
        </ul>

        <FishTable
          v-else
          :items="results"
          :sort="state.sort"
          :dir="state.dir"
          :active-id="state.id"
          @select="openDetail"
          @sort="setSort"
        />
      </main>
    </div>
  </div>

  <SiteFooter :meta="meta" :total="items.length" :detail-fetched="detailFetchedCount" />

  <FishDetail
    :fish="selected"
    :position="selectedIndex >= 0 ? selectedIndex + 1 : null"
    :total="results.length"
    :has-prev="selectedIndex > 0"
    :has-next="selectedIndex >= 0 && selectedIndex < results.length - 1"
    @close="state.id = null"
    @prev="step(-1)"
    @next="step(1)"
  />
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: saturate(1.4) blur(8px);
  -webkit-backdrop-filter: saturate(1.4) blur(8px);
}
.topbar-inner {
  display: flex;
  align-items: center;
  gap: 24px;
  max-width: 1440px;
  margin: 0 auto;
  padding: 10px 16px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  color: var(--text);
  text-decoration: none;
}
.brand svg {
  width: 34px;
  height: 34px;
  color: var(--accent);
}
.brand span {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.brand strong {
  font-size: 17px;
}
.brand small {
  color: var(--text-muted);
  font-size: 12px;
}
.search-slot {
  flex: 1;
  max-width: 720px;
}

.page {
  max-width: 1440px;
  margin: 0 auto;
  padding: 20px 16px 0;
}
.layout {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}
.sidebar {
  position: sticky;
  top: calc(var(--header-h) + 16px);
  max-height: calc(100vh - var(--header-h) - 32px);
  max-height: calc(100dvh - var(--header-h) - 32px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 6px;
  scrollbar-width: thin;
}
.main {
  min-width: 0;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 16px 0 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.filter-toggle {
  display: none;
}
.count-badge {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 11px;
  line-height: 18px;
}
.sort {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.sort-label {
  color: var(--text-muted);
  font-size: 13px;
}
.view-toggle {
  display: inline-flex;
}
.view-toggle .btn:first-child {
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}
.view-toggle .btn:last-child {
  margin-left: -1px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.view-toggle .btn[aria-pressed='true'] {
  position: relative;
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--text);
  font-size: 13px;
}
.chip:hover {
  background: var(--surface-2);
}
.chip span {
  color: var(--text-muted);
}
.chip-clear {
  padding: 2px 6px;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 13px;
}
.chip-clear:hover {
  text-decoration: underline;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cards > li {
  content-visibility: auto;
  contain-intrinsic-size: auto 280px;
}
.empty,
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 56px 16px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-muted);
  text-align: center;
}
.empty p,
.state-box p {
  margin: 0;
}
.state-box h2 {
  margin: 0;
  color: var(--text);
  font-size: 18px;
}
.state-box.error {
  border-color: var(--danger);
  background: var(--danger-soft);
}
.state-box .hint {
  font-size: 13px;
}
.state-box code {
  font-family: var(--mono);
  font-size: 0.92em;
}
.state-box .btn {
  margin-top: 8px;
}
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.filter-overlay {
  display: none;
}

@media (max-width: 899px) {
  .topbar-inner {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .search-slot {
    max-width: none;
  }
  .brand svg {
    width: 28px;
    height: 28px;
  }
  .layout {
    display: block;
  }
  .sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 31;
    width: min(360px, 88vw);
    max-height: none;
    padding: 16px 16px 0;
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    transform: translateX(-105%);
    visibility: hidden;
    transition: transform 0.22s ease, visibility 0s linear 0.22s;
  }
  .sidebar.open {
    transform: none;
    visibility: visible;
    transition: transform 0.22s ease;
  }
  .filter-overlay {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: block;
    background: var(--overlay);
  }
  .filter-toggle {
    display: inline-flex;
  }
}

@media (max-width: 560px) {
  .brand small {
    display: none;
  }
  .page {
    padding-top: 14px;
  }
  .sort-label,
  .vt-text {
    display: none;
  }
  .toolbar {
    gap: 8px;
  }
  .sort .select {
    max-width: 128px;
  }
  .cards {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }
  .cards > li {
    contain-intrinsic-size: auto 250px;
  }
}
</style>
