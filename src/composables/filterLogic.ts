/**
 * 純函式：搜尋索引、篩選、分面計數、排序與 URL 序列化。
 * 不依賴 Vue，方便以 Vitest 單元測試。
 */
import type {
  FacetKey,
  FilterState,
  Fish,
  IndexedFish,
  MultiFacet,
  SortDir,
  SortField,
  Tri,
  TriFacet,
} from '../types'

export const MULTI_FACETS: readonly MultiFacet[] = ['family', 'price', 'season', 'region', 'habitat', 'iucn']
export const TRI_FACETS: readonly TriFacet[] = ['toxic', 'edible', 'ornamental']

export const PRICE_VALUES = ['1', '2', '3', '4', '5', 'none'] as const
export const SEASON_VALUES = ['春', '夏', '秋', '冬', '全年'] as const
export const ALL_YEAR = '全年'
export const NONE = 'none'

/** IUCN 代碼排序（由高風險到低風險，其餘排後） */
export const IUCN_ORDER = ['EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE', 'NL', NONE]

export const SORT_FIELDS: readonly SortField[] = ['default', 'name', 'scientific', 'family', 'price', 'length', 'depth']

export function createDefaultState(): FilterState {
  return {
    q: '',
    family: [],
    price: [],
    season: [],
    region: [],
    habitat: [],
    iucn: [],
    toxic: 'any',
    edible: 'any',
    ornamental: 'any',
    sort: 'default',
    dir: 'asc',
    view: 'card',
    id: null,
  }
}

// ---------------------------------------------------------------- 搜尋

