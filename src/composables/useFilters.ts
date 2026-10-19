import { computed, onScopeDispose, reactive, ref, watch, type Ref } from 'vue'
import type { FilterState, IndexedFish, MultiFacet, SortField, Tri, TriFacet } from '../types'
import {
  DEFAULT_DIR,
  applyFilters,
  computeFacetCounts,
  createDefaultState,
  hasActiveFilters,
  parseQuery,
  serializeState,
  sortFish,
  toCriteria,
} from './filterLogic'

export const SEARCH_DEBOUNCE_MS = 150

/**
 * 搜尋 / 篩選 / 排序狀態，並以 history.replaceState 同步至網址查詢參數。
 */
export function useFilters(items: Ref<readonly IndexedFish[]>) {
  const hasWindow = typeof window !== 'undefined'
  const state = reactive<FilterState>(hasWindow ? parseQuery(window.location.search) : createDefaultState())

  // 輸入框即時值；state.q 為 debounce 後的值
  const queryInput = ref(state.q)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(queryInput, (v) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      state.q = v
    }, SEARCH_DEBOUNCE_MS)
  })
  onScopeDispose(() => clearTimeout(timer))

  const criteria = computed(() => toCriteria(state))
  const filtered = computed(() => applyFilters(items.value, criteria.value))
  const results = computed(() => sortFish(filtered.value, state.sort, state.dir))
  const facetCounts = computed(() => computeFacetCounts(items.value, criteria.value))
  const active = computed(() => hasActiveFilters(state))

  // ---- URL 同步
  if (hasWindow) {
    watch(
      () => serializeState(state),
      (qs) => {
        const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
        window.history.replaceState(window.history.state, '', url)
      },
    )
  }

  // ---- 操作
  function toggleValue(key: MultiFacet, value: string) {
    const list = state[key]
    const i = list.indexOf(value)
    state[key] = i === -1 ? [...list, value] : list.filter((v) => v !== value)
  }

  function setValues(key: MultiFacet, values: string[]) {
    state[key] = values
  }

  function setTri(key: TriFacet, value: Tri) {
    state[key] = value
  }

  /** 設定排序；dir 省略時：同欄位再次點擊則反轉方向，否則採該欄位預設方向 */
  function setSort(field: SortField, dir?: 'asc' | 'desc') {
    if (dir) state.dir = dir
    else if (state.sort === field) state.dir = state.dir === 'asc' ? 'desc' : 'asc'
    else state.dir = DEFAULT_DIR[field]
    state.sort = field
  }

  function clearAll() {
    const d = createDefaultState()
    clearTimeout(timer)
    queryInput.value = ''
    Object.assign(state, {
      q: d.q,
      family: d.family,
      price: d.price,
      season: d.season,
      region: d.region,
      habitat: d.habitat,
      iucn: d.iucn,
      toxic: d.toxic,
      edible: d.edible,
      ornamental: d.ornamental,
    })
  }

  return {
    state,
    queryInput,
    filtered,
    results,
    facetCounts,
    active,
    toggleValue,
    setValues,
    setTri,
    setSort,
    clearAll,
  }
}