/** 建立單筆的小寫化搜尋字串（欄位間以換行分隔，避免跨欄誤配） */
export function buildSearchText(f: Fish): string {
  return [
    f.name_zh,
    f.scientific,
    ...f.common_names,
    ...f.english_names,
    f.family_zh,
    f.family_latin ?? '',
    f.name_cn ?? '',
    ...f.synonyms,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

export function indexFish(list: Fish[]): IndexedFish[] {
  return list.map((f) => ({ ...f, _text: buildSearchText(f) }))
}

/** 以空白（含全形空白）切分關鍵字，轉小寫並去重 */
export function tokenize(q: string): string[] {
  const parts = q.trim().toLowerCase().split(/[\s　]+/).filter(Boolean)
  return [...new Set(parts)]
}

/** 所有關鍵字皆須出現（AND） */
export function matchesTokens(text: string, tokens: readonly string[]): boolean {
  for (const t of tokens) if (!text.includes(t)) return false
  return true
}

// ---------------------------------------------------------------- 篩選

/** 某筆資料在指定分面下「涵蓋」的值；產期「全年」視同涵蓋四季 */
export function facetValues(f: Fish, key: MultiFacet): string[] {
  switch (key) {
    case 'family':
      return [f.family_id]
    case 'price':
      return [f.price == null ? NONE : String(f.price)]
    case 'season':
      return f.season_tags.includes(ALL_YEAR) ? [...SEASON_VALUES] : f.season_tags
    case 'region':
      return f.taiwan_regions
    case 'habitat':
      return f.habitat_tags
    case 'iucn':
      return [f.iucn_code || NONE]
  }
}

export function matchesMulti(f: Fish, key: MultiFacet, selected: readonly string[]): boolean {
  if (selected.length === 0) return true
  const values = facetValues(f, key)
  return values.some((v) => selected.includes(v))
}

/** 三態：不限 / 是（true）/ 否（false）；未知（null）只在「不限」時出現 */
export function matchesTri(f: Fish, key: TriFacet, v: Tri): boolean {
  if (v === 'any') return true
  return f[key] === (v === 'yes')
}

export type Criteria = Pick<FilterState, MultiFacet | TriFacet> & { tokens: readonly string[] }

export function toCriteria(state: FilterState): Criteria {
  return {
    tokens: tokenize(state.q),
    family: state.family,
    price: state.price,
    season: state.season,
    region: state.region,
    habitat: state.habitat,
    iucn: state.iucn,
    toxic: state.toxic,
    edible: state.edible,
    ornamental: state.ornamental,
  }
}

/** 套用所有條件；exclude 指定的分面不參與（供分面計數） */
export function matchesCriteria(f: IndexedFish, c: Criteria, exclude?: FacetKey): boolean {
  if (c.tokens.length && !matchesTokens(f._text, c.tokens)) return false
  for (const k of MULTI_FACETS) {
    if (k !== exclude && !matchesMulti(f, k, c[k])) return false
  }
  for (const k of TRI_FACETS) {
    if (k !== exclude && !matchesTri(f, k, c[k])) return false
  }
  return true
}

export function applyFilters(items: readonly IndexedFish[], c: Criteria, exclude?: FacetKey): IndexedFish[] {
  return items.filter((f) => matchesCriteria(f, c, exclude))
}

export interface FacetCounts {
  multi: Record<MultiFacet, Map<string, number>>
  tri: Record<TriFacet, { yes: number; no: number }>
}

/** 分面計數：每個分面的計數套用「其他」所有條件（含搜尋），但不套用自身 */
export function computeFacetCounts(items: readonly IndexedFish[], c: Criteria): FacetCounts {
  const base = c.tokens.length ? items.filter((f) => matchesTokens(f._text, c.tokens)) : items
  const noTokens: Criteria = { ...c, tokens: [] }
  const multi = {} as FacetCounts['multi']
  const tri = {} as FacetCounts['tri']
  for (const k of MULTI_FACETS) {
    const m = new Map<string, number>()
    for (const f of base) {
      if (!matchesCriteria(f, noTokens, k)) continue
      for (const v of new Set(facetValues(f, k))) m.set(v, (m.get(v) ?? 0) + 1)
    }
    multi[k] = m
  }
  for (const k of TRI_FACETS) {
    const t = { yes: 0, no: 0 }
    for (const f of base) {
      if (!matchesCriteria(f, noTokens, k)) continue
      if (f[k] === true) t.yes++
      else if (f[k] === false) t.no++
    }
    tri[k] = t
  }
  return { multi, tri }
}

export interface FacetOption {
  value: string
  count: number
}

/** 全資料集中某分面所有可選值與總筆數 */
export function facetOptions(items: readonly Fish[], key: MultiFacet): FacetOption[] {
  const m = new Map<string, number>()
  for (const f of items) for (const v of new Set(facetValues(f, key))) m.set(v, (m.get(v) ?? 0) + 1)
  if (key === 'price') return PRICE_VALUES.map((value) => ({ value, count: m.get(value) ?? 0 }))
  if (key === 'season') return SEASON_VALUES.map((value) => ({ value, count: m.get(value) ?? 0 }))
  const opts = [...m].map(([value, count]) => ({ value, count }))
  if (key === 'iucn') {
    const rank = (v: string) => {
      const i = IUCN_ORDER.indexOf(v)
      return i === -1 ? IUCN_ORDER.length - 1 : i
    }
    return opts.sort((a, b) => rank(a.value) - rank(b.value) || a.value.localeCompare(b.value))
  }
  return opts.sort((a, b) => b.count - a.count || zhCollator.compare(a.value, b.value))
}

// ---------------------------------------------------------------- 排序

export const zhCollator = new Intl.Collator('zh-Hant-TW')
const latinCollator = new Intl.Collator('en', { sensitivity: 'base' })

/** 各排序欄位的預設方向 */
export const DEFAULT_DIR: Record<SortField, SortDir> = {
  default: 'asc',
  name: 'asc',
  scientific: 'asc',
  family: 'asc',
  price: 'desc',
  length: 'desc',
  depth: 'asc',
}

function numericKey(f: Fish, field: SortField, dir: SortDir): number | null {
  switch (field) {
    case 'price':
      return f.price
    case 'length':
      return f.max_length_cm
    case 'depth':
      // 由淺到深看最淺深度；由深到淺看最大深度
      return dir === 'asc' ? (f.depth_min ?? f.depth_max) : (f.depth_max ?? f.depth_min)
    default:
      return null
  }
}

/**
 * 排序（回傳新陣列，不改動輸入）。數值欄位的 null 一律排最後；
 * 同值時以原始順序（資料檔順序）為次序。
 */
export function sortFish<T extends Fish>(items: readonly T[], field: SortField, dir: SortDir): T[] {
  const indexed = items.map((f, i) => ({ f, i }))
  const sign = dir === 'asc' ? 1 : -1
  indexed.sort((a, b) => {
    let r = 0
    switch (field) {
      case 'default':
        r = 0
        break
      case 'name':
        r = sign * zhCollator.compare(a.f.name_zh, b.f.name_zh)
        break
      case 'scientific':
        r = sign * latinCollator.compare(a.f.scientific, b.f.scientific)
        break
      case 'family':
        r =
          sign * zhCollator.compare(a.f.family_zh, b.f.family_zh) ||
          latinCollator.compare(a.f.scientific, b.f.scientific)
        break
      default: {
        const x = numericKey(a.f, field, dir)
        const y = numericKey(b.f, field, dir)
        if (x == null && y == null) r = 0
        else if (x == null) r = 1
        else if (y == null) r = -1
        else r = sign * (x - y)
      }
    }
    if (field === 'default') r = sign * (a.i - b.i)
    return r || a.i - b.i
  })
  return indexed.map((x) => x.f)
}

// ---------------------------------------------------------------- URL 狀態

const LIST_KEYS = MULTI_FACETS

function parseTri(v: string | null): Tri {
  return v === 'yes' || v === 'no' ? v : 'any'
}

function parseList(v: string | null): string[] {
  if (!v) return []
  return [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))]
}

/** 從 location.search 解析狀態；無效值回退預設 */
export function parseQuery(search: string): FilterState {
  const p = new URLSearchParams(search)
  const s = createDefaultState()
  s.q = p.get('q') ?? ''
  for (const k of LIST_KEYS) s[k] = parseList(p.get(k))
  s.price = s.price.filter((v) => (PRICE_VALUES as readonly string[]).includes(v))
  s.season = s.season.filter((v) => (SEASON_VALUES as readonly string[]).includes(v))
  for (const k of TRI_FACETS) s[k] = parseTri(p.get(k))
  const view = p.get('view')
  s.view = view === 'table' ? 'table' : 'card'
  const sort = p.get('sort')
  if (sort) {
    const [field, dir] = sort.split('-') as [string, string | undefined]
    if ((SORT_FIELDS as readonly string[]).includes(field)) {
      s.sort = field as SortField
      s.dir = dir === 'asc' || dir === 'desc' ? dir : DEFAULT_DIR[s.sort]
    }
  }
  const id = p.get('id')
  s.id = id && /^[\w-]+$/.test(id) ? id : null
  return s
}

/** 序列化為查詢字串（不含「?」，省略預設值；鍵順序固定） */
export function serializeState(s: FilterState): string {
  const p = new URLSearchParams()
  const q = s.q.trim()
  if (q) p.set('q', q)
  for (const k of LIST_KEYS) if (s[k].length) p.set(k, s[k].join(','))
  for (const k of TRI_FACETS) if (s[k] !== 'any') p.set(k, s[k])
  if (s.view !== 'card') p.set('view', s.view)
  if (!(s.sort === 'default' && s.dir === 'asc')) p.set('sort', `${s.sort}-${s.dir}`)
  if (s.id) p.set('id', s.id)
  return p.toString()
}

/** 是否有任何篩選條件（不含排序 / 檢視 / 選取） */
export function hasActiveFilters(s: FilterState): boolean {
  return (
    s.q.trim() !== '' ||
    MULTI_FACETS.some((k) => s[k].length > 0) ||
    TRI_FACETS.some((k) => s[k] !== 'any')
  )
}
